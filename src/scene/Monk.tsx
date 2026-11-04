import { useEffect, useMemo } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Pose } from '../../shared/protocol'

export const BOW_SECONDS = 2.2
export const GREET_SECONDS = 1.4

/** Các khớp của nhân vật + trạng thái animation nội bộ (đã làm mượt) */
export interface MonkRig {
  body: THREE.Group | null
  upper: THREE.Group | null
  head: THREE.Group | null
  armL: THREE.Group | null
  armR: THREE.Group | null
  legL: THREE.Group | null
  legR: THREE.Group | null
  eyeL: THREE.Group | null
  eyeR: THREE.Group | null
  /** performance.now() của khung hình trước, để tự tính dt */
  last: number
  /** biên độ bước đi 0..1 (mượt dần khi bắt đầu/dừng) */
  walk: number
  /** pha chu kỳ bước chân */
  phase: number
  /** mức chắp tay 0..1 */
  pray: number
  /** mức ngồi thiền 0..1 */
  sit: number
  blinkAt: number
  nextBlink: number
  /** số ngẫu nhiên riêng mỗi nhân vật để các chú tiểu không lắc lư đồng loạt */
  seed: number
}

/** Tạo rig mới – gọi một lần cho mỗi nhân vật (useMemo(createRig, [])) */
export function createRig(): MonkRig {
  return {
    body: null, upper: null, head: null, armL: null, armR: null, legL: null, legR: null, eyeL: null, eyeR: null,
    last: performance.now(), walk: 0, phase: 0, pray: 0, sit: 0,
    blinkAt: -1e9, nextBlink: performance.now() + 1000 + Math.random() * 3000, seed: Math.random() * 100,
  }
}

/* ---- hình khối và vật liệu dùng chung cho mọi chú tiểu (tiết kiệm bộ nhớ GPU) ---- */
const SPHERE = new THREE.SphereGeometry(1, 24, 18)
const SMALL_SPHERE = new THREE.SphereGeometry(1, 12, 10)
const LIMB = new THREE.CapsuleGeometry(1, 2, 4, 10) // bán kính 1, thân dài 2 → scale theo tay/chân
const SMILE = new THREE.TorusGeometry(0.045, 0.009, 6, 14, Math.PI)
const SKIN = new THREE.MeshStandardMaterial({ color: '#f7d4b4', roughness: 0.6 })
const EYE = new THREE.MeshStandardMaterial({ color: '#1f1612', roughness: 0.2 })
const SPARKLE = new THREE.MeshBasicMaterial({ color: '#ffffff' })
const CHEEK = new THREE.MeshStandardMaterial({ color: '#ff8b9e', roughness: 0.9, transparent: true, opacity: 0.6, depthWrite: false })
const MOUTH = new THREE.MeshStandardMaterial({ color: '#9a4030' })
const HAIR = new THREE.MeshStandardMaterial({ color: '#4a3a32', roughness: 0.9 })
const FOOT = new THREE.MeshStandardMaterial({ color: '#4a3422', roughness: 0.8 })

/** Một con mắt tròn có đốm sáng – cả nhóm được scale.y khi chớp mắt */
function Eye({ x, rigKey, rig }: { x: number; rigKey: 'eyeL' | 'eyeR'; rig: MonkRig }) {
  return (
    <group ref={(g) => { rig[rigKey] = g }} position={[x, -0.03, 0.3]}>
      <mesh geometry={SPHERE} material={EYE} scale={[0.058, 0.068, 0.03]} />
      <mesh geometry={SMALL_SPHERE} material={SPARKLE} position={[0.018, 0.024, 0.026]} scale={0.017} />
      <mesh geometry={SMALL_SPHERE} material={SPARKLE} position={[-0.016, -0.02, 0.026]} scale={0.008} />
    </group>
  )
}

/**
 * Chú tiểu chibi: đầu to, mắt tròn long lanh, má hồng, chỏm tóc trước trán.
 * Dùng chung cho mình và người chơi khác. `rig` tạo bằng createRig() để animateMonk điều khiển.
 */
