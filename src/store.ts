import { create } from 'zustand'

/** Các điểm có thể tương tác trong chùa */
export type SpotKind = 'altar' | 'mo' | 'bell' | 'cushion' | 'fortune'

export interface Spot {
  id: string
  kind: SpotKind
  name: string
  action: string
  pos: [number, number] // x, z
}

export const SPOTS: Spot[] = [
  { id: 'altar', kind: 'altar', name: 'Bàn thờ Phật', action: 'Thắp hương & lạy Phật', pos: [0, -7.2] },
  { id: 'mo', kind: 'mo', name: 'Mõ', action: 'Gõ mõ', pos: [-3.2, -6] },
  { id: 'cushion', kind: 'cushion', name: 'Bồ đoàn', action: 'Ngồi thiền', pos: [3.2, -6] },
  { id: 'bell', kind: 'bell', name: 'Gác chuông', action: 'Thỉnh chuông', pos: [9, 4] },
  { id: 'fortune', kind: 'fortune', name: 'Ống xăm', action: 'Xin xăm', pos: [-9, 4] },
]

export type Panel = null | 'meditation' | 'fortune' | 'about'
export type NetStatus = 'idle' | 'connecting' | 'online' | 'offline' | 'full'
export interface RosterEntry { id: string; name: string; color: string }

interface State {
  entered: boolean
  muted: boolean
  panel: Panel
  nearby: Spot | null
  joystick: { x: number; y: number }
  /** Tăng mỗi lần người chơi bấm "Tương tác" – Scene lắng nghe giá trị này */
  interactTick: number
  greetTick: number
  /** Đang thực hiện hành động (lạy/ngồi) – khoá di chuyển */
  pose: 'stand' | 'bow' | 'sit'
  bows: number
  incense: number
  mala: number
  meditationEndsAt: number | null
  fortune: number | null
  name: string
  color: string
  net: NetStatus
  myId: string | null
  roster: RosterEntry[]

  enter: () => void
  toggleMute: () => void
  setPanel: (p: Panel) => void
  setNearby: (s: Spot | null) => void
  setJoystick: (x: number, y: number) => void
  interact: () => void
  greet: () => void
  setPose: (p: State['pose']) => void
  addBow: () => void
  addIncense: () => void
  addMala: () => void
  resetMala: () => void
  startMeditation: (minutes: number) => void
  stopMeditation: () => void
  drawFortune: (n: number) => void
  setIdentity: (name: string, color: string) => void
  setNet: (n: NetStatus) => void
  setMyId: (id: string) => void
  setRoster: (r: RosterEntry[]) => void
}

export const useStore = create<State>((set) => ({
  entered: false,
  muted: false,
  panel: null,
  nearby: null,
  joystick: { x: 0, y: 0 },
  interactTick: 0,
  greetTick: 0,
  pose: 'stand',
  bows: 0,
  incense: 0,
  mala: 0,
  meditationEndsAt: null,
  fortune: null,
  name: '',
  color: '#8a6d4b',
  net: 'idle',
  myId: null,
  roster: [],

  enter: () => set({ entered: true }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  setPanel: (panel) => set({ panel }),
  setNearby: (nearby) => set({ nearby }),
  setJoystick: (x, y) => set({ joystick: { x, y } }),
  interact: () => set((s) => ({ interactTick: s.interactTick + 1 })),
  greet: () => set((s) => ({ greetTick: s.greetTick + 1 })),
  setPose: (pose) => set({ pose }),
  addBow: () => set((s) => ({ bows: s.bows + 1 })),
  addIncense: () => set((s) => ({ incense: s.incense + 1 })),
  addMala: () => set((s) => ({ mala: (s.mala % 108) + 1 })),
  resetMala: () => set({ mala: 0 }),
  startMeditation: (minutes) =>
    set({ meditationEndsAt: Date.now() + minutes * 60_000, pose: 'sit', panel: 'meditation' }),
  stopMeditation: () => set({ meditationEndsAt: null, pose: 'stand', panel: null }),
  drawFortune: (n) => set({ fortune: n, panel: 'fortune' }),
  setIdentity: (name, color) => set({ name, color }),
  setNet: (net) => set({ net }),
  setMyId: (myId) => set({ myId }),
  setRoster: (roster) => set({ roster }),
}))
