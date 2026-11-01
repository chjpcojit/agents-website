# agents-website

Web UI cho hệ thống quản lý nhiều agent Claude Code. Hiện tại là **demo "Agent Office"**: văn phòng 3D mini (isometric, low-poly, phong cách open-plan hiện đại) với dữ liệu mock, chưa nối orchestrator.

Mặt bằng chia 9 khu: Backend, Frontend & Mobile, QA, Platform · DevOps, phòng Tech Lead, phòng họp (trạm office bus), server room, pantry, lounge. 9 agent ngồi theo phòng ban, có 2 bàn trống chờ agent mới. Mặt bằng khai báo ở `src/sim/departments.ts`.

## Chạy

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # dist/
npm run build:single   # dist-single/index.html — 1 file tự chứa, dùng để share preview
```

## Có gì trong demo

| Tính năng (design doc) | Trong demo |
|---|---|
| Trạng thái agent | Nhân vật ở bàn: gõ phím (working), giơ tay (waiting), lắc + màn hình đỏ (error), ngủ gật (paused), thư giãn (idle); vòng màu dưới ghế + bảng tên có context bar |
| Giao việc / chat / stream | Tab **Agent**: stream log (user / assistant / tool_call / tool_result), ô giao việc, Pause/Resume, Cancel, Retry, `/compact` |
| Queue + concurrency | Giới hạn 4 agent chạy cùng lúc, task vượt limit nằm trong queue |
| Office bus | Tab **Office bus**; trong scene, agent gửi tin sẽ đứng dậy đi tới bàn người nhận nói chuyện rồi về (phong thư bay nếu người gửi đang không ở bàn); turn counter, vượt 6 lượt/cặp thì chặn (anti-loop) |
| Di chuyển | Agent rảnh rời bàn đi uống cà phê, ăn vặt ở pantry, ngồi sofa chơi game, ghế lười đọc sách, đánh bóng bàn; có task thì chạy về bàn. Đi theo hành lang + lối dọc (`src/scene/walkers.ts`) |
| Duyệt tập trung | Tab **Duyệt**: tool permission + câu hỏi của agent, đánh dấu high-risk, countdown, hết giờ → deny, không có "always allow" |
| Theo dõi | Quota Max 5h/tuần, task board (cũng hiện dạng giấy note trên bảng trắng trong scene), audit log |

## Cấu trúc

```
src/
  api/contract.ts   # Contract REST + SSE với BE: GET /approvals, POST /approvals/{id}/decision, GET /events
  api/mock.ts       # MockOfficeApi — thay bằng HttpOfficeApi khi BE sẵn sàng
  sim/              # Orchestrator giả lập (mock data + simulator), departments.ts = mặt bằng phòng ban
  scene/office.ts   # Scene three.js: vỏ toà nhà, phòng kính, bàn, nhân vật chibi, animation
  components/       # React UI: top bar, sidebar tabs
```

Stack: Vite + React 19 + TypeScript + three.js (không dùng thêm UI lib).
