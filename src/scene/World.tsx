import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { fx } from './fx'
import { useStore } from '../store'
import { glow } from './Effects'
import { softDotTexture } from './Particles'
import { ambient } from './sky'

const RED = '#8e1f1b'
const RED_DARK = '#6a1512'
const GOLD = '#d4a53a'
const ROOF = '#3f4a3c'
const ROOF_EDGE = '#2f382d'
const WOOD = '#6b4325'
const STONE = '#c9bfa8'

/* Màu HDR (> 1) để bloom bắt sáng – vật thường giữ màu ≤ 1 nên không bị loá */
const FLAME = glow('#ffb347', 5)
const EMBER = glow('#ff7a2a', 4)
const HALO_SOFT = glow('#ffcf70', 1.6)
const SMOKE_DAY = new THREE.Color('#e8e4dc')
const SMOKE_NIGHT = new THREE.Color('#5c5e68')

/* ---------- Mái chùa: khối chóp cụt 4 mặt + đầu đao cong ---------- */
function Roof({ w, d, h, y, color = ROOF }: { w: number; d: number; h: number; y: number; color?: string }) {
  const geo = useMemo(() => {
    // CylinderGeometry 4 cạnh, xoay 45° → chóp cụt vuông, sau đó scale theo w/d
    const g = new THREE.CylinderGeometry(0.42, 0.72, 1, 4, 1)
    g.rotateY(Math.PI / 4)
    g.scale(w, h, d)
    g.computeVertexNormals()
    return g
  }, [w, d, h])
  const corners: Array<[number, number, number]> = [
    [1, 1, 0.25 * Math.PI], [-1, 1, 0.75 * Math.PI], [-1, -1, 1.25 * Math.PI], [1, -1, 1.75 * Math.PI],
  ]
  const half = 0.72 * Math.SQRT1_2
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.9} flatShading />
      </mesh>
      {/* bờ nóc */}
      <mesh position={[0, h / 2 + 0.08, 0]} castShadow>
        <boxGeometry args={[w * 0.42 * Math.SQRT2 * 0.95, 0.18, 0.22]} />
        <meshStandardMaterial color={ROOF_EDGE} />
      </mesh>
      {/* đầu đao cong vút ở 4 góc */}
      {corners.map(([sx, sz, rot], i) => (
        <group key={i} position={[sx * w * half, -h / 2 + 0.05, sz * d * half]} rotation={[0, -rot + Math.PI / 2, 0]}>
          <mesh position={[0.25, 0.22, 0]} rotation={[0, 0, -0.9]} castShadow>
            <coneGeometry args={[0.12, 0.8, 6]} />
            <meshStandardMaterial color={ROOF_EDGE} />
          </mesh>
        </group>
      ))}
      {/* lưỡng long chầu nguyệt (giản lược): mặt trăng giữa nóc */}
      <mesh position={[0, h / 2 + 0.45, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <RoofPearlMaterial />
      </mesh>
    </group>
  )
}

/** Ngọc giữa nóc mái: ánh vàng nhẹ ban ngày, phát sáng ban đêm */
function RoofPearlMaterial() {
  const ref = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => { if (ref.current) ref.current.emissiveIntensity = 0.3 + ambient.night * 2.2 })
  return <meshStandardMaterial ref={ref} color={GOLD} emissive={GOLD} metalness={0.6} roughness={0.3} />
}

/* ---------- Tượng Phật (dựng từ hình khối cơ bản) ---------- */
function Buddha() {
  const gold = <meshStandardMaterial color={GOLD} metalness={0.75} roughness={0.28} />
  const petals = useMemo(() => Array.from({ length: 14 }, (_, i) => (i / 14) * Math.PI * 2), [])
  return (
    <group position={[0, 1.15, -8.9]}>
      {/* đài sen */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.95, 0.8, 0.35, 28]} />
        <meshStandardMaterial color="#b9475e" roughness={0.6} />
      </mesh>
      {petals.map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.9, 0.22, Math.sin(a) * 0.9]} rotation={[0, -a, 0.5]} scale={[0.18, 0.32, 0.12]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#e3899c" roughness={0.6} />
        </mesh>
      ))}
      {/* thân ngồi kiết già */}
      <mesh position={[0, 0.48, 0]} scale={[0.9, 0.32, 0.6]} castShadow>{<sphereGeometry args={[1, 24, 16]} />}{gold}</mesh>
      <mesh position={[0, 1.05, 0]} scale={[0.52, 0.72, 0.4]} castShadow>{<sphereGeometry args={[1, 24, 16]} />}{gold}</mesh>
      {/* tay kết ấn */}
      <mesh position={[0, 0.72, 0.32]} scale={[0.32, 0.1, 0.18]}>{<sphereGeometry args={[1, 16, 10]} />}{gold}</mesh>
      {/* đầu */}
      <mesh position={[0, 1.95, 0.02]} castShadow>{<sphereGeometry args={[0.3, 24, 20]} />}{gold}</mesh>
      <mesh position={[0, 2.25, 0]}>{<sphereGeometry args={[0.13, 16, 12]} />}{gold}</mesh>
      <Halo />
    </group>
  )
}

