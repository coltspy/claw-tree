<script lang="ts">
	import {
		workflow,
		updateNodeData,
		removeNode,
		deselectAll,
		type EdgeData
	} from '$lib/stores/workflow.svelte';
	import {
		CLAW_PERMISSION_MODES,
		CLAW_TOOLS_READ_ONLY,
		CLAW_TOOLS_WORKSPACE_WRITE,
		CLAW_TOOLS_DANGER,
		type ClawPermissionMode,
		type ClawTool,
		type FailurePolicy,
		type OutputFormat
	} from '$lib/types/nodes';
	import { isConditionValid } from '$lib/engine/conditions';

	const selectedNode = $derived.by(() => {
		const selected = workflow.nodes.filter((n) => n.selected);
		return selected.length === 1 ? selected[0] : null;
	});

	const selectedEdge = $derived.by(() => {
		if (selectedNode) return null;
		const selected = workflow.edges.filter((e) => e.selected);
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
	const outputFormats: OutputFormat[] = ['text', 'json'];

	const permissionModeLabels: Record<ClawPermissionMode, string> = {
		'read-only': 'Read only',
		'workspace-write': 'Workspace write',
		'danger-full-access': 'Full access'
	};

	const toolGroups: { label: string; tools: readonly ClawTool[] }[] = [
		{ label: 'Read-only', tools: CLAW_TOOLS_READ_ONLY },
		{ label: 'Workspace write', tools: CLAW_TOOLS_WORKSPACE_WRITE },
		{ label: 'Dangerous', tools: CLAW_TOOLS_DANGER }
	];

	const statusColors: Record<string, string> = {
		idle: 'bg-zinc-700 text-zinc-300',
		queued: 'bg-blue-900/60 text-blue-300',
		running: 'bg-amber-900/60 text-amber-300 animate-pulse',
		done: 'bg-emerald-900/60 text-emerald-300',
		skipped: 'bg-zinc-800 text-zinc-500',
		error: 'bg-red-900/60 text-red-300',
		cancelled: 'bg-zinc-800 text-zinc-500'
	};

	const selectedTools = $derived(new Set(selectedNode?.data.allowedTools ?? []));
	const isPauseNode = $derived(selectedNode?.data.nodeType === 'pause');
	const hasIncomingEdge = $derived.by(() => {
		if (!selectedNode) return false;
		return workflow.edges.some((e) => e.target === selectedNode.id);
	});

	function toggleTool(tool: ClawTool) {
		if (!selectedNode) return;
		const current = selectedNode.data.allowedTools ?? [];
		const next = current.includes(tool)
			? current.filter((t) => t !== tool)
			: [...current, tool];
		updateNodeData(selectedNode.id, {
			allowedTools: next.length > 0 ? next : undefined
		});
	}

	function clearAllowedTools() {
		if (!selectedNode) return;
		updateNodeData(selectedNode.id, { allowedTools: undefined });
	}

	function updateEdgeCondition(expression: string) {
		if (!selectedEdge) return;
		const trimmed = expression.trim();
		const idx = workflow.edges.findIndex((e) => e.id === selectedEdge.id);
		if (idx === -1) return;
		const current = workflow.edges[idx];
		const currentData = (current.data as EdgeData | undefined) ?? {};
		const nextData: EdgeData | undefined = trimmed
			? { ...currentData, condition: trimmed }
			: (() => {
					const { condition: _c, ...rest } = currentData;
					return Object.keys(rest).length > 0 ? rest : undefined;
				})();
		const nextLabel = trimmed
			? trimmed.length > 24
				? `${trimmed.slice(0, 24)}…`
				: trimmed
			: undefined;
		workflow.edges[idx] = { ...current, data: nextData, label: nextLabel };
	}

	function deleteSelectedEdge() {
		if (!selectedEdge) return;
		workflow.edges = workflow.edges.filter((e) => e.id !== selectedEdge.id);
	}

	const edgeCondition = $derived(
		(selectedEdge?.data as EdgeData | undefined)?.condition ?? ''
	);
	const edgeConditionValid = $derived(isConditionValid(edgeCondition));

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && (selectedNode || selectedEdge)) {
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
						{isPauseNode ? 'Approval message' : 'Prompt'}
					</label>
					{#if !isPauseNode}
						<span class="font-mono text-[10px] text-zinc-600">{'{{nodeId.output}}'}</span>
					{/if}
				</div>
				<textarea
					id="node-prompt"
					rows="6"
					value={node.data.prompt}
					oninput={(e) => updateNodeData(node.id, { prompt: e.currentTarget.value })}
					class="w-full resize-y rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 font-mono text-xs leading-relaxed text-zinc-100 focus:border-emerald-500 focus:outline-none"
				></textarea>
			</div>

			{#if !isPauseNode}
				<div>
					<div class="flex items-center justify-between">
						<span class="text-[11px] font-medium text-zinc-400">Continue session</span>
						<button
							type="button"
							role="switch"
							aria-label="Continue session from upstream node"
							aria-checked={Boolean(node.data.resumeFromPrevious)}
							disabled={!hasIncomingEdge}
							onclick={() =>
								updateNodeData(node.id, {
									resumeFromPrevious: !node.data.resumeFromPrevious
								})}
							class="relative h-4 w-7 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40 {node
								.data.resumeFromPrevious
								? 'border-emerald-600 bg-emerald-600/40'
								: 'border-zinc-700 bg-zinc-800'}"
						>
							<span
								class="absolute top-0.5 h-2.5 w-2.5 rounded-full transition-all {node.data
									.resumeFromPrevious
									? 'left-3.5 bg-emerald-300'
									: 'left-0.5 bg-zinc-500'}"
							></span>
						</button>
					</div>
					<p class="mt-1 text-[10px] text-zinc-600">
						{#if !hasIncomingEdge}
							connect an upstream node to enable
						{:else if node.data.resumeFromPrevious}
							this node continues the upstream session — shared memory, cheaper via prompt cache
						{:else}
							spawns a fresh claw session (default)
						{/if}
					</p>
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
					<span class="mb-1.5 block text-[11px] font-medium text-zinc-400">
						Output format
						<span class="ml-1 font-normal text-zinc-600">json enables cost tracking</span>
					</span>
					<div class="flex gap-1">
						{#each outputFormats as fmt (fmt)}
							{@const active = (node.data.outputFormat ?? 'text') === fmt}
							<button
								type="button"
								onclick={() => updateNodeData(node.id, { outputFormat: fmt })}
								class="flex-1 rounded border px-2 py-1 text-[11px] transition-colors {active
									? 'border-emerald-600 bg-emerald-600/10 text-emerald-400'
									: 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'}"
							>
								{fmt}
							</button>
						{/each}
					</div>
				</div>
			{/if}

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

			{#if !isPauseNode}
				<div>
					<span class="mb-1.5 block text-[11px] font-medium text-zinc-400">Permission mode</span>
					<div class="flex gap-1">
						{#each CLAW_PERMISSION_MODES as mode (mode)}
							{@const active =
								(node.data.permissionMode ?? 'danger-full-access') === mode}
							<button
								type="button"
								onclick={() => updateNodeData(node.id, { permissionMode: mode })}
								class="flex-1 rounded border px-2 py-1 text-[11px] transition-colors {active
									? 'border-emerald-600 bg-emerald-600/10 text-emerald-400'
									: 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'}"
							>
								{permissionModeLabels[mode]}
							</button>
						{/each}
					</div>
				</div>

				<div>
					<div class="mb-1.5 flex items-center justify-between">
						<span class="block text-[11px] font-medium text-zinc-400">
							Allowed tools
							<span class="ml-1 font-normal text-zinc-600">
								leave empty = all allowed by mode
							</span>
						</span>
						<button
							type="button"
							onclick={clearAllowedTools}
							class="text-[10px] text-zinc-500 hover:text-zinc-300"
						>
							Clear
						</button>
					</div>
					<div class="flex flex-col gap-3">
						{#each toolGroups as group (group.label)}
							<div>
								<div
									class="mb-1.5 text-[10px] font-medium tracking-wide text-zinc-500 uppercase"
								>
									{group.label} ({group.tools.length})
								</div>
								<div class="flex flex-wrap gap-1">
									{#each group.tools as tool (tool)}
										<button
											type="button"
											onclick={() => toggleTool(tool)}
											class="rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors {selectedTools.has(
												tool
											)
												? 'border-emerald-600 bg-emerald-600/10 text-emerald-300'
												: 'border-zinc-700 text-zinc-400 hover:border-zinc-600'}"
										>
											{tool}
										</button>
									{/each}
								</div>
							</div>
						{/each}
					</div>
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

			{#if node.data.costUsd !== undefined || node.data.inputTokens !== undefined}
				<div>
					<span class="mb-1.5 block text-[11px] font-medium text-zinc-400">Usage</span>
					<div class="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-zinc-400">
						{#if node.data.costUsd !== undefined}
							<span>cost: <span class="text-emerald-400">${node.data.costUsd.toFixed(4)}</span></span>
						{/if}
						{#if node.data.inputTokens !== undefined}
							<span>in: <span class="text-zinc-200">{node.data.inputTokens}</span></span>
						{/if}
						{#if node.data.outputTokens !== undefined}
							<span>out: <span class="text-zinc-200">{node.data.outputTokens}</span></span>
						{/if}
					</div>
				</div>
			{/if}

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
{:else if selectedEdge}
	{@const edge = selectedEdge}
	<aside class="flex w-80 shrink-0 flex-col border-l border-zinc-800 bg-zinc-900">
		<div class="flex items-start justify-between border-b border-zinc-800 px-4 py-3">
			<div>
				<div class="flex items-center gap-2">
					<span class="h-2 w-2 rounded-full bg-sky-500"></span>
					<h2 class="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
						EDGE
					</h2>
				</div>
				<p class="mt-1 text-xs text-zinc-400">
					{edge.source.slice(0, 6)} → {edge.target.slice(0, 6)}
				</p>
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
				<label for="edge-condition" class="mb-1.5 block text-[11px] font-medium text-zinc-400">
					Condition
					<span class="ml-1 font-normal text-zinc-600">
						JS expression — receives output, error, status
					</span>
				</label>
				<textarea
					id="edge-condition"
					rows="4"
					value={edgeCondition}
					placeholder="output.includes('ERROR')"
					oninput={(e) => updateEdgeCondition(e.currentTarget.value)}
					class="w-full resize-y rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 font-mono text-xs leading-relaxed text-zinc-100 focus:border-emerald-500 focus:outline-none"
				></textarea>
				{#if edgeConditionValid !== true}
					<p class="mt-1 text-[10px] text-red-400">{edgeConditionValid}</p>
				{:else if edgeCondition}
					<p class="mt-1 text-[10px] text-emerald-500">valid expression</p>
				{:else}
					<p class="mt-1 text-[10px] text-zinc-600">
						empty = always follow this edge
					</p>
				{/if}
			</div>

			<div>
				<span class="mb-1.5 block text-[11px] font-medium text-zinc-400">Examples</span>
				<div class="flex flex-col gap-1">
					{#each ['output.includes("ERROR")', 'output.length > 100', 'status === "done"', '!error'] as example (example)}
						<button
							type="button"
							onclick={() => updateEdgeCondition(example)}
							class="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-left font-mono text-[10px] text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
						>
							{example}
						</button>
					{/each}
				</div>
			</div>
		</div>

		<div class="border-t border-zinc-800 px-4 py-3">
			<button
				type="button"
				onclick={deleteSelectedEdge}
				class="w-full rounded border border-red-900/70 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300"
			>
				Delete edge
			</button>
		</div>
	</aside>
{/if}
