<script lang="ts">
	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	const shortcuts: { keys: string[]; description: string }[] = [
		{ keys: ['Ctrl', 'Enter'], description: 'Run workflow' },
		{ keys: ['Ctrl', 'S'], description: 'Save workflow' },
		{ keys: ['Ctrl', 'Z'], description: 'Undo' },
		{ keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
		{ keys: ['Ctrl', 'Y'], description: 'Redo' },
		{ keys: ['Delete'], description: 'Delete selected' },
		{ keys: ['Backspace'], description: 'Delete selected' },
		{ keys: ['Escape'], description: 'Deselect all' },
		{ keys: ['?'], description: 'Show shortcuts' }
	];

	function handleKey(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKey} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		role="dialog"
		aria-modal="true"
		aria-labelledby="shortcuts-title"
	>
		<button
			type="button"
			class="absolute inset-0 cursor-default"
			aria-label="Close shortcuts"
			onclick={onClose}
		></button>
		<div
			class="relative w-[400px] max-w-[90vw] rounded-xl border border-border bg-surface-raised shadow-2xl"
		>
			<div class="flex items-center justify-between border-b border-border px-5 py-3">
				<h2 id="shortcuts-title" class="text-sm font-medium text-fg">
					Keyboard shortcuts
				</h2>
				<button
					type="button"
					onclick={onClose}
					aria-label="Close shortcuts"
					class="rounded p-1 text-fg-3 hover:bg-surface-overlay hover:text-fg-2"
				>
					<svg
						class="h-4 w-4"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
					</svg>
				</button>
			</div>

			<div class="flex flex-col gap-2 p-5">
				{#each shortcuts as shortcut}
					<div class="flex items-center justify-between">
						<span class="text-xs text-fg-3">{shortcut.description}</span>
						<div class="flex items-center gap-1">
							{#each shortcut.keys as key}
								<kbd class="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-fg-2">
									{key}
								</kbd>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
