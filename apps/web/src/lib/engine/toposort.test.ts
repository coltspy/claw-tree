import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/svelte';
import { topologicalSort, groupByDepth, CycleError } from './toposort';

type Data = Record<string, unknown>;

function node(id: string): Node<Data> {
	return { id, type: 'default', position: { x: 0, y: 0 }, data: { label: id } };
}

function edge(source: string, target: string): Edge {
	return { id: `${source}->${target}`, source, target };
}

function order(nodes: Node<Data>[]): string[] {
	return nodes.map((n) => n.id);
}

describe('topologicalSort', () => {
	it('returns empty array for empty input', () => {
		expect(topologicalSort<Data>([], [])).toEqual([]);
	});

	it('returns a single node unchanged', () => {
		const result = topologicalSort([node('a')], []);
		expect(order(result)).toEqual(['a']);
	});

	it('orders a linear chain by dependency', () => {
		const result = topologicalSort(
			[node('c'), node('a'), node('b')],
			[edge('a', 'b'), edge('b', 'c')]
		);
		expect(order(result)).toEqual(['a', 'b', 'c']);
	});

	it('handles a diamond: root first, join last', () => {
		const result = topologicalSort(
			[node('a'), node('b'), node('c'), node('d')],
			[edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')]
		);
		const ids = order(result);
		expect(ids[0]).toBe('a');
		expect(ids.at(-1)).toBe('d');
		expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('d'));
		expect(ids.indexOf('c')).toBeLessThan(ids.indexOf('d'));
	});

	it('keeps disconnected nodes in the output', () => {
		const result = topologicalSort([node('a'), node('b'), node('c')], []);
		expect(order(result).sort()).toEqual(['a', 'b', 'c']);
	});

	it('throws CycleError on a simple two-node cycle', () => {
		expect(() =>
			topologicalSort([node('a'), node('b')], [edge('a', 'b'), edge('b', 'a')])
		).toThrow(CycleError);
	});

	it('throws CycleError on a three-node cycle', () => {
		expect(() =>
			topologicalSort(
				[node('a'), node('b'), node('c')],
				[edge('a', 'b'), edge('b', 'c'), edge('c', 'a')]
			)
		).toThrow(CycleError);
	});

	it('throws CycleError on a self-loop', () => {
		expect(() => topologicalSort([node('a')], [edge('a', 'a')])).toThrow(CycleError);
	});

	it('ignores edges that reference nonexistent nodes', () => {
		const result = topologicalSort([node('a'), node('b')], [edge('a', 'ghost'), edge('a', 'b')]);
		const ids = order(result);
		expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'));
		expect(ids).toHaveLength(2);
	});
});

describe('groupByDepth', () => {
	it('returns an empty array for empty input', () => {
		expect(groupByDepth<Data>([], [])).toEqual([]);
	});

	it('puts a single node at depth 0', () => {
		const ordered = topologicalSort([node('a')], []);
		const groups = groupByDepth(ordered, []);
		expect(groups).toHaveLength(1);
		expect(order(groups[0])).toEqual(['a']);
	});

	it('puts independent nodes in the same group', () => {
		const ordered = topologicalSort([node('a'), node('b'), node('c')], []);
		const groups = groupByDepth(ordered, []);
		expect(groups).toHaveLength(1);
		expect(groups[0].map((n) => n.id).sort()).toEqual(['a', 'b', 'c']);
	});

	it('places each node in a separate group for a linear chain', () => {
		const edges = [edge('a', 'b'), edge('b', 'c')];
		const ordered = topologicalSort([node('a'), node('b'), node('c')], edges);
		const groups = groupByDepth(ordered, edges);
		expect(groups.map((g) => g.map((n) => n.id))).toEqual([['a'], ['b'], ['c']]);
	});

	it('groups diamond nodes correctly: root, parallel middle, join', () => {
		const edges = [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')];
		const ordered = topologicalSort([node('a'), node('b'), node('c'), node('d')], edges);
		const groups = groupByDepth(ordered, edges);
		expect(groups).toHaveLength(3);
		expect(groups[0].map((n) => n.id)).toEqual(['a']);
		expect(groups[1].map((n) => n.id).sort()).toEqual(['b', 'c']);
		expect(groups[2].map((n) => n.id)).toEqual(['d']);
	});

	it('handles mixed connected + disconnected nodes', () => {
		const edges = [edge('a', 'b')];
		const ordered = topologicalSort([node('a'), node('b'), node('c')], edges);
		const groups = groupByDepth(ordered, edges);
		const depth0Ids = groups[0].map((n) => n.id).sort();
		expect(depth0Ids).toEqual(['a', 'c']);
		expect(groups[1].map((n) => n.id)).toEqual(['b']);
	});
});
