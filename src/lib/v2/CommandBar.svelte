<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '../sim/store';
  import { office } from '../stores/office';

  // Prompt-style command bar: pick an agent, type the task, Enter to dispatch. ⌘K / Ctrl+K focuses it.
  // Command bar kiểu prompt AI: chọn agent, gõ task, Enter để giao. ⌘K / Ctrl+K để focus.
  let text = $state('');
  let target = $state(store.getState().agents[0]?.id ?? '');
  let input: HTMLInputElement;
  let flash = $state('');

  // Follow the selected agent so the bar always targets what the user is looking at.
  // Bám theo agent đang chọn để command bar luôn nhắm đúng agent đang xem.
  const selectedId = $derived($office.selectedAgentId);
  $effect(() => {
    if (selectedId) target = selectedId;
  });
  const agent = $derived($office.agents.find((a) => a.id === target));

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function send(e: SubmitEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !agent) return;
    store.assignTask(agent.id, t);
    flash = `Đã giao cho ${agent.name}`;
    text = '';
    setTimeout(() => (flash = ''), 1800);
  }
</script>

<form class="bar" onsubmit={send}>
  <label class="to" >
    <i></i>
    <select bind:value={target} aria-label="Chọn agent">
      {#each $office.agents as a (a.id)}<option value={a.id}>@{a.name}</option>{/each}
    </select>
  </label>
  <input bind:this={input} bind:value={text} placeholder={flash || `Giao việc cho ${agent?.name ?? 'agent'}…`} aria-label="Nội dung task" />
  <kbd>⌘K</kbd>
  <button type="submit" disabled={!text.trim()} aria-label="Gửi">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  </button>
</form>

<style>
  .bar {
    position: relative; display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 10px;
    width: min(680px, 100%); margin: 0 auto; border-radius: 999px;
    background: rgba(18, 19, 23, 0.8); backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  }
  .bar:focus-within { border-color: rgba(255, 255, 255, 0.28); box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.04), 0 20px 50px rgba(0, 0, 0, 0.5); }
  .to { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.06); }
  .to i { width: 8px; height: 8px; border-radius: 50%; background: rgba(255, 255, 255, 0.6); }
  select { background: transparent; border: 0; color: #eef1ff; font: 600 13px 'Space Grotesk', sans-serif; outline: none; cursor: pointer; }
  select option { background: #141519; }
  input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; color: #eef1ff; font: 400 14.5px 'Space Grotesk', sans-serif; padding: 8px 4px; }
  input::placeholder { color: rgba(255, 255, 255, 0.32); }
  kbd { font: 10px 'JetBrains Mono', monospace; color: var(--h-muted); border: 1px solid var(--h-line); border-radius: 6px; padding: 2px 6px; }
  button { width: 38px; height: 38px; border-radius: 50%; border: 0; display: grid; place-items: center; color: #08090b; cursor: pointer; background: #f2f3f5; transition: opacity 0.2s, transform 0.2s; }
  button:disabled { opacity: 0.3; cursor: not-allowed; }
  button:not(:disabled):hover { transform: scale(1.06); }
  @media (max-width: 600px) { kbd { display: none; } }
</style>
