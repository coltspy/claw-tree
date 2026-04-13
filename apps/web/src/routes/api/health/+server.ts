import type { RequestHandler } from './$types';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { json } from '@sveltejs/kit';

const DEFAULT_BIN =
	process.platform === 'win32'
		? resolve(process.cwd(), '../../rust/target/debug/claw.exe')
		: resolve(process.cwd(), '../../rust/target/debug/claw');

const CLAW_BIN = process.env.CLAW_BIN ?? DEFAULT_BIN;
const HEALTH_TIMEOUT_MS = 5000;

export const GET: RequestHandler = async () => {
	try {
		const version = await runClawVersion();
		return json({ ok: true, version, bin: CLAW_BIN, workspace: process.env.CLAW_TREE_WORKSPACE ?? null });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return json(
			{ ok: false, error: message, bin: CLAW_BIN },
			{ status: 503 }
		);
	}
};

function runClawVersion(): Promise<string> {
	return new Promise((res, rej) => {
		const child = spawn(CLAW_BIN, ['--version'], {
			stdio: ['ignore', 'pipe', 'pipe']
		});

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		const timer = setTimeout(() => {
			child.kill();
			rej(new Error(`claw --version timed out after ${HEALTH_TIMEOUT_MS}ms`));
		}, HEALTH_TIMEOUT_MS);

		child.on('error', (err) => {
			clearTimeout(timer);
			rej(err);
		});

		child.on('close', (code) => {
			clearTimeout(timer);
			if (code !== 0) {
				rej(new Error(`exited ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
				return;
			}
			const match = stdout.match(/Version\s+(\S+)/);
			res(match?.[1] ?? (stdout.trim() || 'unknown'));
		});
	});
}
