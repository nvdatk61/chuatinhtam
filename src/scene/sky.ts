import { useEffect, useState } from 'react'
import * as THREE from 'three'

/**
 * Chu kỳ ngày/đêm theo giờ thật của máy người chơi.
 * Thêm `?hour=21` (hoặc 6.5, 18...) vào URL để xem thử một thời điểm cố định.
 */

/** Giá trị môi trường dùng chung, đọc trực tiếp trong useFrame (không gây re-render) */
export const ambient = {
  /** 0 = ban ngày, 1 = đêm hẳn */
  night: 0,
}

/** Thiết bị yếu / điện thoại: giảm hạt và độ phân giải bloom */
export const LOW_POWER =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches || window.devicePixelRatio < 1.25)

function hourOverride(): number | null {
  const v = new URLSearchParams(location.search).get('hour')
  if (v === null) return null
  const h = Number(v)
  return Number.isFinite(h) ? ((h % 24) + 24) % 24 : null
}

function currentHour() {
  const d = new Date()
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600
}

/** Giờ hiện tại (số thực 0..24), cập nhật mỗi 15 giây – đủ mượt vì mặt trời đi rất chậm */
export function useHour() {
  const [hour, setHour] = useState(() => hourOverride() ?? currentHour())
  useEffect(() => {
    if (hourOverride() !== null) return
    const id = setInterval(() => setHour(currentHour()), 15_000)
    return () => clearInterval(id)
  }, [])
  return hour
}

interface Key {
  h: number
  fog: string
  hemiSky: string
  hemiGround: string
  hemiInt: number
  light: string
  lightInt: number
  night: number
}

/** Các mốc trong ngày; giữa hai mốc thì nội suy tuyến tính */
const KEYS: Key[] = [
  { h: 0, fog: '#141a2e', hemiSky: '#3b4a7a', hemiGround: '#1a2016', hemiInt: 0.38, light: '#9fb4ff', lightInt: 0.35, night: 1 },
  { h: 4.8, fog: '#1a2036', hemiSky: '#3f4c7c', hemiGround: '#1a2016', hemiInt: 0.4, light: '#9fb4ff', lightInt: 0.3, night: 1 },
  { h: 6, fog: '#e2ac88', hemiSky: '#ffc9a0', hemiGround: '#4a5236', hemiInt: 0.5, light: '#ffb070', lightInt: 0.4, night: 0.45 },
  { h: 7.5, fog: '#f1e0c4', hemiSky: '#fff0d6', hemiGround: '#5c6b3c', hemiInt: 0.75, light: '#ffe2b8', lightInt: 1.6, night: 0 },
  { h: 12, fog: '#e4ebe9', hemiSky: '#f4f7ff', hemiGround: '#5c6b3c', hemiInt: 0.8, light: '#fff4e0', lightInt: 2.0, night: 0 },
  { h: 16, fog: '#f1d7b0', hemiSky: '#ffe9c7', hemiGround: '#5c6b3c', hemiInt: 0.75, light: '#ffd9a3', lightInt: 1.8, night: 0 },
  { h: 17.6, fog: '#efb489', hemiSky: '#ffc49a', hemiGround: '#4f5536', hemiInt: 0.6, light: '#ff9a55', lightInt: 1.1, night: 0.2 },
  { h: 18.4, fog: '#4e3a5a', hemiSky: '#7a6a9a', hemiGround: '#2a2a20', hemiInt: 0.45, light: '#9fb4ff', lightInt: 0.25, night: 0.75 },
  { h: 19.5, fog: '#141a2e', hemiSky: '#3b4a7a', hemiGround: '#1a2016', hemiInt: 0.38, light: '#9fb4ff', lightInt: 0.35, night: 1 },
  { h: 24, fog: '#141a2e', hemiSky: '#3b4a7a', hemiGround: '#1a2016', hemiInt: 0.38, light: '#9fb4ff', lightInt: 0.35, night: 1 },
]

export interface Env {
  fog: THREE.Color
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  hemiInt: number
  light: THREE.Color
  lightInt: number
  /** vị trí đèn hướng (mặt trời ban ngày, mặt trăng ban đêm) */
  lightPos: [number, number, number]
  /** vị trí mặt trời cho shader bầu trời */
  sunPos: [number, number, number]
  /** mặt trời còn trên/gần đường chân trời → vẽ bầu trời Sky */
  showSky: boolean
  night: number
}

const mix = (a: string, b: string, k: number) => new THREE.Color(a).lerp(new THREE.Color(b), k)

export function envAt(hour: number): Env {
  let i = 0
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++
  const a = KEYS[i], b = KEYS[i + 1]
  const k = THREE.MathUtils.clamp((hour - a.h) / (b.h - a.h), 0, 1)
  const lerp = (x: number, y: number) => x + (y - x) * k

  // mặt trời mọc hướng đông (+x) lúc 6h, lên cao lúc 12h, lặn hướng tây lúc 18h
  const ang = ((hour - 6) / 12) * Math.PI
  const elev = Math.sin(ang)
  const sunPos: [number, number, number] = [Math.cos(ang) * 100, elev * 60, 45]
  const lightPos: [number, number, number] = elev > 0.02
    ? [Math.cos(ang) * 24, Math.max(elev * 26, 6), 16]
    : [-14, 24, 12] // ánh trăng

  return {
    fog: mix(a.fog, b.fog, k),
    hemiSky: mix(a.hemiSky, b.hemiSky, k),
    hemiGround: mix(a.hemiGround, b.hemiGround, k),
    hemiInt: lerp(a.hemiInt, b.hemiInt),
    light: mix(a.light, b.light, k),
    lightInt: lerp(a.lightInt, b.lightInt),
    lightPos,
    sunPos,
    showSky: elev > -0.06,
    night: lerp(a.night, b.night),
  }
}
