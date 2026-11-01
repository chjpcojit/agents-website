<script lang="ts">
  import { onMount } from 'svelte';
  import { createOfficeScene, STATUS_COLOR, type OfficeSceneHandle } from '../scene/office';
  import { store } from '../sim/store';
  import type { AgentStatus } from '../sim/types';
  import { office } from '../stores/office';

  const LEGEND: [AgentStatus, string][] = [
    ['working', 'Đang làm'],
    ['waiting', 'Chờ duyệt/hỏi'],
    ['idle', 'Rảnh'],
    ['error', 'Lỗi'],
    ['paused', 'Tạm dừng'],
  ];

  let host: HTMLDivElement;
  let handle: OfficeSceneHandle | null = null;

  // Mount the imperative three.js scene once; state flows in via update().
  // Mount scene three.js (imperative) một lần; state đi vào qua update().
  onMount(() => {
    handle = createOfficeScene(host, store.getState(), (id) => store.select(id));
    return () => {
      handle?.dispose();
      handle = null;
    };
  });

  $effect(() => {
    handle?.update($office);
  });
</script>

<section class="scene-wrap" aria-label="Văn phòng 3D">
  <div bind:this={host} class="scene"></div>
  <div class="legend">
    {#each LEGEND as [s, label] (s)}
      <span><i style:background={STATUS_COLOR[s]}></i>{label}</span>
    {/each}
  </div>
  <div class="hint">Click nhân vật để xem chi tiết · kéo để xoay · cuộn để zoom</div>
</section>
