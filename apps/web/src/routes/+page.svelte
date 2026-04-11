<script lang="ts">
	import Toolbar from '$lib/components/Toolbar.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import WorkflowCanvas from '$lib/components/WorkflowCanvas.svelte';
	import NodePanel from '$lib/components/NodePanel.svelte';
	import RunHistory from '$lib/components/RunHistory.svelte';
	import OutputDrawer from '$lib/components/OutputDrawer.svelte';
	import ApprovalPanel from '$lib/components/ApprovalPanel.svelte';
	import {
		workflow,
		setHistoryHooks,
		removeNode,
		deselectAll
	} from '$lib/stores/workflow.svelte';
	import {
		recordHistory,
		recordHistoryDebounced,
		undo,
		redo
	} from '$lib/stores/history.svelte';
	import { runWorkflow, cancelWorkflow, execution } from '$lib/stores/execution.svelte';

	setHistoryHooks(recordHistory, recordHistoryDebounced);

	function isEditable(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		const tag = target.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
	}

	function triggerSave() {
		const data = JSON.stringify(
			{ nodes: workflow.nodes, edges: workflow.edges },
			null,
			2
		);
		const blob = new Blob([data], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'workflow.clawtree.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	function deleteSelection() {
		const selectedNodes = workflow.nodes.filter((n) => n.selected);
		const selectedEdges = workflow.edges.filter((e) => e.selected);
		if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
		if (selectedEdges.length > 0) {
			const ids = new Set(selectedEdges.map((e) => e.id));
			workflow.edges = workflow.edges.filter((e) => !ids.has(e.id));
		}
		for (const n of selectedNodes) {
			removeNode(n.id);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		const mod = event.ctrlKey || event.metaKey;

		if (mod && event.key.toLowerCase() === 'z') {
			event.preventDefault();
			if (event.shiftKey) redo();
			else undo();
			return;
		}
		if (mod && event.key.toLowerCase() === 'y') {
			event.preventDefault();
			redo();
			return;
		}
		if (mod && event.key === 'Enter') {
			event.preventDefault();
			if (execution.running) cancelWorkflow();
			else runWorkflow();
			return;
		}
		if (mod && event.key.toLowerCase() === 's') {
			event.preventDefault();
			triggerSave();
			return;
		}

		if (isEditable(event.target)) return;

		if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			deleteSelection();
			return;
		}
		if (event.key === 'Escape') {
			deselectAll();
			return;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-screen flex-col bg-zinc-950 text-zinc-100">
	<Toolbar />
	<div class="flex flex-1 overflow-hidden">
		<RunHistory />
		<Sidebar />
		<main class="relative flex flex-1 flex-col overflow-hidden">
			<div class="relative flex-1 overflow-hidden">
				<WorkflowCanvas />
			</div>
			<OutputDrawer />
		</main>
		<NodePanel />
	</div>
	<ApprovalPanel />
</div>
