<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ui } from '$lib/stores/ui.svelte';

	let { children } = $props();

	$effect(() => {
		document.documentElement.setAttribute('data-theme', ui.theme);
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
