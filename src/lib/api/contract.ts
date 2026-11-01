import type { Approval, BusMessage, StreamEvent, Task } from '../sim/types';

// Wire contract agreed for the BE: REST + SSE.
//   GET  /approvals                    → ApprovalListResponse
//   POST /approvals/{id}/decision      ← DecisionRequest
//   GET  /events (text/event-stream)   → ServerEvent per SSE message
// Contract đã chốt với BE: REST + SSE (như trên). Demo chạy bằng MockOfficeApi;
// khi có BE chỉ cần thay bằng HttpOfficeApi cùng interface.

export interface ApprovalListResponse {
  items: Approval[];
}

/** Body of POST /approvals/{id}/decision. / Body của POST /approvals/{id}/decision. */
export type DecisionRequest =
  | { decision: 'approve' }
  | { decision: 'deny' }
  | { decision: 'answer'; answer: string };

/** One SSE message from GET /events; `type` maps to the SSE `event:` field. / Một message SSE từ GET /events; `type` tương ứng field `event:` của SSE. */
export type ServerEvent =
  | { type: 'approval.created'; data: Approval }
  | { type: 'approval.resolved'; data: Approval }
  | { type: 'agent.stream'; data: StreamEvent }
  | { type: 'bus.message'; data: BusMessage }
  | { type: 'task.updated'; data: Task };

export interface OfficeApi {
  listApprovals(): Promise<ApprovalListResponse>;
  postDecision(approvalId: string, body: DecisionRequest): Promise<void>;
  /** Returns an unsubscribe fn (EventSource.close in the real impl). / Trả về hàm huỷ (EventSource.close ở bản thật). */
  subscribeEvents(onEvent: (e: ServerEvent) => void): () => void;
}
