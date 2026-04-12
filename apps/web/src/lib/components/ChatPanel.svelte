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
	<aside class="flex w-96 shrink-0 flex-col border-l border-zinc-800 bg-zinc-900">
		<header class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
			<div class="min-w-0">
				<div class="text-sm font-medium text-zinc-100">Chat</div>
				{#if chat.sessionId}
					<div class="mt-0.5 font-mono text-[10px] text-zinc-500">
						session {chat.sessionId.slice(0, 8)}…
					</div>
				{:else}
					<div class="mt-0.5 font-mono text-[10px] text-zinc-600">no session yet</div>
				{/if}
			</div>
			<div class="flex items-center gap-1">
				<button
					type="button"
					onclick={() => newChat()}
					disabled={chat.sending}
					aria-label="New chat"
					title="New chat"
					class="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-500"
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
					class="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
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
					<div class="text-xs text-zinc-500">Start a conversation with claw</div>
					<div class="mt-1 text-[11px] text-zinc-600">
						Messages here share memory with workflow nodes via --resume
					</div>
				</div>
			{:else}
				{#each chat.messages as msg (msg.id)}
					{#if msg.role === 'user'}
						<div
							class="ml-auto max-w-[85%] rounded-lg border border-emerald-900/50 bg-emerald-900/30 px-3 py-2 text-xs whitespace-pre-wrap text-zinc-100"
						>
							{msg.content}
						</div>
					{:else}
						<div class="mr-auto max-w-[85%]">
							<div
								class="rounded-lg border border-zinc-800 bg-zinc-800/60 px-3 py-2 text-xs whitespace-pre-wrap text-zinc-200"
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
								<div class="mt-1 font-mono text-[10px] text-zinc-600">{footerLine(msg)}</div>
							{/if}
						</div>
					{/if}
				{/each}
			{/if}
		</div>

		<div class="border-t border-zinc-800 p-3">
			<textarea
				rows="3"
				bind:value={draft}
				onkeydown={handleKeydown}
				disabled={chat.sending}
				placeholder="Ask claw anything. Shift+Enter for new line."
				class="w-full resize-none rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
			></textarea>
			<div class="mt-2 flex items-center justify-between">
				<span class="text-[10px] text-zinc-600">Enter to send · Shift+Enter newline</span>
				{#if chat.sending}
					<button
						type="button"
						onclick={() => cancelChat()}
						class="rounded border border-zinc-700 bg-zinc-800 px-3 py-1 text-[11px] font-medium text-zinc-200 hover:border-zinc-600 hover:bg-zinc-700"
					>
						Cancel
					</button>
				{:else}
					<button
						type="button"
						onclick={submit}
						disabled={draft.trim().length === 0}
						class="rounded border border-emerald-600 bg-emerald-600 px-3 py-1 text-[11px] font-medium text-zinc-950 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500"
					>
						Send
					</button>
				{/if}
			</div>
		</div>
	</aside>
{/if}
