import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LOW_POWER, ambient } from './sky'
import { glow } from './Effects'

const rand = (a: number, b: number) => a + Math.random() * (b - a)

/* ---------- Cánh hoa bay ---------- */

/** Hình giọt nước dẹt làm cánh hoa, dựng bằng Shape (không cần texture) */
function petalGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0, -0.5)
  s.bezierCurveTo(0.45, -0.25, 0.4, 0.35, 0, 0.5)
  s.bezierCurveTo(-0.4, 0.35, -0.45, -0.25, 0, -0.5)
  const g = new THREE.ShapeGeometry(s, 6)
  g.scale(0.07, 0.09, 1)
  return g
}

interface Petal {
  x: number; y: number; z: number
  vy: number; sway: number; phase: number
  rx: number; ry: number; rz: number; spin: number
  /** thời điểm (giây) cánh hoa nằm trên đất tới khi được thả lại từ trên cao */
  restUntil: number
}

/** Phạm vi rơi: sân trước chánh điện tới cổng (tránh rơi xuyên mái vào trong điện) */
function spawn(p: Petal, top: boolean) {
  p.x = rand(-16, 16)
  p.z = rand(-2, 18)
  p.y = top ? rand(7, 10) : rand(0.5, 10)
  p.vy = rand(0.35, 0.65)
  p.sway = rand(0.3, 0.8)
  p.phase = rand(0, Math.PI * 2)
  p.rx = rand(0, Math.PI * 2); p.ry = rand(0, Math.PI * 2); p.rz = rand(0, Math.PI * 2)
  p.spin = rand(1, 3)
  p.restUntil = 0
}

export function Petals({ count = LOW_POWER ? 40 : 90 }: { count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(petalGeometry, [])
  const petals = useMemo(() => Array.from({ length: count }, () => {
    const p = {} as Petal
    spawn(p, false)
    return p
  }), [count])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // màu ngẫu nhiên giữa hồng đào và trắng hồng
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return
    const a = new THREE.Color('#f4a6b8'), b = new THREE.Color('#fff0f3'), c = new THREE.Color()
    for (let i = 0; i < count; i++) m.setColorAt(i, c.copy(a).lerp(b, Math.random()))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [count])
  useEffect(() => () => geo.dispose(), [geo])

  useFrame(({ clock }, dtRaw) => {
    const m = ref.current; if (!m) return
    const dt = Math.min(dtRaw, 0.05)
    const t = clock.elapsedTime
    const wind = 0.25 + Math.sin(t * 0.13) * 0.2 // gió thổi nhẹ, đổi dần theo thời gian
    for (let i = 0; i < count; i++) {
      const p = petals[i]
      if (p.y > 0.03) {
        p.y -= p.vy * dt
        p.x += (wind + Math.sin(t * p.sway + p.phase) * 0.35) * dt
        p.z += Math.cos(t * p.sway * 0.8 + p.phase) * 0.25 * dt
        p.rx += p.spin * dt; p.rz += p.spin * 0.7 * dt
        if (p.y <= 0.03) { p.y = 0.03; p.restUntil = t + rand(3, 7) } // chạm đất: nằm yên một lúc
        dummy.rotation.set(p.rx, p.ry, p.rz)
      } else {
        if (t > p.restUntil) spawn(p, true)
        dummy.rotation.set(-Math.PI / 2, 0, p.rz) // nằm phẳng trên mặt sân
      }
      dummy.position.set(p.x, p.y, p.z)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[geo, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.8} />
    </instancedMesh>
  )
}

/* ---------- Đom đóm (chỉ hiện khi trời tối) ---------- */

/** Chấm sáng tròn mềm vẽ bằng canvas, dùng làm sprite cho Points */
export function softDotTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.25, 'rgba(255,255,255,0.8)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Những nơi đom đóm hay tụ: hồ sen, các gốc cây, hai bên lối vào cổng */
const HOMES: Array<[number, number, number]> = [
  [-11.7, 10, 3.2], [-15, -4, 2], [15, -4, 2], [-14, 2, 2], [14, 9, 2],
  [-7, 17, 2], [8, 17, 2], [-17, 14, 2.5], [17, 15, 2.5], [-3, 16, 1.5], [3, 16, 1.5],
]

export function Fireflies({ count = LOW_POWER ? 22 : 48 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)
  const mat = useRef<THREE.PointsMaterial>(null)
  const tex = useMemo(softDotTexture, [])
  const base = useMemo(() => glow('#d8ff78', 3.2), [])
  const flies = useMemo(() => Array.from({ length: count }, (_, i) => {
    const [hx, hz, r] = HOMES[i % HOMES.length]
    return {
      hx: hx + rand(-r, r), hz: hz + rand(-r, r), hy: rand(0.4, 2),
      fx: rand(0.15, 0.4), fz: rand(0.15, 0.4), fy: rand(0.3, 0.7),
      ph: rand(0, 100), blink: rand(1.5, 3.5),
    }
  }), [count])
  const [positions, colors] = useMemo(() => [new Float32Array(count * 3), new Float32Array(count * 3)], [count])
  useEffect(() => () => tex.dispose(), [tex])

  useFrame(({ clock }) => {
    const pts = ref.current, m = mat.current
    if (!pts || !m) return
    const night = ambient.night
    pts.visible = night > 0.05
    if (!pts.visible) return
    m.opacity = THREE.MathUtils.smoothstep(night, 0.05, 0.8)
    const t = clock.elapsedTime
    const pos = pts.geometry.getAttribute('position') as THREE.BufferAttribute
    const col = pts.geometry.getAttribute('color') as THREE.BufferAttribute
    flies.forEach((f, i) => {
      // bay lượn chậm quanh "nhà" bằng tổ hợp các sóng sin lệch pha
      pos.setXYZ(
        i,
        f.hx + Math.sin(t * f.fx + f.ph) * 1.2 + Math.sin(t * f.fx * 2.3 + f.ph) * 0.4,
        f.hy + Math.sin(t * f.fy + f.ph * 1.7) * 0.35,
        f.hz + Math.cos(t * f.fz + f.ph) * 1.2 + Math.cos(t * f.fz * 1.9 + f.ph) * 0.4,
      )
      // nhấp nháy: sáng lên rồi tắt dần, mỗi con một nhịp riêng (màu đậm/nhạt ≈ sáng/tối vì blend cộng)
      const k = Math.pow(Math.max(0, Math.sin(t * f.blink + f.ph)), 3) * 0.85 + 0.15
      col.setXYZ(i, base.r * k, base.g * k, base.b * k)
    })
    pos.needsUpdate = true
    col.needsUpdate = true
  })

  return (
    <points ref={ref} frustumCulled={false} visible={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={mat}
        map={tex}
        size={0.22}
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