export function Monk({ rig, color, name, isMe }: { rig: MonkRig; color: string; name?: string; isMe?: boolean }) {
  // áo theo màu người chơi chọn + viền/đai sẫm hơn một chút
  const [robe, trim] = useMemo(() => [
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.62), roughness: 0.85 }),
  ], [color])
  useEffect(() => () => { robe.dispose(); trim.dispose() }, [robe, trim])

  return (
    <group ref={(g) => { rig.body = g }}>
      {/* chân – khớp ở hông, phần lớn nằm trong vạt áo, chỉ lộ bàn chân */}
      {([-0.1, 0.1] as const).map((x) => (
        <group
          key={x}
          ref={(g) => { if (g) g.rotation.order = 'YXZ'; rig[x < 0 ? 'legL' : 'legR'] = g }}
          position={[x, 0.3, 0]}
        >
          <mesh geometry={LIMB} material={trim} position={[0, -0.12, 0]} scale={[0.065, 0.06, 0.065]} />
          <mesh geometry={SPHERE} material={FOOT} position={[0, -0.24, 0.03]} scale={[0.07, 0.045, 0.1]} castShadow />
        </group>
      ))}
      {/* vạt áo dưới */}
      <mesh position={[0, 0.29, 0]} castShadow>
        <cylinderGeometry args={[0.23, 0.33, 0.42, 20]} />
        <primitive object={robe} attach="material" />
      </mesh>

      {/* thân trên – xoay quanh hông khi lạy/chào */}
      <group ref={(g) => { rig.upper = g }} position={[0, 0.5, 0]}>
        <mesh position={[0, 0.15, 0]} castShadow>
          <cylinderGeometry args={[0.17, 0.23, 0.34, 20]} />
          <primitive object={robe} attach="material" />
        </mesh>
        {/* đai lưng và cổ áo */}
        <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.235, 0.235, 0.05, 20]} /><primitive object={trim} attach="material" /></mesh>
        <mesh position={[0, 0.31, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.13, 0.03, 8, 20]} /><primitive object={trim} attach="material" /></mesh>

        {/* tay áo + bàn tay, khớp ở vai */}
        {([-0.2, 0.2] as const).map((x) => (
          <group key={x} ref={(g) => { rig[x < 0 ? 'armL' : 'armR'] = g }} position={[x, 0.27, 0.04]}>
            <mesh geometry={LIMB} material={robe} position={[0, -0.11, 0]} scale={[0.07, 0.06, 0.07]} castShadow />
            <mesh geometry={SPHERE} material={SKIN} position={[0, -0.25, 0]} scale={0.062} />
          </group>
        ))}

        {/* đầu to tròn – khớp ở cổ */}
        <group ref={(g) => { rig.head = g }} position={[0, 0.3, 0]}>
          <group position={[0, 0.3, 0]}>
            <mesh geometry={SPHERE} material={SKIN} scale={[0.34, 0.33, 0.34]} castShadow />
            {/* tai */}
            {[-1, 1].map((s) => (
              <mesh key={s} geometry={SPHERE} material={SKIN} position={[s * 0.33, -0.02, 0]} scale={[0.04, 0.07, 0.05]} />
            ))}
            <Eye x={-0.12} rigKey="eyeL" rig={rig} />
            <Eye x={0.12} rigKey="eyeR" rig={rig} />
            {/* má hồng */}
            {[-1, 1].map((s) => (
              <mesh key={s} geometry={SPHERE} material={CHEEK} position={[s * 0.19, -0.1, 0.262]} rotation={[0, s * 0.62, 0]} scale={[0.06, 0.036, 0.012]} />
            ))}
            {/* miệng cười: nửa vòng xuyến úp ngược */}
            <mesh geometry={SMILE} material={MOUTH} position={[0, -0.13, 0.305]} rotation={[0.25, 0, Math.PI]} />
            {/* chỏm tóc trước trán (kiểu chú tiểu) */}
            <mesh geometry={SPHERE} material={HAIR} position={[0, 0.315, 0.08]} rotation={[0.3, 0, 0]} scale={[0.05, 0.03, 0.055]} />
            <mesh geometry={SPHERE} material={HAIR} position={[0.012, 0.345, 0.1]} rotation={[0.9, 0, -0.3]} scale={[0.018, 0.04, 0.018]} />
          </group>
        </group>
      </group>

      {name && (
        <Html position={[0, 1.75, 0]} center distanceFactor={9} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`nametag${isMe ? ' me' : ''}`}>{name}</div>
        </Html>
      )}
    </group>
  )
}

/** Tiến dần tới mục tiêu theo hàm mũ – mượt và không phụ thuộc fps */
const damp = (cur: number, target: number, speed: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-speed * dt))
/** Đường cong lên-xuống 0→1→0 có đạo hàm bằng 0 ở hai đầu (bắt đầu và kết thúc êm) */
const bump = (t: number, dur: number) => (t >= 0 && t < dur ? 0.5 - 0.5 * Math.cos((t / dur) * Math.PI * 2) : 0)

/**
 * Áp animation lên nhân vật dựa trên pose và thời điểm hành động gần nhất.
 * Gọi trong useFrame cho cả người chơi local và remote; dt tự tính từ `now`.
 */
