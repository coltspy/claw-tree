import type { Node, Edge } from '@xyflow/svelte';
import { workflow, type NodeData } from './workflow.svelte';

interface Snapshot {
	nodes: Node<NodeData>[];
	edges: Edge[];
}

const MAX_HISTORY = 50;

export const history = $state({
	past: [] as Snapshot[],
	future: [] as Snapshot[]
});

let lastRecorded = 0;

function snapshot(): Snapshot {
	return {
		nodes: JSON.parse(JSON.stringify(workflow.nodes)) as Node<NodeData>[],
		edges: JSON.parse(JSON.stringify(workflow.edges)) as Edge[]
	};
}

export function recordHistory() {
	history.past.push(snapshot());
	if (history.past.length > MAX_HISTORY) {
		history.past.shift();
	}
	history.future = [];
	lastRecorded = Date.now();
}

export function recordHistoryDebounced(cooldownMs = 500) {
	const now = Date.now();
	if (now - lastRecorded < cooldownMs) return;
	recordHistory();
}

export function undo() {
	const prev = history.past.pop();
	if (!prev) return;
	history.future.push(snapshot());
	workflow.nodes = prev.nodes;
	workflow.edges = prev.edges;
}

export function redo() {
	const next = history.future.pop();
	if (!next) return;
	history.past.push(snapshot());
	if (history.past.length > MAX_HISTORY) {
		history.past.shift();
	}
	workflow.nodes = next.nodes;
	workflow.edges = next.edges;
}

export function canUndo(): boolean {
	return history.past.length > 0;
}

export function canRedo(): boolean {
	return history.future.length > 0;
}

export function clearHistory() {
	history.past = [];
	history.future = [];
	lastRecorded = 0;
}
