<script lang="ts">
	import Toolbar from '$lib/components/Toolbar.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import WorkflowCanvas from '$lib/components/WorkflowCanvas.svelte';
	import NodePanel from '$lib/components/NodePanel.svelte';
</script>

<div class="flex h-screen flex-col bg-zinc-950 text-zinc-100">
	<Toolbar />
	<div class="flex flex-1 overflow-hidden">
		<Sidebar />
		<main class="relative flex-1 overflow-hidden">
			<WorkflowCanvas />
		</main>
		<NodePanel />
	</div>
</div>