/* ---------- Hào quang: vòng sáng toả bloom, "thở" chậm, sáng hơn về đêm ---------- */
function Halo() {
  const inner = useRef<THREE.MeshStandardMaterial>(null)
  const outer = useRef<THREE.MeshStandardMaterial>(null)
  const disc = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    const pulse = 1 + Math.sin(clock.elapsedTime * 0.9) * 0.12
    const n = 1 + ambient.night * 0.6
    if (inner.current) inner.current.emissiveIntensity = 3.2 * pulse * n
    if (outer.current) outer.current.emissiveIntensity = 2 * pulse * n
    if (disc.current) disc.current.opacity = (0.22 + ambient.night * 0.18) * pulse
  })
  return (
    <group>
      <mesh position={[0, 1.9, -0.35]}>
        <torusGeometry args={[0.62, 0.05, 10, 48]} />
        <meshStandardMaterial ref={inner} color="#ffd36b" emissive="#ffb43a" />
      </mesh>
      <mesh position={[0, 1.4, -0.4]}>
        <torusGeometry args={[1.15, 0.04, 10, 64]} />
        <meshStandardMaterial ref={outer} color="#ffd36b" emissive="#ffb43a" />
      </mesh>
      {/* đĩa sáng mờ sau đầu tượng */}
      <mesh position={[0, 1.9, -0.37]}>
        <circleGeometry args={[0.6, 48]} />
        <meshBasicMaterial ref={disc} color={HALO_SOFT} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}

/* ---------- Nến: ngọn lửa hình giọt nước, lung linh ---------- */
function Candle({ x }: { x: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + x * 3
    const f = 1 + Math.sin(t * 17) * 0.08 + Math.sin(t * 9.3) * 0.06
    if (ref.current) {
      ref.current.scale.set(0.035 / f, 0.06 * f, 0.035 / f)
      ref.current.rotation.z = Math.sin(t * 5.1) * 0.08
    }
  })
  return (
    <group position={[x, 0.95, -8.05]}>
      <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[0.05, 0.05, 0.3, 12]} /><meshStandardMaterial color="#f3e7c9" /></mesh>
      <mesh ref={ref} position={[0, 0.35, 0]}><sphereGeometry args={[1, 10, 8]} /><meshBasicMaterial color={FLAME} /></mesh>
    </group>
  )
}

/* ---------- Khói hương ---------- */
function Smoke({ position, count = 30 }: { position: [number, number, number]; count?: number }) {
  const ref = useRef<THREE.Points>(null)
  const mat = useRef<THREE.PointsMaterial>(null)
  const tex = useMemo(softDotTexture, [])
  useEffect(() => () => tex.dispose(), [tex])
  const seeds = useMemo(() => Array.from({ length: count }, () => Math.random()), [count])
  const positions = useMemo(() => new Float32Array(count * 3), [count])
  useFrame(({ clock }) => {
    const pts = ref.current; if (!pts) return
    const attr = pts.geometry.getAttribute('position') as THREE.BufferAttribute
    const t = clock.elapsedTime
    // khói không tự phát sáng: ban đêm mờ đi để khỏi trắng loá giữa nền tối
    if (mat.current) {
      mat.current.opacity = 0.5 - ambient.night * 0.25
      mat.current.color.lerpColors(SMOKE_DAY, SMOKE_NIGHT, ambient.night)
    }
    seeds.forEach((s, i) => {
      const p = (t * 0.22 + s) % 1
      attr.setXYZ(i, Math.sin(p * 7 + s * 10) * 0.15 * p, p * 1.8, Math.cos(p * 5 + s * 8) * 0.15 * p)
    })
    attr.needsUpdate = true
  })
  return (
    <points ref={ref} position={position}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={mat} map={tex} size={0.12} transparent depthWrite={false} />
    </points>
  )
}

