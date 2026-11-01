<script lang="ts">
  let { label, value, sub }: { label: string; value: number; sub: string } = $props();
  const pct = $derived(Math.round(value * 100));
</script>

<div class="meter" title="{label}: {pct}%">
  <div class="meter-head"><span>{label}</span><b>{pct}%</b></div>
  <div class="bar" class:warn={pct >= 65 && pct < 85} class:danger={pct >= 85}>
    <i style:width="{pct}%"></i>
  </div>
  <small>{sub}</small>
</div>
