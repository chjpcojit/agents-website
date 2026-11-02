<script lang="ts">
  import App from '$lib/components/App.svelte';
</script>

<App />
<a class="switch" href="/v2">Thử bản v2 →</a>

<style>
  .switch {
    position: fixed; right: 16px; bottom: 16px; z-index: 5; font: 700 12px Nunito, sans-serif; color: #3a3346;
    text-decoration: none; padding: 6px 12px; border-radius: 999px; background: #fff; box-shadow: 0 6px 20px rgba(120, 84, 60, 0.18);
  }
</style>
