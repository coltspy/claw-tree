<script lang="ts">
	import StatusIndicator from './StatusIndicator.svelte';
	import SettingsModal from './SettingsModal.svelte';
	import { workflow, clearWorkflow, loadWorkflow } from '$lib/stores/workflow.svelte';
	import { execution, runWorkflow, cancelWorkflow } from '$lib/stores/execution.svelte';
	import { settings, saveSettings } from '$lib/stores/settings.svelte';
	import { ui, toggleChat, toggleTheme } from '$lib/stores/ui.svelte';
	import { bypassCacheForNextRun } from '$lib/stores/cache.svelte';
	import type { Compression } from '$lib/types/nodes';

	const cavemanOptions: { value: Compression; label: string; hint: string }[] = [
		{ value: 'off', label: 'Off', hint: 'Full verbose output' },
		{ value: 'lite', label: 'Lite', hint: 'Concise, no filler' },
		{ value: 'full', label: 'Full', hint: 'Maximum brevity' }
	];

	let cavemanOpen = $state(false);

	const cavemanLabel = $derived(
		cavemanOptions.find((o) => o.value === settings.globalCompression)?.label ?? 'Off'
	);

	function runIgnoringCache() {
		bypassCacheForNextRun();
		void runWorkflow();
	}

	let serverStatus = $state<'connected' | 'disconnected' | 'checking'>('checking');
	let serverVersion = $state<string | null>(null);
	let settingsOpen = $state(false);

	const keySet = $derived(
		settings.anthropicApiKey.length > 0 || settings.openaiApiKey.length > 0
	);

	const nodeCount = $derived(workflow.nodes.length);
	const canRun = $derived(nodeCount > 0 && !execution.running);
	const hasErrors = $derived(execution.errors.length > 0);

	const HEALTH_POLL_MS = 10_000;

	async function checkHealth() {
		try {
			const response = await fetch('/api/health');
			if (response.ok) {
				const body = (await response.json()) as { version?: string };
				serverStatus = 'connected';
				serverVersion = body.version ?? null;
			} else {
				serverStatus = 'disconnected';
				serverVersion = null;
			}
		} catch {
			serverStatus = 'disconnected';
			serverVersion = null;
		}
	}

	$effect(() => {
		checkHealth();
		const interval = setInterval(checkHealth, HEALTH_POLL_MS);
		return () => clearInterval(interval);
	});

	let fileInput: HTMLInputElement | null = $state(null);

	function handleSave() {
		const data = JSON.stringify(
			{ nodes: workflow.nodes, edges: workflow.edges },
			null,
			2
		);
		const blob = new Blob([data], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'workflow.clawtree.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	async function handleFileChange(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		target.value = '';
		if (!file) return;

		try {
			const text = await file.text();
			const data = JSON.parse(text);
			const result = loadWorkflow(data);
			if (!result.success) {
				execution.errors = [{ message: `Load failed: ${result.error}` }];
			} else {
				execution.errors = [];
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			execution.errors = [{ message: `Load failed: ${message}` }];
		}
	}
</script>

<header
	class="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface-raised px-4"
>
	<div class="flex items-center gap-2.5">
		<span class="text-sm font-semibold tracking-tight text-fg">claw-tree</span>
		<StatusIndicator status={serverStatus} version={serverVersion} />
	</div>

	<div class="flex items-center gap-1.5">
		{#if execution.running}
			<button
				type="button"
				onclick={cancelWorkflow}
				class="btn-push btn-push-danger rounded-md bg-danger px-4 py-1.5 text-xs font-medium text-white"
			>
				Cancel
			</button>
		{:else}
			<div class="btn-push flex items-center rounded-md bg-accent" class:btn-push-disabled={!canRun}>
				<button
					type="button"
					onclick={runWorkflow}
					disabled={!canRun}
					class="rounded-l-md px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-hover/20 disabled:cursor-not-allowed disabled:opacity-40"
				>
					Run
				</button>
				<span class="my-1.5 w-px self-stretch bg-white/20"></span>
				<button
					type="button"
					onclick={runIgnoringCache}
					disabled={!canRun}
					title="Run ignoring cache (Ctrl+Shift+Enter)"
					aria-label="Run ignoring cache"
					class="rounded-r-md px-2 py-1.5 text-xs font-medium text-white hover:bg-accent-hover/20 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
						<path d="M13.5 8a5.5 5.5 0 11-1.6-3.9M13.5 3v3H10.5" />
					</svg>
				</button>
			</div>
		{/if}

		<div class="mx-1.5 h-4 w-px bg-border"></div>

		<div class="relative">
			<button
				type="button"
				onclick={() => (cavemanOpen = !cavemanOpen)}
				class="flex items-center gap-1.5 rounded-md bg-surface-overlay px-2.5 py-1.5 text-xs transition-colors hover:brightness-110"
			>
				<span class="text-fg-3">Caveman</span>
				<span class="font-medium {settings.globalCompression === 'off' ? 'text-fg-muted' : 'text-accent'}">{cavemanLabel}</span>
				<svg class="h-3 w-3 text-fg-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
					<path d="M4 6l4 4 4-4" />
				</svg>
			</button>
			{#if cavemanOpen}
				<button
					type="button"
					aria-label="Close menu"
					onclick={() => (cavemanOpen = false)}
					class="fixed inset-0 z-40 cursor-default"
				></button>
				<div class="absolute top-full right-0 z-50 mt-1 w-44 rounded-lg border border-border bg-surface-raised shadow-xl">
					{#each cavemanOptions as opt (opt.value)}
						<button
							type="button"
							onclick={() => { saveSettings({ globalCompression: opt.value }); cavemanOpen = false; }}
							class="flex w-full flex-col px-3 py-2 text-left transition-colors first:rounded-t-lg last:rounded-b-lg {settings.globalCompression === opt.value
								? 'bg-accent-dim'
								: 'hover:bg-surface-overlay'}"
						>
							<span class="text-xs font-medium {settings.globalCompression === opt.value ? 'text-accent' : 'text-fg'}">{opt.label}</span>
							<span class="text-[11px] {settings.globalCompression === opt.value ? 'text-accent/60' : 'text-fg-3'}">{opt.hint}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="mx-1.5 h-4 w-px bg-border"></div>

		<input
			bind:this={fileInput}
			type="file"
			accept=".json,application/json"
			onchange={handleFileChange}
			class="hidden"
		/>
		<button
			type="button"
			onclick={() => fileInput?.click()}
			class="rounded-md px-3 py-1.5 text-xs text-fg-2 hover:bg-surface-overlay hover:text-fg"
		>
			Load
		</button>
		<button
			type="button"
			onclick={handleSave}
			disabled={nodeCount === 0}
			class="rounded-md px-3 py-1.5 text-xs text-fg-2 hover:bg-surface-overlay hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
		>
			Save
		</button>
		<button
			type="button"
			onclick={clearWorkflow}
			disabled={nodeCount === 0}
			class="rounded-md px-3 py-1.5 text-xs text-fg-2 hover:bg-surface-overlay hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
		>
			Clear
		</button>

		<div class="mx-1.5 h-4 w-px bg-border"></div>

		<button
			type="button"
			onclick={toggleChat}
			aria-label="Toggle chat panel"
			aria-pressed={ui.chatOpen}
			class="flex h-8 w-8 items-center justify-center rounded-lg {ui.chatOpen
				? 'bg-accent-dim text-accent'
				: 'text-fg-3 hover:bg-surface-overlay hover:text-fg'}"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
				<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
			</svg>
		</button>

		<button
			type="button"
			onclick={toggleTheme}
			aria-label="Toggle theme"
			class="flex h-8 w-8 items-center justify-center rounded-lg text-fg-3 hover:bg-surface-overlay hover:text-fg"
		>
			{#if ui.theme === 'dark'}
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="5" />
					<line x1="12" y1="1" x2="12" y2="3" />
					<line x1="12" y1="21" x2="12" y2="23" />
					<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
					<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
					<line x1="1" y1="12" x2="3" y2="12" />
					<line x1="21" y1="12" x2="23" y2="12" />
					<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
					<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
				</svg>
			{:else}
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
				</svg>
			{/if}
		</button>

		<button
			type="button"
			onclick={() => (settingsOpen = true)}
			aria-label="Open settings"
			title={keySet ? 'Settings' : 'Settings — no API key set'}
			class="relative flex h-8 w-8 items-center justify-center rounded-lg text-fg-3 hover:bg-surface-overlay hover:text-fg"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="3" />
				<path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
			</svg>
			{#if !keySet}
				<span class="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400"></span>
			{/if}
		</button>
	</div>

	<SettingsModal open={settingsOpen} onClose={() => (settingsOpen = false)} />

	{#if hasErrors}
		<div class="absolute top-12 right-4 z-50 max-w-md rounded-lg border border-danger/30 bg-surface-raised p-3 shadow-lg">
			<div class="mb-1.5 flex items-center justify-between">
				<span class="text-xs font-semibold text-danger">Cannot run workflow</span>
				<button
					type="button"
					onclick={() => (execution.errors = [])}
					class="flex h-5 w-5 items-center justify-center rounded text-fg-3 hover:text-fg"
					aria-label="Dismiss"
				>
					<svg class="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
					</svg>
				</button>
			</div>
			<ul class="space-y-0.5 text-xs text-fg-2">
				{#each execution.errors as err (err.message)}
					<li class="leading-relaxed">{err.message}</li>
				{/each}
			</ul>
		</div>
	{/if}
</header>
