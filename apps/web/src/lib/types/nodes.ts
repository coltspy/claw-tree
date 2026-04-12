export type NodeType =
	| 'security'
	| 'test'
	| 'review'
	| 'confirm'
	| 'custom'
	| 'pause'
	| 'plan'
	| 'summarize';

export type OutputFormat = 'text' | 'json';

export type NodeStatus =
	| 'idle'
	| 'queued'
	| 'running'
	| 'done'
	| 'skipped'
	| 'error'
	| 'cancelled';

export type FailurePolicy = 'halt' | 'skip' | 'retry';

export const CLAW_PERMISSION_MODES = [
	'read-only',
	'workspace-write',
	'danger-full-access'
] as const;
export type ClawPermissionMode = (typeof CLAW_PERMISSION_MODES)[number];

export const CLAW_TOOLS_READ_ONLY = [
	'read_file',
	'glob_search',
	'grep_search',
	'WebFetch',
	'WebSearch',
	'Skill',
	'ToolSearch',
	'Sleep',
	'AskUserQuestion',
	'TaskGet',
	'TaskList',
	'TaskOutput'
] as const;

export const CLAW_TOOLS_WORKSPACE_WRITE = [
	'write_file',
	'edit_file',
	'TodoWrite',
	'NotebookEdit',
	'Config',
	'EnterPlanMode',
	'ExitPlanMode'
] as const;

export const CLAW_TOOLS_DANGER = [
	'bash',
	'Agent',
	'REPL',
	'PowerShell',
	'TaskCreate',
	'TaskStop',
	'TaskUpdate'
] as const;

export const CLAW_TOOLS_ALL = [
	...CLAW_TOOLS_READ_ONLY,
	...CLAW_TOOLS_WORKSPACE_WRITE,
	...CLAW_TOOLS_DANGER
] as const;

export type ClawTool = (typeof CLAW_TOOLS_ALL)[number];

export interface WorkflowNode {
	id: string;
	type: NodeType;
	label: string;
	prompt: string;
	model: string;
	path?: string;
	depends_on: string[];
	failure_policy: FailurePolicy;
	retry_count?: number;
	permission_mode?: ClawPermissionMode;
	allowed_tools?: ClawTool[];
	status: NodeStatus;
	output?: string;
	error?: string;
}

export interface WorkflowEdge {
	id: string;
	source: string;
	target: string;
}

export interface Workflow {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
}
