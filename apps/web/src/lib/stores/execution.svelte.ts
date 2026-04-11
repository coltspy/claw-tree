import { workflow, updateNodeData, type NodeData, type EdgeData } from './workflow.svelte';
import {
	createRun,
	finalizeRun,
	updateNodeResult,
	type Run
} from './runs.svelte';
import { topologicalSort, groupByDepth } from '$lib/engine/toposort';
import { validateWorkflow, type ValidationError } from '$lib/engine/validate';
import { interpolatePrompt } from '$lib/engine/interpolate';
import { evaluateCondition, ConditionError } from '$lib/engine/conditions';
import type { Node, Edge } from '@xyflow/svelte';

export interface PendingApproval {
	nodeId: string;
	label: string;
	prompt: string;
	resolve: (approved: boolean) => void;
}

export const execution = $state({
	running: false,
	errors: [] as ValidationError[],
	activeNodeIds: new Set<string>(),
	pendingApproval: null as PendingApproval | null
});

let abortController: AbortController | null = null;

const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 10_000;

export async function runWorkflow() {
	if (execution.running) return;

	const errors = validateWorkflow(workflow.nodes, workflow.edges);
	if (errors.length > 0) {
		execution.errors = errors;
		return;
	}

	execution.errors = [];
	execution.running = true;
	execution.activeNodeIds = new Set();
	execution.pendingApproval = null;
	abortController = new AbortController();

	for (const n of workflow.nodes) {
		updateNodeData(n.id, {
			status: 'idle',
			output: undefined,
			error: undefined,
			costUsd: undefined,
			inputTokens: undefined,
			outputTokens: undefined
		});
	}

	const run = createRun(workflow.nodes, workflow.edges);
	let haltRequested = false;

	try {
		const order = topologicalSort(workflow.nodes, workflow.edges);
		const depthGroups = groupByDepth(order, workflow.edges);
		const skipped = new Set<string>();

		for (const group of depthGroups) {
			if (abortController.signal.aborted || haltRequested) break;

			const toRun: Node<NodeData>[] = [];
			for (const node of group) {
				if (isNodeEnabled(node, workflow.edges, run, skipped)) {
					toRun.push(node);
				} else {
					skipped.add(node.id);
					updateNodeData(node.id, { status: 'skipped' });
					updateNodeResult(run.id, node.id, {
						status: 'skipped',
						endedAt: Date.now()
					});
				}
			}

			const outcomes = await Promise.all(
				toRun.map((node) => executeNode(node, order, run.id))
			);

			for (let i = 0; i < outcomes.length; i++) {
				if (outcomes[i] === 'halt') {
					const remainingIds = new Set<string>();
					let started = false;
					for (const g of depthGroups) {
						if (g === group) {
							started = true;
							continue;
						}
						if (!started) continue;
						for (const rn of g) remainingIds.add(rn.id);
					}
					for (const rid of remainingIds) {
						updateNodeData(rid, { status: 'cancelled' });
						updateNodeResult(run.id, rid, {
							status: 'cancelled',
							endedAt: Date.now()
						});
					}
					haltRequested = true;
					break;
				}
			}
		}
	} finally {
		const cancelled = abortController.signal.aborted;
		execution.running = false;
		execution.activeNodeIds = new Set();
		execution.pendingApproval = null;

		const anyError = Object.values(run.results).some((r) => r.status === 'error');
		const finalStatus: Run['status'] = cancelled
			? 'cancelled'
			: anyError
				? 'error'
				: 'done';
		finalizeRun(run.id, finalStatus);
		abortController = null;
	}
}

function isNodeEnabled(
	node: Node<NodeData>,
	edges: Edge[],
	run: Run,
	skipped: Set<string>
): boolean {
	const incoming = edges.filter((e) => e.target === node.id);
	if (incoming.length === 0) return true;

	for (const edge of incoming) {
		if (skipped.has(edge.source)) continue;
		const sourceResult = run.results[edge.source];
		if (!sourceResult || sourceResult.status !== 'done') continue;

		const condition = (edge.data as EdgeData | undefined)?.condition;
		if (!condition) return true;

		try {
			const passed = evaluateCondition(condition, {
				output: sourceResult.output ?? '',
				status: sourceResult.status,
				error: sourceResult.error
			});
			if (passed) return true;
		} catch (err) {
			if (err instanceof ConditionError) continue;
			throw err;
		}
	}
	return false;
}

