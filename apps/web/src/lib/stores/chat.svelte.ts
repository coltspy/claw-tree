import { settings } from './settings.svelte';

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: number;
	streaming?: boolean;
	error?: string;
	costUsd?: number;
	inputTokens?: number;
	outputTokens?: number;
}

const STORAGE_KEY = 'claw-tree:chat';
const MAX_MESSAGES = 200;
const META_MARKER = '<<<CLAW_TREE_META>>>';

interface PersistedChat {
	messages: ChatMessage[];
	sessionId: string | null;
}

function load(): PersistedChat {
	if (typeof localStorage === 'undefined') return { messages: [], sessionId: null };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { messages: [], sessionId: null };
		const parsed = JSON.parse(raw);
		return {
			messages: Array.isArray(parsed.messages) ? parsed.messages : [],
			sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : null
		};
	} catch {
		return { messages: [], sessionId: null };
	}
}

const initial = load();

export const chat = $state({
	messages: initial.messages as ChatMessage[],
	sessionId: initial.sessionId as string | null,
	sending: false as boolean
});

let abortController: AbortController | null = null;

function persist() {
	if (typeof localStorage === 'undefined') return;
	try {
		const toStore: PersistedChat = {
			messages: chat.messages.slice(-MAX_MESSAGES),
			sessionId: chat.sessionId
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
	} catch {
		// localStorage full — trim and retry
		chat.messages = chat.messages.slice(-Math.floor(MAX_MESSAGES / 2));
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({ messages: chat.messages, sessionId: chat.sessionId })
			);
		} catch {
			// give up silently
		}
	}
}

export function newChat() {
	abortController?.abort();
	chat.messages = [];
	chat.sessionId = null;
	chat.sending = false;
	persist();
}

export function cancelChat() {
	abortController?.abort();
}

function extractMeta(accumulated: string): {
	visible: string;
	meta: { sessionId?: string; costUsd?: number; inputTokens?: number; outputTokens?: number };
} {
	const idx = accumulated.lastIndexOf(META_MARKER);
	if (idx === -1) return { visible: accumulated, meta: {} };
	const visible = accumulated.slice(0, idx);
	const jsonPart = accumulated.slice(idx + META_MARKER.length).trim();
	try {
		const parsed = JSON.parse(jsonPart.split('\n')[0]);
		return { visible, meta: parsed };
	} catch {
		return { visible, meta: {} };
	}
}

export async function sendMessage(content: string) {
	const trimmed = content.trim();
	if (!trimmed || chat.sending) return;

	const userMsg: ChatMessage = {
		id: crypto.randomUUID(),
		role: 'user',
		content: trimmed,
		timestamp: Date.now()
	};
	const assistantMsg: ChatMessage = {
		id: crypto.randomUUID(),
		role: 'assistant',
		content: '',
		timestamp: Date.now(),
		streaming: true
	};

	chat.messages = [...chat.messages, userMsg, assistantMsg];
	chat.sending = true;
	persist();

	abortController = new AbortController();

	try {
		const response = await fetch('/api/run', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				prompt: trimmed,
				model: settings.defaultModel,
				resumeSessionId: chat.sessionId ?? undefined,
				anthropicApiKey: settings.anthropicApiKey || undefined,
				openaiApiKey: settings.openaiApiKey || undefined
			}),
			signal: abortController.signal
		});

		if (!response.ok) {
			const text = await response.text().catch(() => '');
			throw new Error(`Server ${response.status}: ${text || response.statusText}`);
		}

		const reader = response.body?.getReader();
		if (!reader) throw new Error('Server returned no response body');

		const decoder = new TextDecoder();
		let accumulated = '';

		for (;;) {
			const { value, done } = await reader.read();
			if (done) break;
			accumulated += decoder.decode(value, { stream: true });
			const { visible } = extractMeta(accumulated);
			updateLastAssistant({ content: visible });
		}

		const { visible, meta } = extractMeta(accumulated);
		updateLastAssistant({
			content: visible.trim(),
			streaming: false,
			costUsd: meta.costUsd,
			inputTokens: meta.inputTokens,
			outputTokens: meta.outputTokens
		});
		if (meta.sessionId) {
			chat.sessionId = meta.sessionId;
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		updateLastAssistant({
			content: '',
			streaming: false,
			error: abortController.signal.aborted ? 'Cancelled' : message
		});
	} finally {
		chat.sending = false;
		abortController = null;
		persist();
	}
}

function updateLastAssistant(patch: Partial<ChatMessage>) {
	const idx = chat.messages.findLastIndex((m) => m.role === 'assistant');
	if (idx === -1) return;
	chat.messages[idx] = { ...chat.messages[idx], ...patch };
}
