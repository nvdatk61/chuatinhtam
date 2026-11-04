import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Sky, Stars } from '@react-three/drei'
import World from './World'
import Player from './Player'
import Others from './Others'
import Effects from './Effects'
import { Fireflies, Petals } from './Particles'
import { ambient, envAt, useHour } from './sky'

/** Bầu trời, sương mù và ánh sáng thay đổi theo giờ thật (xem sky.ts) */
function DayNight() {
  const hour = useHour()
  const env = useMemo(() => envAt(hour), [hour])
  ambient.night = env.night
  return (
    <>
      <color attach="background" args={[env.fog]} />
      <fog attach="fog" args={[env.fog, 25, 70]} />
      {env.showSky && (
        <Sky sunPosition={env.sunPos} turbidity={6} rayleigh={1.5} mieCoefficient={0.006} mieDirectionalG={0.85} />
      )}
      {env.night > 0.4 && <Stars radius={90} depth={30} count={1500} factor={3} saturation={0} fade speed={0.4} />}
      <hemisphereLight args={[env.hemiSky, env.hemiGround, env.hemiInt]} />
      <directionalLight
        position={env.lightPos}
        intensity={env.lightInt}
        color={env.light}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-bias={-0.0004}
      />
      {/* ánh sáng ấm trong chánh điện – đêm xuống thì nổi bật hơn */}
      <pointLight position={[0, 3.6, -5]} intensity={6 + env.night * 5} distance={14 + env.night * 4} decay={1.5} color="#ffbf7a" />
    </>
  )
}

export default function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 4, 18], fov: 55, near: 0.1, far: 200 }}
      style={{ position: 'fixed', inset: 0, touchAction: 'none' }}
    >
      <DayNight />
      <World />
      <Petals />
      <Fireflies />
      <Player />
      <Others />
      <Effects />
    </Canvas>
  )
}