/* ---------- Bàn thờ, bát hương, nến ---------- */
function Altar() {
  const incense = useStore((s) => s.incense)
  const sticks = Math.min(3 + incense, 15)
  const flame = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    if (flame.current) flame.current.intensity = 2.2 + ambient.night * 1.5 + Math.sin(clock.elapsedTime * 13) * 0.25 + Math.sin(clock.elapsedTime * 7.3) * 0.2
  })
  return (
    <group>
      {/* bệ cao đặt tượng */}
      <mesh position={[0, 0.6, -8.9]} castShadow receiveShadow>
        <boxGeometry args={[3, 1.2, 1.6]} />
        <meshStandardMaterial color={RED_DARK} roughness={0.7} />
      </mesh>
      {/* bàn thờ phía trước */}
      <mesh position={[0, 0.45, -8.05]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.9, 0.6]} />
        <meshStandardMaterial color={RED} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.92, -8.05]}>
        <boxGeometry args={[2.6, 0.06, 0.75]} />
        <meshStandardMaterial color={GOLD} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* bát hương */}
      <mesh position={[0, 1.05, -8.05]}>
        <cylinderGeometry args={[0.2, 0.16, 0.22, 20]} />
        <meshStandardMaterial color="#b88a3a" metalness={0.6} roughness={0.35} />
      </mesh>
      {Array.from({ length: sticks }, (_, i) => {
        const a = (i / sticks) * Math.PI * 2
        const r = i === 0 ? 0 : 0.08
        return (
          <group key={i} position={[Math.cos(a) * r, 1.32, -8.05 + Math.sin(a) * r]} rotation={[Math.sin(a) * 0.08, 0, Math.cos(a) * 0.08]}>
            <mesh><cylinderGeometry args={[0.008, 0.008, 0.5, 4]} /><meshStandardMaterial color="#a33" /></mesh>
            <mesh position={[0, 0.25, 0]}><sphereGeometry args={[0.014, 6, 6]} /><meshBasicMaterial color={EMBER} /></mesh>
          </group>
        )
      })}
      <Smoke position={[0, 1.55, -8.05]} count={18 + sticks * 3} />
      {/* nến */}
      {[-0.9, 0.9].map((x) => <Candle key={x} x={x} />)}
      <pointLight ref={flame} position={[0, 1.6, -7.6]} color="#ffae5c" distance={8} decay={1.6} />
      {/* đĩa quả */}
      {[-0.5, 0.5].map((x) => (
        <group key={x} position={[x, 1.0, -8.05]}>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position={[Math.cos(k * 2) * 0.07, k === 3 ? 0.1 : 0.04, Math.sin(k * 2) * 0.07]}>
              <sphereGeometry args={[0.06, 10, 8]} />
              <meshStandardMaterial color={k % 2 ? '#e2a32a' : '#c8452e'} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/* ---------- Chánh điện ---------- */
function Hall() {
  const cols: Array<[number, number]> = []
  for (const x of [-6.4, -3.2, 3.2, 6.4]) for (const z of [-2.6, -6.5]) cols.push([x, z])
  return (
    <group>
      {/* nền */}
      <mesh position={[0, 0.03, -6.7]} receiveShadow>
        <boxGeometry args={[15.6, 0.06, 9.8]} />
        <meshStandardMaterial color="#8a6a48" roughness={0.85} />
      </mesh>
      {/* chiếu đỏ giữa lối */}
      <mesh position={[0, 0.07, -5]} receiveShadow>
        <boxGeometry args={[1.6, 0.02, 5.4]} />
        <meshStandardMaterial color="#9b2b23" roughness={1} />
      </mesh>
      {/* tường */}
      <mesh position={[0, 2.1, -11.05]} receiveShadow><boxGeometry args={[15.2, 4.2, 0.4]} /><meshStandardMaterial color="#e8d8b4" /></mesh>
      <mesh position={[-7.2, 2.1, -6.85]} receiveShadow><boxGeometry args={[0.4, 4.2, 8.8]} /><meshStandardMaterial color="#e8d8b4" /></mesh>
      <mesh position={[7.2, 2.1, -6.85]} receiveShadow><boxGeometry args={[0.4, 4.2, 8.8]} /><meshStandardMaterial color="#e8d8b4" /></mesh>
      {/* hoành phi */}
      <mesh position={[0, 3.55, -10.8]}><boxGeometry args={[3.4, 0.7, 0.08]} /><meshStandardMaterial color={RED} /></mesh>
      <mesh position={[0, 3.55, -10.75]}><boxGeometry args={[3.0, 0.45, 0.04]} /><meshStandardMaterial color={GOLD} metalness={0.5} /></mesh>
      {/* cột */}
      {cols.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.32, 0.36, 0.24, 16]} /><meshStandardMaterial color={STONE} /></mesh>
          <mesh position={[0, 2.2, 0]} castShadow><cylinderGeometry args={[0.2, 0.22, 4.2, 16]} /><meshStandardMaterial color={RED} roughness={0.5} /></mesh>
        </group>
      ))}
      {/* xà ngang */}
      <mesh position={[0, 4.25, -2.6]} castShadow><boxGeometry args={[15, 0.3, 0.3]} /><meshStandardMaterial color={RED_DARK} /></mesh>
      {/* mái 2 tầng */}
      <group position={[0, 0, -6.7]}>
        <Roof w={22} d={14.5} h={1.6} y={5.1} />
        <Roof w={13} d={8.4} h={1.4} y={6.4} />
      </group>
      {/* đèn lồng */}
      {[-4.8, 4.8].map((x) => <Lantern key={x} position={[x, 3.5, -2.6]} />)}
    </group>
  )
}

