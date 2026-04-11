import type { Node, Edge } from '@xyflow/svelte';

export class CycleError extends Error {
	constructor() {
		super('Workflow contains a cycle');
		this.name = 'CycleError';
	}
}

export function groupByDepth<T extends Record<string, unknown>>(
	ordered: Node<T>[],
	edges: Edge[]
): Node<T>[][] {
	const byId = new Map(ordered.map((n) => [n.id, n]));
	const depth = new Map<string, number>();
	const incoming = new Map<string, string[]>();

	for (const n of ordered) incoming.set(n.id, []);
	for (const e of edges) {
		if (!byId.has(e.source) || !byId.has(e.target)) continue;
		incoming.get(e.target)!.push(e.source);
	}

	for (const n of ordered) {
		const deps = incoming.get(n.id) ?? [];
		const max = deps.length === 0 ? -1 : Math.max(...deps.map((id) => depth.get(id) ?? 0));
		depth.set(n.id, max + 1);
	}

	const maxDepth = Math.max(0, ...Array.from(depth.values()));
	const groups: Node<T>[][] = [];
	for (let d = 0; d <= maxDepth; d++) {
		groups.push(ordered.filter((n) => depth.get(n.id) === d));
	}
	return groups.filter((g) => g.length > 0);
}

export function topologicalSort<T extends Record<string, unknown>>(
	nodes: Node<T>[],
	edges: Edge[]
): Node<T>[] {
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const incoming = new Map<string, Set<string>>();
	const outgoing = new Map<string, Set<string>>();

	for (const n of nodes) {
		incoming.set(n.id, new Set());
		outgoing.set(n.id, new Set());
	}

	for (const e of edges) {
		if (!byId.has(e.source) || !byId.has(e.target)) continue;
		incoming.get(e.target)!.add(e.source);
		outgoing.get(e.source)!.add(e.target);
	}

	const ordered: Node<T>[] = [];
	const ready: string[] = [];

	for (const [id, deps] of incoming) {
		if (deps.size === 0) ready.push(id);
	}

	while (ready.length > 0) {
		const id = ready.shift()!;
		ordered.push(byId.get(id)!);
		for (const downstream of outgoing.get(id) ?? []) {
			const deps = incoming.get(downstream)!;
			deps.delete(id);
			if (deps.size === 0) ready.push(downstream);
		}
	}

	if (ordered.length !== nodes.length) {
		throw new CycleError();
	}

	return ordered;
}
