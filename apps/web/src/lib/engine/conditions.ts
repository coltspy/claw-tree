export interface ConditionContext {
	output: string;
	error?: string;
	status: string;
}

export class ConditionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConditionError';
	}
}

export function evaluateCondition(
	expression: string,
	ctx: ConditionContext
): boolean {
	if (!expression.trim()) return true;
	try {
		const fn = new Function(
			'output',
			'error',
			'status',
			`"use strict"; return (${expression});`
		);
		return Boolean(fn(ctx.output, ctx.error ?? '', ctx.status));
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new ConditionError(`Condition "${expression}" failed: ${message}`);
	}
}

export function isConditionValid(expression: string): true | string {
	if (!expression.trim()) return true;
	try {
		new Function(
			'output',
			'error',
			'status',
			`"use strict"; return (${expression});`
		);
		return true;
	} catch (err) {
		return err instanceof Error ? err.message : String(err);
	}
}