function Lantern({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (ref.current) ref.current.rotation.z = Math.sin(t * 1.2 + position[0]) * 0.05
    // ban ngày ửng nhẹ, ban đêm rực lên và chập chờn như có nến bên trong
    if (mat.current) mat.current.emissiveIntensity = (0.9 + ambient.night * 1.0) * (1 + Math.sin(t * 7 + position[0]) * 0.04)
  })
  return (
    <group ref={ref} position={position}>
      <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.01, 0.01, 0.7, 4]} /><meshStandardMaterial color="#222" /></mesh>
      <mesh scale={[1, 1.2, 1]}><sphereGeometry args={[0.28, 16, 12]} /><meshStandardMaterial ref={mat} color="#c42a20" emissive="#ff2a12" /></mesh>
      <mesh position={[0, -0.42, 0]}><cylinderGeometry args={[0.04, 0.02, 0.25, 6]} /><meshStandardMaterial color={GOLD} /></mesh>
    </group>
  )
}

/* ---------- Mõ ---------- */
function Mo() {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!ref.current) return
    const t = (performance.now() - fx.moAt) / 1000
    const k = t < 0.25 ? Math.sin(t * 40) * Math.exp(-t * 14) : 0
    ref.current.scale.set(1 + k * 0.08, 1 - k * 0.1, 1 + k * 0.08)
  })
  return (
    <group position={[-3.2, 0, -6.9]}>
      <mesh position={[0, 0.25, 0]} castShadow><boxGeometry args={[0.9, 0.5, 0.7]} /><meshStandardMaterial color={RED} /></mesh>
      <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.32, 0.32, 0.08, 20]} /><meshStandardMaterial color="#c9a227" /></mesh>
      <group ref={ref} position={[0, 0.82, 0]}>
        <mesh scale={[0.32, 0.24, 0.3]} castShadow>
          <sphereGeometry args={[1, 24, 18]} />
          <meshStandardMaterial color="#a0522d" roughness={0.45} />
        </mesh>
        {/* khe mõ */}
        <mesh position={[0, -0.02, 0.27]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.36, 0.025, 0.06]} />
          <meshStandardMaterial color="#2b1608" />
        </mesh>
      </group>
      {/* dùi */}
      <mesh position={[0.42, 0.62, 0.15]} rotation={[0, 0, 0.6]}>
        <cylinderGeometry args={[0.02, 0.02, 0.4, 6]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
    </group>
  )
}

/* ---------- Bồ đoàn ---------- */
function Cushion() {
  return (
    <group position={[3.2, 0, -6.9]}>
      <mesh position={[0, 0.06, 0]} receiveShadow><boxGeometry args={[1.4, 0.04, 1.4]} /><meshStandardMaterial color="#7d5a1e" /></mesh>
      <mesh position={[0, 0.17, 0]} castShadow><cylinderGeometry args={[0.42, 0.45, 0.2, 24]} /><meshStandardMaterial color="#d9a521" roughness={0.9} /></mesh>
    </group>
  )
}

