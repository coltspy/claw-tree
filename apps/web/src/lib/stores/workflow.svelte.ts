import type { Node, Edge } from '@xyflow/svelte';
import type {
	NodeType,
	NodeStatus,
	FailurePolicy,
	ClawPermissionMode,
	ClawTool,
	OutputFormat
} from '$lib/types/nodes';
import { canvas } from './canvas.svelte';

export interface NodeData extends Record<string, unknown> {
	label: string;
	nodeType: NodeType;
	prompt: string;
	model: string;
	path?: string;
	failurePolicy: FailurePolicy;
	retryCount?: number;
	permissionMode?: ClawPermissionMode;
	allowedTools?: ClawTool[];
	outputFormat?: OutputFormat;
	resumeFromPrevious?: boolean;
	status: NodeStatus;
	output?: string;
	error?: string;
	costUsd?: number;
	inputTokens?: number;
	outputTokens?: number;
	sessionId?: string;
	fromCache?: boolean;
}

export interface EdgeData extends Record<string, unknown> {
	condition?: string;
}

export const workflow = $state({
	nodes: [] as Node<NodeData>[],
	edges: [] as Edge[]
});

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const CHEAP_MODEL = 'claude-haiku-4-5';
const DEFAULT_PERMISSION_MODE: 'read-only' | 'workspace-write' | 'danger-full-access' =
	'workspace-write';

const MODEL_OVERRIDES: Partial<Record<NodeType, string>> = {
	summarize: CHEAP_MODEL
};

const NODE_DEFAULTS: Record<NodeType, { label: string; prompt: string }> = {
	security: {
		label: 'Security Scan',
		prompt: `You are a senior application security engineer. Audit the current working directory for security issues.

Focus on:
- Injection vulnerabilities (SQL, command, XSS, template)
- Authentication and authorization flaws
- Secrets, API keys, or credentials committed to source
- Unsafe deserialization, eval, or file operations
- Missing input validation at trust boundaries

For each finding, report in this exact format:

<finding>
  <severity>critical | high | medium | low</severity>
  <location>file:line</location>
  <issue>one-line description</issue>
  <fix>one-sentence suggested fix</fix>
</finding>

If you find no issues, say "No security issues found." on a single line.
Do not flag stylistic concerns.`
	},
	test: {
		label: 'Run Tests',
		prompt: `Run the project's test suite and report the result.

Use the appropriate command for the project (e.g. \`npm test\`, \`cargo test\`,
\`pytest\`). If you're unsure which command to use, inspect package.json,
Cargo.toml, or pyproject.toml first.

Report the result in this exact format:

<result>
Command: <the command you ran>
Total: <N>
Passed: <N>
Failed: <N>
Skipped: <N>
</result>

If any tests failed, quote the failure output (test name, file, and error
message) for each. If the suite can't be run at all, explain why in one
sentence.`
	},
	review: {
		label: 'Review',
		prompt: `You are reviewing the output of a prior workflow step. Assess whether the
step achieved its goal and whether anything looks wrong, incomplete, or
suspicious.

<prior_output>
{{previous.output}}
</prior_output>

Reply in two sections:

1. **Status**: exactly one of \`ok\`, \`warning\`, or \`error\` on its own line.
2. **Notes**: up to 3 bullet points, each a single sentence, covering what
   stood out and what the next step should consider.

Be specific. Cite concrete details from the prior output. If everything
looks clean, say so briefly.`
	},
	confirm: {
		label: 'Confirm',
		prompt: `You are an independent reviewer. Verify that the output below is correct
and complete. Do not trust it blindly — cross-check claims, re-run the
reasoning in your head, and look for subtle errors or omissions.

<output_to_verify>
{{previous.output}}
</output_to_verify>

Respond with:

- **Verdict**: one of \`confirmed\`, \`needs_changes\`, or \`rejected\`
- **Reasoning**: 1-3 sentences explaining the verdict
- **Issues** (only if not confirmed): bullet list of specific problems`
	},
	custom: { label: 'Custom Step', prompt: '' },
	pause: {
		label: 'Pause for approval',
		prompt: `Review the output of the previous step before continuing.

Check for:
- Unexpected side effects (files modified, commands run)
- Incorrect or suspicious results
- Anything that needs human judgment before proceeding

Approve to continue the workflow, or reject to halt it.`
	},
	plan: {
		label: 'Plan',
		prompt: `You are a senior engineer planning a task. Think step by step before
doing any work.

<task>
{{previous.output}}
</task>

Produce a numbered plan. For each step include:
- **What**: what specifically will be done
- **Where**: which files, directories, or components it touches
- **Why**: why the step is necessary
- **Risk**: what could go wrong or break

Keep the plan tight — 3 to 7 steps total. Do not execute anything yet.
Output only the plan.`
	},
	summarize: {
		label: 'Summarize',
		prompt: `Summarize the content below into a brief suitable for a human skimming a
dashboard.

<content>
{{previous.output}}
</content>

Format the response as:

- **TL;DR**: one sentence capturing the whole thing
- **Key points**: 3-5 bullets, each under 15 words
- **Action items** (only if applicable): bullets starting with a verb

Drop anything that isn't actionable or informative. Be ruthless about
cutting filler.`
	}
};

