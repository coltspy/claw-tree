import type { Node, Edge } from '@xyflow/svelte';
import type {
	NodeType,
	NodeStatus,
	FailurePolicy,
	ClawPermissionMode,
	ClawTool,
	OutputFormat
} from '$lib/types/nodes';

export interface NodeData extends Record<string, unknown> {
	label: string;
	nodeType: NodeType;
	prompt: string;
	model: string;
	path?: string;
	failurePolicy: FailurePolicy;
	retryCount?: number;
	permissionMode?: ClawPermissionMode;
	allowedTools?: ClawTool[];
	outputFormat?: OutputFormat;
	status: NodeStatus;
	output?: string;
	error?: string;
	costUsd?: number;
	inputTokens?: number;
	outputTokens?: number;
}

export interface EdgeData extends Record<string, unknown> {
	condition?: string;
}

export const workflow = $state({
	nodes: [] as Node<NodeData>[],
	edges: [] as Edge[]
});

const DEFAULT_MODEL = 'claude-sonnet-4-6';

const NODE_DEFAULTS: Record<NodeType, { label: string; prompt: string }> = {
	security: { label: 'Security Scan', prompt: 'Run a security audit on ' },
	test: { label: 'Run Tests', prompt: 'Run the test suite and report pass/fail' },
	review: { label: 'Review', prompt: 'Review the output: {{previous.output}}' },
	confirm: { label: 'Confirm', prompt: 'Verify that {{previous.output}} is correct' },
	custom: { label: 'Custom Step', prompt: '' },
	pause: {
		label: 'Pause',
		prompt: 'Review the output of the previous node and decide whether to continue.'
	}
};

const STATE_ONLY_KEYS: (keyof NodeData)[] = [
	'status',
	'output',
	'error',
	'costUsd',
	'inputTokens',
	'outputTokens'
];

function isStateOnlyPatch(patch: Partial<NodeData>): boolean {
	const keys = Object.keys(patch) as (keyof NodeData)[];
	return keys.length > 0 && keys.every((k) => STATE_ONLY_KEYS.includes(k));
}

let recordHistoryHook: (() => void) | null = null;
let recordHistoryDebouncedHook: (() => void) | null = null;

export function setHistoryHooks(
	immediate: () => void,
	debounced: () => void
) {
	recordHistoryHook = immediate;
	recordHistoryDebouncedHook = debounced;
}

export function addNode(type: NodeType) {
	recordHistoryHook?.();
	const offset = workflow.nodes.length * 40;
	const { label, prompt } = NODE_DEFAULTS[type];

	workflow.nodes.push({
		id: crypto.randomUUID(),
		type: 'workflow',
		position: { x: 160 + offset, y: 140 + offset },
		data: {
			label,
			nodeType: type,
			prompt,
			model: DEFAULT_MODEL,
			failurePolicy: 'halt',
			status: 'idle'
		}
	});
}

export function updateNodeData(id: string, patch: Partial<NodeData>) {
	const idx = workflow.nodes.findIndex((n) => n.id === id);
	if (idx === -1) return;
	if (!isStateOnlyPatch(patch)) {
		recordHistoryDebouncedHook?.();
	}
	const current = workflow.nodes[idx];
	workflow.nodes[idx] = {
		...current,
		data: { ...current.data, ...patch }
	};
}

export function removeNode(id: string) {
	recordHistoryHook?.();
	workflow.nodes = workflow.nodes.filter((n) => n.id !== id);
	workflow.edges = workflow.edges.filter((e) => e.source !== id && e.target !== id);
}

export function deselectAll() {
	workflow.nodes = workflow.nodes.map((n) =>
		n.selected ? { ...n, selected: false } : n
	);
	workflow.edges = workflow.edges.map((e) =>
		e.selected ? { ...e, selected: false } : e
	);
}

export function clearWorkflow() {
	recordHistoryHook?.();
	workflow.nodes = [];
	workflow.edges = [];
}

export type LoadResult = { success: true } | { success: false; error: string };

export function loadWorkflow(data: unknown): LoadResult {
	if (!data || typeof data !== 'object') {
		return { success: false, error: 'File is not a valid workflow object' };
	}

	const maybe = data as { nodes?: unknown; edges?: unknown };
	if (!Array.isArray(maybe.nodes) || !Array.isArray(maybe.edges)) {
		return { success: false, error: 'File is missing "nodes" or "edges" arrays' };
	}

	for (const n of maybe.nodes) {
		if (
			!n ||
			typeof n !== 'object' ||
			typeof (n as { id?: unknown }).id !== 'string' ||
			typeof (n as { data?: unknown }).data !== 'object'
		) {
			return { success: false, error: 'File contains a malformed node' };
		}
	}

	recordHistoryHook?.();
	workflow.nodes = (maybe.nodes as Node<NodeData>[]).map((n) => ({
		...n,
		selected: false,
		data: { ...n.data, status: 'idle', output: undefined, error: undefined }
	}));
	workflow.edges = (maybe.edges as Edge[]).map((e) => ({ ...e, selected: false }));

	return { success: true };
}
