import { workflow, loadWorkflow, clearWorkflow, type NodeData } from './workflow.svelte';
import type { Node, Edge } from '@xyflow/svelte';

const STORAGE_KEY = 'claw-tree:library';

export interface SavedWorkflow {
	id: string;
	name: string;
	nodes: Node<NodeData>[];
	edges: Edge[];
	createdAt: number;
	updatedAt: number;
}

function load(): SavedWorkflow[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export const library = $state({
	workflows: load() as SavedWorkflow[],
	activeId: null as string | null
});

function persist() {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(library.workflows));
	} catch {
		// quota full — evict oldest half
		library.workflows = library.workflows
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.slice(0, Math.max(10, Math.floor(library.workflows.length / 2)));
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(library.workflows));
		} catch {
			// give up
		}
	}
}

export function saveCurrentWorkflow(name?: string) {
	if (workflow.nodes.length === 0 && !library.activeId) return;

	const now = Date.now();

	if (library.activeId) {
		const idx = library.workflows.findIndex((w) => w.id === library.activeId);
		if (idx !== -1) {
			library.workflows[idx] = {
				...library.workflows[idx],
				name: name ?? library.workflows[idx].name,
				nodes: JSON.parse(JSON.stringify(workflow.nodes)),
				edges: JSON.parse(JSON.stringify(workflow.edges)),
				updatedAt: now
			};
			persist();
			return;
		}
	}

	const id = crypto.randomUUID();
	const defaultName =
		name ??
		(workflow.nodes.length > 0
			? workflow.nodes[0].data.label
			: `Workflow ${library.workflows.length + 1}`);

	library.workflows.push({
		id,
		name: defaultName,
		nodes: JSON.parse(JSON.stringify(workflow.nodes)),
		edges: JSON.parse(JSON.stringify(workflow.edges)),
		createdAt: now,
		updatedAt: now
	});
	library.activeId = id;
	persist();
}

export function loadSavedWorkflow(id: string) {
	if (library.activeId && workflow.nodes.length > 0) {
		saveCurrentWorkflow();
	}

	const saved = library.workflows.find((w) => w.id === id);
	if (!saved) return;

	loadWorkflow({ nodes: saved.nodes, edges: saved.edges });
	library.activeId = id;
}

export function deleteSavedWorkflow(id: string) {
	library.workflows = library.workflows.filter((w) => w.id !== id);
	if (library.activeId === id) library.activeId = null;
	persist();
}

export function renameSavedWorkflow(id: string, name: string) {
	const wf = library.workflows.find((w) => w.id === id);
	if (wf) {
		wf.name = name;
		wf.updatedAt = Date.now();
		persist();
	}
}

export function newWorkflow() {
	if (library.activeId && workflow.nodes.length > 0) {
		saveCurrentWorkflow();
	}
	clearWorkflow();
	library.activeId = null;
}

export function importExampleWorkflow(data: { nodes: unknown[]; edges: unknown[] }, name: string) {
	loadWorkflow(data);
	const now = Date.now();
	const id = crypto.randomUUID();
	library.workflows.push({
		id,
		name,
		nodes: JSON.parse(JSON.stringify(workflow.nodes)),
		edges: JSON.parse(JSON.stringify(workflow.edges)),
		createdAt: now,
		updatedAt: now
	});
	library.activeId = id;
	persist();
}
