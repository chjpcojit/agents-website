import { useEffect, useRef } from 'react';
import { createOfficeScene, STATUS_COLOR, type OfficeSceneHandle } from '../scene/office';
import { store } from '../sim/store';
import type { AgentStatus } from '../sim/types';
import { useOffice } from '../useOffice';

const LEGEND: [AgentStatus, string][] = [
  ['working', 'Đang làm'],
  ['waiting', 'Chờ duyệt/hỏi'],
  ['idle', 'Rảnh'],
  ['error', 'Lỗi'],
  ['paused', 'Tạm dừng'],
];

/** React wrapper around the imperative three.js scene. / Wrapper React cho scene three.js dạng imperative. */
export function OfficeCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<OfficeSceneHandle | null>(null);
  const state = useOffice();

  useEffect(() => {
    if (!ref.current) return;
    // Mount once; later state flows in via update(). / Mount một lần; state về sau đi qua update().
    handle.current = createOfficeScene(ref.current, store.getState(), (id) => store.select(id));
    return () => {
      handle.current?.dispose();
      handle.current = null;
    };
  }, []);

  useEffect(() => {
    handle.current?.update(state);
  }, [state]);

  return (
    <section className="scene-wrap" aria-label="Văn phòng 3D">
      <div ref={ref} className="scene" />
      <div className="legend">
        {LEGEND.map(([s, label]) => (
          <span key={s}>
            <i style={{ background: STATUS_COLOR[s] }} />
            {label}
          </span>
        ))}
      </div>
      <div className="hint">Click nhân vật để xem chi tiết · kéo để xoay · cuộn để zoom</div>
    </section>
  );
}
