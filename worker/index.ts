/**
 * Cloudflare Worker cho Chùa Tịnh Tâm.
 *  - File tĩnh (dist/) do Cloudflare phục vụ trực tiếp qua cấu hình "assets" trong wrangler.jsonc.
 *  - /ws  → chuyển WebSocket vào Durable Object "Temple" (1 phòng chung cho mọi người).
 *  - /health → trả số người đang online.
 *
 * Durable Object là một "máy chủ nhỏ" duy nhất trên toàn cầu cho mỗi ID, giữ state trong RAM
 * → rất hợp cho phòng chơi realtime: mọi WebSocket của cùng phòng đi vào cùng một instance.
 */
import { DurableObject } from 'cloudflare:workers'
import {
  ACTIONS, MAX_NAME, POSES, ROBE_COLORS, TICK_MS, WS_PATH,
  type Action, type ClientMsg, type PlayerInfo, type PlayerState, type Pose, type ServerMsg,
} from '../shared/protocol'

export interface Env {
  TEMPLE: DurableObjectNamespace<Temple>
  ASSETS: Fetcher
  MAX_PLAYERS?: string
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === WS_PATH || url.pathname === '/health') {
      // tên phòng: mặc định "main"; sau này có thể chia phòng bằng ?room=...
      const room = (url.searchParams.get('room') ?? 'main').slice(0, 32)
      return env.TEMPLE.get(env.TEMPLE.idFromName(room)).fetch(req)
    }
    return env.ASSETS.fetch(req)
  },
} satisfies ExportedHandler<Env>

/* ------------------------------------------------------------------ */

interface Player extends PlayerInfo {
  ws: WebSocket
  x: number; z: number; rot: number; pose: Pose
  lastAction: number
  actionBudget: number
}

const round = (n: number) => Math.round(n * 100) / 100
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const toState = (p: Player): PlayerState => [p.id, round(p.x), round(p.z), round(p.rot), p.pose]
const info = (p: Player) => ({ id: p.id, name: p.name, color: p.color, state: toState(p) })

function cleanName(raw: unknown) {
  // bỏ ký tự điều khiển và dấu < > để tránh chèn HTML; giới hạn độ dài
  const s = String(raw ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MAX_NAME)
  return s || `Chú tiểu ${Math.floor(100 + Math.random() * 900)}`
}

export class Temple extends DurableObject<Env> {
  private players = new Map<string, Player>()
  /** Socket đã kết nối nhưng chưa gửi "hello" */
  private pending = new Set<WebSocket>()
  private ticker: ReturnType<typeof setInterval> | null = null

  async fetch(req: Request): Promise<Response> {
    if (new URL(req.url).pathname === '/health') {
      return Response.json({ ok: true, players: this.players.size })
    }
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('Cần kết nối WebSocket', { status: 426 })
    }
    const { 0: client, 1: server } = new WebSocketPair()
    server.accept()
    this.pending.add(server)
    let me: Player | null = null

    server.addEventListener('message', (ev) => {
      if (typeof ev.data !== 'string' || ev.data.length > 1000) return // chặn gói lạ / quá lớn
      let msg: ClientMsg
      try { msg = JSON.parse(ev.data) } catch { return }
      if (!msg || typeof msg !== 'object') return

      if (msg.t === 'hello' && !me) {
        this.pending.delete(server)
        const max = Number(this.env.MAX_PLAYERS ?? 100)
        if (this.players.size >= max) { this.send(server, { t: 'full' }); server.close(1013, 'full'); return }
        me = {
          id: crypto.randomUUID().slice(0, 8),
          name: cleanName(msg.name),
          color: ROBE_COLORS.includes(msg.color) ? msg.color : ROBE_COLORS[0],
          ws: server,
          x: (Math.random() - 0.5) * 4, z: 11, rot: Math.PI, pose: 'stand',
          lastAction: 0, actionBudget: 5,
        }
        this.players.set(me.id, me)
        this.send(server, { t: 'welcome', id: me.id, players: [...this.players.values()].map(info) })
        this.broadcast({ t: 'join', p: info(me) }, me.id)
        this.updateTicker()
        return
      }
      if (!me) return

      if (msg.t === 's' && Array.isArray(msg.s)) {
        const [x, z, rot, pose] = msg.s
        if (!isNum(x) || !isNum(z) || !isNum(rot) || !POSES.includes(pose)) return
        me.x = clamp(x, -20, 20); me.z = clamp(z, -12, 20); me.rot = rot; me.pose = pose
        return
      }

      if (msg.t === 'a' && ACTIONS.includes(msg.a as Action)) {
        // token bucket: tối đa dồn 5 hành động, hồi 2 hành động mỗi giây
        const now = Date.now()
        me.actionBudget = Math.min(5, me.actionBudget + ((now - me.lastAction) / 1000) * 2)
        me.lastAction = now
        if (me.actionBudget < 1) return
        me.actionBudget -= 1
        this.broadcast({ t: 'act', id: me.id, a: msg.a }, me.id)
      }
    })

    const bye = () => {
      this.pending.delete(server)
      if (!me || !this.players.has(me.id)) return
      this.players.delete(me.id)
      this.broadcast({ t: 'leave', id: me.id })
      this.updateTicker()
    }
    server.addEventListener('close', bye)
    server.addEventListener('error', bye)

    return new Response(null, { status: 101, webSocket: client })
  }

  /** Chỉ chạy vòng lặp snapshot khi có ít nhất 2 người – phòng trống thì Durable Object được nghỉ */
  private updateTicker() {
    if (this.players.size >= 2 && !this.ticker) {
      this.ticker = setInterval(() => this.broadcast({ t: 'snap', s: [...this.players.values()].map(toState) }), TICK_MS)
    } else if (this.players.size < 2 && this.ticker) {
      clearInterval(this.ticker)
      this.ticker = null
    }
  }

  private send(ws: WebSocket, msg: ServerMsg) {
    try { ws.send(JSON.stringify(msg)) } catch { /* socket đã đóng */ }
  }

  private broadcast(msg: ServerMsg, exceptId?: string) {
    const data = JSON.stringify(msg)
    for (const p of this.players.values()) {
      if (p.id === exceptId) continue
      try { p.ws.send(data) } catch { /* bỏ qua, sự kiện close sẽ dọn dẹp */ }
    }
  }
}