const STATE_ONLY_KEYS: (keyof NodeData)[] = [
	'status',
	'output',
	'error',
	'costUsd',
	'inputTokens',
	'outputTokens'
];

function isStateOnlyPatch(patch: Partial<NodeData>): boolean {
	const keys = Object.keys(patch) as (keyof NodeData)[];
	return keys.length > 0 && keys.every((k) => STATE_ONLY_KEYS.includes(k));
}

let recordHistoryHook: (() => void) | null = null;
let recordHistoryDebouncedHook: (() => void) | null = null;

export function setHistoryHooks(
	immediate: () => void,
	debounced: () => void
) {
	recordHistoryHook = immediate;
	recordHistoryDebouncedHook = debounced;
}

const SNAP = 20;

function snap(value: number): number {
	return Math.round(value / SNAP) * SNAP;
}

function gridSpawnPosition(): { x: number; y: number } {
	const count = workflow.nodes.length;
	return {
		x: snap(100 + (count % 4) * 280),
		y: snap(100 + Math.floor(count / 4) * 200)
	};
}

export function addNodeAt(
	type: NodeType,
	position: { x: number; y: number },
	options: { pan?: boolean } = {}
) {
	recordHistoryHook?.();
	const { label, prompt } = NODE_DEFAULTS[type];

	const snapped = { x: snap(position.x), y: snap(position.y) };
	const id = crypto.randomUUID();

	workflow.nodes.push({
		id,
		type: 'workflow',
		position: snapped,
		data: {
			label,
			nodeType: type,
			prompt,
			model: MODEL_OVERRIDES[type] ?? DEFAULT_MODEL,
			permissionMode: type === 'pause' ? undefined : DEFAULT_PERMISSION_MODE,
			failurePolicy: 'halt',
			status: 'idle'
		}
	});

	if (options.pan && canvas.helpers) {
		canvas.helpers.focusNode(id);
	}
}

export function addNode(type: NodeType) {
	addNodeAt(type, gridSpawnPosition(), { pan: true });
}

export function updateNodeData(id: string, patch: Partial<NodeData>) {
	const idx = workflow.nodes.findIndex((n) => n.id === id);
	if (idx === -1) return;
	if (!isStateOnlyPatch(patch)) {
		recordHistoryDebouncedHook?.();
	}
	const current = workflow.nodes[idx];
	workflow.nodes[idx] = {
		...current,
		data: { ...current.data, ...patch }
	};
}

export function removeNode(id: string) {
	recordHistoryHook?.();
	workflow.nodes = workflow.nodes.filter((n) => n.id !== id);
	workflow.edges = workflow.edges.filter((e) => e.source !== id && e.target !== id);
}

export function deselectAll() {
	workflow.nodes = workflow.nodes.map((n) =>
		n.selected ? { ...n, selected: false } : n
	);
	workflow.edges = workflow.edges.map((e) =>
		e.selected ? { ...e, selected: false } : e
	);
}

export function clearWorkflow() {
	recordHistoryHook?.();
	workflow.nodes = [];
	workflow.edges = [];
}

export type LoadResult = { success: true } | { success: false; error: string };

export function loadWorkflow(data: unknown): LoadResult {
	if (!data || typeof data !== 'object') {
		return { success: false, error: 'File is not a valid workflow object' };
	}

	const maybe = data as { nodes?: unknown; edges?: unknown };
	if (!Array.isArray(maybe.nodes) || !Array.isArray(maybe.edges)) {
		return { success: false, error: 'File is missing "nodes" or "edges" arrays' };
	}

	for (const n of maybe.nodes) {
		if (
			!n ||
			typeof n !== 'object' ||
			typeof (n as { id?: unknown }).id !== 'string' ||
			typeof (n as { data?: unknown }).data !== 'object'
		) {
			return { success: false, error: 'File contains a malformed node' };
		}
	}

	recordHistoryHook?.();
	workflow.nodes = (maybe.nodes as Node<NodeData>[]).map((n) => ({
		...n,
		selected: false,
		data: { ...n.data, status: 'idle', output: undefined, error: undefined }
	}));
	workflow.edges = (maybe.edges as Edge[]).map((e) => ({ ...e, selected: false }));

	return { success: true };
}
