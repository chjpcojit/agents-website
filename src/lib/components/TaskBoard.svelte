<script lang="ts">
  import { store } from '../sim/store';
  import type { TaskStatus } from '../sim/types';
  import { ago, office } from '../stores/office';
  import Avatar from './Avatar.svelte';

  // Kanban task board with a quick "new task" form. / Task board kiểu kanban kèm form tạo task nhanh.
  const COLUMNS: { key: TaskStatus[]; title: string }[] = [
    { key: ['queued'], title: 'Queue' },
    { key: ['running'], title: 'Đang làm' },
    { key: ['review'], title: 'Review' },
    { key: ['done', 'failed', 'cancelled'], title: 'Xong / Lỗi' },
  ];

  let title = $state('');
  let assignee = $state(store.getState().agents[0]?.id ?? '');
  const agents = $derived(new Map($office.agents.map((a) => [a.id, a])));

  function create(e: SubmitEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    store.assignTask(assignee, title);
    title = '';
  }
</script>

<div class="board-wrap">
  <form class="composer" onsubmit={create}>
    <input bind:value={title} placeholder="Task mới…" />
    <select bind:value={assignee} aria-label="Assignee">
      {#each $office.agents as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
    </select>
    <button class="primary" disabled={!title.trim()}>Tạo</button>
  </form>
  <div class="board">
    {#each COLUMNS as c (c.title)}
      {@const items = $office.tasks.filter((t) => c.key.includes(t.status)).slice(-12).reverse()}
      <div class="col">
        <h4>{c.title} <span>{items.length}</span></h4>
        {#each items as t (t.id)}
          {@const a = agents.get(t.assignee)}
          <button class="task s-{t.status}" onclick={() => store.select(t.assignee)}>
            <p>{t.title}</p>
            <div class="row between">
              <span class="row">
                {#if a}<Avatar agent={a} size={18} />{/if}
                <small>{a?.name}</small>
              </span>
              <small class="muted">
                {t.status === 'failed' ? 'lỗi' : t.status === 'cancelled' ? 'huỷ' : ago($office.now, t.updatedAt)}{t.parentId ? ' · subtask' : ''}
              </small>
            </div>
          </button>
        {/each}
      </div>
    {/each}
  </div>
</div>
