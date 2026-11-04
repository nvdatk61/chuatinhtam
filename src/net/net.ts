import { WS_PATH, type Action, type ClientMsg, type PlayerInfo, type PlayerState, type Pose, type ServerMsg } from '../../shared/protocol'
import { useStore } from '../store'

/**
 * Người chơi khác. Vị trí lưu ở biến thường (không phải React state) để
 * useFrame đọc 60 lần/giây mà không gây re-render.
 */
export interface Remote extends PlayerInfo {
  x: number; z: number; rot: number // vị trí đang hiển thị (đã nội suy)
  tx: number; tz: number; trot: number // vị trí mục tiêu mới nhất từ server
  pose: Pose
  bowAt: number; greetAt: number
}

export const remotes = new Map<string, Remote>()
type Listener = (id: string, a: Action) => void
const actionListeners = new Set<Listener>()

let ws: WebSocket | null = null
let identity: { name: string; color: string } | null = null
let lastSent = ''
let retry = 0
let gaveUp = false

function syncRoster() {
  useStore.getState().setRoster([...remotes.values()].map(({ id, name, color }) => ({ id, name, color })))
}

function upsert(p: PlayerInfo & { state: PlayerState }) {
  const [, x, z, rot, pose] = p.state
  remotes.set(p.id, { ...p, x, z, rot, tx: x, tz: z, trot: rot, pose, bowAt: -1e9, greetAt: -1e9 })
}

/** URL WebSocket: VITE_SERVER_URL nếu có, ngược lại cùng domain với trang web */
function serverUrl(): string | null {
  const env = import.meta.env.VITE_SERVER_URL as string | undefined
  if (env === 'none') return null
  const base = env || location.origin
  return base.replace(/^http/, 'ws').replace(/\/$/, '') + WS_PATH
}

function send(msg: ClientMsg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function handle(msg: ServerMsg) {
  switch (msg.t) {
    case 'welcome':
      retry = 0
      useStore.getState().setMyId(msg.id)
      useStore.getState().setNet('online')
      remotes.clear()
      for (const p of msg.players) if (p.id !== msg.id) upsert(p)
      syncRoster()
      break
    case 'join': upsert(msg.p); syncRoster(); break
    case 'leave': remotes.delete(msg.id); syncRoster(); break
    case 'snap':
      for (const [id, x, z, rot, pose] of msg.s) {
        const r = remotes.get(id)
        if (r) { r.tx = x; r.tz = z; r.trot = rot; r.pose = pose }
      }
      break
    case 'act': {
      const r = remotes.get(msg.id)
      if (!r) break
      if (msg.a === 'bow') r.bowAt = performance.now()
      if (msg.a === 'greet') r.greetAt = performance.now()
      actionListeners.forEach((fn) => fn(msg.id, msg.a))
      break
    }
    case 'full':
      gaveUp = true
      useStore.getState().setNet('full')
      break
  }
}

function open() {
  const url = serverUrl()
  if (!url || !identity) { useStore.getState().setNet('offline'); return }
  useStore.getState().setNet(retry === 0 ? 'connecting' : 'offline')
  lastSent = ''
  const sock = new WebSocket(url)
  ws = sock
  sock.onopen = () => send({ t: 'hello', ...identity! })
  sock.onmessage = (ev) => {
    try { handle(JSON.parse(ev.data as string) as ServerMsg) } catch { /* bỏ qua gói lỗi */ }
  }
  sock.onclose = () => {
    if (ws !== sock) return
    ws = null
    remotes.clear(); syncRoster()
    if (gaveUp) return
    useStore.getState().setNet('offline')
    // tự kết nối lại với thời gian chờ tăng dần: 1s, 2s, 4s… tối đa 30s
    const delay = Math.min(30_000, 1000 * 2 ** retry++)
    setTimeout(open, delay)
  }
}

export function connect(name: string, color: string) {
  if (identity) return
  identity = { name, color }
  open()
}

/** Gửi vị trí của mình – chỉ gửi khi có thay đổi */
export function sendState(x: number, z: number, rot: number, pose: Pose) {
  const s: [number, number, number, Pose] = [round(x), round(z), round(rot), pose]
  const key = s.join(',')
  if (key === lastSent || ws?.readyState !== WebSocket.OPEN) return
  // nếu mạng đang nghẽn (bộ đệm gửi còn nhiều) thì bỏ gói vị trí này
  if (ws.bufferedAmount > 4096) return
  lastSent = key
  send({ t: 's', s })
}

export function sendAction(a: Action) {
  send({ t: 'a', a })
}

export function onRemoteAction(fn: Listener) {
  actionListeners.add(fn)
  return () => { actionListeners.delete(fn) }
}

const round = (n: number) => Math.round(n * 100) / 100
