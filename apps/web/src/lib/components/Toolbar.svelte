<script lang="ts">
	import StatusIndicator from './StatusIndicator.svelte';
	import SettingsModal from './SettingsModal.svelte';
	import { workflow, clearWorkflow, loadWorkflow } from '$lib/stores/workflow.svelte';
	import { execution, runWorkflow, cancelWorkflow } from '$lib/stores/execution.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { ui, toggleChat } from '$lib/stores/ui.svelte';

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
	class="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4"
>
	<div class="flex items-center gap-3">
		<span class="text-sm font-semibold tracking-tight text-zinc-100">claw-tree</span>
	</div>

	<div class="flex items-center gap-4">
		<span class="text-xs text-zinc-500">{nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}</span>
		<StatusIndicator status={serverStatus} version={serverVersion} />
		<button
			type="button"
			onclick={toggleChat}
			aria-label="Toggle chat panel"
			aria-pressed={ui.chatOpen}
			class="rounded border px-2.5 py-1 text-[11px] transition-colors {ui.chatOpen
				? 'border-emerald-600 bg-emerald-600/10 text-emerald-400'
				: 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'}"
		>
			Chat
		</button>
		<button
			type="button"
			onclick={() => (settingsOpen = true)}
			aria-label="Open settings"
			title={keySet ? 'Settings' : 'Settings — no API key set'}
			class="relative rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="3" />
				<path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
			</svg>
			{#if !keySet}
				<span class="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-amber-400"></span>
			{/if}
		</button>
		<div class="flex items-center gap-2">
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
				class="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
			>
				Load
			</button>
			<button
				type="button"
				onclick={clearWorkflow}
				disabled={nodeCount === 0}
				class="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
			>
				Clear
			</button>
			<button
				type="button"
				onclick={handleSave}
				disabled={nodeCount === 0}
				class="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
			>
				Save
			</button>
			{#if execution.running}
				<button
					type="button"
					onclick={cancelWorkflow}
					class="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500"
				>
					Cancel
				</button>
			{:else}
				<button
					type="button"
					onclick={runWorkflow}
					disabled={!canRun}
					class="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
				>
					Run
				</button>
			{/if}
		</div>
	</div>

	<SettingsModal open={settingsOpen} onClose={() => (settingsOpen = false)} />

	{#if hasErrors}
		<div class="absolute top-12 right-4 z-50 max-w-md rounded border border-red-900 bg-red-950/90 p-3 shadow-lg">
			<div class="mb-1 flex items-center justify-between">
				<span class="text-[11px] font-semibold text-red-300">Cannot run workflow</span>
				<button
					type="button"
					onclick={() => (execution.errors = [])}
					class="text-red-400 hover:text-red-200"
					aria-label="Dismiss"
				>
					<svg class="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
					</svg>
				</button>
			</div>
			<ul class="space-y-0.5 text-[11px] text-red-200">
				{#each execution.errors as err (err.message)}
					<li>• {err.message}</li>
				{/each}
			</ul>
		</div>
	{/if}
</header>
