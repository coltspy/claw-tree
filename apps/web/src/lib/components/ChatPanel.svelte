<script lang="ts">
	import {
		chat,
		sendMessage,
		newChat,
		cancelChat,
		type ChatMessage
	} from '$lib/stores/chat.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	let draft = $state('');
	let listEl: HTMLDivElement | null = $state(null);

	$effect(() => {
		const lastMsg = chat.messages[chat.messages.length - 1];
		const _ = chat.messages.length + (lastMsg?.content?.length ?? 0);
		void _;
		if (listEl) {
			listEl.scrollTop = listEl.scrollHeight;
		}
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			submit();
		}
	}

	function submit() {
		if (chat.sending) return;
		const text = draft.trim();
		if (!text) return;
		draft = '';
		void sendMessage(text);
	}

	function formatCost(n: number | undefined): string {
		if (n === undefined) return '';
		if (n < 0.0001) return '< $0.0001';
		if (n < 0.01) return `$${n.toFixed(4)}`;
		return `$${n.toFixed(3)}`;
	}

	function footerLine(msg: ChatMessage): string {
		const parts: string[] = [];
		if (msg.costUsd !== undefined) parts.push(formatCost(msg.costUsd));
		if (msg.inputTokens !== undefined) parts.push(`in:${msg.inputTokens}`);
		if (msg.outputTokens !== undefined) parts.push(`out:${msg.outputTokens}`);
		return parts.join(' · ');
	}

	function hasFooter(msg: ChatMessage): boolean {
		return (
			!msg.streaming &&
			(msg.costUsd !== undefined ||
				msg.inputTokens !== undefined ||
				msg.outputTokens !== undefined)
		);
	}
</script>

{#if open}
	<aside class="flex w-96 shrink-0 flex-col border-l border-border bg-surface-raised">
		<header class="flex items-center justify-between border-b border-border px-4 py-3">
			<div class="min-w-0">
				<div class="text-sm font-medium text-fg">Chat</div>
				{#if chat.sessionId}
					<div class="mt-0.5 font-mono text-[11px] text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100" title={chat.sessionId}>
						session {chat.sessionId.slice(0, 8)}
					</div>
				{/if}
			</div>
			<div class="flex items-center gap-1">
				<button
					type="button"
					onclick={() => newChat()}
					disabled={chat.sending}
					aria-label="New chat"
					title="New chat"
					class="rounded p-1.5 text-fg-3 hover:bg-surface-overlay hover:text-fg-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fg-3"
				>
					<svg
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.75"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="9" />
						<path d="M12 8v8M8 12h8" />
					</svg>
				</button>
				<button
					type="button"
					onclick={onClose}
					aria-label="Close panel"
					title="Close panel"
					class="rounded p-1.5 text-fg-3 hover:bg-surface-overlay hover:text-fg-2"
				>
					<svg
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.75"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M6 6l12 12M18 6L6 18" />
					</svg>
				</button>
			</div>
		</header>

		<div bind:this={listEl} class="flex-1 space-y-4 overflow-y-auto px-4 py-3">
			{#if chat.messages.length === 0}
				<div class="flex h-full flex-col items-center justify-center text-center">
					<div class="text-xs text-fg-3">Start a conversation with claw</div>
					<div class="mt-1 text-[11px] text-fg-muted">
						Messages here share memory with workflow nodes via --resume
					</div>
				</div>
			{:else}
				{#each chat.messages as msg (msg.id)}
					{#if msg.role === 'user'}
						<div
							class="ml-auto max-w-[85%] rounded-lg border border-accent/30 bg-accent-dim px-3 py-2 text-xs whitespace-pre-wrap text-fg"
						>
							{msg.content}
						</div>
					{:else}
						<div class="mr-auto max-w-[85%]">
							<div
								class="rounded-lg border border-border bg-surface-overlay px-3 py-2 text-xs whitespace-pre-wrap text-fg-2"
							>
								{#if msg.error}
									<span
										class="block rounded border border-red-900/50 bg-red-950/30 px-2 py-1 text-red-300"
									>
										{msg.error}
									</span>
								{:else}
									{msg.content}{#if msg.streaming}<span
											class="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400"
										></span>{/if}
								{/if}
							</div>
							{#if hasFooter(msg)}
								<div class="mt-1 font-mono text-[11px] text-fg-muted">{footerLine(msg)}</div>
							{/if}
						</div>
					{/if}
				{/each}
			{/if}
		</div>

		<div class="border-t border-border p-3">
			<textarea
				rows="3"
				bind:value={draft}
				onkeydown={handleKeydown}
				disabled={chat.sending}
				placeholder="Ask claw anything. Shift+Enter for new line."
				class="w-full resize-none rounded border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-fg focus:border-accent focus:outline-none disabled:opacity-60"
			></textarea>
			<div class="mt-2 flex items-center justify-between">
				<span class="text-[11px] text-fg-muted">Enter to send</span>
				{#if chat.sending}
					<button
						type="button"
						onclick={() => cancelChat()}
						class="rounded bg-surface-overlay px-3 py-1 text-[11px] font-medium text-fg-2 hover:text-fg"
					>
						Cancel
					</button>
				{:else}
					<button
						type="button"
						onclick={submit}
						disabled={draft.trim().length === 0}
						class="btn-push rounded bg-accent px-3 py-1 text-[11px] font-medium text-surface disabled:cursor-not-allowed disabled:opacity-40"
					>
						Send
					</button>
				{/if}
			</div>
		</div>
	</aside>
{/if}
