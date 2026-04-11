<script lang="ts">
	import {
		SvelteFlow,
		Background,
		Controls,
		MiniMap,
		type NodeTypes
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { workflow, addNodeAt } from '$lib/stores/workflow.svelte';
	import { canvas } from '$lib/stores/canvas.svelte';
	import type { NodeType } from '$lib/types/nodes';
	import WorkflowNodeCard from './nodes/WorkflowNodeCard.svelte';
	import CanvasBridge from './CanvasBridge.svelte';

	const nodeTypes: NodeTypes = {
		workflow: WorkflowNodeCard
	};

	const NODE_OPTIONS: { type: NodeType; label: string; color: string }[] = [
		{ type: 'security', label: 'Security', color: 'text-red-300' },
		{ type: 'test', label: 'Test', color: 'text-sky-300' },
		{ type: 'review', label: 'Review', color: 'text-violet-300' },
		{ type: 'confirm', label: 'Confirm', color: 'text-emerald-300' },
		{ type: 'custom', label: 'Custom', color: 'text-zinc-300' },
		{ type: 'pause', label: 'Pause', color: 'text-amber-300' }
	];

	interface Picker {
		screenX: number;
		screenY: number;
		flowX: number;
		flowY: number;
		sourceNodeId: string;
	}

	let picker = $state<Picker | null>(null);
	let pendingConnection = $state<{ nodeId: string } | null>(null);

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		const type = event.dataTransfer?.getData('application/claw-tree-node') as NodeType | '';
		if (!type || !canvas.helpers) return;
		const flowPos = canvas.helpers.screenToFlowPosition({
			x: event.clientX,
			y: event.clientY
		});
		addNodeAt(type, { x: flowPos.x - 120, y: flowPos.y - 60 }, { pan: true });
	}

	function handleConnectStart(_event: unknown, params: { nodeId: string | null }) {
		if (params.nodeId) {
			pendingConnection = { nodeId: params.nodeId };
		}
	}

	function handleConnectEnd(event: MouseEvent | TouchEvent) {
		const source = pendingConnection;
		pendingConnection = null;
		if (!source || !canvas.helpers) return;

		const target = event.target as HTMLElement | null;
		const droppedOnPane = target?.classList.contains('svelte-flow__pane');
		if (!droppedOnPane) return;

		const clientX = 'clientX' in event ? event.clientX : event.changedTouches[0]?.clientX ?? 0;
		const clientY = 'clientY' in event ? event.clientY : event.changedTouches[0]?.clientY ?? 0;
		const flowPos = canvas.helpers.screenToFlowPosition({ x: clientX, y: clientY });

		picker = {
			screenX: clientX,
			screenY: clientY,
			flowX: flowPos.x - 120,
			flowY: flowPos.y - 20,
			sourceNodeId: source.nodeId
		};
	}

	function pickNodeType(type: NodeType) {
		if (!picker) return;
		const newId = crypto.randomUUID();
		addNodeAt(type, { x: picker.flowX, y: picker.flowY });
		const created = workflow.nodes[workflow.nodes.length - 1];
		if (created) {
			workflow.edges = [
				...workflow.edges,
				{
					id: `${picker.sourceNodeId}->${created.id}`,
					source: picker.sourceNodeId,
					target: created.id,
					type: 'smoothstep'
				}
			];
		}
		picker = null;
		void newId;
	}

	function dismissPicker() {
		picker = null;
	}
</script>

<div
	class="relative h-full w-full"
	role="application"
	aria-label="Workflow canvas"
	ondrop={handleDrop}
	ondragover={handleDragOver}
>
	{#if workflow.nodes.length === 0}
		<div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
			<div class="text-center">
				<p class="text-sm text-zinc-500">Empty canvas</p>
				<p class="mt-1 text-xs text-zinc-600">
					Drag a node from the left, or click to add
				</p>
			</div>
		</div>
	{/if}

	<SvelteFlow
		bind:nodes={workflow.nodes}
		bind:edges={workflow.edges}
		{nodeTypes}
		colorMode="dark"
		snapGrid={[20, 20]}
		minZoom={0.3}
		maxZoom={1.6}
		defaultEdgeOptions={{ type: 'smoothstep' }}
		onconnectstart={handleConnectStart}
		onconnectend={handleConnectEnd}
		proOptions={{ hideAttribution: true }}
	>
		<Background />
		<Controls position="top-left" showLock={false} />
		<MiniMap position="top-right" pannable zoomable width={160} height={100} />
		<CanvasBridge />
	</SvelteFlow>

	{#if picker}
		<button
			type="button"
			aria-label="Dismiss node picker"
			onclick={dismissPicker}
			class="fixed inset-0 z-40 cursor-default"
		></button>
		<div
			role="menu"
			style="position: fixed; left: {picker.screenX}px; top: {picker.screenY}px;"
			class="z-50 w-48 -translate-x-1/2 rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl"
		>
			<div class="border-b border-zinc-800 px-3 py-2">
				<div class="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
					Add connected node
				</div>
			</div>
			<div class="flex flex-col p-1">
				{#each NODE_OPTIONS as option (option.type)}
					<button
						type="button"
						role="menuitem"
						onclick={() => pickNodeType(option.type)}
						class="flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-800"
					>
						<span class="h-1.5 w-1.5 rounded-full bg-current {option.color}"></span>
						<span>{option.label}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
