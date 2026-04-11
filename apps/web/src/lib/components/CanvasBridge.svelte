<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { setCanvasHelpers } from '$lib/stores/canvas.svelte';

	const flow = useSvelteFlow();

	$effect(() => {
		setCanvasHelpers({
			screenToFlowPosition: (p) => flow.screenToFlowPosition(p),
			focusNode: (nodeId) => {
				setTimeout(() => {
					flow.fitView({
						nodes: [{ id: nodeId }],
						padding: 2,
						duration: 300,
						maxZoom: 1.2,
						minZoom: 0.6
					});
				}, 16);
			},
			fitView: () => flow.fitView({ padding: 0.2, duration: 300 })
		});
		return () => setCanvasHelpers(null);
	});
</script>
