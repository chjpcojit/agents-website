// Domain types mirroring the design doc's 6 entities (Agent, Task, Session, Message, Approval, Event).
// Kiểu dữ liệu bám theo 6 entity trong design doc (Agent, Task, Session, Message, Approval, Event).

/** Runtime status of an agent. / Trạng thái runtime của một agent. */
export type AgentStatus = 'working' | 'idle' | 'waiting' | 'error' | 'paused';

export type AgentRole = 'backend' | 'frontend' | 'mobile' | 'devops' | 'qa' | 'lead';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  roleLabel: string;
  /** Shirt colour used in the 3D scene. / Màu áo nhân vật trong scene 3D. */
  color: string;
  hair: string;
  model: string;
  worktree: string;
  tools: string[];
  status: AgentStatus;
  /** Claude Code session id used with --resume. / Session id Claude Code, dùng với --resume. */
  sessionId: string;
  /** Context window usage in [0, 1]. / Mức dùng context window trong khoảng [0, 1]. */
  context: number;
  currentTaskId: string | null;
  /** Last error message when status === 'error'. / Lỗi gần nhất khi status === 'error'. */
  lastError: string | null;
  /** Index of the desk in the office layout. / Vị trí bàn trong layout văn phòng. */
  desk: number;
}

export type TaskStatus = 'queued' | 'running' | 'review' | 'done' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  title: string;
  assignee: string;
  status: TaskStatus;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

export type StreamKind = 'user' | 'assistant' | 'tool_call' | 'tool_result' | 'system' | 'error';

/** One stream-json style event shown in the agent log. / Một event kiểu stream-json hiển thị trong log agent. */
export interface StreamEvent {
  id: string;
  agentId: string;
  kind: StreamKind;
  text: string;
  ts: number;
}

/** Recipient: agent id, channel ("#general") or the human ("user"). / Người nhận: agent id, kênh ("#general") hoặc người dùng ("user"). */
export interface BusMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  ts: number;
  /** Turn number inside this conversation pair (anti-loop). / Số lượt trong cặp hội thoại (anti-loop). */
  turn: number;
  blocked?: boolean;
}

export type ApprovalType = 'tool' | 'ask';
export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'answered';

export interface Approval {
  id: string;
  agentId: string;
  type: ApprovalType;
  /** Tool name for type "tool" (e.g. Bash). / Tên tool với type "tool" (vd Bash). */
  tool?: string;
  summary: string;
  detail: string;
  risk: 'low' | 'high';
  options?: string[];
  createdAt: number;
  deadline: number;
  status: ApprovalStatus;
  decidedBy?: string;
  answer?: string;
}

/** Audit log entry. / Bản ghi audit log. */
export interface AuditEvent {
  id: string;
  ts: number;
  actor: string;
  action: string;
}

/** Envelope animation between two desks in the scene. / Animation phong thư bay giữa hai bàn trong scene. */
export interface Flight {
  id: string;
  from: string;
  to: string;
  startedAt: number;
}

export interface Quota {
  /** Rolling 5-hour window usage in [0, 1]. / Mức dùng cửa sổ 5 giờ trong [0, 1]. */
  fiveHour: number;
  /** Weekly usage in [0, 1]. / Mức dùng theo tuần trong [0, 1]. */
  weekly: number;
  fiveHourResetAt: number;
}

export interface OfficeState {
  now: number;
  agents: Agent[];
  tasks: Task[];
  stream: StreamEvent[];
  bus: BusMessage[];
  approvals: Approval[];
  audit: AuditEvent[];
  flights: Flight[];
  quota: Quota;
  concurrencyLimit: number;
  /** Max agent-to-agent turns per pair before the bus blocks. / Số lượt tối đa mỗi cặp agent trước khi bus chặn. */
  turnLimit: number;
  selectedAgentId: string | null;
}