/* ---------- Gác chuông ---------- */
function BellTower() {
  const bell = useRef<THREE.Group>(null)
  const log = useRef<THREE.Group>(null)
  const bellGeo = useMemo(() => {
    const pts = [
      [0, 1.2], [0.18, 1.2], [0.32, 1.12], [0.4, 0.9], [0.44, 0.5], [0.52, 0.18], [0.62, 0.04], [0.6, 0], [0.5, 0.02],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    return new THREE.LatheGeometry(pts, 32)
  }, [])
  useFrame(() => {
    const t = (performance.now() - fx.bellAt) / 1000
    if (bell.current) bell.current.rotation.x = t < 6 ? Math.sin(t * 5) * 0.06 * Math.exp(-t * 0.8) : 0
    if (log.current) log.current.position.z = t < 0.6 ? -Math.sin(Math.min(t, 0.3) / 0.3 * Math.PI) * 0.45 : 0
  })
  const posts: Array<[number, number]> = [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]
  return (
    <group position={[9, 0, 2.5]}>
      <mesh position={[0, 0.15, 0]} receiveShadow><boxGeometry args={[3.2, 0.3, 3.2]} /><meshStandardMaterial color={STONE} /></mesh>
      {posts.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 2, z]} castShadow><cylinderGeometry args={[0.13, 0.15, 3.6, 12]} /><meshStandardMaterial color={RED} /></mesh>
      ))}
      <mesh position={[0, 3.6, 0]}><boxGeometry args={[2.8, 0.2, 0.2]} /><meshStandardMaterial color={RED_DARK} /></mesh>
      <Roof w={5.4} d={5.4} h={1.1} y={4.3} />
      <group ref={bell} position={[0, 3.5, 0]}>
        <mesh position={[0, -1.35, 0]} geometry={bellGeo} castShadow>
          <meshStandardMaterial color="#6e5a2c" metalness={0.85} roughness={0.35} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* chày gỗ thỉnh chuông */}
      <group ref={log} position={[0, 2.5, 0]}>
        <mesh position={[0, 0, 1.15]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.12, 0.12, 1.1, 10]} /><meshStandardMaterial color={WOOD} /></mesh>
      </group>
    </group>
  )
}

/* ---------- Ống xăm ---------- */
function FortuneTable() {
  const cup = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = (performance.now() - fx.shakeAt) / 1000
    if (cup.current) cup.current.rotation.z = t < 0.9 ? Math.sin(t * 38) * 0.18 : 0
  })
  return (
    <group position={[-9, 0, 3]}>
      <mesh position={[0, 0.4, 0]} castShadow><boxGeometry args={[1.2, 0.8, 0.8]} /><meshStandardMaterial color={RED} /></mesh>
      <group ref={cup} position={[0, 0.8, 0]}>
        <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.16, 0.14, 0.5, 18]} /><meshStandardMaterial color="#b3261e" /></mesh>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={i} position={[Math.cos(i) * 0.07, 0.6, Math.sin(i) * 0.07]} rotation={[Math.sin(i) * 0.12, 0, Math.cos(i) * 0.12]}>
            <boxGeometry args={[0.025, 0.4, 0.008]} />
            <meshStandardMaterial color="#d8b673" />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* ---------- Tam quan (cổng chùa) ---------- */
function Gate() {
  return (
    <group position={[0, 0, 14]}>
      {[-5, 5].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 1.6, 0]} castShadow><boxGeometry args={[2.2, 3.2, 0.7]} /><meshStandardMaterial color="#e2d3ae" /></mesh>
          <Roof w={3.4} d={1.6} h={0.6} y={3.5} />
        </group>
      ))}
      {[-3.7, 3.7].map((x) => (
        <mesh key={x} position={[x, 2.2, 0]} castShadow><cylinderGeometry args={[0.2, 0.22, 4.4, 12]} /><meshStandardMaterial color={RED} /></mesh>
      ))}
      <mesh position={[0, 4.2, 0]}><boxGeometry args={[7.6, 0.35, 0.4]} /><meshStandardMaterial color={RED_DARK} /></mesh>
      <mesh position={[0, 4.75, 0.21]}><boxGeometry args={[2.6, 0.6, 0.06]} /><meshStandardMaterial color={GOLD} metalness={0.4} /></mesh>
      <Roof w={9.5} d={2.6} h={1} y={5.4} />
    </group>
  )
}

