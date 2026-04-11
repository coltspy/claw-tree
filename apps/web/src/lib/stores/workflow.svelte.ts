import type { Node, Edge } from '@xyflow/svelte';
import type { NodeType, NodeStatus, FailurePolicy } from '$lib/types/nodes';

export interface NodeData extends Record<string, unknown> {
	label: string;
	nodeType: NodeType;
	prompt: string;
	model: string;
	path?: string;
	failurePolicy: FailurePolicy;
	retryCount?: number;
	status: NodeStatus;
	output?: string;
	error?: string;
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
	custom: { label: 'Custom Step', prompt: '' }
};

export function addNode(type: NodeType) {
	const offset = workflow.nodes.length * 40;
	const { label, prompt } = NODE_DEFAULTS[type];

	workflow.nodes.push({
		id: crypto.randomUUID(),
		type: 'default',
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
	const current = workflow.nodes[idx];
	workflow.nodes[idx] = {
		...current,
		data: { ...current.data, ...patch }
	};
}

export function removeNode(id: string) {
	workflow.nodes = workflow.nodes.filter((n) => n.id !== id);
	workflow.edges = workflow.edges.filter((e) => e.source !== id && e.target !== id);
}

export function deselectAll() {
	workflow.nodes = workflow.nodes.map((n) =>
		n.selected ? { ...n, selected: false } : n
	);
}

export function clearWorkflow() {
	workflow.nodes = [];
	workflow.edges = [];
}
