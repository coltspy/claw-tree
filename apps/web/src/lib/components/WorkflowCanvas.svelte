<script lang="ts">
	import { SvelteFlow, Background, Controls, MiniMap, type NodeTypes } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { workflow } from '$lib/stores/workflow.svelte';
	import WorkflowNodeCard from './nodes/WorkflowNodeCard.svelte';

	const nodeTypes: NodeTypes = {
		workflow: WorkflowNodeCard
	};
</script>

<div class="h-full w-full">
	{#if workflow.nodes.length === 0}
		<div class="pointer-events-none absolute inset-0 flex items-center justify-center">
			<div class="text-center">
				<p class="text-sm text-zinc-500">Empty canvas</p>
				<p class="mt-1 text-xs text-zinc-600">Add a node from the sidebar to get started</p>
			</div>
		</div>
	{/if}

	<SvelteFlow
		bind:nodes={workflow.nodes}
		bind:edges={workflow.edges}
		{nodeTypes}
		colorMode="dark"
		fitView
		proOptions={{ hideAttribution: true }}
	>
		<Background />
		<Controls />
		<MiniMap pannable zoomable />
	</SvelteFlow>
</div>
