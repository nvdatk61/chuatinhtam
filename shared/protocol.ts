/**
 * Giao thức client ↔ server qua WebSocket (JSON), dùng chung cho cả hai phía.
 * Mỗi gói tin là một object có trường `t` (type) để phân loại.
 */

export type Pose = 'stand' | 'bow' | 'sit'
export const POSES: Pose[] = ['stand', 'bow', 'sit']

/** Hành động được phát lại cho người khác (để thấy animation và nghe âm thanh) */
export type Action = 'bow' | 'mo' | 'bell' | 'shake' | 'greet'
export const ACTIONS: Action[] = ['bow', 'mo', 'bell', 'shake', 'greet']

export interface PlayerInfo {
  id: string
  name: string
  color: string
}

/** Trạng thái vị trí gọn nhẹ: [id, x, z, góc quay, pose] */
export type PlayerState = [id: string, x: number, z: number, rot: number, pose: Pose]

export type ServerMsg =
  | { t: 'welcome'; id: string; players: Array<PlayerInfo & { state: PlayerState }> }
  | { t: 'join'; p: PlayerInfo & { state: PlayerState } }
  | { t: 'leave'; id: string }
  | { t: 'snap'; s: PlayerState[] }
  | { t: 'act'; id: string; a: Action }
  | { t: 'full' }

export type ClientMsg =
  | { t: 'hello'; name: string; color: string }
  | { t: 's'; s: [x: number, z: number, rot: number, pose: Pose] }
  | { t: 'a'; a: Action }

export const ROBE_COLORS = ['#8a6d4b', '#9a8a6a', '#7b5a3a', '#a07040', '#6f6a5a', '#b0905a']
export const MAX_NAME = 20
export const TICK_MS = 100
export const WS_PATH = '/ws'
