import { describe, it, expect } from 'vitest';
import type { Node } from '@xyflow/svelte';
import { interpolatePrompt, extractReferences } from './interpolate';
import type { NodeData } from '$lib/stores/workflow.svelte';

function node(id: string, label: string, output?: string): Node<NodeData> {
	return {
		id,
		type: 'default',
		position: { x: 0, y: 0 },
		data: {
			label,
			nodeType: 'custom',
			prompt: '',
			model: 'claude-sonnet-4-6',
			failurePolicy: 'halt',
			status: output ? 'done' : 'idle',
			output
		}
	};
}

describe('extractReferences', () => {
	it('returns an empty array when there are no references', () => {
		expect(extractReferences('plain prompt')).toEqual([]);
	});

	it('extracts a single reference', () => {
		expect(extractReferences('Use {{alpha.output}}')).toEqual(['alpha']);
	});

	it('extracts multiple references', () => {
		expect(extractReferences('{{a.output}} and {{b.output}}')).toEqual(['a', 'b']);
	});

	it('extracts the previous keyword like any other ref', () => {
		expect(extractReferences('{{previous.output}}')).toEqual(['previous']);
	});

	it('tolerates whitespace around the reference', () => {
		expect(extractReferences('{{  alpha .output  }}')).toEqual(['alpha']);
	});

	it('ignores braces without .output', () => {
		expect(extractReferences('{{alpha}}')).toEqual([]);
	});
});

describe('interpolatePrompt', () => {
	it('returns the prompt unchanged when there are no references', () => {
		const a = node('a', 'A');
		expect(interpolatePrompt('hello world', a, [a], [a])).toBe('hello world');
	});

	it('resolves {{previous.output}} to the prior node in execution order', () => {
		const a = node('a', 'A', 'scan results');
		const b = node('b', 'B');
		const result = interpolatePrompt('Review: {{previous.output}}', b, [a, b], [a, b]);
		expect(result).toBe('Review: scan results');
	});

	it('resolves {{previous.output}} to empty string for the first node', () => {
		const a = node('a', 'A');
		const result = interpolatePrompt('Start: {{previous.output}}', a, [a], [a]);
		expect(result).toBe('Start: ');
	});

	it('resolves a reference by node id', () => {
		const a = node('a', 'Alpha', 'value-a');
		const b = node('b', 'Beta');
		const result = interpolatePrompt('Got {{a.output}}', b, [a, b], [a, b]);
		expect(result).toBe('Got value-a');
	});

	it('resolves a reference by node label', () => {
		const a = node('a', 'Alpha', 'value-alpha');
		const b = node('b', 'Beta');
		const result = interpolatePrompt('Got {{Alpha.output}}', b, [a, b], [a, b]);
		expect(result).toBe('Got value-alpha');
	});

	it('replaces multiple references in a single prompt', () => {
		const a = node('a', 'A', 'first');
		const b = node('b', 'B', 'second');
		const c = node('c', 'C');
		const result = interpolatePrompt(
			'{{a.output}} then {{b.output}}',
			c,
			[a, b, c],
			[a, b, c]
		);
		expect(result).toBe('first then second');
	});

	it('resolves a reference to a node without output to empty string', () => {
		const a = node('a', 'A');
		const b = node('b', 'B');
		const result = interpolatePrompt('{{a.output}}!', b, [a, b], [a, b]);
		expect(result).toBe('!');
	});

	it('prefers id match over label match when both exist', () => {
		const byId = node('target', 'WrongName', 'from-id');
		const byLabel = node('other', 'target', 'from-label');
		const current = node('c', 'Current');
		const result = interpolatePrompt(
			'{{target.output}}',
			current,
			[byId, byLabel, current],
			[byId, byLabel, current]
		);
		expect(result).toBe('from-id');
	});

	it('leaves text unchanged when braces do not match .output pattern', () => {
		const a = node('a', 'A');
		expect(interpolatePrompt('{{a}} and {a.output}', a, [a], [a])).toBe('{{a}} and {a.output}');
	});
});
