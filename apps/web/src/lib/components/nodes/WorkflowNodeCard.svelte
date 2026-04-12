<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import type { NodeData } from '$lib/stores/workflow.svelte';
	import type { NodeType, NodeStatus } from '$lib/types/nodes';
	import { translateError, type ErrorAction } from '$lib/errors/translate';
	import NodeErrorCard from '$lib/components/NodeErrorCard.svelte';

	let { data, selected }: NodeProps = $props();
	const node = $derived(data as NodeData);

	const typeStyles: Record<NodeType, { accent: string; label: string; ring: string }> = {
		security: {
			accent: 'bg-red-500/15 text-red-300 border-red-900/60',
			label: 'SECURITY',
			ring: 'shadow-red-900/40'
		},
		test: {
			accent: 'bg-sky-500/15 text-sky-300 border-sky-900/60',
			label: 'TEST',
			ring: 'shadow-sky-900/40'
		},
		review: {
			accent: 'bg-violet-500/15 text-violet-300 border-violet-900/60',
			label: 'REVIEW',
			ring: 'shadow-violet-900/40'
		},
		confirm: {
			accent: 'bg-emerald-500/15 text-emerald-300 border-emerald-900/60',
			label: 'CONFIRM',
			ring: 'shadow-emerald-900/40'
		},
		custom: {
			accent: 'bg-zinc-500/15 text-zinc-300 border-zinc-700',
			label: 'CUSTOM',
			ring: 'shadow-zinc-900/40'
		},
		pause: {
			accent: 'bg-amber-500/15 text-amber-300 border-amber-900/60',
			label: 'PAUSE',
			ring: 'shadow-amber-900/40'
		},
		plan: {
			accent: 'bg-indigo-500/15 text-indigo-300 border-indigo-900/60',
			label: 'PLAN',
			ring: 'shadow-indigo-900/40'
		},
		summarize: {
			accent: 'bg-teal-500/15 text-teal-300 border-teal-900/60',
			label: 'SUMMARIZE',
			ring: 'shadow-teal-900/40'
		}
	};

	function formatCost(cost: number): string {
		if (cost < 0.0001) return '< $0.0001';
		if (cost < 0.01) return `$${cost.toFixed(4)}`;
		return `$${cost.toFixed(3)}`;
	}

	const statusDot: Record<NodeStatus, string> = {
		idle: 'bg-zinc-600',
		queued: 'bg-blue-400',
		running: 'bg-amber-400 animate-pulse',
		done: 'bg-emerald-400',
		skipped: 'bg-zinc-500',
		error: 'bg-red-500',
		cancelled: 'bg-zinc-500'
	};

	const style = $derived(typeStyles[node.nodeType]);
	const dot = $derived(statusDot[node.status]);
	const promptPreview = $derived(
		node.prompt.trim() ? node.prompt.trim() : '(no prompt)'
	);
	const outputPreview = $derived.by(() => {
		if (!node.output) return null;
		const trimmed = node.output.trim();
		return trimmed.length > 160 ? trimmed.slice(-160) : trimmed;
	});

	function handleErrorAction(action: ErrorAction, _node: NodeData): void {
		// TODO: wire actual handlers (open settings modal, focus node panel field, etc.)
		console.log('node error action', action, _node.label);
	}
</script>

<div
	class="group relative w-60 rounded-lg border bg-zinc-900 shadow-lg transition-all {selected
		? 'border-emerald-500 shadow-emerald-900/40'
		: `border-zinc-800 ${style.ring}`}"
>
	<Handle
		type="target"
		position={Position.Top}
		class="!h-2 !w-2 !border-zinc-600 !bg-zinc-800"
	/>

	<div class="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
		<span
			class="rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-widest {style.accent}"
		>
			{style.label}
		</span>
		<div class="flex items-center gap-1.5">
			{#if node.failurePolicy !== 'halt'}
				<span class="text-[9px] text-zinc-500 uppercase">{node.failurePolicy}</span>
			{/if}
			<span class="h-2 w-2 rounded-full {dot}" title={node.status}></span>
		</div>
	</div>

	<div class="px-3 py-2">
		<h3 class="truncate text-sm font-semibold text-zinc-100">{node.label}</h3>
		<p
			class="mt-1 line-clamp-2 text-[11px] leading-snug text-zinc-500"
			class:italic={!node.prompt.trim()}
		>
			{promptPreview}
		</p>
	</div>

	<div class="flex items-center justify-between border-t border-zinc-800/70 px-3 py-1.5">
		<span class="truncate font-mono text-[10px] text-zinc-600">{node.model}</span>
		<div class="flex items-center gap-2">
			{#if node.fromCache}
				<span
					class="rounded border border-cyan-900/60 bg-cyan-500/10 px-1.5 text-[9px] font-medium text-cyan-300"
					title="Result reused from local cache"
				>
					cached
				</span>
			{/if}
			{#if node.costUsd !== undefined}
				<span class="font-mono text-[10px] text-emerald-500/80">{formatCost(node.costUsd)}</span>
			{/if}
			{#if node.path}
				<span class="truncate font-mono text-[10px] text-zinc-600">{node.path}</span>
			{/if}
		</div>
	</div>

	{#if outputPreview}
		<div
			class="max-h-20 overflow-hidden border-t border-emerald-900/40 bg-emerald-950/20 px-3 py-1.5"
		>
			<pre
				class="line-clamp-3 font-mono text-[10px] leading-snug whitespace-pre-wrap text-emerald-200/80">{outputPreview}</pre>
		</div>
	{:else if node.error}
		{@const translated = translateError(node.error)}
		{#if translated}
			<NodeErrorCard
				{translated}
				onAction={() => handleErrorAction(translated.action, node)}
			/>
		{:else}
			<div
				class="max-h-20 overflow-hidden border-t border-red-900/40 bg-red-950/20 px-3 py-1.5"
			>
				<pre
					class="line-clamp-3 font-mono text-[10px] leading-snug whitespace-pre-wrap text-red-300">{node.error}</pre>
			</div>
		{/if}
	{/if}

	<Handle
		type="source"
		position={Position.Bottom}
		class="!h-2 !w-2 !border-zinc-600 !bg-zinc-800"
	/>
</div>
