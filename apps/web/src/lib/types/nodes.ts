export type NodeType =
	| 'security'
	| 'test'
	| 'review'
	| 'confirm'
	| 'custom';

export type NodeStatus =
	| 'idle'
	| 'queued'
	| 'running'
	| 'done'
	| 'skipped'
	| 'error'
	| 'cancelled';

export type FailurePolicy = 'halt' | 'skip' | 'retry';

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
