<script lang="ts">
	import { settings, saveSettings } from '$lib/stores/settings.svelte';
	import { cacheSize, clearCache } from '$lib/stores/cache.svelte';
	import { CLAW_PERMISSION_MODES, type ClawPermissionMode } from '$lib/types/nodes';

	const permissionLabels: Record<ClawPermissionMode, string> = {
		'read-only': 'Read only',
		'workspace-write': 'Workspace write',
		'danger-full-access': 'Full access'
	};

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	let anthropicKey = $state('');
	let openaiKey = $state('');
	let zaiKey = $state('');
	let defaultModel = $state('claude-sonnet-4-6');
	let defaultPermission = $state<ClawPermissionMode>('workspace-write');
	let workspacePath = $state('');
	let showAnthropic = $state(false);
	let showOpenai = $state(false);
	let showZai = $state(false);

	$effect(() => {
		if (open) {
			anthropicKey = settings.anthropicApiKey;
			openaiKey = settings.openaiApiKey;
			zaiKey = settings.zaiApiKey;
			defaultModel = settings.defaultModel;
			defaultPermission = settings.defaultPermissionMode;
			workspacePath = settings.workspacePath;
			showAnthropic = false;
			showOpenai = false;
			showZai = false;
		}
	});

	function save() {
		saveSettings({
			anthropicApiKey: anthropicKey.trim(),
			openaiApiKey: openaiKey.trim(),
			zaiApiKey: zaiKey.trim(),
			defaultModel,
			defaultPermissionMode: defaultPermission,
			workspacePath: workspacePath.trim()
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
		if (key.length < 8) return '--------';
		return `${key.slice(0, 6)}------${key.slice(-4)}`;
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
			class="w-[520px] max-w-[90vw] rounded-xl border border-border bg-surface-raised shadow-2xl"
		>
			<div class="flex items-start justify-between border-b border-border px-5 py-3">
				<div>
					<div class="text-[10px] font-semibold tracking-widest text-fg-3 uppercase">
						Settings
					</div>
					<h2 id="settings-title" class="mt-0.5 text-sm font-medium text-fg">
						API keys &amp; defaults
					</h2>
				</div>
				<button
					type="button"
					onclick={onClose}
					aria-label="Close settings"
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

			<div class="flex flex-col gap-5 p-5">
				<div>
					<div class="mb-1.5 flex items-center justify-between">
						<label for="anthropic-key" class="text-[11px] font-medium text-fg-2">
							Anthropic API key
						</label>
						{#if settings.anthropicApiKey}
							<span class="font-mono text-[10px] text-accent">
								saved: {mask(settings.anthropicApiKey)}
							</span>
						{:else}
							<span class="text-[10px] text-fg-muted">not set</span>
						{/if}
					</div>
					<div class="relative">
						<input
							id="anthropic-key"
							type={showAnthropic ? 'text' : 'password'}
							placeholder="sk-ant-..."
							bind:value={anthropicKey}
							class="w-full rounded border border-border bg-surface px-2.5 py-1.5 pr-16 font-mono text-xs text-fg focus:border-accent focus:outline-none"
						/>
						<button
							type="button"
							onclick={() => (showAnthropic = !showAnthropic)}
							class="absolute inset-y-0 right-0 px-2 text-[10px] text-fg-3 hover:text-fg-2"
						>
							{showAnthropic ? 'hide' : 'show'}
						</button>
					</div>
					<p class="mt-1 text-[10px] text-fg-muted">
						Used for claude-* models. Stored in browser localStorage.
					</p>
				</div>

				<div>
					<div class="mb-1.5 flex items-center justify-between">
						<label for="openai-key" class="text-[11px] font-medium text-fg-2">
							OpenAI API key
							<span class="ml-1 font-normal text-fg-muted">(optional)</span>
						</label>
						{#if settings.openaiApiKey}
							<span class="font-mono text-[10px] text-accent">
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
							class="w-full rounded border border-border bg-surface px-2.5 py-1.5 pr-16 font-mono text-xs text-fg focus:border-accent focus:outline-none"
						/>
						<button
							type="button"
							onclick={() => (showOpenai = !showOpenai)}
							class="absolute inset-y-0 right-0 px-2 text-[10px] text-fg-3 hover:text-fg-2"
						>
							{showOpenai ? 'hide' : 'show'}
						</button>
					</div>
					<p class="mt-1 text-[11px] text-fg-muted">
						Only needed for gpt-* models.
					</p>
				</div>

				<div>
					<div class="mb-1.5 flex items-center justify-between">
						<label for="zai-key" class="text-[11px] font-medium text-fg-2">
							Z.AI API key
							<span class="ml-1 font-normal text-fg-muted">(optional)</span>
						</label>
						{#if settings.zaiApiKey}
							<span class="font-mono text-[10px] text-accent">
								saved: {mask(settings.zaiApiKey)}
							</span>
						{/if}
					</div>
					<div class="relative">
						<input
							id="zai-key"
							type={showZai ? 'text' : 'password'}
							placeholder="your-api-key"
							bind:value={zaiKey}
							class="w-full rounded border border-border bg-surface px-2.5 py-1.5 pr-16 font-mono text-xs text-fg focus:border-accent focus:outline-none"
						/>
						<button
							type="button"
							onclick={() => (showZai = !showZai)}
							class="absolute inset-y-0 right-0 px-2 text-[10px] text-fg-3 hover:text-fg-2"
						>
							{showZai ? 'hide' : 'show'}
						</button>
					</div>
					<p class="mt-1 text-[11px] text-fg-muted">
						Only needed for glm-* models.
					</p>
				</div>

				<div>
					<label for="default-model" class="mb-1.5 block text-[11px] font-medium text-fg-2">
						Default model for new nodes
					</label>
					<select
						id="default-model"
						bind:value={defaultModel}
						class="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-xs text-fg focus:border-accent focus:outline-none"
					>
						<option value="claude-opus-4-6">claude-opus-4-6</option>
						<option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
						<option value="claude-haiku-4-5">claude-haiku-4-5</option>
						<option value="gpt-5">gpt-5</option>
						<option value="gpt-5-mini">gpt-5-mini</option>
						<option value="glm-5.1">glm-5.1 (Z.AI)</option>
					</select>
				</div>

				<div>
					<label for="default-permission" class="mb-1.5 block text-[11px] font-medium text-fg-2">
						Default permission mode
					</label>
					<select
						id="default-permission"
						bind:value={defaultPermission}
						class="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-xs text-fg focus:border-accent focus:outline-none"
					>
						{#each CLAW_PERMISSION_MODES as mode (mode)}
							<option value={mode}>{permissionLabels[mode]}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="workspace-path" class="mb-1.5 block text-[11px] font-medium text-fg-2">
						Workspace path
						<span class="ml-1 font-normal text-fg-muted">where claw reads/writes files</span>
					</label>
					<input
						id="workspace-path"
						type="text"
						placeholder="/home/user/my-project"
						bind:value={workspacePath}
						class="w-full rounded border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-fg focus:border-accent focus:outline-none"
					/>
					<p class="mt-1 text-[11px] text-fg-muted">
						{#if workspacePath.trim()}
							Nodes will run in this directory.
						{:else}
							Empty = claw runs in the claw-tree server directory (apps/web).
						{/if}
					</p>
				</div>

				<p class="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-300">
					Keys never leave your machine. They are sent from your browser to the local
					SvelteKit server and passed as environment variables to the claw subprocess.
				</p>

				<div>
					<div class="mb-1.5 flex items-center justify-between">
						<span class="text-[11px] font-medium text-fg-2">Node output cache</span>
						<span class="font-mono text-[10px] text-fg-3">{cacheSize()} entries</span>
					</div>
					<button
						type="button"
						onclick={clearCache}
						class="w-full rounded border border-border px-3 py-1.5 text-xs text-fg-2 hover:border-danger/40 hover:text-danger"
					>
						Clear cache
					</button>
					<p class="mt-1 text-[10px] text-fg-muted">
						Nodes skip re-running when their inputs match a prior successful run. Cached results
						show a badge on the node card.
					</p>
				</div>
			</div>

			<div class="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
				<button
					type="button"
					onclick={onClose}
					class="rounded border border-border bg-surface-overlay px-3 py-1 text-xs text-fg-2 hover:text-fg"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={save}
					class="btn-push rounded bg-accent px-3 py-1 text-xs font-medium text-surface"
				>
					Save
				</button>
			</div>
		</div>
	</div>
{/if}
