<script lang="ts">
	import { runs, viewRun, deleteRun, forkRun, clearAllRuns, type Run, type RunStatus } from '$lib/stores/runs.svelte';

	const sortedRuns = $derived.by(() => [...runs.list].sort((a, b) => b.startedAt - a.startedAt));

	const statusDotClass: Record<RunStatus, string> = {
		done: 'bg-emerald-500',
		error: 'bg-red-500',
		running: 'bg-amber-400 animate-pulse',
		cancelled: 'bg-zinc-500'
	};

	function relativeTime(ts: number) {
		const diff = Date.now() - ts;
		if (diff < 60_000) return 'just now';
		if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
		if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
		return `${Math.floor(diff / 86_400_000)}d ago`;
	}

	function formatDuration(run: Run) {
		if (run.endedAt === undefined) return null;
		const ms = run.endedAt - run.startedAt;
		if (ms > 1000) return `${(ms / 1000).toFixed(1)}s`;
		return `${ms}ms`;
	}

	function handleDelete(event: MouseEvent, runId: string) {
		event.stopPropagation();
		deleteRun(runId);
	}

	function handleFork(event: MouseEvent, runId: string) {
		event.stopPropagation();
		const result = forkRun(runId);
		if (!result.success) {
			console.warn(`Fork failed: ${result.error}`);
		}
	}

	function handleRowKeydown(event: KeyboardEvent, runId: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			viewRun(runId);
		}
	}
</script>

<aside class="flex w-56 shrink-0 flex-col border-r border-border bg-surface-raised">
	<div class="flex h-10 items-center justify-between border-b border-border px-3">
		<h2 class="text-[11px] font-semibold tracking-widest text-fg-3 uppercase">Run history</h2>
		<button
			type="button"
			onclick={clearAllRuns}
			disabled={runs.list.length === 0}
			class="rounded px-1.5 py-0.5 text-[11px] text-fg-3 hover:bg-surface-overlay hover:text-fg-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fg-3"
		>
			Clear all
		</button>
	</div>

	<div class="flex flex-1 flex-col overflow-y-auto">
		{#if sortedRuns.length === 0}
			<div class="px-3 py-4 text-[11px] italic text-fg-muted">No runs yet</div>
		{:else}
			{#each sortedRuns as run (run.id)}
				{@const isViewing = runs.viewingRunId === run.id}
				{@const nodeCount = Object.keys(run.results).length}
				{@const duration = formatDuration(run)}
				<div
					role="button"
					tabindex="0"
					onclick={() => viewRun(run.id)}
					onkeydown={(e) => handleRowKeydown(e, run.id)}
					class="group flex w-full cursor-pointer flex-col gap-1 px-3 py-2 text-left {isViewing
						? 'border-l-2 border-accent bg-surface-overlay'
						: 'border-l-2 border-transparent hover:bg-surface-overlay'}"
				>
					<div class="flex items-center justify-between gap-2">
						<div class="flex items-center gap-2">
							<span class="h-2 w-2 rounded-full {statusDotClass[run.status]}"></span>
							<span class="text-[11px] text-fg-3">{relativeTime(run.startedAt)}</span>
						</div>
						<div class="flex items-center gap-1">
							<span class="font-mono text-[11px] text-fg-muted">{run.id.slice(0, 6)}</span>
							<button
								type="button"
								aria-label="Fork this run"
								title="Fork — restore this run's workflow onto the canvas"
								onclick={(e) => handleFork(e, run.id)}
								class="ml-1 rounded p-0.5 text-fg-3 opacity-0 hover:bg-surface-overlay hover:text-fg group-hover:opacity-100"
							>
								<svg class="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
									<circle cx="4" cy="3" r="1.5" />
									<circle cx="12" cy="3" r="1.5" />
									<circle cx="8" cy="13" r="1.5" />
									<path d="M4 4.5v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2" stroke-linecap="round" />
									<path d="M8 8.5v3" stroke-linecap="round" />
								</svg>
							</button>
							<button
								type="button"
								aria-label="Delete run"
								onclick={(e) => handleDelete(e, run.id)}
								class="rounded p-0.5 text-fg-3 opacity-0 hover:bg-surface-overlay hover:text-fg group-hover:opacity-100"
							>
								<svg class="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
									<path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
								</svg>
							</button>
						</div>
					</div>
					<div class="flex items-center justify-between text-[11px] text-fg-3">
						<span>{nodeCount} nodes</span>
						{#if duration}
							<span class="font-mono">{duration}</span>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</aside>