type NodeOutcome = 'done' | 'skip' | 'halt' | 'cancelled';

async function executeNode(
	node: Node<NodeData>,
	fullOrder: Node<NodeData>[],
	runId: string
): Promise<NodeOutcome> {
	if (abortController?.signal.aborted) {
		updateNodeData(node.id, { status: 'cancelled' });
		updateNodeResult(runId, node.id, {
			status: 'cancelled',
			endedAt: Date.now()
		});
		return 'cancelled';
	}

	const fresh = workflow.nodes.find((n) => n.id === node.id);
	if (!fresh) return 'done';

	if (fresh.data.nodeType === 'pause') {
		return executePauseNode(fresh, runId);
	}

	addActive(node.id);
	updateNodeData(node.id, { status: 'running', output: '' });
	updateNodeResult(runId, node.id, {
		status: 'running',
		startedAt: Date.now(),
		output: ''
	});

	const resolvedPrompt = interpolatePrompt(
		fresh.data.prompt,
		fresh,
		workflow.nodes,
		fullOrder
	);

	const maxAttempts =
		fresh.data.failurePolicy === 'retry'
			? Math.max(1, fresh.data.retryCount ?? 1) + 1
			: 1;

	let lastError: Error | null = null;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		if (abortController?.signal.aborted) break;

		if (attempt > 0) {
			const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (attempt - 1));
			await sleep(delay, abortController?.signal);
			if (abortController?.signal.aborted) break;
			updateNodeData(node.id, { output: '' });
		}

		try {
			const result = await streamNode(
				node.id,
				runId,
				resolvedPrompt,
				fresh.data,
				abortController!.signal
			);
			updateNodeData(node.id, {
				status: 'done',
				output: result.output,
				costUsd: result.costUsd,
				inputTokens: result.inputTokens,
				outputTokens: result.outputTokens
			});
			updateNodeResult(runId, node.id, {
				status: 'done',
				endedAt: Date.now(),
				output: result.output,
				retriesUsed: attempt
			});
			removeActive(node.id);
			return 'done';
		} catch (err) {
			if (abortController?.signal.aborted) break;
			lastError = err instanceof Error ? err : new Error(String(err));
		}
	}

	removeActive(node.id);

	if (abortController?.signal.aborted) {
		updateNodeData(node.id, { status: 'cancelled' });
		updateNodeResult(runId, node.id, {
			status: 'cancelled',
			endedAt: Date.now()
		});
		return 'cancelled';
	}

	const message = lastError?.message ?? 'Unknown error';
	const policy = fresh.data.failurePolicy;

	if (policy === 'skip') {
		updateNodeData(node.id, { status: 'skipped', error: message });
		updateNodeResult(runId, node.id, {
			status: 'skipped',
			endedAt: Date.now(),
			error: message,
			retriesUsed: maxAttempts - 1
		});
		return 'skip';
	}

	updateNodeData(node.id, { status: 'error', error: message });
	updateNodeResult(runId, node.id, {
		status: 'error',
		endedAt: Date.now(),
		error: message,
		retriesUsed: maxAttempts - 1
	});
	return 'halt';
}

