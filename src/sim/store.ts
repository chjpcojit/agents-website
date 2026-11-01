import { COLLEAGUE, COMMANDS, QUESTIONS, TASK_IDEAS, createInitialState } from './mockData';
import type { Agent, Approval, BusMessage, OfficeState, StreamEvent, StreamKind, Task } from './types';

// Mock orchestrator: a client-side simulator that mimics what the real Go orchestrator will stream.
// Orchestrator giả lập: simulator chạy phía client, mô phỏng những gì orchestrator Go thật sẽ stream ra.

type Step =
  | { kind: 'stream'; type: StreamKind; text: string }
  | { kind: 'approval'; build: (agent: Agent, now: number) => Approval }
  | { kind: 'bus'; to: string; text: string }
  | { kind: 'fail'; error: string }
  | { kind: 'done' };

interface Runner {
  steps: Step[];
  index: number;
  nextAt: number;
}

const TICK_MS = 700;
const FLIGHT_MS = 1800;
const APPROVAL_TIMEOUT_MS = 90_000;
const MAX_STREAM = 400;
const MAX_BUS = 200;

let seq = 0;
/** Monotonic id generator (good enough for a demo). / Sinh id tăng dần (đủ dùng cho demo). */
const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)] as T;
const pairKey = (a: string, b: string) => [a, b].sort().join('|');

