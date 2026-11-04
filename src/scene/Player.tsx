import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SPOTS, useStore, type Spot } from '../store'
import { sfx } from '../audio/sfx'
import { FORTUNES } from '../data/fortunes'
import { sendAction, sendState } from '../net/net'
import { blocked, fx, me } from './fx'
import { BOW_SECONDS, Monk, animateMonk, createRig } from './Monk'

const SPEED = 3.2
const NEAR_DIST = 1.7
const SEND_EVERY = 0.1 // giây – gửi vị trí 10 lần/giây

export default function Player() {
  const root = useRef<THREE.Group>(null)
  const rig = useMemo(createRig, [])
  const keys = useRef<Record<string, boolean>>({})
  const yaw = useRef(0) // góc camera quanh nhân vật
  const pitch = useRef(0.38)
  const facing = useRef(Math.PI) // hướng mặt nhân vật
  const greetAt = useRef(-1e9)
  const sendTimer = useRef(0)
  const camera = useThree((s) => s.camera)
  const dom = useThree((s) => s.gl.domElement)
  const name = useStore((s) => s.name)
  const color = useStore((s) => s.color)
  const online = useStore((s) => s.roster.length > 0)

  /* ---- bàn phím ---- */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      keys.current[e.code] = true
      if (e.repeat) return
      const s = useStore.getState()
      if (e.code === 'KeyE' || e.code === 'Enter') s.interact()
      if (e.code === 'KeyG') s.greet()
      if (e.code === 'Space') { e.preventDefault(); s.addMala(); sfx.bead() }
      if (e.code === 'Escape') {
        if (s.meditationEndsAt) s.stopMeditation(); else s.setPanel(null)
      }
    }
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false }
    const blur = () => { keys.current = {} } // tránh "kẹt phím" khi chuyển tab
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  /* ---- kéo chuột / vuốt để xoay camera ---- */
  useEffect(() => {
    let dragging = false, lx = 0, ly = 0
    const onDown = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      yaw.current -= (e.clientX - lx) * 0.006
      pitch.current = THREE.MathUtils.clamp(pitch.current + (e.clientY - ly) * 0.004, 0.08, 1.1)
      lx = e.clientX; ly = e.clientY
    }
    const onUp = () => { dragging = false }
    dom.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      dom.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dom])

  /* ---- ?debug: cho phép đọc/đặt vị trí nhân vật từ console ---- */
  useEffect(() => {
    if (new URLSearchParams(location.search).has('debug')) (window as unknown as { player: unknown }).player = root.current
  }, [])

  /* ---- chắp tay chào ---- */
  useEffect(() => useStore.subscribe((s, prev) => {
    if (s.greetTick === prev.greetTick || s.pose !== 'stand') return
    if (performance.now() - greetAt.current < 1500) return
    greetAt.current = performance.now()
    sendAction('greet')
  }), [])

  /* ---- xử lý tương tác ---- */
  useEffect(() => {
    function handleInteract(spot: Spot) {
      const st = useStore.getState()
      const g = root.current!
      switch (spot.kind) {
        case 'altar':
          g.position.set(spot.pos[0], 0, spot.pos[1])
          facing.current = Math.PI
          fx.bowAt = performance.now()
          st.setPose('bow')
          st.addIncense()
          sfx.smallBell()
          sendAction('bow')
          setTimeout(() => { useStore.getState().addBow(); useStore.getState().setPose('stand') }, BOW_SECONDS * 1000)
          break
        case 'mo':
          fx.moAt = performance.now()
          sfx.mo()
          sendAction('mo')
          break
        case 'bell':
          fx.bellAt = performance.now()
          setTimeout(() => sfx.bell(), 220)
          sendAction('bell')
          break
        case 'cushion':
          st.setPanel('meditation')
          break
        case 'fortune':
          fx.shakeAt = performance.now()
          sfx.shake()
          sendAction('shake')
          setTimeout(() => useStore.getState().drawFortune(Math.floor(Math.random() * FORTUNES.length)), 1000)
          break
      }
    }
    return useStore.subscribe((s, prev) => {
      if (s.interactTick === prev.interactTick) return
      if (!s.nearby || s.pose !== 'stand' || s.panel) return
      handleInteract(s.nearby)
    })
  }, [])

  /* ---- vòng lặp mỗi khung hình ---- */
  const target = useRef(new THREE.Vector3()).current
  const camPos = useRef(new THREE.Vector3()).current
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const g = root.current; if (!g) return
    const st = useStore.getState()
    const now = performance.now()

    // Ngồi thiền: đặt nhân vật lên bồ đoàn
    if (st.pose === 'sit') {
      const c = SPOTS.find((s) => s.kind === 'cushion')!
      g.position.set(c.pos[0], 0, c.pos[1] - 0.9)
      facing.current = Math.PI
    }

    // Di chuyển
    let ix = 0, iz = 0
    if (st.pose === 'stand' && !st.panel) {
      const k = keys.current
      if (k.KeyW || k.ArrowUp) iz -= 1
      if (k.KeyS || k.ArrowDown) iz += 1
      if (k.KeyA || k.ArrowLeft) ix -= 1
      if (k.KeyD || k.ArrowRight) ix += 1
      ix += st.joystick.x
      iz += st.joystick.y
    }
    const len = Math.hypot(ix, iz)
    const moving = len > 0.05
    if (moving) {
      const n = Math.min(len, 1) / len
      ix *= n; iz *= n
      // đổi hướng input theo góc camera
      const s = Math.sin(yaw.current), c = Math.cos(yaw.current)
      const dx = ix * c + iz * s
      const dz = -ix * s + iz * c
      const nx = g.position.x + dx * SPEED * dt
      const nz = g.position.z + dz * SPEED * dt
      // kiểm tra từng trục riêng → trượt dọc tường thay vì dính cứng
      if (!blocked(nx, g.position.z)) g.position.x = nx
      if (!blocked(g.position.x, nz)) g.position.z = nz
      facing.current = Math.atan2(dx, dz)
    }
    const diff = Math.atan2(Math.sin(facing.current - g.rotation.y), Math.cos(facing.current - g.rotation.y))
    g.rotation.y += diff * Math.min(1, dt * 12)
    me.x = g.position.x; me.z = g.position.z

    animateMonk(rig, { pose: st.pose, bowAt: fx.bowAt, greetAt: greetAt.current, moving, now })

    // Gửi trạng thái lên server
    sendTimer.current += dtRaw
    if (sendTimer.current >= SEND_EVERY) {
      sendTimer.current = 0
      sendState(g.position.x, g.position.z, g.rotation.y, st.pose)
    }

    // Tìm điểm tương tác gần nhất
    let best: Spot | null = null, bestD = NEAR_DIST
    for (const s of SPOTS) {
      const d = Math.hypot(s.pos[0] - g.position.x, s.pos[1] - g.position.z)
      if (d < bestD) { bestD = d; best = s }
    }
    if (best?.id !== st.nearby?.id) st.setNearby(best)

    // Camera bám theo phía sau
    const dist = st.pose === 'sit' ? 3.2 : 6
    target.set(g.position.x, 1.3, g.position.z)
    camPos.set(
      target.x + Math.sin(yaw.current) * Math.cos(pitch.current) * dist,
      target.y + Math.sin(pitch.current) * dist,
      target.z + Math.cos(yaw.current) * Math.cos(pitch.current) * dist,
    )
    camera.position.lerp(camPos, 1 - Math.exp(-dt * 6))
    camera.lookAt(target)
  })

  return (
    <group ref={root} position={[0, 0, 11]} rotation={[0, Math.PI, 0]}>
      {/* chỉ hiện tên mình khi có người khác trong chùa */}
      <Monk rig={rig} color={color} name={online ? name : undefined} isMe />
    </group>
  )
}
