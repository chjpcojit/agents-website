<script lang="ts">
  import { api } from '../api/mock';
  import { office } from '../stores/office';

  // Floating approval cards: tool permissions + agent questions, timeout → deny.
  // Decisions go through OfficeApi (POST /approvals/{id}/decision).
  // Thẻ duyệt nổi: quyền tool + câu hỏi của agent, hết giờ → deny.
  // Quyết định đi qua OfficeApi (POST /approvals/{id}/decision).
  const agents = $derived(new Map($office.agents.map((a) => [a.id, a])));
  const pending = $derived($office.approvals.filter((a) => a.status === 'pending').slice(0, 2));
  const more = $derived($office.approvals.filter((a) => a.status === 'pending').length - pending.length);
  const C = 2 * Math.PI * 13;
</script>

{#if pending.length}
  <section class="stack" aria-label="Yêu cầu duyệt">
    <h2>CẦN ANH DUYỆT</h2>
    {#each pending as ap (ap.id)}
      {@const a = agents.get(ap.agentId)}
      {@const left = Math.max(0, (ap.deadline - $office.now) / 1000)}
      {@const frac = left / Math.max(1, (ap.deadline - ap.createdAt) / 1000)}
      <article class="card" class:high={ap.risk === 'high'} style:--c={a?.color ?? '#9ef6ff'}>
        <header>
          <span class="who"><i></i>{a?.name}</span>
          <span class="kind">{ap.type === 'tool' ? ap.tool : 'HỎI'}</span>
          {#if ap.risk === 'high'}<span class="risk">HIGH-RISK</span>{/if}
          <svg class="timer" width="32" height="32" viewBox="0 0 32 32" aria-label="{Math.ceil(left)} giây">
            <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="2.5" />
            <circle cx="16" cy="16" r="13" fill="none" stroke={left < 20 ? '#ff5c7c' : '#ffc46b'} stroke-width="2.5" stroke-linecap="round" stroke-dasharray="{C * frac} {C}" transform="rotate(-90 16 16)" />
            <text x="16" y="17" dominant-baseline="middle" text-anchor="middle">{Math.ceil(left)}</text>
          </svg>
        </header>
        {#if ap.type === 'tool'}
          <code>$ {ap.summary}</code>
        {:else}
          <p>{ap.summary}</p>
        {/if}
        <div class="acts">
          {#if ap.type === 'tool'}
            <button class="go" onclick={() => void api.postDecision(ap.id, { decision: 'approve' })}>Approve</button>
            <button onclick={() => void api.postDecision(ap.id, { decision: 'deny' })}>Deny</button>
          {:else}
            {#each ap.options ?? [] as o (o)}
              <button onclick={() => void api.postDecision(ap.id, { decision: 'answer', answer: o })}>{o}</button>
            {/each}
          {/if}
        </div>
      </article>
    {/each}
    {#if more > 0}<small class="more">+{more} yêu cầu khác</small>{/if}
  </section>
{/if}

<style>
  .stack { display: flex; flex-direction: column; gap: 10px; width: 100%; flex: none; }
  h2 { font: 600 10px 'JetBrains Mono', monospace; letter-spacing: 3px; color: #ffc46b; margin: 0; }
  .card {
    background: var(--h-glass); border: 1px solid var(--h-line); border-radius: 16px; padding: 12px 14px;
    backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); animation: in 0.35s ease-out;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 10px 30px rgba(0, 0, 0, 0.35);
  }
  .card.high { border-color: rgba(255, 92, 124, 0.45); box-shadow: 0 0 0 1px rgba(255, 92, 124, 0.15), 0 0 24px rgba(255, 92, 124, 0.15); }
  @keyframes in { from { opacity: 0; transform: translateY(-6px); } }
  header { display: flex; align-items: center; gap: 8px; }
  .who { display: inline-flex; align-items: center; gap: 6px; font: 600 13px 'Space Grotesk', sans-serif; }
  .who i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); box-shadow: 0 0 10px var(--c); }
  .kind, .risk { font: 600 9px 'JetBrains Mono', monospace; letter-spacing: 1.5px; padding: 2px 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.06); color: var(--h-muted); }
  .risk { background: rgba(255, 92, 124, 0.15); color: #ff8aa1; }
  .timer { margin-left: auto; }
  .timer text { fill: #eef1ff; font: 500 9px 'JetBrains Mono', monospace; }
  code { display: block; margin: 10px 0 4px; font: 12px 'JetBrains Mono', monospace; color: #9ef6ff; background: rgba(0, 0, 0, 0.35); padding: 8px 10px; border-radius: 10px; overflow-wrap: anywhere; }
  p { margin: 10px 0 4px; font: 500 13.5px 'Space Grotesk', sans-serif; }
  .acts { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  button { font: 600 12px 'Space Grotesk', sans-serif; color: #eef1ff; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--h-line); border-radius: 10px; padding: 6px 12px; cursor: pointer; transition: background 0.2s, border-color 0.2s; }
  button:hover { border-color: rgba(158, 246, 255, 0.5); }
  button.go { background: linear-gradient(135deg, #5ef2ff, #9b7bff); color: #05060c; border-color: transparent; }
  .more { font: 11px 'JetBrains Mono', monospace; color: var(--h-muted); }
</style>
