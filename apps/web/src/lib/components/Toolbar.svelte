<script lang="ts">
	import StatusIndicator from './StatusIndicator.svelte';
	import { workflow, clearWorkflow } from '$lib/stores/workflow.svelte';
	import { execution, runWorkflow, cancelWorkflow } from '$lib/stores/execution.svelte';

	let serverStatus = $state<'connected' | 'disconnected' | 'checking'>('checking');

	const nodeCount = $derived(workflow.nodes.length);
	const canRun = $derived(nodeCount > 0 && !execution.running);
	const hasErrors = $derived(execution.errors.length > 0);

	function handleSave() {
		const data = JSON.stringify(workflow, null, 2);
		const blob = new Blob([data], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'workflow.clawtree.json';
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<header
	class="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4"
>
	<div class="flex items-center gap-3">
		<span class="text-sm font-semibold tracking-tight text-zinc-100">claw-tree</span>
	</div>

	<div class="flex items-center gap-4">
		<span class="text-xs text-zinc-500">{nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}</span>
		<StatusIndicator status={serverStatus} />
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={clearWorkflow}
				disabled={nodeCount === 0}
				class="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
			>
				Clear
			</button>
			<button
				type="button"
				onclick={handleSave}
				disabled={nodeCount === 0}
				class="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
			>
				Save
			</button>
			{#if execution.running}
				<button
					type="button"
					onclick={cancelWorkflow}
					class="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500"
				>
					Cancel
				</button>
			{:else}
				<button
					type="button"
					onclick={runWorkflow}
					disabled={!canRun}
					class="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
				>
					Run
				</button>
			{/if}
		</div>
	</div>

	{#if hasErrors}
		<div class="absolute top-12 right-4 z-50 max-w-md rounded border border-red-900 bg-red-950/90 p-3 shadow-lg">
			<div class="mb-1 flex items-center justify-between">
				<span class="text-[11px] font-semibold text-red-300">Cannot run workflow</span>
				<button
					type="button"
					onclick={() => (execution.errors = [])}
					class="text-red-400 hover:text-red-200"
					aria-label="Dismiss"
				>
					<svg class="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
					</svg>
				</button>
			</div>
			<ul class="space-y-0.5 text-[11px] text-red-200">
				{#each execution.errors as err (err.message)}
					<li>• {err.message}</li>
				{/each}
			</ul>
		</div>
	{/if}
</header>
