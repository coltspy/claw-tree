<script lang="ts">
	import { execution, approvePause, rejectPause } from '$lib/stores/execution.svelte';

	const pending = $derived(execution.pendingApproval);
	const titleId = 'approval-panel-title';

	function handleKey(event: KeyboardEvent) {
		if (!pending) return;
		if (event.key === 'Enter') {
			event.preventDefault();
			approvePause();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			rejectPause();
		}
	}
</script>

<svelte:window onkeydown={handleKey} />

{#if pending}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			class="w-[480px] max-w-[90vw] rounded-xl border border-amber-500/30 bg-surface-raised shadow-2xl"
		>
			<div class="border-b border-amber-900/40 bg-amber-900/20 px-5 py-3">
				<div class="text-[10px] font-semibold tracking-widest text-amber-400 uppercase">
					Paused
				</div>
				<h2 id={titleId} class="mt-0.5 text-sm font-medium text-fg">
					{pending.label}
				</h2>
			</div>

			<div class="p-5">
				<div class="text-[10px] font-medium tracking-wide text-fg-3 uppercase">Prompt</div>
				<p class="mt-1 text-sm whitespace-pre-wrap text-fg-2">{pending.prompt}</p>
			</div>

			<div class="flex justify-end gap-2 border-t border-border px-5 py-3">
				<button
					type="button"
					onclick={rejectPause}
					class="rounded border border-danger/40 px-4 py-1.5 text-xs text-danger hover:bg-danger/10"
				>
					Reject (Esc)
				</button>
				<button
					type="button"
					onclick={approvePause}
					class="btn-push rounded bg-accent px-4 py-1.5 text-xs font-medium text-surface"
				>
					Approve (Enter)
				</button>
			</div>
		</div>
	</div>
{/if}