/* ---------- Hồ sen ---------- */
function Pond() {
  const pads = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({ x: Math.cos(i * 2.4) * (0.6 + (i % 4) * 0.45), z: Math.sin(i * 2.4) * (0.6 + (i % 4) * 0.4), flower: i % 3 === 0 })),
    [],
  )
  return (
    <group position={[-11.7, 0, 10]}>
      <mesh position={[0, 0.06, 0]} scale={[1.25, 1, 1]}><cylinderGeometry args={[2.2, 2.2, 0.12, 40]} /><meshStandardMaterial color={STONE} /></mesh>
      <mesh position={[0, 0.1, 0]} scale={[1.25, 1, 1]}><cylinderGeometry args={[2, 2, 0.06, 40]} /><meshStandardMaterial color="#3e7f86" roughness={0.15} metalness={0.2} /></mesh>
      {pads.map((p, i) => (
        <group key={i} position={[p.x, 0.14, p.z]}>
          <mesh rotation={[-Math.PI / 2, 0, i]}><circleGeometry args={[0.24, 14, 0.3, Math.PI * 1.85]} /><meshStandardMaterial color="#4f8d3a" side={THREE.DoubleSide} /></mesh>
          {p.flower && (
            <mesh position={[0, 0.1, 0]} scale={[1, 0.8, 1]}><coneGeometry args={[0.1, 0.22, 8]} /><meshStandardMaterial color="#f09ab0" /></mesh>
          )}
        </group>
      ))}
    </group>
  )
}

/* ---------- Cây ---------- */
function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.8 + position[0]) * 0.02
  })
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1, 0]} castShadow><cylinderGeometry args={[0.15, 0.22, 2, 8]} /><meshStandardMaterial color="#5a3d22" /></mesh>
      <group ref={ref} position={[0, 2, 0]}>
        {[[0, 0.7, 0, 1.1], [0.6, 0.4, 0.2, 0.8], [-0.5, 0.5, -0.3, 0.85], [0, 1.3, 0, 0.75]].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} castShadow><icosahedronGeometry args={[r, 1]} /><meshStandardMaterial color={i % 2 ? '#4c7a3a' : '#5d8f45'} flatShading /></mesh>
        ))}
      </group>
    </group>
  )
}

/* ---------- Tổng thể ---------- */
export default function World() {
  return (
    <group>
      {/* cỏ */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#7a9a5a" roughness={1} />
      </mesh>
      {/* sân gạch */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 4]} receiveShadow>
        <planeGeometry args={[30, 13]} />
        <meshStandardMaterial color="#b58b6a" roughness={0.95} />
      </mesh>
      {/* lối đi ra cổng */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 14]} receiveShadow>
        <planeGeometry args={[4, 10]} />
        <meshStandardMaterial color={STONE} roughness={0.95} />
      </mesh>
      <Hall />
      <Buddha />
      <Altar />
      <Mo />
      <Cushion />
      <BellTower />
      <FortuneTable />
      <Gate />
      <Pond />
      {[[-15, 0, -4, 1.3], [15, 0, -4, 1.2], [-14, 0, 2, 1], [14, 0, 9, 1.1], [-7, 0, 17, 0.9], [8, 0, 17, 1], [-17, 0, 14, 1.2], [17, 0, 15, 1.3], [-11, 0, -13, 1.5], [11, 0, -13, 1.4]].map(
        ([x, y, z, s], i) => <Tree key={i} position={[x, y, z]} scale={s} />,
      )}
      {/* lư hương lớn giữa sân */}
      <group position={[0, 0, 3.5]}>
        <mesh position={[0, 0.4, 0]} castShadow><cylinderGeometry args={[0.55, 0.45, 0.8, 8]} /><meshStandardMaterial color="#4b4237" metalness={0.6} roughness={0.4} /></mesh>
        <mesh position={[0, 0.85, 0]}><cylinderGeometry args={[0.7, 0.55, 0.15, 8]} /><meshStandardMaterial color="#5a4f40" metalness={0.6} roughness={0.4} /></mesh>
        <Smoke position={[0, 0.95, 0]} count={40} />
      </group>
    </group>
  )
}
