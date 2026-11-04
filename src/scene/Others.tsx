import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { onRemoteAction, remotes } from '../net/net'
import { sfx } from '../audio/sfx'
import { fx, me } from './fx'
import { Monk, animateMonk, type MonkRefs } from './Monk'

/** Một người chơi khác: nội suy mượt từ vị trí server gửi (10Hz) lên 60fps */
function RemoteMonk({ id, name, color }: { id: string; name: string; color: string }) {
  const root = useRef<THREE.Group>(null)
  const rig = useRef<MonkRefs>({ body: null, upper: null }).current
  const first = useRef(true)

  useFrame((_, dt) => {
    const r = remotes.get(id)
    const g = root.current
    if (!r || !g) return
    if (first.current) { r.x = r.tx; r.z = r.tz; r.rot = r.trot; first.current = false }
    // nội suy theo hàm mũ: không phụ thuộc fps, tự "đuổi kịp" khi gói tin đến trễ
    const k = 1 - Math.exp(-dt * 10)
    const dx = r.tx - r.x, dz = r.tz - r.z
    r.x += dx * k
    r.z += dz * k
    // nếu bị lệch quá xa (vd. dịch chuyển) thì nhảy thẳng tới
    if (dx * dx + dz * dz > 25) { r.x = r.tx; r.z = r.tz }
    const dr = Math.atan2(Math.sin(r.trot - r.rot), Math.cos(r.trot - r.rot))
    r.rot += dr * Math.min(1, dt * 12)
    g.position.set(r.x, 0, r.z)
    g.rotation.y = r.rot
    animateMonk(rig, {
      pose: r.pose, bowAt: r.bowAt, greetAt: r.greetAt,
      moving: Math.abs(dx) + Math.abs(dz) > 0.02, now: performance.now(),
    })
  })

  return (
    <group ref={root}>
      <Monk rig={rig} color={color} name={name} />
    </group>
  )
}

/** Âm lượng giảm dần theo khoảng cách tới người chơi local */
function volumeFor(id: string, min: number) {
  const r = remotes.get(id)
  if (!r) return min
  const d = Math.hypot(r.x - me.x, r.z - me.z)
  return THREE.MathUtils.clamp(1 - d / 22, min, 1)
}

export default function Others() {
  const roster = useStore((s) => s.roster)

  // Hành động của người khác → animation trên vật thể + âm thanh theo khoảng cách
  useEffect(() => onRemoteAction((id, a) => {
    const now = performance.now()
    switch (a) {
      case 'mo': fx.moAt = now; sfx.at(volumeFor(id, 0.1), (s) => s.mo()); break
      case 'bell': fx.bellAt = now; setTimeout(() => sfx.at(volumeFor(id, 0.35), (s) => s.bell()), 220); break
      case 'shake': fx.shakeAt = now; sfx.at(volumeFor(id, 0.05), (s) => s.shake()); break
      case 'bow': sfx.at(volumeFor(id, 0.05) * 0.6, (s) => s.smallBell()); break
      case 'greet': break
    }
  }), [])

  return (
    <>
      {roster.map((p) => <RemoteMonk key={p.id} id={p.id} name={p.name} color={p.color} />)}
    </>
  )
}
