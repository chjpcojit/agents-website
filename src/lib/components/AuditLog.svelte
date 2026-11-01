<script lang="ts">
  import { ago, office } from '../stores/office';
</script>

<!-- Audit log: who approved/assigned what. / Audit log: ai duyệt/giao gì. -->
<div class="audit">
  {#each $office.audit as e (e.id)}
    <div class="history-row">
      <span class="dot {e.actor === 'system' ? 's-expired' : 's-approved'}"></span>
      <span class="grow"><b>{e.actor}</b> · {e.action}</span>
      <time>{ago($office.now, e.ts)}</time>
    </div>
  {/each}
</div>
