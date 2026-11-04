import { Canvas } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import World from './World'
import Player from './Player'
import Others from './Others'

export default function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 4, 18], fov: 55, near: 0.1, far: 200 }}
      style={{ position: 'fixed', inset: 0, touchAction: 'none' }}
    >
      <color attach="background" args={['#f3d9b1']} />
      <fog attach="fog" args={['#f1d7b0', 25, 70]} />
      {/* hoàng hôn ấm */}
      <Sky sunPosition={[30, 12, 40]} turbidity={6} rayleigh={1.5} mieCoefficient={0.006} mieDirectionalG={0.85} />
      <hemisphereLight args={['#ffe9c7', '#5c6b3c', 0.75]} />
      <directionalLight
        position={[18, 22, 16]}
        intensity={1.8}
        color="#ffd9a3"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-bias={-0.0004}
      />
      {/* ánh sáng ấm trong chánh điện */}
      <pointLight position={[0, 3.6, -5]} intensity={6} distance={14} decay={1.5} color="#ffbf7a" />
      <World />
      <Player />
      <Others />
    </Canvas>
  )
}
