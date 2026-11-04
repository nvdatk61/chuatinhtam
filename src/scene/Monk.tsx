import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Pose } from '../../shared/protocol'

export const BOW_SECONDS = 2.2
export const GREET_SECONDS = 1.4

export interface MonkRefs {
  body: THREE.Group | null
  upper: THREE.Group | null
}

/** Nhân vật chú tiểu dựng bằng khối cơ bản. Dùng chung cho mình và người chơi khác.
 *  `rig` là object do component cha giữ (useRef(...).current) để animateMonk điều khiển. */
export function Monk({ rig, color, name, isMe }: { rig: MonkRefs; color: string; name?: string; isMe?: boolean }) {
  const robe = <meshStandardMaterial color={color} roughness={0.9} />
  const skin = <meshStandardMaterial color="#f0c8a0" roughness={0.7} />
  return (
    <group ref={(g) => { rig.body = g }}>
      <mesh position={[0, 0.38, 0]} castShadow><cylinderGeometry args={[0.2, 0.3, 0.76, 16]} />{robe}</mesh>
      {/* thân trên – xoay quanh hông khi lạy/chào */}
      <group ref={(g) => { rig.upper = g }} position={[0, 0.74, 0]}>
        <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.16, 0.2, 0.42, 16]} />{robe}</mesh>
        <mesh position={[0, 0.25, 0.17]} scale={[0.6, 1, 0.6]}><sphereGeometry args={[0.07, 10, 8]} />{skin}</mesh>
        <mesh position={[0, 0.58, 0]} castShadow><sphereGeometry args={[0.2, 20, 16]} />{skin}</mesh>
        <mesh position={[0, 0.76, -0.05]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#222" /></mesh>
        {[-0.07, 0.07].map((x) => (
          <mesh key={x} position={[x, 0.6, 0.18]}><sphereGeometry args={[0.018, 6, 6]} /><meshBasicMaterial color="#222" /></mesh>
        ))}
      </group>
      {name && (
        <Html position={[0, 1.75, 0]} center distanceFactor={9} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`nametag${isMe ? ' me' : ''}`}>{name}</div>
        </Html>
      )}
    </group>
  )
}

/**
 * Áp animation lên nhân vật dựa trên pose và thời điểm hành động gần nhất.
 * Hàm thuần, gọi trong useFrame cho cả người chơi local và remote.
 */
export function animateMonk(
  r: MonkRefs,
  o: { pose: Pose; bowAt: number; greetAt: number; moving: boolean; now: number },
) {
  const { body, upper } = r
  if (!body || !upper) return
  // ngồi thiền: hạ thấp người
  const baseY = o.pose === 'sit' ? 0.06 : 0
  body.position.y = THREE.MathUtils.lerp(body.position.y, baseY, 0.15)

  const bt = (o.now - o.bowAt) / 1000
  const bowK = bt >= 0 && bt < BOW_SECONDS ? Math.sin((bt / BOW_SECONDS) * Math.PI) : 0
  const gt = (o.now - o.greetAt) / 1000
  const greetK = gt >= 0 && gt < GREET_SECONDS ? Math.sin((gt / GREET_SECONDS) * Math.PI) : 0

  upper.rotation.x = bowK * 1.15 + greetK * 0.45
  body.position.y -= bowK * 0.3
  if (o.moving) body.position.y += Math.abs(Math.sin(o.now / 110)) * 0.04
}
