import type { Node, Edge } from '@xyflow/svelte';
import { type NodeData, loadWorkflow } from './workflow.svelte';
import type { NodeStatus } from '$lib/types/nodes';

export interface NodeRunResult {
	nodeId: string;
	status: NodeStatus;
	startedAt?: number;
	endedAt?: number;
	output?: string;
	error?: string;
	retriesUsed?: number;
	costUsd?: number;
}

export type RunStatus = 'running' | 'done' | 'error' | 'cancelled';

export interface Run {
	id: string;
	startedAt: number;
	endedAt?: number;
	status: RunStatus;
	snapshot: {
		nodes: Node<NodeData>[];
		edges: Edge[];
	};
	results: Record<string, NodeRunResult>;
}

const STORAGE_KEY = 'claw-tree:runs';
const MAX_RUNS = 50;

export const runs = $state({
	list: [] as Run[],
	currentRunId: null as string | null,
	viewingRunId: null as string | null
});

function load() {
	if (typeof localStorage === 'undefined') return;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) {
			runs.list = parsed as Run[];
		}
	} catch {
		runs.list = [];
	}
}

function persist() {
	if (typeof localStorage === 'undefined') return;
	try {
		const toStore = runs.list.slice(-MAX_RUNS);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
	} catch {
		runs.list = runs.list.slice(-Math.floor(MAX_RUNS / 2));
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.list));
		} catch {
			// give up silently — quota exhausted
		}
	}
}

load();

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

export function createRun(nodes: Node<NodeData>[], edges: Edge[]): Run {
	const run: Run = {
		id: crypto.randomUUID(),
		startedAt: Date.now(),
		status: 'running',
		snapshot: { nodes: clone(nodes), edges: clone(edges) },
		results: Object.fromEntries(
			nodes.map((n) => [n.id, { nodeId: n.id, status: 'idle' as NodeStatus }])
		)
	};
	runs.list.push(run);
	runs.currentRunId = run.id;
	runs.viewingRunId = run.id;
	persist();
	return run;
}

export function getCurrentRun(): Run | null {
	if (!runs.currentRunId) return null;
	return runs.list.find((r) => r.id === runs.currentRunId) ?? null;
}

export function getRun(runId: string): Run | null {
	return runs.list.find((r) => r.id === runId) ?? null;
}

export function updateNodeResult(
	runId: string,
	nodeId: string,
	patch: Partial<NodeRunResult>
) {
	const run = runs.list.find((r) => r.id === runId);
	if (!run) return;
	const existing = run.results[nodeId] ?? { nodeId, status: 'idle' };
	run.results[nodeId] = { ...existing, ...patch };
	persist();
}

export function appendNodeOutput(runId: string, nodeId: string, chunk: string) {
	const run = runs.list.find((r) => r.id === runId);
	if (!run) return;
	const existing = run.results[nodeId] ?? { nodeId, status: 'running' as NodeStatus };
	run.results[nodeId] = {
		...existing,
		output: (existing.output ?? '') + chunk
	};
}

export function finalizeRun(runId: string, status: RunStatus) {
	const run = runs.list.find((r) => r.id === runId);
	if (!run) return;
	run.status = status;
	run.endedAt = Date.now();
	persist();
}

export function deleteRun(runId: string) {
	runs.list = runs.list.filter((r) => r.id !== runId);
	if (runs.viewingRunId === runId) runs.viewingRunId = null;
	if (runs.currentRunId === runId) runs.currentRunId = null;
	persist();
}

export function clearAllRuns() {
	runs.list = [];
	runs.currentRunId = null;
	runs.viewingRunId = null;
	persist();
}

export function viewRun(runId: string | null) {
	runs.viewingRunId = runId;
}

export function forkRun(runId: string): { success: true } | { success: false; error: string } {
	const run = runs.list.find((r) => r.id === runId);
	if (!run) return { success: false, error: 'Run not found' };
	if (!run.snapshot || !Array.isArray(run.snapshot.nodes) || !Array.isArray(run.snapshot.edges)) {
		return { success: false, error: 'Run snapshot is corrupted' };
	}
	return loadWorkflow({
		nodes: run.snapshot.nodes,
		edges: run.snapshot.edges
	});
}

function formatTimestamp(ts: number): string {
	const d = new Date(ts);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatMs(ms: number): string {
	if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
	return `${ms}ms`;
}

export function exportRunAsMarkdown(runId: string): string | null {
	const run = runs.list.find((r) => r.id === runId);
	if (!run) return null;

	const nodeCount = Object.keys(run.results).length;
	const duration = run.endedAt ? formatMs(run.endedAt - run.startedAt) : 'N/A';

	const labelMap = new Map<string, string>();
	for (const node of run.snapshot.nodes) {
		labelMap.set(node.id, (node.data as NodeData).label ?? node.id);
	}

	const lines: string[] = [
		'# Workflow Run Report',
		'',
		`**Run ID:** ${run.id}`,
		`**Status:** ${run.status}`,
		`**Started:** ${formatTimestamp(run.startedAt)}`,
		`**Duration:** ${duration}`,
		`**Nodes:** ${nodeCount}`
	];

	const totalCost = Object.values(run.results).reduce(
		(sum, r) => sum + (r.costUsd ?? 0),
		0
	);
	if (totalCost > 0) {
		lines.push(`**Total Cost:** $${totalCost.toFixed(4)}`);
	}

	for (const result of Object.values(run.results)) {
		const label = labelMap.get(result.nodeId) ?? result.nodeId;
		const nodeDuration =
			result.startedAt && result.endedAt
				? formatMs(result.endedAt - result.startedAt)
				: 'N/A';
		const costStr = result.costUsd != null ? `$${result.costUsd.toFixed(4)}` : 'N/A';

		lines.push('', '---', '');
		lines.push(`## Node: ${label}`);
		lines.push(`**Status:** ${result.status} | **Cost:** ${costStr} | **Duration:** ${nodeDuration}`);

		if (result.error) {
			lines.push('', '<error>', result.error, '</error>');
		}
		if (result.output) {
			lines.push('', '<output>', result.output, '</output>');
		}
	}

	lines.push('');
	return lines.join('\n');
}

export function downloadRunReport(runId: string) {
	const markdown = exportRunAsMarkdown(runId);
	if (!markdown) return;

	const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `run-${runId.slice(0, 8)}.md`;
	a.click();
	URL.revokeObjectURL(url);
}
