import type { AgentStatus } from './sim/types';

export const STATUS_LABEL: Record<AgentStatus, string> = {
  working: 'Đang làm',
  idle: 'Rảnh',
  waiting: 'Chờ duyệt',
  error: 'Lỗi',
  paused: 'Tạm dừng',
};
