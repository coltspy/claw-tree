import { describe, it, expect } from 'vitest';
import { evaluateCondition, isConditionValid, ConditionError } from './conditions';

const ctx = (output: string, status = 'done', error?: string) => ({
	output,
	status,
	error
});

describe('evaluateCondition', () => {
	it('returns true for an empty expression', () => {
		expect(evaluateCondition('', ctx('hello'))).toBe(true);
		expect(evaluateCondition('   ', ctx('hello'))).toBe(true);
	});

	it('evaluates a simple includes check', () => {
		expect(evaluateCondition("output.includes('ERROR')", ctx('ERROR found'))).toBe(true);
		expect(evaluateCondition("output.includes('ERROR')", ctx('all good'))).toBe(false);
	});

	it('evaluates length comparisons', () => {
		expect(evaluateCondition('output.length > 5', ctx('hello world'))).toBe(true);
		expect(evaluateCondition('output.length > 5', ctx('hi'))).toBe(false);
	});

	it('supports boolean logic', () => {
		expect(
			evaluateCondition(
				"output.includes('ok') && status === 'done'",
				ctx('all ok', 'done')
			)
		).toBe(true);
		expect(
			evaluateCondition(
				"output.includes('ok') && status === 'done'",
				ctx('all ok', 'error')
			)
		).toBe(false);
	});

	it('supports the logical OR', () => {
		expect(
			evaluateCondition(
				"output.includes('FAIL') || output.includes('ERROR')",
				ctx('tests FAIL')
			)
		).toBe(true);
		expect(
			evaluateCondition(
				"output.includes('FAIL') || output.includes('ERROR')",
				ctx('all good')
			)
		).toBe(false);
	});

	it('supports negation', () => {
		expect(evaluateCondition('!error', ctx('ok', 'done'))).toBe(true);
		expect(evaluateCondition('!error', ctx('oops', 'error', 'bad thing'))).toBe(false);
	});

	it('throws ConditionError on invalid syntax', () => {
		expect(() => evaluateCondition('output.', ctx('x'))).toThrow(ConditionError);
	});

	it('coerces truthy values to true', () => {
		expect(evaluateCondition("'yes'", ctx('x'))).toBe(true);
		expect(evaluateCondition("''", ctx('x'))).toBe(false);
		expect(evaluateCondition('1', ctx('x'))).toBe(true);
		expect(evaluateCondition('0', ctx('x'))).toBe(false);
	});

	it('does not leak globals into the condition scope', () => {
		expect(() => evaluateCondition('process.exit(0)', ctx('x'))).toThrow(ConditionError);
	});
});

describe('isConditionValid', () => {
	it('returns true for empty and valid expressions', () => {
		expect(isConditionValid('')).toBe(true);
		expect(isConditionValid("output.includes('x')")).toBe(true);
	});

	it('returns an error message for malformed expressions', () => {
		const result = isConditionValid('output.');
		expect(typeof result).toBe('string');
	});
});
