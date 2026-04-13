<script lang="ts">
	type Status = 'connected' | 'disconnected' | 'checking';

	interface Props {
		status: Status;
		version?: string | null;
	}

	let { status, version = null }: Props = $props();

	const dotClass = $derived(
		{
			connected: 'bg-accent',
			disconnected: 'bg-danger',
			checking: 'bg-amber-400 animate-pulse'
		}[status]
	);

	const title = $derived.by(() => {
		if (status === 'connected') return version ? `claw ${version} — connected` : 'Server online';
		if (status === 'disconnected') return 'claw binary not reachable — check CLAW_BIN or rebuild';
		return 'Pinging claw CLI...';
	});
</script>

<span class="inline-block h-1.5 w-1.5 rounded-full {dotClass}" {title}></span>
