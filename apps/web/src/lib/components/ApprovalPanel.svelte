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
			class="w-[480px] max-w-[90vw] rounded-lg border border-amber-600/40 bg-zinc-900 shadow-2xl"
		>
			<div class="border-b border-amber-900/40 bg-amber-900/20 px-5 py-3">
				<div class="text-[10px] font-semibold tracking-widest text-amber-400 uppercase">
					Paused
				</div>
				<h2 id={titleId} class="mt-0.5 text-sm font-medium text-zinc-100">
					{pending.label}
				</h2>
			</div>

			<div class="p-5">
				<div class="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">Prompt</div>
				<p class="mt-1 text-sm whitespace-pre-wrap text-zinc-200">{pending.prompt}</p>
			</div>

			<div class="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3">
				<button
					type="button"
					onclick={rejectPause}
					class="rounded border border-red-900 px-4 py-1.5 text-xs text-red-300 hover:bg-red-950/40 hover:text-red-200"
				>
					Reject (Esc)
				</button>
				<button
					type="button"
					onclick={approvePause}
					class="rounded bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
				>
					Approve (Enter)
				</button>
			</div>
		</div>
	</div>
{/if}
