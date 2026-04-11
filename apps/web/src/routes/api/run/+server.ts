import type { RequestHandler } from './$types';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { error } from '@sveltejs/kit';

const DEFAULT_BIN = process.platform === 'win32'
	? resolve(process.cwd(), '../../rust/target/debug/claw.exe')
	: resolve(process.cwd(), '../../rust/target/debug/claw');

const CLAW_BIN = process.env.CLAW_BIN ?? DEFAULT_BIN;

interface RunBody {
	prompt: string;
	model?: string;
	permissionMode?: 'read-only' | 'workspace-write' | 'danger-full-access';
	allowedTools?: string[];
	outputFormat?: 'text' | 'json';
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

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const child = spawn(CLAW_BIN, args, {
				stdio: ['ignore', 'pipe', 'pipe']
			});

			const encoder = new TextEncoder();

			child.stdout.on('data', (chunk: Buffer) => {
				controller.enqueue(new Uint8Array(chunk));
			});

			child.stderr.on('data', (chunk: Buffer) => {
				controller.enqueue(encoder.encode(`[stderr] ${chunk.toString()}`));
			});

			child.on('error', (err) => {
				controller.enqueue(
					encoder.encode(`\n[spawn error] ${err.message}\nTried: ${CLAW_BIN}\n`)
				);
				controller.close();
			});

			child.on('close', (code) => {
				if (code !== 0 && code !== null) {
					controller.enqueue(encoder.encode(`\n[exit ${code}]`));
				}
				controller.close();
			});

			request.signal.addEventListener('abort', () => {
				child.kill();
			});
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