async function executePauseNode(
	node: Node<NodeData>,
	runId: string
): Promise<NodeOutcome> {
	addActive(node.id);
	updateNodeData(node.id, { status: 'running', output: '' });
	updateNodeResult(runId, node.id, {
		status: 'running',
		startedAt: Date.now()
	});

	const approved = await new Promise<boolean>((resolve) => {
		execution.pendingApproval = {
			nodeId: node.id,
			label: node.data.label,
			prompt: node.data.prompt,
			resolve
		};

		const onAbort = () => {
			if (execution.pendingApproval?.nodeId === node.id) {
				execution.pendingApproval = null;
				resolve(false);
			}
		};
		abortController?.signal.addEventListener('abort', onAbort, { once: true });
	});

	execution.pendingApproval = null;
	removeActive(node.id);

	if (abortController?.signal.aborted) {
		updateNodeData(node.id, { status: 'cancelled' });
		updateNodeResult(runId, node.id, {
			status: 'cancelled',
			endedAt: Date.now()
		});
		return 'cancelled';
	}

	if (approved) {
		const message = 'Approved by user';
		updateNodeData(node.id, { status: 'done', output: message });
		updateNodeResult(runId, node.id, {
			status: 'done',
			endedAt: Date.now(),
			output: message
		});
		return 'done';
	}

	const message = 'Rejected by user';
	const policy = node.data.failurePolicy;
	if (policy === 'skip') {
		updateNodeData(node.id, { status: 'skipped', error: message });
		updateNodeResult(runId, node.id, {
			status: 'skipped',
			endedAt: Date.now(),
			error: message
		});
		return 'skip';
	}

	updateNodeData(node.id, { status: 'error', error: message });
	updateNodeResult(runId, node.id, {
		status: 'error',
		endedAt: Date.now(),
		error: message
	});
	return 'halt';
}

export function approvePause() {
	execution.pendingApproval?.resolve(true);
}

export function rejectPause() {
	execution.pendingApproval?.resolve(false);
}

function addActive(nodeId: string) {
	const next = new Set(execution.activeNodeIds);
	next.add(nodeId);
	execution.activeNodeIds = next;
}

function removeActive(nodeId: string) {
	const next = new Set(execution.activeNodeIds);
	next.delete(nodeId);
	execution.activeNodeIds = next;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new DOMException('Aborted', 'AbortError'));
			return;
		}
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			signal?.removeEventListener('abort', onAbort);
			reject(new DOMException('Aborted', 'AbortError'));
		};
		signal?.addEventListener('abort', onAbort);
	});
}

interface StreamResult {
	output: string;
	costUsd?: number;
	inputTokens?: number;
	outputTokens?: number;
}

async function streamNode(
	nodeId: string,
	runId: string,
	prompt: string,
	nodeData: NodeData,
	signal: AbortSignal
): Promise<StreamResult> {
	const response = await fetch('/api/run', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			prompt,
			model: nodeData.model,
			permissionMode: nodeData.permissionMode,
			allowedTools: nodeData.allowedTools,
			outputFormat: nodeData.outputFormat
		}),
		signal
	});

	if (!response.ok) {
		const text = await response.text().catch(() => '');
		throw new Error(`Server ${response.status}: ${text || response.statusText}`);
	}

	const reader = response.body?.getReader();
	if (!reader) throw new Error('Server returned no response body');

	const decoder = new TextDecoder();
	let accumulated = '';

	for (;;) {
		const { value, done } = await reader.read();
		if (done) break;
		accumulated += decoder.decode(value, { stream: true });
		updateNodeData(nodeId, { output: accumulated });
		updateNodeResult(runId, nodeId, { output: accumulated });
	}

	if (nodeData.outputFormat === 'json') {
		return parseJsonOutput(accumulated);
	}

	return { output: accumulated.trim() };
}

function parseJsonOutput(raw: string): StreamResult {
	const trimmed = raw.trim();
	try {
		const parsed = JSON.parse(trimmed);
		const message: string =
			typeof parsed.message === 'string' ? parsed.message : trimmed;
		const inputTokens =
			typeof parsed.usage?.input_tokens === 'number'
				? parsed.usage.input_tokens
				: undefined;
		const outputTokens =
			typeof parsed.usage?.output_tokens === 'number'
				? parsed.usage.output_tokens
				: undefined;
		const costRaw = parsed.estimated_cost;
		let costUsd: number | undefined;
		if (typeof costRaw === 'string') {
			const match = costRaw.match(/[\d.]+/);
			if (match) costUsd = parseFloat(match[0]);
		} else if (typeof costRaw === 'number') {
			costUsd = costRaw;
		}
		return { output: message, costUsd, inputTokens, outputTokens };
	} catch {
		return { output: trimmed };
	}
}

export function cancelWorkflow() {
	abortController?.abort();
}
