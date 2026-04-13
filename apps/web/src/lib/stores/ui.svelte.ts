const STORAGE_KEY = 'claw-tree:ui';

type Theme = 'dark' | 'light';

interface UiState {
	chatOpen: boolean;
	theme: Theme;
}

const DEFAULTS: UiState = {
	chatOpen: false,
	theme: 'dark'
};

function load(): UiState {
	if (typeof localStorage === 'undefined') return { ...DEFAULTS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULTS };
		return { ...DEFAULTS, ...JSON.parse(raw) };
	} catch {
		return { ...DEFAULTS };
	}
}

export const ui = $state<UiState>(load());

function persist() {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(ui));
	} catch {
		// ignore quota errors
	}
}

function applyTheme(theme: Theme) {
	if (typeof document === 'undefined') return;
	document.documentElement.setAttribute('data-theme', theme);
}

applyTheme(ui.theme);

export function toggleChat() {
	ui.chatOpen = !ui.chatOpen;
	persist();
}

export function setChatOpen(open: boolean) {
	ui.chatOpen = open;
	persist();
}

export function toggleTheme() {
	ui.theme = ui.theme === 'dark' ? 'light' : 'dark';
	applyTheme(ui.theme);
	persist();
}

export function setTheme(theme: Theme) {
	ui.theme = theme;
	applyTheme(ui.theme);
	persist();
}
