export type ErrorAction =
	| { kind: 'open-settings' }
	| { kind: 'open-node-panel'; field: 'permissionMode' | 'allowedTools' | 'path' }
	| { kind: 'copy-command'; command: string }
	| { kind: 'none' };

export interface TranslatedError {
	code: string;
	title: string;
	body: string;
	hint?: string;
	action: ErrorAction;
}

interface Rule {
	code: string;
	pattern: RegExp;
	build: (match: RegExpExecArray) => Omit<TranslatedError, 'code'>;
}

const rules: Rule[] = [
	{
		code: 'missing-api-key',
		pattern: /missing\s+anthropic\s+credentials|ANTHROPIC_AUTH_TOKEN|ANTHROPIC_API_KEY/i,
		build: () => ({
			title: 'Missing Anthropic API key',
			body: 'Claw could not find an Anthropic credential in the environment.',
			hint: 'Click Settings to paste your Anthropic key.',
			action: { kind: 'open-settings' }
		})
	},
	{
		code: 'tool-denied',
		pattern: /tool '(\w+)' is not enabled/i,
		build: (match) => {
			const tool = match[1];
			return {
				title: `Tool '${tool}' is not allowed`,
				body: `The current node configuration blocks the '${tool}' tool from running.`,
				hint: `Add '${tool}' to the node's Allowed Tools, or switch Permission mode.`,
				action: { kind: 'open-node-panel', field: 'allowedTools' }
			};
		}
	},
	{
		code: 'permission-denied',
		pattern: /permission\s+denied/i,
		build: () => ({
			title: 'Permission denied',
			body: 'A workspace-write operation was blocked by the current permission mode.',
			hint: 'This tool needs workspace-write or higher. Open the node panel and upgrade permission.',
			action: { kind: 'open-node-panel', field: 'permissionMode' }
		})
	},
	{
		code: 'session-not-found',
		pattern: /session\s+(?:file\s+)?not\s+found|no\s+managed\s+sessions/i,
		build: () => ({
			title: 'Session not found',
			body: 'Claw could not resume the upstream session for this node.',
			hint: "The upstream session wasn't saved. Try disabling 'Continue session' on this node.",
			action: { kind: 'none' }
		})
	},
	{
		code: 'rate-limit',
		pattern: /rate\s+limit|429/i,
		build: () => ({
			title: 'Rate limited',
			body: 'Anthropic returned a rate-limit response for this request.',
			hint: 'Anthropic rate-limited this key. Wait 30s and retry, or switch to a smaller model.',
			action: { kind: 'none' }
		})
	},
	{
		code: 'path-not-found',
		pattern: /no\s+such\s+file|path.+not\s+found/i,
		build: () => ({
			title: 'Path not found',
			body: 'The working directory or file path provided to claw does not exist.',
			hint: "The target path doesn't exist. Check the Path field in the node panel.",
			action: { kind: 'open-node-panel', field: 'path' }
		})
	}
];

export function translateError(raw: string): TranslatedError | null {
	for (const rule of rules) {
		const match = rule.pattern.exec(raw);
		if (match) {
			return { code: rule.code, ...rule.build(match) };
		}
	}
	return null;
}
