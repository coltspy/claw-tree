<script lang="ts">
	import type { TranslatedError, ErrorAction } from '$lib/errors/translate';

	interface Props {
		translated: TranslatedError;
		onAction: () => void;
	}

	let { translated, onAction }: Props = $props();

	function buttonLabel(action: ErrorAction): string {
		switch (action.kind) {
			case 'open-settings':
				return 'Open Settings';
			case 'open-node-panel':
				return 'Edit node';
			case 'copy-command':
				return 'Copy command';
			case 'none':
				return 'Retry';
		}
	}

	const label = $derived(buttonLabel(translated.action));
	const showButton = $derived(translated.action.kind !== 'none');
</script>

<div class="border-t border-red-900/40 bg-red-950/20 px-3 py-2">
	<p class="text-xs font-medium text-red-300">{translated.title}</p>
	<p class="mt-0.5 text-[11px] text-red-400/80">{translated.body}</p>
	{#if translated.hint}
		<p class="mt-0.5 text-[10px] text-red-500/70 italic">{translated.hint}</p>
	{/if}
	{#if showButton}
		<button
			type="button"
			class="mt-2 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-emerald-500"
			onclick={onAction}
		>
			{label}
		</button>
	{/if}
</div>
