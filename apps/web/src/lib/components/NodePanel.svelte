<script lang="ts">
	import {
		workflow,
		updateNodeData,
		removeNode,
		deselectAll
	} from '$lib/stores/workflow.svelte';
	import type { FailurePolicy } from '$lib/types/nodes';

	const selectedNode = $derived.by(() => {
		const selected = workflow.nodes.filter((n) => n.selected);
		return selected.length === 1 ? selected[0] : null;
	});

	const models = [
		'claude-opus-4-6',
		'claude-sonnet-4-6',
		'claude-haiku-4-5',
		'gpt-5',
		'gpt-5-mini'
	];

	const failurePolicies: FailurePolicy[] = ['halt', 'skip', 'retry'];

	const statusColors: Record<string, string> = {
		idle: 'bg-zinc-700 text-zinc-300',
		queued: 'bg-blue-900/60 text-blue-300',
		running: 'bg-amber-900/60 text-amber-300 animate-pulse',
		done: 'bg-emerald-900/60 text-emerald-300',
		skipped: 'bg-zinc-800 text-zinc-500',
		error: 'bg-red-900/60 text-red-300',
		cancelled: 'bg-zinc-800 text-zinc-500'
	};

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && selectedNode) {
			deselectAll();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if selectedNode}
	{@const node = selectedNode}
	<aside class="flex w-80 shrink-0 flex-col border-l border-zinc-800 bg-zinc-900">
		<div class="flex items-start justify-between border-b border-zinc-800 px-4 py-3">
			<div>
				<div class="flex items-center gap-2">
					<span class="h-2 w-2 rounded-full bg-emerald-500"></span>
					<h2 class="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
						{node.data.nodeType}
					</h2>
				</div>
				<p class="mt-1 text-xs text-zinc-400">Node configuration</p>
			</div>
			<button
				type="button"
				onclick={deselectAll}
				class="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
				aria-label="Close panel"
			>
				<svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
				</svg>
			</button>
		</div>

		<div class="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
			<div>
				<label for="node-label" class="mb-1.5 block text-[11px] font-medium text-zinc-400">
					Label
				</label>
				<input
					id="node-label"
					type="text"
					value={node.data.label}
					oninput={(e) => updateNodeData(node.id, { label: e.currentTarget.value })}
					class="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
				/>
			</div>

			<div>
				<div class="mb-1.5 flex items-center justify-between">
					<label for="node-prompt" class="block text-[11px] font-medium text-zinc-400">
						Prompt
					</label>
					<span class="text-[10px] text-zinc-600 font-mono">{'{{nodeId.output}}'}</span>
				</div>
				<textarea
					id="node-prompt"
					rows="6"
					value={node.data.prompt}
					oninput={(e) => updateNodeData(node.id, { prompt: e.currentTarget.value })}
					class="w-full resize-y rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 font-mono text-xs leading-relaxed text-zinc-100 focus:border-emerald-500 focus:outline-none"
				></textarea>
			</div>

			<div>
				<label for="node-model" class="mb-1.5 block text-[11px] font-medium text-zinc-400">
					Model
				</label>
				<select
					id="node-model"
					value={node.data.model}
					onchange={(e) => updateNodeData(node.id, { model: e.currentTarget.value })}
					class="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
				>
					{#each models as model (model)}
						<option value={model}>{model}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="node-path" class="mb-1.5 block text-[11px] font-medium text-zinc-400">
					Path <span class="ml-1 text-zinc-600">(optional)</span>
				</label>
				<input
					id="node-path"
					type="text"
					placeholder="/src"
					value={node.data.path ?? ''}
					oninput={(e) =>
						updateNodeData(node.id, { path: e.currentTarget.value || undefined })}
					class="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
				/>
			</div>

			<div>
				<span class="mb-1.5 block text-[11px] font-medium text-zinc-400">Failure policy</span>
				<div class="flex gap-1">
					{#each failurePolicies as policy (policy)}
						<button
							type="button"
							onclick={() => updateNodeData(node.id, { failurePolicy: policy })}
							class="flex-1 rounded border px-2 py-1 text-[11px] capitalize transition-colors {node
								.data.failurePolicy === policy
								? 'border-emerald-600 bg-emerald-600/10 text-emerald-400'
								: 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'}"
						>
							{policy}
						</button>
					{/each}
				</div>
			</div>

			{#if node.data.failurePolicy === 'retry'}
				<div>
					<label for="node-retry" class="mb-1.5 block text-[11px] font-medium text-zinc-400">
						Retry count
					</label>
					<input
						id="node-retry"
						type="number"
						min="1"
						max="10"
						value={node.data.retryCount ?? 1}
						oninput={(e) =>
							updateNodeData(node.id, { retryCount: Number(e.currentTarget.value) })}
						class="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
					/>
				</div>
			{/if}

			<div>
				<span class="mb-1.5 block text-[11px] font-medium text-zinc-400">Status</span>
				<span
					class="inline-block rounded px-2 py-0.5 text-[11px] font-medium capitalize {statusColors[
						node.data.status
					] ?? 'bg-zinc-800 text-zinc-400'}"
				>
					{node.data.status}
				</span>
			</div>

			{#if node.data.error}
				<div>
					<span class="mb-1.5 block text-[11px] font-medium text-red-400">Error</span>
					<pre
						class="max-h-32 overflow-auto rounded border border-red-900/50 bg-red-950/20 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-red-300">{node
							.data.error}</pre>
				</div>
			{/if}

			{#if node.data.output}
				<div>
					<span class="mb-1.5 block text-[11px] font-medium text-zinc-400">Output</span>
					<pre
						class="max-h-48 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-zinc-300">{node
							.data.output}</pre>
				</div>
			{/if}
		</div>

		<div class="border-t border-zinc-800 px-4 py-3">
			<button
				type="button"
				onclick={() => removeNode(node.id)}
				class="w-full rounded border border-red-900/70 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300"
			>
				Delete node
			</button>
		</div>
	</aside>
{/if}
