<script lang="ts">
	import { addNode } from '$lib/stores/workflow.svelte';
	import type { NodeType } from '$lib/types/nodes';

	interface NodeOption {
		type: NodeType;
		label: string;
		description: string;
		accent: string;
		iconPath: string;
	}

	const nodeOptions: NodeOption[] = [
		{
			type: 'plan',
			label: 'Plan',
			description: 'Think step by step first',
			accent: 'bg-indigo-500/10 text-indigo-300 ring-indigo-900/40',
			iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
		},
		{
			type: 'security',
			label: 'Security',
			description: 'Audit for vulnerabilities',
			accent: 'bg-red-500/10 text-red-300 ring-red-900/40',
			iconPath: 'M12 2l7 4v6c0 5-3.5 9.2-7 10-3.5-.8-7-5-7-10V6l7-4z'
		},
		{
			type: 'test',
			label: 'Test',
			description: 'Run and report tests',
			accent: 'bg-sky-500/10 text-sky-300 ring-sky-900/40',
			iconPath: 'M9 11l3 3 8-8M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h7'
		},
		{
			type: 'review',
			label: 'Review',
			description: 'Review prior output',
			accent: 'bg-violet-500/10 text-violet-300 ring-violet-900/40',
			iconPath:
				'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z'
		},
		{
			type: 'confirm',
			label: 'Confirm',
			description: 'Verify with a 2nd model',
			accent: 'bg-emerald-500/10 text-emerald-300 ring-emerald-900/40',
			iconPath: 'M9 12l2 2 4-4M20 12a8 8 0 11-16 0 8 8 0 0116 0z'
		},
		{
			type: 'summarize',
			label: 'Summarize',
			description: 'Condense into a brief',
			accent: 'bg-teal-500/10 text-teal-300 ring-teal-900/40',
			iconPath: 'M4 6h16M4 10h10M4 14h6M4 18h2'
		},
		{
			type: 'custom',
			label: 'Custom',
			description: 'Freeform prompt',
			accent: 'bg-zinc-500/10 text-zinc-300 ring-zinc-700',
			iconPath: 'M16 18l6-6-6-6M8 6l-6 6 6 6'
		},
		{
			type: 'pause',
			label: 'Pause',
			description: 'Wait for approval',
			accent: 'bg-amber-500/10 text-amber-300 ring-amber-900/40',
			iconPath: 'M10 9v6M14 9v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
		}
	];

	function handleDragStart(event: DragEvent, type: NodeType) {
		if (!event.dataTransfer) return;
		event.dataTransfer.setData('application/claw-tree-node', type);
		event.dataTransfer.effectAllowed = 'move';
	}
</script>

<aside
	class="flex w-64 shrink-0 flex-col border-r border-border bg-surface-raised"
>
	<div class="px-5 pt-5 pb-3">
		<h2 class="text-xs font-medium tracking-wide text-fg-3">Nodes</h2>
		<p class="mt-0.5 text-[11px] text-fg-muted">Drag onto canvas or click to add</p>
	</div>

	<div class="flex flex-col gap-0.5 px-4 pb-3">
		{#each nodeOptions as option (option.type)}
			<button
				type="button"
				draggable="true"
				ondragstart={(e) => handleDragStart(e, option.type)}
				onclick={() => addNode(option.type)}
				class="group flex cursor-grab items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-overlay active:cursor-grabbing active:bg-surface-overlay"
			>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1 {option.accent}"
				>
					<svg
						class="h-[18px] w-[18px]"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.75"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d={option.iconPath} />
					</svg>
				</div>
				<div class="min-w-0 flex-1">
					<div class="truncate text-[13px] font-medium text-fg">{option.label}</div>
					<div class="truncate text-[11px] text-fg-3 group-hover:text-fg-2">
						{option.description}
					</div>
				</div>
			</button>
		{/each}
	</div>

	<div class="mt-auto border-t border-border-subtle px-5 py-3">
		<p class="text-[11px] leading-relaxed text-fg-muted">
			Drag between handles to connect nodes. Drop off a handle onto empty canvas to spawn a
			connected node.
		</p>
	</div>
</aside>
