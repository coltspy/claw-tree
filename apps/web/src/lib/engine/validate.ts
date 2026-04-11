import type { Node, Edge } from '@xyflow/svelte';
import type { NodeData } from '$lib/stores/workflow.svelte';
import { topologicalSort, CycleError } from './toposort';
import { extractReferences } from './interpolate';

export interface ValidationError {
	nodeId?: string;
	message: string;
}

export function validateWorkflow(
	nodes: Node<NodeData>[],
	edges: Edge[]
): ValidationError[] {
	const errors: ValidationError[] = [];

	if (nodes.length === 0) {
		errors.push({ message: 'Workflow is empty — add at least one node' });
		return errors;
	}

	try {
		topologicalSort(nodes, edges);
	} catch (err) {
		if (err instanceof CycleError) {
			errors.push({ message: err.message });
		} else {
			throw err;
		}
	}

	for (const n of nodes) {
		if (!n.data.prompt.trim()) {
			errors.push({
				nodeId: n.id,
				message: `"${n.data.label}" has no prompt`
			});
		}
	}

	const ids = new Set(nodes.map((n) => n.id));
	const labels = new Set(nodes.map((n) => n.data.label));

	for (const n of nodes) {
		for (const ref of extractReferences(n.data.prompt)) {
			if (ref === 'previous') continue;
			if (!ids.has(ref) && !labels.has(ref)) {
				errors.push({
					nodeId: n.id,
					message: `"${n.data.label}" references unknown node: ${ref}`
				});
			}
		}
	}

	return errors;
}
