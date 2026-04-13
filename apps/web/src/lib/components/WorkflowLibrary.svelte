<script lang="ts">
	import {
		library,
		saveCurrentWorkflow,
		loadSavedWorkflow,
		deleteSavedWorkflow,
		renameSavedWorkflow,
		newWorkflow,
		importExampleWorkflow
	} from '$lib/stores/library.svelte';

	const EXAMPLES: { file: string; name: string; description: string }[] = [
		{ file: 'hello-world', name: 'Hello World', description: 'Single node — verify setup' },
		{
			file: 'multi-agent-review',
			name: 'Multi-Agent Review',
			description: 'Parallel security + quality agents -> merge'
		},
		{
			file: 'full-audit-pipeline',
			name: 'Full Audit Pipeline',
			description: 'Triple parallel audit + conditional triage'
		},
		{
			file: 'research-synthesize',
			name: 'Research & Synthesize',
			description: 'Fan-out 3 perspectives -> synthesize'
		},
		{
			file: 'plan-then-audit',
			name: 'Plan then Audit',
			description: 'Plan -> Security -> Summarize -> Pause'
		},
		{
			file: 'test-gate',
			name: 'Test Gate',
			description: 'Test -> Review -> conditional branch'
		},
		{
			file: 'pr-review',
			name: 'PR Review',
			description: 'Plan -> Review -> Security -> Verdict'
		},
		{
			file: 'refactor-plan',
			name: 'Refactor Plan',
			description: 'Map repo -> Plan -> Review -> Approve'
		},
		{
			file: 'dep-audit',
			name: 'Dependency Audit',
			description: 'Inventory -> CVE scan -> Action list'
		}
	];

	let editingId = $state<string | null>(null);
	let editName = $state('');

	function startRename(id: string, currentName: string) {
		editingId = id;
		editName = currentName;
	}

	function finishRename() {
		if (editingId && editName.trim()) {
			renameSavedWorkflow(editingId, editName.trim());
		}
		editingId = null;
	}

	function renameKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') finishRename();
		if (event.key === 'Escape') {
			editingId = null;
		}
	}

	async function loadExample(file: string, name: string) {
		try {
			const response = await fetch(`/examples/${file}.clawtree.json`);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = await response.json();
			importExampleWorkflow(data, name);
		} catch (err) {
			console.warn(`Failed to load example: ${file}`, err);
		}
	}

	function relativeTime(ts: number): string {
		const diff = Date.now() - ts;
		if (diff < 60_000) return 'just now';
		if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
		if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
		return `${Math.floor(diff / 86_400_000)}d ago`;
	}

	const sorted = $derived(
		[...library.workflows].sort((a, b) => b.updatedAt - a.updatedAt)
	);
</script>

<aside class="flex w-56 shrink-0 flex-col border-r border-border bg-surface-raised">
	<div class="flex items-center justify-between border-b border-border px-4 py-3">
		<h2 class="text-[11px] font-medium tracking-wide text-fg-3">Workflows</h2>
		<div class="flex items-center gap-1">
			<button
				type="button"
				onclick={() => saveCurrentWorkflow()}
				title="Save current workflow"
				class="rounded p-1 text-fg-3 hover:bg-surface-overlay hover:text-fg"
			>
				<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M13 5v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1h6l3 3z" />
					<path d="M10 2v3h3" />
				</svg>
			</button>
			<button
				type="button"
				onclick={newWorkflow}
				title="New empty workflow"
				class="rounded p-1 text-fg-3 hover:bg-surface-overlay hover:text-fg"
			>
				<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M8 3v10M3 8h10" />
				</svg>
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto">
		{#if sorted.length > 0}
			<div class="flex flex-col gap-0.5 p-2">
				{#each sorted as wf (wf.id)}
					<div
						role="button"
						tabindex="0"
						onclick={() => loadSavedWorkflow(wf.id)}
						onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') loadSavedWorkflow(wf.id); }}
						class="group flex cursor-pointer items-start justify-between rounded-md px-2.5 py-2 transition-colors {library.activeId === wf.id
							? 'border-l-2 border-accent bg-surface-overlay'
							: 'border-l-2 border-transparent hover:bg-surface-overlay'}"
					>
						<div class="min-w-0 flex-1">
							{#if editingId === wf.id}
								<input
									type="text"
									bind:value={editName}
									onblur={finishRename}
									onkeydown={renameKeydown}
									onclick={(e) => e.stopPropagation()}
									class="w-full rounded border border-border bg-surface px-1 py-0.5 text-xs text-fg focus:border-accent focus:outline-none"
								/>
							{:else}
								<div class="truncate text-xs font-medium text-fg">
									{wf.name}
								</div>
							{/if}
							<div class="mt-0.5 flex items-center gap-2 text-[11px] text-fg-muted">
								<span>{wf.nodes.length} nodes</span>
								<span>{relativeTime(wf.updatedAt)}</span>
							</div>
						</div>
						<div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
							<button
								type="button"
								onclick={(e) => { e.stopPropagation(); startRename(wf.id, wf.name); }}
								aria-label="Rename workflow"
								class="rounded p-0.5 text-fg-3 hover:text-fg"
							>
								<svg class="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
									<path d="M10.5 2.5l3 3M2 11l7-7 3 3-7 7H2v-3z" />
								</svg>
							</button>
							<button
								type="button"
								onclick={(e) => { e.stopPropagation(); deleteSavedWorkflow(wf.id); }}
								aria-label="Delete workflow"
								class="rounded p-0.5 text-fg-3 hover:text-red-400"
							>
								<svg class="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
									<path d="M4 4l8 8M12 4l-8 8" />
								</svg>
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<div class="border-t border-border-subtle px-4 py-3">
			<h3 class="mb-2 text-[11px] font-semibold tracking-widest text-fg-3 uppercase">
				Examples
			</h3>
			<div class="flex flex-col gap-1">
				{#each EXAMPLES as example (example.file)}
					<button
						type="button"
						onclick={() => loadExample(example.file, example.name)}
						class="flex flex-col items-start rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-overlay"
					>
						<span class="text-[11px] font-medium text-fg-2">{example.name}</span>
						<span class="text-[11px] text-fg-3">{example.description}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>
</aside>
