<script lang="ts">
	import Toolbar from '$lib/components/Toolbar.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import WorkflowCanvas from '$lib/components/WorkflowCanvas.svelte';
	import NodePanel from '$lib/components/NodePanel.svelte';
	import WorkflowLibrary from '$lib/components/WorkflowLibrary.svelte';
	import OutputDrawer from '$lib/components/OutputDrawer.svelte';
	import ApprovalPanel from '$lib/components/ApprovalPanel.svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
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
	import { ui, setChatOpen } from '$lib/stores/ui.svelte';
	import { settings } from '$lib/stores/settings.svelte';

	let bannerDismissed = $state(false);
	const showSetupBanner = $derived(
		!bannerDismissed &&
		settings.anthropicApiKey.length === 0 &&
		settings.openaiApiKey.length === 0
	);

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

<div class="flex h-screen flex-col bg-surface text-fg">
	<Toolbar />
	<div class="flex flex-1 overflow-hidden">
		<WorkflowLibrary />
		<Sidebar />
		<main class="relative flex flex-1 flex-col overflow-hidden">
			{#if showSetupBanner}
				<div class="flex shrink-0 items-center justify-between border-b border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
					<div class="flex items-center gap-2">
						<svg class="h-4 w-4 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
						</svg>
						<span class="text-xs text-amber-200">
							No API key set. Click the <strong>gear icon</strong> in the toolbar to add your Anthropic key, then try an example from the library.
						</span>
					</div>
					<button
						type="button"
						onclick={() => (bannerDismissed = true)}
						class="ml-3 shrink-0 rounded p-1 text-amber-400/60 hover:text-amber-300"
						aria-label="Dismiss"
					>
						<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
						</svg>
					</button>
				</div>
			{/if}
			<div class="relative flex-1 overflow-hidden">
				<WorkflowCanvas />
			</div>
			<OutputDrawer />
		</main>
		<ChatPanel open={ui.chatOpen} onClose={() => setChatOpen(false)} />
		<NodePanel />
	</div>
	<ApprovalPanel />
</div>
