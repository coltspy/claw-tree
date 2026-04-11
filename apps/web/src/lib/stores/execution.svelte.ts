import { workflow, updateNodeData } from './workflow.svelte';
import { topologicalSort } from '$lib/engine/toposort';
import { validateWorkflow, type ValidationError } from '$lib/engine/validate';
import { interpolatePrompt } from '$lib/engine/interpolate';

export const execution = $state({
	running: false,
	errors: [] as ValidationError[],
	currentNodeId: null as string | null
});

let abortController: AbortController | null = null;

export async function runWorkflow() {
	if (execution.running) return;

	const errors = validateWorkflow(workflow.nodes, workflow.edges);
	if (errors.length > 0) {
		execution.errors = errors;
		return;
	}

	execution.errors = [];
	execution.running = true;
	abortController = new AbortController();

	for (const n of workflow.nodes) {
		updateNodeData(n.id, {
			status: 'idle',
			output: undefined,
			error: undefined
		});
	}

	try {
		const order = topologicalSort(workflow.nodes, workflow.edges);

		for (const node of order) {
			if (abortController.signal.aborted) {
				updateNodeData(node.id, { status: 'cancelled' });
				continue;
			}

			execution.currentNodeId = node.id;
			updateNodeData(node.id, { status: 'running', output: '' });

			const freshNode = workflow.nodes.find((n) => n.id === node.id);
			if (!freshNode) continue;

			const resolvedPrompt = interpolatePrompt(
				freshNode.data.prompt,
				freshNode,
				workflow.nodes,
				order
			);

			try {
				await streamNode(
					node.id,
					resolvedPrompt,
					freshNode.data.model,
					abortController.signal
				);
				updateNodeData(node.id, { status: 'done' });
			} catch (err) {
				if (abortController.signal.aborted) {
					updateNodeData(node.id, { status: 'cancelled' });
					break;
				}

				const message = err instanceof Error ? err.message : String(err);
				updateNodeData(node.id, { status: 'error', error: message });

				const policy = freshNode.data.failurePolicy;
				if (policy === 'halt') {
					const currentIdx = order.findIndex((n) => n.id === node.id);
					for (let i = currentIdx + 1; i < order.length; i++) {
						updateNodeData(order[i].id, { status: 'cancelled' });
					}
					break;
				}
			}
		}
	} finally {
		execution.running = false;
		execution.currentNodeId = null;
		abortController = null;
	}
}

export function cancelWorkflow() {
	abortController?.abort();
}

async function streamNode(
	nodeId: string,
	prompt: string,
	model: string,
	signal: AbortSignal
): Promise<void> {
	const response = await fetch('/api/run', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ prompt, model }),
		signal
	});

	if (!response.ok) {
		const text = await response.text().catch(() => '');
		throw new Error(`Server ${response.status}: ${text || response.statusText}`);
	}

	const reader = response.body?.getReader();
	if (!reader) throw new Error('Server returned no response body');

	const decoder = new TextDecoder();
	let accumulated = '';

	for (;;) {
		const { value, done } = await reader.read();
		if (done) break;
		accumulated += decoder.decode(value, { stream: true });
		updateNodeData(nodeId, { output: accumulated });
	}
}
