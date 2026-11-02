<script lang="ts">
  // Tiny circular gauge. / Đồng hồ tròn nhỏ.
  let { value, size = 34, color = '#9ef6ff', label = '' }: { value: number; size?: number; color?: string; label?: string } = $props();
  const r = $derived(size / 2 - 3);
  const len = $derived(2 * Math.PI * r);
</script>

<svg width={size} height={size} viewBox="0 0 {size} {size}" aria-label="{label} {Math.round(value * 100)}%">
  <circle cx={size / 2} cy={size / 2} {r} fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3" />
  <circle
    cx={size / 2}
    cy={size / 2}
    {r}
    fill="none"
    stroke={color}
    stroke-width="3"
    stroke-linecap="round"
    stroke-dasharray="{len * Math.min(1, Math.max(0, value))} {len}"
    transform="rotate(-90 {size / 2} {size / 2})"
    style="transition: stroke-dasharray .6s"
  />
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#eef1ff" font-size={size * 0.28} font-family="JetBrains Mono, monospace">{Math.round(value * 100)}</text>
</svg>
