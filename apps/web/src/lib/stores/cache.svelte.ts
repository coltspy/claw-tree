const STORAGE_KEY = 'claw-tree:node-cache';
const MAX_ENTRIES = 200;

export interface CachedResult {
	output: string;
	sessionId?: string;
	costUsd?: number;
	inputTokens?: number;
	outputTokens?: number;
	cachedAt: number;
}

interface CacheStore {
	entries: Record<string, CachedResult>;
}

function load(): CacheStore {
	if (typeof localStorage === 'undefined') return { entries: {} };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { entries: {} };
		const parsed = JSON.parse(raw);
		return { entries: parsed.entries ?? {} };
	} catch {
		return { entries: {} };
	}
}

export const cache = $state<CacheStore>(load());

function persist() {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
	} catch {
		const keys = Object.keys(cache.entries);
		const sorted = keys
			.map((k) => [k, cache.entries[k].cachedAt] as const)
			.sort((a, b) => a[1] - b[1]);
		for (let i = 0; i < Math.floor(keys.length / 2); i++) {
			delete cache.entries[sorted[i][0]];
		}
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
		} catch {
			// give up silently — quota exhausted
		}
	}
}

export async function computeCacheKey(input: {
	prompt: string;
	model: string;
	permissionMode?: string;
	allowedTools?: string[];
	outputFormat?: string;
	resumeSessionId?: string;
}): Promise<string> {
	const normalized = JSON.stringify({
		prompt: input.prompt,
		model: input.model,
		permissionMode: input.permissionMode ?? 'default',
		allowedTools: (input.allowedTools ?? []).slice().sort(),
		outputFormat: input.outputFormat ?? 'text',
		resumeSessionId: input.resumeSessionId ?? null
	});
	const encoder = new TextEncoder();
	const data = encoder.encode(normalized);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export function getCached(key: string): CachedResult | null {
	return cache.entries[key] ?? null;
}

export function setCached(key: string, result: Omit<CachedResult, 'cachedAt'>) {
	cache.entries[key] = { ...result, cachedAt: Date.now() };
	const keys = Object.keys(cache.entries);
	if (keys.length > MAX_ENTRIES) {
		const sorted = keys
			.map((k) => [k, cache.entries[k].cachedAt] as const)
			.sort((a, b) => a[1] - b[1]);
		for (let i = 0; i < keys.length - MAX_ENTRIES; i++) {
			delete cache.entries[sorted[i][0]];
		}
	}
	persist();
}

export function clearCache() {
	cache.entries = {};
	persist();
}

export function cacheSize(): number {
	return Object.keys(cache.entries).length;
}

export const cacheControl = $state({
	bypassNext: false
});

export function bypassCacheForNextRun() {
	cacheControl.bypassNext = true;
}
