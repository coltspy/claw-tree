import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/svelte';
import { topologicalSort, CycleError } from './toposort';

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
