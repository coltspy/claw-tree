<script lang="ts">
	import { addNode } from '$lib/stores/workflow.svelte';
	import type { NodeType } from '$lib/types/nodes';

	interface NodeOption {
		type: NodeType;
		label: string;
		description: string;
		color: string;
		icon: string;
	}

	const nodeOptions: NodeOption[] = [
		{
			type: 'agent',
			label: 'Run Agent',
			description: 'Execute a task',
			color: 'text-orange-400',
			icon: 'M13 10V3L4 14h7v7l9-11h-7z'
		},
		{
			type: 'plan',
			label: 'Plan',
			description: 'Think step by step',
			color: 'text-indigo-400',
			icon: 'M9 6h11M9 12h11M9 18h11M5 6h.01M5 12h.01M5 18h.01'
		},
		{
			type: 'security',
			label: 'Security',
			description: 'Audit for vulns',
			color: 'text-red-400',
			icon: 'M12 3l7 4v5c0 5.25-3.5 9.24-7 10-3.5-.76-7-4.75-7-10V7l7-4z'
		},
		{
			type: 'test',
			label: 'Test',
			description: 'Run test suite',
			color: 'text-sky-400',
			icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
		},
		{
			type: 'review',
			label: 'Review',
			description: 'Review output',
			color: 'text-violet-400',
			icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
		},
		{
			type: 'confirm',
			label: 'Confirm',
			description: 'Verify with 2nd model',
			color: 'text-emerald-400',
			icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z'
		},
		{
			type: 'summarize',
			label: 'Summarize',
			description: 'Condense output',
			color: 'text-teal-400',
			icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
		},
		{
			type: 'custom',
			label: 'Custom',
			description: 'Freeform prompt',
			color: 'text-zinc-400',
			icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4'
		},
		{
			type: 'pause',
			label: 'Pause',
			description: 'Wait for approval',
			color: 'text-amber-400',
			icon: 'M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11'
		}
	];

	function handleDragStart(event: DragEvent, type: NodeType) {
		if (!event.dataTransfer) return;
		event.dataTransfer.setData('application/claw-tree-node', type);
		event.dataTransfer.effectAllowed = 'move';
	}
</script>

<aside
	class="flex w-56 shrink-0 flex-col border-r border-border bg-surface-raised"
>
	<div class="px-4 pt-4 pb-2">
		<h2 class="text-xs font-semibold text-fg-2">Nodes</h2>
	</div>

	<div class="flex flex-col gap-1 overflow-y-auto px-3 pb-3">
		{#each nodeOptions as option (option.type)}
			<button
				type="button"
				draggable="true"
				ondragstart={(e) => handleDragStart(e, option.type)}
				onclick={() => addNode(option.type)}
				class="group flex cursor-grab items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5 text-left transition-all hover:border-fg-muted hover:shadow-sm active:cursor-grabbing active:scale-[0.98]"
			>
				<svg
					class="h-4 w-4 shrink-0 {option.color}"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d={option.icon} />
				</svg>
				<div class="min-w-0 flex-1">
					<div class="text-xs font-medium text-fg">{option.label}</div>
					<div class="text-[11px] text-fg-muted group-hover:text-fg-3">
						{option.description}
					</div>
				</div>
			</button>
		{/each}
	</div>
</aside>
