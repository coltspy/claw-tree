<script lang="ts">
	import { addNode } from '$lib/stores/workflow.svelte';
	import type { NodeType } from '$lib/types/nodes';

	interface NodeOption {
		type: NodeType;
		label: string;
		description: string;
	}

	const nodeOptions: NodeOption[] = [
		{ type: 'security', label: 'Security', description: 'Audit a path for vulnerabilities' },
		{ type: 'test', label: 'Test', description: 'Run tests, report pass/fail' },
		{ type: 'review', label: 'Review', description: "Review a prior node's output" },
		{ type: 'confirm', label: 'Confirm', description: 'Second model verifies output' },
		{ type: 'custom', label: 'Custom', description: 'Freeform prompt' }
	];
</script>

<aside
	class="flex w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900"
>
	<div class="border-b border-zinc-800 px-4 py-3">
		<h2 class="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Add node</h2>
		<p class="mt-0.5 text-[11px] text-zinc-600">Click to drop onto canvas</p>
	</div>

	<div class="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
		{#each nodeOptions as option (option.type)}
			<button
				type="button"
				onclick={() => addNode(option.type)}
				class="group flex flex-col items-start gap-0.5 rounded-md border border-transparent px-3 py-2 text-left hover:border-zinc-700 hover:bg-zinc-800"
			>
				<span class="text-xs font-medium text-zinc-100">{option.label}</span>
				<span class="text-[11px] text-zinc-500 group-hover:text-zinc-400">
					{option.description}
				</span>
			</button>
		{/each}
	</div>

	<div class="border-t border-zinc-800 px-4 py-3 text-[10px] text-zinc-600">
		Tip: connect nodes by dragging between handles
	</div>
</aside>
