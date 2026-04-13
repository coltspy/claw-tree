import type { ClawPermissionMode, Compression } from '$lib/types/nodes';

const STORAGE_KEY = 'claw-tree:settings';

export interface Settings {
	anthropicApiKey: string;
	openaiApiKey: string;
	zaiApiKey: string;
	defaultModel: string;
	defaultPermissionMode: ClawPermissionMode;
	globalCompression: Compression;
	workspacePath: string;
}

const DEFAULTS: Settings = {
	anthropicApiKey: '',
	openaiApiKey: '',
	zaiApiKey: '',
	defaultModel: 'claude-sonnet-4-6',
	defaultPermissionMode: 'workspace-write',
	globalCompression: 'off',
	workspacePath: ''
};

function load(): Settings {
	if (typeof localStorage === 'undefined') return { ...DEFAULTS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULTS };
		const parsed = JSON.parse(raw);
		return { ...DEFAULTS, ...parsed };
	} catch {
		return { ...DEFAULTS };
	}
}

export const settings = $state<Settings>(load());

export function saveSettings(patch: Partial<Settings>) {
	Object.assign(settings, patch);
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// localStorage may be full or disabled — settings will persist in memory for the session
	}
}

export function clearSettings() {
	Object.assign(settings, DEFAULTS);
	if (typeof localStorage !== 'undefined') {
		localStorage.removeItem(STORAGE_KEY);
	}
}

export function hasAnyApiKey(): boolean {
	return settings.anthropicApiKey.length > 0 || settings.openaiApiKey.length > 0 || settings.zaiApiKey.length > 0;
}
