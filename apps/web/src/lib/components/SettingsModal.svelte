<script lang="ts">
	import { settings, saveSettings } from '$lib/stores/settings.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	let anthropicKey = $state('');
	let openaiKey = $state('');
	let defaultModel = $state('claude-sonnet-4-6');
	let showAnthropic = $state(false);
	let showOpenai = $state(false);

	$effect(() => {
		if (open) {
			anthropicKey = settings.anthropicApiKey;
			openaiKey = settings.openaiApiKey;
			defaultModel = settings.defaultModel;
			showAnthropic = false;
			showOpenai = false;
		}
	});

	function save() {
		saveSettings({
			anthropicApiKey: anthropicKey.trim(),
			openaiApiKey: openaiKey.trim(),
			defaultModel
		});
		onClose();
	}

	function handleKey(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
		}
	}

	function mask(key: string): string {
		if (key.length < 8) return '••••••••';
		return `${key.slice(0, 6)}••••••${key.slice(-4)}`;
	}
</script>

<svelte:window onkeydown={handleKey} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		role="dialog"
		aria-modal="true"
		aria-labelledby="settings-title"
	>
		<div
			class="w-[520px] max-w-[90vw] rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl"
		>
			<div class="flex items-start justify-between border-b border-zinc-800 px-5 py-3">
				<div>
					<div class="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
						Settings
					</div>
					<h2 id="settings-title" class="mt-0.5 text-sm font-medium text-zinc-100">
						API keys &amp; defaults
					</h2>
				</div>
				<button
					type="button"
					onclick={onClose}
					aria-label="Close settings"
					class="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
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

			<div class="flex flex-col gap-5 p-5">
				<div>
					<div class="mb-1.5 flex items-center justify-between">
						<label for="anthropic-key" class="text-[11px] font-medium text-zinc-400">
							Anthropic API key
						</label>
						{#if settings.anthropicApiKey}
							<span class="font-mono text-[10px] text-emerald-500">
								saved: {mask(settings.anthropicApiKey)}
							</span>
						{:else}
							<span class="text-[10px] text-zinc-600">not set</span>
						{/if}
					</div>
					<div class="relative">
						<input
							id="anthropic-key"
							type={showAnthropic ? 'text' : 'password'}
							placeholder="sk-ant-..."
							bind:value={anthropicKey}
							class="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 pr-16 font-mono text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
						/>
						<button
							type="button"
							onclick={() => (showAnthropic = !showAnthropic)}
							class="absolute inset-y-0 right-0 px-2 text-[10px] text-zinc-500 hover:text-zinc-300"
						>
							{showAnthropic ? 'hide' : 'show'}
						</button>
					</div>
					<p class="mt-1 text-[10px] text-zinc-600">
						Used for claude-* models. Stored in browser localStorage.
					</p>
				</div>

				<div>
					<div class="mb-1.5 flex items-center justify-between">
						<label for="openai-key" class="text-[11px] font-medium text-zinc-400">
							OpenAI API key
							<span class="ml-1 font-normal text-zinc-600">(optional)</span>
						</label>
						{#if settings.openaiApiKey}
							<span class="font-mono text-[10px] text-emerald-500">
								saved: {mask(settings.openaiApiKey)}
							</span>
						{/if}
					</div>
					<div class="relative">
						<input
							id="openai-key"
							type={showOpenai ? 'text' : 'password'}
							placeholder="sk-..."
							bind:value={openaiKey}
							class="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 pr-16 font-mono text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
						/>
						<button
							type="button"
							onclick={() => (showOpenai = !showOpenai)}
							class="absolute inset-y-0 right-0 px-2 text-[10px] text-zinc-500 hover:text-zinc-300"
						>
							{showOpenai ? 'hide' : 'show'}
						</button>
					</div>
					<p class="mt-1 text-[10px] text-zinc-600">
						Only needed for gpt-* models.
					</p>
				</div>

				<div>
					<label for="default-model" class="mb-1.5 block text-[11px] font-medium text-zinc-400">
						Default model for new nodes
					</label>
					<select
						id="default-model"
						bind:value={defaultModel}
						class="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
					>
						<option value="claude-opus-4-6">claude-opus-4-6</option>
						<option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
						<option value="claude-haiku-4-5">claude-haiku-4-5</option>
						<option value="gpt-5">gpt-5</option>
						<option value="gpt-5-mini">gpt-5-mini</option>
					</select>
				</div>

				<p class="rounded border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-[10px] leading-relaxed text-amber-300/90">
					Keys never leave your machine. They are sent from your browser to the local
					SvelteKit server and passed as environment variables to the claw subprocess.
				</p>
			</div>

			<div class="flex items-center justify-end gap-2 border-t border-zinc-800 px-5 py-3">
				<button
					type="button"
					onclick={onClose}
					class="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={save}
					class="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
				>
					Save
				</button>
			</div>
		</div>
	</div>
{/if}
