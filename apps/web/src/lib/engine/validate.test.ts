import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/svelte';
import { validateWorkflow } from './validate';
import type { NodeData } from '$lib/stores/workflow.svelte';

function node(id: string, label: string, prompt = 'do thing'): Node<NodeData> {
	return {
		id,
		type: 'default',
		position: { x: 0, y: 0 },
		data: {
			label,
			nodeType: 'custom',
			prompt,
			model: 'claude-sonnet-4-6',
			failurePolicy: 'halt',
			status: 'idle'
		}
	};
}

function edge(source: string, target: string): Edge {
	return { id: `${source}->${target}`, source, target };
}

describe('validateWorkflow', () => {
	it('reports an error for an empty workflow', () => {
		const errors = validateWorkflow([], []);
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toMatch(/empty/i);
	});

	it('returns no errors for a single valid node', () => {
		expect(validateWorkflow([node('a', 'A')], [])).toEqual([]);
	});

	it('reports an empty prompt', () => {
		const errors = validateWorkflow([node('a', 'Alpha', '   ')], []);
		expect(errors).toHaveLength(1);
		expect(errors[0].nodeId).toBe('a');
		expect(errors[0].message).toMatch(/no prompt/);
	});

	it('reports every node with an empty prompt', () => {
		const errors = validateWorkflow(
			[node('a', 'Alpha', ''), node('b', 'Beta', 'valid'), node('c', 'Gamma', '')],
			[]
		);
		const missing = errors.filter((e) => /no prompt/.test(e.message));
		expect(missing).toHaveLength(2);
		expect(missing.map((e) => e.nodeId).sort()).toEqual(['a', 'c']);
	});

	it('reports a cycle', () => {
		const errors = validateWorkflow(
			[node('a', 'A'), node('b', 'B')],
			[edge('a', 'b'), edge('b', 'a')]
		);
		expect(errors.some((e) => /cycle/i.test(e.message))).toBe(true);
	});

	it('accepts {{previous.output}} as always-valid', () => {
		const errors = validateWorkflow(
			[node('a', 'A'), node('b', 'B', 'Use {{previous.output}}')],
			[edge('a', 'b')]
		);
		expect(errors).toEqual([]);
	});

	it('accepts a template reference by node id', () => {
		const errors = validateWorkflow(
			[node('alpha', 'Alpha'), node('b', 'B', 'Use {{alpha.output}}')],
			[]
		);
		expect(errors).toEqual([]);
	});

	it('accepts a template reference by node label', () => {
		const errors = validateWorkflow(
			[node('a', 'Alpha'), node('b', 'B', 'Use {{Alpha.output}}')],
			[]
		);
		expect(errors).toEqual([]);
	});

	it('reports a reference to an unknown node', () => {
		const errors = validateWorkflow(
			[node('a', 'A', 'Use {{ghost.output}}')],
			[]
		);
		expect(errors).toHaveLength(1);
		expect(errors[0].nodeId).toBe('a');
		expect(errors[0].message).toMatch(/unknown node/);
	});

	it('surfaces multiple independent problems at once', () => {
		const errors = validateWorkflow(
			[node('a', 'A', ''), node('b', 'B', 'Use {{ghost.output}}')],
			[]
		);
		expect(errors.length).toBeGreaterThanOrEqual(2);
		expect(errors.some((e) => /no prompt/.test(e.message))).toBe(true);
		expect(errors.some((e) => /unknown node/.test(e.message))).toBe(true);
	});
});
