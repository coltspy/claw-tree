export interface CanvasHelpers {
	screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
	focusNode: (nodeId: string) => void;
	fitView: () => void;
}

export const canvas = $state<{ helpers: CanvasHelpers | null }>({
	helpers: null
});

export function setCanvasHelpers(helpers: CanvasHelpers | null) {
	canvas.helpers = helpers;
}
