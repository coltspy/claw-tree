<script lang="ts">
	import {
		SvelteFlow,
		Background,
		Controls,
		MiniMap,
		type NodeTypes
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { untrack } from 'svelte';
	import { workflow, addNodeAt, type NodeData } from '$lib/stores/workflow.svelte';
	import { canvas } from '$lib/stores/canvas.svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import type { NodeType, NodeStatus } from '$lib/types/nodes';
	import { topologicalSort, groupByDepth, CycleError } from '$lib/engine/toposort';

	function autoLayout() {
		if (workflow.nodes.length < 2) return;
		try {
			const ordered = topologicalSort(workflow.nodes, workflow.edges);
			const groups = groupByDepth(ordered, workflow.edges);

			const X_GAP = 280;
			const Y_GAP = 220;
			const START_X = 200;
			const START_Y = 100;

			const updated = workflow.nodes.map((n) => ({ ...n }));
			const posMap = new Map<string, { x: number; y: number }>();

			for (let row = 0; row < groups.length; row++) {
				const group = groups[row];
				const totalWidth = (group.length - 1) * X_GAP;
				const offsetX = START_X - totalWidth / 2;
				for (let col = 0; col < group.length; col++) {
					posMap.set(group[col].id, {
						x: offsetX + col * X_GAP,
						y: START_Y + row * Y_GAP
					});
				}
			}

			for (const node of updated) {
				const pos = posMap.get(node.id);
				if (pos) {
					node.position = pos;
				}
			}

			workflow.nodes = updated;
		} catch (e) {
			if (e instanceof CycleError) return;
			throw e;
		}
	}

	const edgeColors: Record<NodeStatus, string> = {
		idle: '',
		queued: 'stroke: #60a5fa;',
		running: 'stroke: #fbbf24; stroke-dasharray: 5; animation: dash 0.5s linear infinite;',
		done: 'stroke: #34d399;',
		skipped: '',
		error: 'stroke: #f87171;',
		cancelled: ''
	};

	$effect(() => {
		const nodeMap = new Map(workflow.nodes.map((n) => [n.id, n.data as NodeData]));
		untrack(() => {
			let changed = false;
			const updated = workflow.edges.map((e) => {
				const sourceData = nodeMap.get(e.source);
				const status = sourceData?.status ?? 'idle';
				const newStyle = edgeColors[status];
				const newAnimated = status === 'running';
				if (e.style !== newStyle || e.animated !== newAnimated) {
					changed = true;
					return { ...e, style: newStyle || undefined, animated: newAnimated };
				}
				return e;
			});
			if (changed) {
				workflow.edges = updated;
			}
		});
	});
	import WorkflowNodeCard from './nodes/WorkflowNodeCard.svelte';
	import CanvasBridge from './CanvasBridge.svelte';

	const nodeTypes: NodeTypes = {
		workflow: WorkflowNodeCard
	};

	const NODE_OPTIONS: { type: NodeType; label: string; color: string }[] = [
		{ type: 'agent', label: 'Run Agent', color: 'text-orange-300' },
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
				<p class="text-sm text-fg-3">Empty canvas</p>
				<p class="mt-1 text-xs text-fg-muted">
					Drag a node from the left, or click to add
				</p>
			</div>
		</div>
	{/if}

	<SvelteFlow
		bind:nodes={workflow.nodes}
		bind:edges={workflow.edges}
		{nodeTypes}
		colorMode={ui.theme === 'light' ? 'light' : 'dark'}
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

	{#if workflow.nodes.length >= 2}
		<button
			type="button"
			onclick={autoLayout}
			class="absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-md border border-border bg-surface-raised px-2 py-1 text-[11px] text-fg-3 hover:text-fg"
			title="Auto-layout"
		>
			<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<rect x="1" y="1" width="5" height="4" rx="0.5" />
				<rect x="10" y="1" width="5" height="4" rx="0.5" />
				<rect x="5.5" y="11" width="5" height="4" rx="0.5" />
				<path d="M3.5 5v2.5h9V5" />
				<path d="M8 7.5V11" />
			</svg>
			Auto-layout
		</button>
	{/if}

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
			class="z-50 w-48 -translate-x-1/2 rounded-lg border border-border bg-surface-raised shadow-xl"
		>
			<div class="border-b border-border px-3 py-2">
				<div class="text-[11px] font-medium tracking-wide text-fg-3 uppercase">
					Add connected node
				</div>
			</div>
			<div class="flex flex-col p-1">
				{#each NODE_OPTIONS as option (option.type)}
					<button
						type="button"
						role="menuitem"
						onclick={() => pickNodeType(option.type)}
						class="flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-fg-2 hover:bg-surface-overlay"
					>
						<span class="h-1.5 w-1.5 rounded-full bg-current {option.color}"></span>
						<span>{option.label}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
