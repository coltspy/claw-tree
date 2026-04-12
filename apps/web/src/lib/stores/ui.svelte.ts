const STORAGE_KEY = 'claw-tree:ui';

interface UiState {
	chatOpen: boolean;
}

const DEFAULTS: UiState = {
	chatOpen: false
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

export function toggleChat() {
	ui.chatOpen = !ui.chatOpen;
	persist();
}

export function setChatOpen(open: boolean) {
	ui.chatOpen = open;
	persist();
}
