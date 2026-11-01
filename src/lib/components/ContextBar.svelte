<script lang="ts">
  let { value }: { value: number } = $props();
  const pct = $derived(Math.round(value * 100));
</script>

<div class="ctxbar" title="Context {pct}%">
  <div class="bar" class:warn={pct >= 60 && pct < 80} class:danger={pct >= 80} class:ok={pct < 60}>
    <i style:width="{pct}%"></i>
  </div>
  <small>context {pct}%</small>
</div>
