import type { RequestHandler } from './$types';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { error } from '@sveltejs/kit';

const DEFAULT_BIN = process.platform === 'win32'
	? resolve(process.cwd(), '../../rust/target/debug/claw.exe')
	: resolve(process.cwd(), '../../rust/target/debug/claw');

const CLAW_BIN = process.env.CLAW_BIN ?? DEFAULT_BIN;

const ANSI_CSI = /\u001b\[[0-9;?]*[a-zA-Z]/g;
const ANSI_DEC = /\u001b[78]/g;

function stripAnsi(text: string): string {
	return text.replace(ANSI_CSI, '').replace(ANSI_DEC, '');
}

interface RunBody {
	prompt: string;
	model?: string;
	permissionMode?: 'read-only' | 'workspace-write' | 'danger-full-access';
	allowedTools?: string[];
	outputFormat?: 'text' | 'json';
	resumeSessionId?: string;
	anthropicApiKey?: string;
	openaiApiKey?: string;
}

const META_MARKER = '<<<CLAW_TREE_META>>>';
const SESSION_RE = /\[claw-tree-session\]\s+(\S+)/;
const USAGE_RE =
	/\[claw-tree-usage\]\s+cost_usd=\$?([\d.]+)\s+input_tokens=(\d+)\s+output_tokens=(\d+)/;

interface ClawMeta {
	sessionId?: string;
	costUsd?: number;
	inputTokens?: number;
	outputTokens?: number;
}

function parseMetaFromStderr(stderr: string): ClawMeta {
	const meta: ClawMeta = {};
	const session = stderr.match(SESSION_RE);
	if (session) meta.sessionId = session[1];
	const usage = stderr.match(USAGE_RE);
	if (usage) {
		meta.costUsd = parseFloat(usage[1]);
		meta.inputTokens = parseInt(usage[2], 10);
		meta.outputTokens = parseInt(usage[3], 10);
	}
	return meta;
}

export const POST: RequestHandler = async ({ request }) => {
	let body: RunBody;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	if (!body.prompt || typeof body.prompt !== 'string') {
		error(400, 'prompt must be a non-empty string');
	}

	const args = ['--print', '--model', body.model ?? 'claude-sonnet-4-6'];

	if (body.outputFormat === 'json') {
		args.push('--output-format', 'json');
	}
	if (body.permissionMode) {
		args.push('--permission-mode', body.permissionMode);
	}
	if (body.allowedTools && body.allowedTools.length > 0) {
		args.push('--allowedTools', body.allowedTools.join(','));
	}

	args.push('-p', body.prompt);

	if (body.resumeSessionId) {
		args.push('--resume', body.resumeSessionId);
	}

	const childEnv: NodeJS.ProcessEnv = { ...process.env };
	if (body.anthropicApiKey) childEnv.ANTHROPIC_API_KEY = body.anthropicApiKey;
	if (body.openaiApiKey) childEnv.OPENAI_API_KEY = body.openaiApiKey;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const child = spawn(CLAW_BIN, args, {
				stdio: ['ignore', 'pipe', 'pipe'],
				env: childEnv
			});

			const encoder = new TextEncoder();
			let stdoutBuffer = '';
			let stderrBuffer = '';
			let closed = false;

			const safeEnqueue = (data: Uint8Array) => {
				if (closed) return;
				try {
					controller.enqueue(data);
				} catch {
					closed = true;
				}
			};

			const safeClose = () => {
				if (closed) return;
				closed = true;
				try {
					controller.close();
				} catch {
					// controller may already be closed by an upstream abort
				}
			};

			const processStdout = (text: string): string => {
				stdoutBuffer += text;
				stdoutBuffer = stdoutBuffer.replace(/\u001b7[\s\S]*?\u001b8/g, '');
				const pendingIdx = stdoutBuffer.lastIndexOf('\u001b7');
				const emit = pendingIdx === -1 ? stdoutBuffer : stdoutBuffer.slice(0, pendingIdx);
				stdoutBuffer = pendingIdx === -1 ? '' : stdoutBuffer.slice(pendingIdx);
				return stripAnsi(emit);
			};

			child.stdout.on('data', (chunk: Buffer) => {
				if (closed) return;
				const clean = processStdout(chunk.toString('utf8'));
				if (clean.length > 0) {
					safeEnqueue(encoder.encode(clean));
				}
			});

			child.stderr.on('data', (chunk: Buffer) => {
				stderrBuffer += stripAnsi(chunk.toString('utf8'));
			});

			child.on('error', (err) => {
				safeEnqueue(
					encoder.encode(`\n[spawn error] ${err.message}\nTried: ${CLAW_BIN}\n`)
				);
				safeClose();
			});

			child.on('close', (code) => {
				if (stdoutBuffer.length > 0) {
					const flushed = stripAnsi(
						stdoutBuffer.replace(/\u001b7[\s\S]*?\u001b8/g, '')
					);
					if (flushed.length > 0) safeEnqueue(encoder.encode(flushed));
					stdoutBuffer = '';
				}
				const meta = parseMetaFromStderr(stderrBuffer);
				safeEnqueue(encoder.encode(`\n${META_MARKER}${JSON.stringify(meta)}\n`));
				if (code !== 0 && code !== null) {
					const info = stderrBuffer
						.replace(SESSION_RE, '')
						.replace(USAGE_RE, '')
						.trim();
					safeEnqueue(
						encoder.encode(`\n[exit ${code}]${info ? `: ${info}` : ''}`)
					);
				}
				safeClose();
			});

			request.signal.addEventListener('abort', () => {
				closed = true;
				child.kill();
			});
		},
		cancel() {
			// consumer cancelled — the abort listener above handles child cleanup
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'no-cache',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
