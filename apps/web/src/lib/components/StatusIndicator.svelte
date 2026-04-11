<script lang="ts">
	type Status = 'connected' | 'disconnected' | 'checking';

	interface Props {
		status: Status;
	}

	let { status }: Props = $props();

	const dotClass = $derived(
		{
			connected: 'bg-emerald-500',
			disconnected: 'bg-red-500',
			checking: 'bg-amber-400 animate-pulse'
		}[status]
	);

	const label = $derived(
		{
			connected: 'Server online',
			disconnected: 'Server offline',
			checking: 'Checking…'
		}[status]
	);
</script>

<div class="flex items-center gap-2 text-xs text-zinc-400">
	<span class="h-2 w-2 rounded-full {dotClass}"></span>
	<span>{label}</span>
</div>
