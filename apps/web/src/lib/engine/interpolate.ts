import type { Node } from '@xyflow/svelte';
import type { NodeData } from '$lib/stores/workflow.svelte';

const REF_PATTERN = /\{\{\s*([^}]+?)\s*\.output\s*\}\}/g;

export function interpolatePrompt(
	prompt: string,
	currentNode: Node<NodeData>,
	allNodes: Node<NodeData>[],
	executionOrder: Node<NodeData>[]
): string {
	const byId = new Map(allNodes.map((n) => [n.id, n]));
	const byLabel = new Map(allNodes.map((n) => [n.data.label, n]));
	const currentIdx = executionOrder.findIndex((n) => n.id === currentNode.id);
	const previous = currentIdx > 0 ? executionOrder[currentIdx - 1] : null;

	return prompt.replace(REF_PATTERN, (_match, ref: string) => {
		if (ref === 'previous') return previous?.data.output ?? '';
		const node = byId.get(ref) ?? byLabel.get(ref);
		return node?.data.output ?? '';
	});
}

export function extractReferences(prompt: string): string[] {
	const refs: string[] = [];
	for (const match of prompt.matchAll(REF_PATTERN)) {
		refs.push(match[1]);
	}
	return refs;
}
