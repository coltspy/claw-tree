<script lang="ts">
	import { workflow } from '$lib/stores/workflow.svelte';
	import { execution } from '$lib/stores/execution.svelte';
	import type { NodeStatus } from '$lib/types/nodes';

	let collapsed = $state(false);
	let scrollEl: HTMLPreElement | null = $state(null);

	const statusColors: Record<NodeStatus, string> = {
		idle: 'bg-zinc-700 text-zinc-300',
		queued: 'bg-blue-900/60 text-blue-300',
		running: 'bg-amber-900/60 text-amber-300 animate-pulse',
		done: 'bg-emerald-900/60 text-emerald-300',
		skipped: 'bg-zinc-800 text-zinc-500',
		error: 'bg-red-900/60 text-red-300',
		cancelled: 'bg-zinc-800 text-zinc-500'
	};

	const focusedNode = $derived.by(() => {
		const selected = workflow.nodes.filter((n) => n.selected);
		if (selected.length === 1) return selected[0];
		if (execution.running) {
			return workflow.nodes.find((n) => n.data.status === 'running') ?? null;
		}
		return null;
	});

	const output = $derived(focusedNode?.data.output ?? '');
	const error = $derived(focusedNode?.data.error ?? '');

	$effect(() => {
		output.length;
		if (scrollEl) {
			scrollEl.scrollTop = scrollEl.scrollHeight;
		}
	});
</script>

{#if !focusedNode}
	<div
		class="flex h-8 w-full shrink-0 items-center border-t border-zinc-800 bg-zinc-950 px-3 text-[11px] text-zinc-600 italic"
	>
		No output — run a workflow to see output here
	</div>
{:else}
	{@const node = focusedNode}
	<section
		class="flex w-full shrink-0 flex-col border-t border-zinc-800 bg-zinc-950"
		style:height={collapsed ? '32px' : '240px'}
	>
		<header class="flex h-8 shrink-0 items-center justify-between border-b border-zinc-800 px-3">
			<div class="flex min-w-0 items-center gap-2">
				<span class="truncate text-[11px] font-medium text-zinc-300">{node.data.label}</span>
			</div>
			<span
				class="rounded px-2 py-0.5 text-[10px] font-medium capitalize {statusColors[node.data.status] ?? 'bg-zinc-800 text-zinc-400'}"
			>
				{node.data.status}
			</span>
			<button
				type="button"
				onclick={() => (collapsed = !collapsed)}
				class="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
				aria-label={collapsed ? 'Expand output drawer' : 'Collapse output drawer'}
			>
				<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
					{#if collapsed}
						<path d="M4 10l4-4 4 4" stroke-linecap="round" stroke-linejoin="round" />
					{:else}
						<path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
					{/if}
				</svg>
			</button>
		</header>

		{#if !collapsed}
			<pre
				bind:this={scrollEl}
				class="flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-[11px] leading-relaxed text-zinc-300"
			>{#if error}<span class="mb-3 block rounded border border-red-900/50 bg-red-950/20 p-2 text-red-300">{error}</span>{/if}{#if output}{output}{:else}<span class="text-zinc-600 italic">(no output yet)</span>{/if}</pre>
		{/if}
	</section>
{/if}