export function animateMonk(
  r: MonkRig,
  o: { pose: Pose; bowAt: number; greetAt: number; moving: boolean; now: number },
) {
  const { body, upper, head, armL, armR, legL, legR, eyeL, eyeR } = r
  if (!body || !upper || !head || !armL || !armR || !legL || !legR || !eyeL || !eyeR) return
  const dt = Math.min(Math.max((o.now - r.last) / 1000, 0), 0.05)
  r.last = o.now
  const t = o.now / 1000 + r.seed

  // lạy (nhấn sâu ở giữa) và chào (cúi nhẹ)
  const bowT = (o.now - o.bowAt) / 1000
  const greetT = (o.now - o.greetAt) / 1000
  const bowK = bump(bowT, BOW_SECONDS)
  const greetK = bump(greetT, GREET_SECONDS)
  const inBow = bowT >= 0 && bowT < BOW_SECONDS - 0.25
  const inGreet = greetT >= 0 && greetT < GREET_SECONDS - 0.2

  // các giá trị được làm mượt
  r.walk = damp(r.walk, o.moving ? 1 : 0, 9, dt)
  r.sit = damp(r.sit, o.pose === 'sit' ? 1 : 0, 5, dt)
  r.pray = damp(r.pray, inBow || inGreet ? 1 : 0, 12, dt)
  if (o.moving) r.phase += dt * 10.5
  const w = r.walk, sit = r.sit, pray = r.pray
  const swing = Math.sin(r.phase)

  /* thân: ngồi thì nâng lên mặt bồ đoàn, đi thì nhún nhảy + lắc lư kiểu chibi */
  body.position.y = sit * 0.16 + Math.abs(swing) * 0.055 * w - bowK * 0.08
  body.rotation.z = swing * 0.06 * w
  const squash = 1 - Math.abs(Math.cos(r.phase)) * 0.04 * w // co nhẹ khi chân chạm đất
  body.scale.set(2 - squash, squash, 2 - squash)

  /* thân trên: thở + cúi khi lạy/chào */
  const breathe = Math.sin(t * 2.1) * 0.012 * (1 - w)
  upper.scale.set(1 + breathe * 0.5, 1 + breathe, 1 + breathe * 0.5)
  upper.rotation.x = bowK * 0.95 + greetK * 0.4 + w * 0.06

  /* đầu: lắc lư nhẹ khi đứng yên, gật theo bước, nghiêng đầu khi chào */
  head.rotation.z = Math.sin(t * 0.8) * 0.05 * (1 - w) * (1 - sit) + swing * 0.04 * w + greetK * 0.14
  head.rotation.x = bowK * 0.25 + Math.sin(r.phase * 2) * 0.03 * w + sit * 0.12 + Math.sin(t * 0.5) * 0.02 * sit
  head.rotation.y = Math.sin(t * 0.37) * 0.12 * (1 - w) * (1 - sit) * (1 - pray)

  /* tay: vung khi đi, chắp trước ngực khi lạy/chào, đặt lên đùi khi thiền */
  const rest = 1 - pray
  armL.rotation.x = swing * 0.6 * w * rest + pray * -1.45 + sit * rest * -0.75
  armR.rotation.x = -swing * 0.6 * w * rest + pray * -1.45 + sit * rest * -0.75
  armL.rotation.z = (-0.22 - w * 0.12) * rest * (1 - sit) + pray * 0.6 + sit * rest * 0.5
  armR.rotation.z = (0.22 + w * 0.12) * rest * (1 - sit) - pray * 0.6 - sit * rest * 0.5

  /* chân: bước khi đi, xếp bằng khi ngồi thiền */
  legL.rotation.x = -swing * 0.55 * w * (1 - sit) - sit * 1.5
  legR.rotation.x = swing * 0.55 * w * (1 - sit) - sit * 1.5
  legL.rotation.y = sit * 0.75
  legR.rotation.y = -sit * 0.75

  /* chớp mắt ngẫu nhiên (đôi khi chớp hai lần); nhắm mắt khi thiền và khi lạy */
  if (o.now > r.nextBlink) {
    r.blinkAt = o.now
    r.nextBlink = o.now + (Math.random() < 0.15 ? 260 : 1800 + Math.random() * 3500)
  }
  const bt = (o.now - r.blinkAt) / 150
  const blink = bt >= 0 && bt < 1 ? Math.sin(bt * Math.PI) : 0
  const closed = Math.max(blink, sit * 0.92, bowK * 0.9)
  const ey = 1 - closed * 0.88
  eyeL.scale.y = ey
  eyeR.scale.y = ey
}
