import { store } from '../sim/store';
import type { ApprovalListResponse, DecisionRequest, OfficeApi, ServerEvent } from './contract';

// In-memory OfficeApi backed by the simulator; diffs store snapshots into SSE-shaped events.
// OfficeApi in-memory dựa trên simulator; so sánh snapshot store để sinh event đúng hình dạng SSE.

export class MockOfficeApi implements OfficeApi {
  async listApprovals(): Promise<ApprovalListResponse> {
    return { items: store.getState().approvals };
  }

  async postDecision(approvalId: string, body: DecisionRequest): Promise<void> {
    if (body.decision === 'answer') {
      const answer = body.answer.trim();
      // Mirror a 400 from the real API on an empty answer. / Mô phỏng lỗi 400 của API thật khi answer rỗng.
      if (!answer) throw new Error('answer must not be empty / answer không được rỗng');
      store.decide(approvalId, true, answer);
      return;
    }
    store.decide(approvalId, body.decision === 'approve');
  }

  subscribeEvents(onEvent: (e: ServerEvent) => void): () => void {
    let prev = store.getState();
    return store.subscribe(() => {
      const next = store.getState();
      if (next.approvals !== prev.approvals) {
        const before = new Map(prev.approvals.map((a) => [a.id, a]));
        for (const a of next.approvals) {
          const old = before.get(a.id);
          if (!old) onEvent({ type: 'approval.created', data: a });
          else if (old.status !== a.status) onEvent({ type: 'approval.resolved', data: a });
        }
      }
      if (next.stream !== prev.stream) {
        const seen = new Set(prev.stream.map((e) => e.id));
        for (const e of next.stream) if (!seen.has(e.id)) onEvent({ type: 'agent.stream', data: e });
      }
      if (next.bus !== prev.bus) {
        const seen = new Set(prev.bus.map((m) => m.id));
        for (const m of next.bus) if (!seen.has(m.id)) onEvent({ type: 'bus.message', data: m });
      }
      if (next.tasks !== prev.tasks) {
        const before = new Map(prev.tasks.map((t) => [t.id, t]));
        for (const t of next.tasks) if (before.get(t.id) !== t) onEvent({ type: 'task.updated', data: t });
      }
      prev = next;
    });
  }
}

export const api: OfficeApi = new MockOfficeApi();
