<script lang="ts">
  import HoloApp from '$lib/v2/HoloApp.svelte';
</script>

<svelte:head><title>Agent OS · v2</title></svelte:head>

<HoloApp />
<a class="switch" href="/">← Bản 3D</a>

<style>
  .switch {
    position: fixed; right: 20px; bottom: 26px; z-index: 5; font: 600 12px 'Space Grotesk', sans-serif;
    color: #9ef6ff; text-decoration: none; padding: 6px 12px; border-radius: 999px;
    background: rgba(16, 18, 36, 0.6); border: 1px solid rgba(160, 175, 255, 0.15); backdrop-filter: blur(12px);
  }
  @media (max-width: 960px) { .switch { top: 14px; bottom: auto; } }
</style>
