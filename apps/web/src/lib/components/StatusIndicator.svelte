<script lang="ts">
	type Status = 'connected' | 'disconnected' | 'checking';

	interface Props {
		status: Status;
		version?: string | null;
	}

	let { status, version = null }: Props = $props();

	const dotClass = $derived(
		{
			connected: 'bg-emerald-500',
			disconnected: 'bg-red-500',
			checking: 'bg-amber-400 animate-pulse'
		}[status]
	);

	const label = $derived.by(() => {
		if (status === 'connected') return version ? `claw ${version}` : 'Server online';
		if (status === 'disconnected') return 'Server offline';
		return 'Checking…';
	});

	const title = $derived(
		status === 'disconnected'
			? 'claw binary not reachable — check CLAW_BIN or rebuild'
			: status === 'connected'
				? 'claw CLI responded to --version'
				: 'Pinging claw CLI…'
	);
</script>

<div class="flex items-center gap-2 text-xs text-zinc-400" {title}>
	<span class="h-2 w-2 rounded-full {dotClass}"></span>
	<span>{label}</span>
</div>