export class OfficeStore {
  private state: OfficeState;
  private readonly listeners = new Set<() => void>();
  private readonly runners = new Map<string, Runner>();
  /** Agent-to-agent turn counter per pair (anti-loop). / Bộ đếm lượt agent↔agent theo cặp (anti-loop). */
  private readonly turns = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const now = Date.now();
    this.state = createInitialState(now);
    // Resume scripts for agents that start in the "working" state.
    // Khởi động script cho các agent đang ở trạng thái "working".
    for (const a of this.state.agents) {
      const task = this.state.tasks.find((t) => t.id === a.currentTaskId);
      if (task && (a.status === 'working' || a.status === 'waiting')) {
        this.runners.set(a.id, { steps: this.buildScript(a, task).slice(3), index: 0, nextAt: now + 1500 + Math.random() * 2500 });
      }
    }
    for (const m of this.state.bus) {
      if (!m.to.startsWith('#')) this.turns.set(pairKey(m.from, m.to), m.turn);
    }
  }

  // ---- external store contract (useSyncExternalStore) / hợp đồng external store ----

  getState = (): OfficeState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private commit(next: Partial<OfficeState>): void {
    this.state = { ...this.state, ...next };
    for (const l of this.listeners) l();
  }

  // ---- user actions / hành động của người dùng ----

  select(agentId: string | null): void {
    this.commit({ selectedAgentId: agentId });
  }

  /** Assign work: run now if the agent is free and under concurrency limit, else queue. / Giao việc: chạy ngay nếu agent rảnh và chưa vượt concurrency limit, ngược lại xếp hàng. */
  assignTask(agentId: string, title: string): void {
    const clean = title.trim();
    if (!clean) return;
    const now = Date.now();
    const task: Task = { id: uid('t'), title: clean, assignee: agentId, status: 'queued', parentId: null, createdAt: now, updatedAt: now };
    this.commit({
      tasks: [...this.state.tasks, task],
      audit: this.auditAdd('Đức', `Giao task "${clean}" cho ${this.name(agentId)}`),
    });
    this.pushStream(agentId, 'user', clean);
    this.tryStartQueued(now);
  }

  decide(approvalId: string, approve: boolean, answer?: string): void {
    const ap = this.state.approvals.find((a) => a.id === approvalId);
    if (!ap || ap.status !== 'pending') return;
    const status: Approval['status'] = ap.type === 'ask' ? 'answered' : approve ? 'approved' : 'denied';
    const label = ap.type === 'ask' ? `Trả lời "${answer ?? ''}" cho câu hỏi của ${this.name(ap.agentId)}` : `${approve ? 'Approve' : 'Deny'} ${ap.tool ?? ''}(${ap.summary}) cho ${this.name(ap.agentId)}`;
    this.resolveApproval(ap, status, 'Đức', answer);
    this.commit({ audit: this.auditAdd('Đức', label) });
  }

  togglePause(agentId: string): void {
    const a = this.agent(agentId);
    if (!a) return;
    if (a.status === 'paused') {
      this.patchAgent(agentId, { status: a.currentTaskId ? 'working' : 'idle' });
      const r = this.runners.get(agentId);
      if (r) r.nextAt = Date.now() + 800;
      this.pushStream(agentId, 'system', 'resumed');
    } else {
      this.patchAgent(agentId, { status: 'paused' });
      this.pushStream(agentId, 'system', 'paused bởi Đức');
    }
    this.commit({ audit: this.auditAdd('Đức', `${a.status === 'paused' ? 'Resume' : 'Pause'} ${a.name}`) });
  }

  cancel(agentId: string): void {
    const a = this.agent(agentId);
    if (!a || !a.currentTaskId) return;
    const taskId = a.currentTaskId;
    this.runners.delete(agentId);
    this.setTask(taskId, 'cancelled');
    this.expirePendingFor(agentId);
    this.patchAgent(agentId, { status: 'idle', currentTaskId: null });
    this.pushStream(agentId, 'system', 'interrupt · task cancelled');
    this.commit({ audit: this.auditAdd('Đức', `Cancel task của ${a.name}`) });
  }

  /** Retry a failed agent's last task. / Chạy lại task lỗi gần nhất của agent. */
  retry(agentId: string): void {
    const a = this.agent(agentId);
    if (!a || a.status !== 'error') return;
    const failed = [...this.state.tasks].reverse().find((t) => t.assignee === agentId && t.status === 'failed');
    this.patchAgent(agentId, { status: 'idle', lastError: null });
    if (failed) {
      this.setTask(failed.id, 'queued');
      this.pushStream(agentId, 'system', `retry "${failed.title}"`);
    }
    this.tryStartQueued(Date.now());
  }

  /** Simulate /compact: shrink context usage. / Giả lập /compact: giảm context usage. */
  compact(agentId: string): void {
    const a = this.agent(agentId);
    if (!a) return;
    this.patchAgent(agentId, { context: Math.max(0.08, a.context * 0.35) });
    this.pushStream(agentId, 'system', '/compact · conversation summarized');
  }

  // ---- simulation loop / vòng lặp mô phỏng ----

  private tick(): void {
    const now = Date.now();
    this.commit({ now, flights: this.state.flights.filter((f) => now - f.startedAt < FLIGHT_MS) });

    // Timeout → default deny. / Hết giờ → mặc định deny.
    for (const ap of this.state.approvals) {
      if (ap.status === 'pending' && now >= ap.deadline) {
        this.resolveApproval(ap, 'expired', 'system');
        this.commit({ audit: this.auditAdd('system', `Timeout → deny ${ap.tool ?? 'ask'}(${ap.summary}) của ${this.name(ap.agentId)}`) });
      }
    }

    for (const a of this.state.agents) {
      if (a.status !== 'working') continue;
      const r = this.runners.get(a.id);
      if (!r || now < r.nextAt) continue;
      const step = r.steps[r.index++];
      r.nextAt = now + 1800 + Math.random() * 2600;
      if (step) this.runStep(a, step, now);
    }

    this.tryStartQueued(now);
    this.maybeInventWork(now);

    // Shared Max quota drifts up with every running agent. / Quota Max dùng chung tăng dần theo số agent đang chạy.
    const running = this.state.agents.filter((a) => a.status === 'working').length;
    const q = this.state.quota;
    this.commit({
      quota: { ...q, fiveHour: Math.min(0.99, q.fiveHour + running * 0.00025), weekly: Math.min(0.99, q.weekly + running * 0.00004) },
    });
  }

  private runStep(a: Agent, step: Step, now: number): void {
    this.patchAgent(a.id, { context: Math.min(0.97, a.context + 0.01 + Math.random() * 0.025) });
    switch (step.kind) {
      case 'stream':
        this.pushStream(a.id, step.type, step.text);
        break;
      case 'approval': {
        const ap = step.build(a, now);
        this.commit({ approvals: [ap, ...this.state.approvals].slice(0, 60) });
        this.patchAgent(a.id, { status: 'waiting' });
        this.pushStream(a.id, 'system', ap.type === 'ask' ? `hỏi Đức: ${ap.summary}` : `chờ duyệt quyền: ${ap.tool}(${ap.summary})`);
        break;
      }
      case 'bus':
        this.sendBus(a.id, step.to, step.text, now);
        break;
      case 'fail': {
        this.pushStream(a.id, 'error', step.error);
        if (a.currentTaskId) this.setTask(a.currentTaskId, 'failed');
        this.runners.delete(a.id);
        this.patchAgent(a.id, { status: 'error', lastError: step.error, currentTaskId: null });
        this.sendBus(a.id, '#general', `Em bị lỗi rồi 😵 ${step.error}`, now);
        break;
      }
      case 'done': {
        if (a.currentTaskId) this.setTask(a.currentTaskId, Math.random() < 0.5 ? 'review' : 'done');
        this.runners.delete(a.id);
        this.patchAgent(a.id, { status: 'idle', currentTaskId: null });
        break;
      }
    }
  }

  /** Office bus send with anti-loop guard. / Gửi tin qua office bus có chặn loop. */
  private sendBus(from: string, to: string, text: string, now: number): void {
    let turn = 1;
    let blocked = false;
    if (!to.startsWith('#')) {
      const key = pairKey(from, to);
      turn = (this.turns.get(key) ?? 0) + 1;
      this.turns.set(key, turn);
      blocked = turn > this.state.turnLimit;
    }
    const msg: BusMessage = { id: uid('b'), from, to, text, ts: now, turn, blocked };
    const extra: BusMessage[] = blocked
      ? [{ id: uid('b'), from: 'system', to: '#general', text: `anti-loop: chặn ${this.name(from)} → ${this.name(to)} (vượt ${this.state.turnLimit} lượt)`, ts: now, turn: 0 }]
      : [];
    this.commit({
      bus: [...this.state.bus, msg, ...extra].slice(-MAX_BUS),
      flights: blocked || to.startsWith('#') ? this.state.flights : [...this.state.flights, { id: msg.id, from, to, startedAt: now }],
    });
  }

  private resolveApproval(ap: Approval, status: Approval['status'], by: string, answer?: string): void {
    this.commit({ approvals: this.state.approvals.map((x) => (x.id === ap.id ? { ...x, status, decidedBy: by, answer } : x)) });
    const a = this.agent(ap.agentId);
    if (!a || a.status !== 'waiting') return;
    const ok = status === 'approved' || status === 'answered';
    this.pushStream(ap.agentId, ok ? 'tool_result' : 'error',
      status === 'answered' ? `Đức trả lời: ${answer}` : ok ? `${ap.tool}(${ap.summary}) · ok` : `permission ${status === 'expired' ? 'timeout → denied' : 'denied'}: ${ap.summary}`);
    this.patchAgent(ap.agentId, { status: 'working' });
    const r = this.runners.get(ap.agentId);
    if (r) {
      r.nextAt = Date.now() + 900;
      // On deny the agent tries a safer route instead. / Khi bị deny, agent đổi sang hướng an toàn hơn.
      if (!ok) r.steps.splice(r.index, 0, { kind: 'stream', type: 'assistant', text: 'OK, em bỏ bước đó và làm theo hướng an toàn hơn.' });
    }
  }

  private expirePendingFor(agentId: string): void {
    this.commit({ approvals: this.state.approvals.map((x) => (x.agentId === agentId && x.status === 'pending' ? { ...x, status: 'denied', decidedBy: 'system' } : x)) });
  }

  /** Start queued tasks while respecting the concurrency limit (shared Max quota). / Chạy task trong queue, tôn trọng concurrency limit (quota Max dùng chung). */
  private tryStartQueued(now: number): void {
    for (const t of this.state.tasks) {
      if (t.status !== 'queued') continue;
      const active = this.state.agents.filter((a) => a.status === 'working' || a.status === 'waiting').length;
      if (active >= this.state.concurrencyLimit) return;
      const a = this.agent(t.assignee);
      if (!a || a.status !== 'idle') continue;
      this.setTask(t.id, 'running');
      this.patchAgent(a.id, { status: 'working', currentTaskId: t.id });
      this.runners.set(a.id, { steps: this.buildScript(a, t), index: 0, nextAt: now + 600 });
    }
  }

  /** Keep the office lively: idle agents sometimes get new work. / Giữ văn phòng sôi động: agent rảnh thỉnh thoảng nhận việc mới. */
  private maybeInventWork(now: number): void {
    if (Math.random() > 0.035) return;
    const idle = this.state.agents.filter((a) => a.status === 'idle');
    if (idle.length === 0) return;
    const a = pick(idle);
    const title = pick(TASK_IDEAS[a.role]);
    const task: Task = { id: uid('t'), title, assignee: a.id, status: 'queued', parentId: null, createdAt: now, updatedAt: now };
    this.commit({ tasks: [...this.state.tasks, task] });
    this.pushStream(a.id, 'user', `${title} (từ Cam)`);
  }

  /** Script that roughly mirrors a Claude Code turn. / Script mô phỏng gần đúng một lượt Claude Code. */
  private buildScript(a: Agent, t: Task): Step[] {
    const peer = COLLEAGUE[a.role];
    const cmds = COMMANDS[a.role];
    const safe = cmds.find((c) => c.risk === 'low') ?? cmds[0];
    const risky = cmds.find((c) => c.risk === 'high');
    const steps: Step[] = [
      { kind: 'stream', type: 'system', text: `session resumed · claude -p --resume ${a.sessionId}` },
      { kind: 'stream', type: 'assistant', text: `Đã nhận "${t.title}". Em đọc code liên quan trước.` },
      { kind: 'stream', type: 'tool_call', text: `Grep "${t.title.split(' ').slice(-2).join(' ')}" ./` },
      { kind: 'stream', type: 'tool_result', text: `${2 + Math.floor(Math.random() * 6)} matches` },
      { kind: 'stream', type: 'tool_call', text: `Read ${a.role === 'frontend' ? 'src/App.tsx' : a.role === 'mobile' ? 'lib/main.dart' : a.role === 'devops' ? 'infra/main.tf' : 'internal/usecase/service.go'}` },
    ];
    if (Math.random() < 0.7 && peer !== a.id) {
      steps.push({ kind: 'bus', to: peer, text: pick([`Mình đang làm "${t.title}", có đụng phần của bạn không?`, 'Contract API chỗ này giữ nguyên nhé?', 'Bạn review giúp mình đoạn này sau nhé 🙏']) });
    }
    steps.push({ kind: 'stream', type: 'tool_call', text: `Edit ${a.worktree.replace('~/office/wt/', '')}/… (+${10 + Math.floor(Math.random() * 90)} −${Math.floor(Math.random() * 20)})` });
    if (Math.random() < 0.55) {
      const q = QUESTIONS[a.role];
      const useAsk = Math.random() < 0.35 || !risky;
      steps.push({
        kind: 'approval',
        build: (_agent, now) =>
          useAsk
            ? { id: uid('ap'), agentId: a.id, type: 'ask', summary: q.q, detail: `${a.name} hỏi qua office bus (ask_user)`, risk: 'low', options: q.options, createdAt: now, deadline: now + APPROVAL_TIMEOUT_MS, status: 'pending' }
            : { id: uid('ap'), agentId: a.id, type: 'tool', tool: 'Bash', summary: risky?.cmd ?? safe?.cmd ?? 'true', detail: `permission-prompt-tool · worktree ${a.worktree}`, risk: risky?.risk ?? 'low', createdAt: now, deadline: now + APPROVAL_TIMEOUT_MS, status: 'pending' },
      });
    }
    steps.push({ kind: 'stream', type: 'tool_call', text: `Bash ${safe?.cmd ?? 'true'}` });
    if (Math.random() < 0.12) {
      steps.push({ kind: 'fail', error: `Bash(${safe?.cmd}) exit 1 · ${1 + Math.floor(Math.random() * 3)} failed` });
      return steps;
    }
    steps.push({ kind: 'stream', type: 'tool_result', text: 'ok · all checks passed' });
    steps.push({ kind: 'stream', type: 'assistant', text: `Xong "${t.title}". Em đã để summary trong task log.` });
    steps.push({ kind: 'done' });
    return steps;
  }

  // ---- helpers ----

  private agent(id: string): Agent | undefined {
    return this.state.agents.find((a) => a.id === id);
  }

  private name(id: string): string {
    if (id === 'user') return 'Đức';
    if (id.startsWith('#')) return id;
    return this.agent(id)?.name ?? id;
  }

  private patchAgent(id: string, patch: Partial<Agent>): void {
    this.commit({ agents: this.state.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  }

  private setTask(id: string, status: Task['status']): void {
    const now = Date.now();
    this.commit({ tasks: this.state.tasks.map((t) => (t.id === id ? { ...t, status, updatedAt: now } : t)) });
  }

  private pushStream(agentId: string, kind: StreamKind, text: string): void {
    const ev: StreamEvent = { id: uid('s'), agentId, kind, text, ts: Date.now() };
    this.commit({ stream: [...this.state.stream, ev].slice(-MAX_STREAM) });
  }

  private auditAdd(actor: string, action: string) {
    return [{ id: uid('au'), ts: Date.now(), actor, action }, ...this.state.audit].slice(0, 100);
  }
}

export const store = new OfficeStore();
