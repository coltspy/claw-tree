import type { Node, Edge } from '@xyflow/svelte';
import type { NodeData, EdgeData } from '$lib/stores/workflow.svelte';
import { topologicalSort, CycleError } from './toposort';
import { extractReferences } from './interpolate';
import { isConditionValid } from './conditions';

export interface ValidationError {
	nodeId?: string;
	edgeId?: string;
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

	for (const e of edges) {
		const condition = (e.data as EdgeData | undefined)?.condition;
		if (!condition) continue;
		const result = isConditionValid(condition);
		if (result !== true) {
			const sourceLabel =
				nodes.find((n) => n.id === e.source)?.data.label ?? e.source;
			errors.push({
				edgeId: e.id,
				message: `Edge from "${sourceLabel}" has invalid condition: ${result}`
			});
		}
	}

	return errors;
}
