# Chùa Tịnh Tâm – Đi chùa online 3D (multiplayer)

Ngôi chùa 3D chạy trên trình duyệt. Bạn có thể đi lại, thắp hương lạy Phật, gõ mõ, thỉnh chuông, xin xăm, ngồi thiền và lần tràng hạt cùng những người khác đang online. Mọi người thấy nhau, chắp tay chào nhau và nghe tiếng chuông, tiếng mõ của nhau. Chùa cố ý không có chat để giữ không gian yên tĩnh.

Toàn bộ hình khối được dựng bằng code (không dùng model 3D), và âm thanh được tổng hợp bằng Web Audio API (không dùng file mp3), nên dự án không phụ thuộc asset có bản quyền.

## Chạy local

Cần Node.js 20 trở lên.

```bash
npm install
npm run dev        # chạy Worker (wrangler dev, cổng 8787) + web Vite (cổng 5173)
```

Mở http://localhost:5173 ở 2 tab hoặc 2 trình duyệt để thấy nhau. `wrangler dev` chạy Durable Object ngay trên máy bạn, không cần tài khoản Cloudflare.

Chạy giống hệt môi trường production:

```bash
npm run preview    # build rồi chạy Worker phục vụ cả web + WebSocket tại http://localhost:8787
```

Nếu không kết nối được server, game tự chuyển sang **chế độ một mình** và tự thử kết nối lại.

Thêm `?debug` vào URL thì có thể điều khiển nhân vật từ console, ví dụ `player.position.set(0, 0, -6)`.

## Điều khiển

| Thao tác | Máy tính | Điện thoại |
|---|---|---|
| Đi lại | W A S D / phím mũi tên | Joystick góc trái |
| Xoay góc nhìn | Kéo chuột | Vuốt màn hình |
| Tương tác | E / Enter | Nút "Tương tác" |
| Chắp tay chào | G | Nút 🙏 |
| Lần tràng hạt | Space | Nút 📿 |
| Thoát thiền / đóng bảng | Esc | Nút "Kết thúc" |

## Cấu trúc

```
shared/protocol.ts          # kiểu gói tin client ↔ server (JSON qua WebSocket), dùng chung 2 phía
worker/index.ts             # Cloudflare Worker + Durable Object "Temple" (phòng chùa)
wrangler.jsonc              # cấu hình Cloudflare: static assets, Durable Object, biến môi trường
src/
├── net/net.ts              # WebSocket client, tự kết nối lại, danh sách người chơi khác (remotes)
├── store.ts                # Zustand: trạng thái UI, SPOTS, trạng thái mạng, roster
├── audio/sfx.ts            # Web Audio: mõ, chuông, hạt, ống xăm, âm nền; sfx.at(vol) cho âm ở xa
├── data/fortunes.ts        # 12 quẻ xăm tự soạn
├── scene/
│   ├── Scene.tsx           # Canvas, ánh sáng, bầu trời
│   ├── World.tsx           # chánh điện, tượng Phật, gác chuông, tam quan, hồ sen, cây
│   ├── Monk.tsx            # model chú tiểu + animateMonk() dùng chung cho mình và người khác
│   ├── Player.tsx          # điều khiển, camera, tương tác, gửi vị trí lên server
│   ├── Others.tsx          # vẽ người chơi khác, nội suy vị trí, âm thanh theo khoảng cách
│   └── fx.ts               # va chạm AABB, mốc thời gian hiệu ứng
└── ui/HUD.tsx              # màn chào (nhập pháp danh, chọn màu áo), số người online, panel
```

## Kiến trúc multiplayer

```
Trình duyệt ──https──▶ Cloudflare edge ──▶ file tĩnh (dist/)
Trình duyệt ──wss /ws─▶ Worker ──▶ Durable Object "Temple" (1 instance cho cả phòng)
                                     ├─ nhận vị trí 10 lần/giây từ mỗi người
                                     ├─ phát snapshot gộp 10 lần/giây
                                     └─ phát lại hành động ngay lập tức
```

- **Durable Object là "phòng chơi".** Mọi WebSocket gọi `idFromName("main")` đều đi vào cùng một instance duy nhất trên thế giới, nên state trong RAM (`Map players`) luôn nhất quán mà không cần Redis hay database.
- **Server giữ trạng thái chuẩn.** Client chỉ gửi vị trí của mình. Server gộp vị trí của tất cả mọi người thành một `snap` chung, nên số gói tin là O(n) thay vì O(n²). Vòng lặp snapshot chỉ chạy khi có từ 2 người trở lên.
- **Nội suy phía client:** vị trí người khác "đuổi" theo vị trí mục tiêu bằng `1 - exp(-dt·k)`, cho chuyển động mượt ở 60fps dù server chỉ gửi 10Hz. Nếu bộ đệm gửi đầy (mạng chậm), client bỏ gói vị trí cũ.
- **Không tin client:** server kiểm tra kiểu dữ liệu và giới hạn toạ độ, làm sạch tên, bỏ gói lớn hơn 1KB, và rate limit hành động bằng token bucket (tối đa 5 hành động dồn, hồi 2 hành động/giây).
- **Tự kết nối lại:** khi mất kết nối, client thử lại sau 1s, 2s, 4s… tối đa 30s.

## Deploy lên Cloudflare (Workers + Durable Objects)

Web và server cùng nằm trên **một Worker**, chạy được với gói **Workers Free**. Lưu ý đây là **Worker**, không phải Pages, vì Pages không chạy được Durable Object.

**Cách 1: từ máy bạn, không cần GitHub**

```bash
npx wrangler login     # đăng nhập Cloudflare trong trình duyệt
npm run deploy         # build + deploy → https://chua-tinh-tam.<tài-khoản>.workers.dev
```

**Cách 2: tự deploy mỗi lần push lên GitHub (Workers Builds)**

Vào Cloudflare Dashboard, chọn **Workers & Pages**, bấm **Create**, chọn **Import a repository** rồi chọn repo của bạn. Điền như sau:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/` (nơi có `package.json` và `wrangler.jsonc`)

Đổi số người tối đa bằng `vars.MAX_PLAYERS` trong `wrangler.jsonc`. Có thể chia nhiều phòng bằng `wss://.../ws?room=ten-phong`.

## Ý tưởng phát triển tiếp

1. **Nhiều phòng:** Worker đã hỗ trợ `?room=`. Hãy thêm UI chọn phòng, hoặc tự chia phòng khi một phòng quá 30 người.
2. **Hibernation API:** chuyển sang `ctx.acceptWebSocket()` để Durable Object "ngủ" khi phòng yên lặng, giúp tiết kiệm chi phí.
3. **Lưu tiến trình:** lưu lịch sử thiền và chuỗi ngày vào SQLite hoặc Supabase.
4. **Đồ hoạ:** thay khối cơ bản bằng model glTF, thêm bloom cho hào quang và nến, dùng `InstancedMesh` cho cây.
5. **Kiểm thử:** test tải bằng k6 (có module WebSocket) để xem một phòng chịu được bao nhiêu người, và viết test E2E bằng Playwright với nhiều tab.
6. **Quan sát hệ thống:** thêm metrics (số kết nối, gói tin/giây) và log có cấu trúc.

## Ghi chú

- Kiến trúc được tham khảo ý tưởng từ một số dự án "đi chùa online" công khai trên GitHub. Toàn bộ code ở đây được viết mới.
- Lời xăm mang tính chiêm nghiệm và khích lệ, không phải lời tiên đoán.
