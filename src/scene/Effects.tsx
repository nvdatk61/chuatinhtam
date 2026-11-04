import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { LOW_POWER, ambient } from './sky'

/** Ngưỡng sáng để toả bloom. Vật muốn phát sáng cần màu HDR > 1 (xem `glow()`). */
const THRESHOLD = 1.05

/** Màu phát sáng HDR: màu gốc nhân với cường độ, vượt ngưỡng nên sẽ toả sáng qua bloom */
export function glow(hex: string, intensity: number) {
  return new THREE.Color(hex).multiplyScalar(intensity)
}

/**
 * Hậu kỳ bloom (UnrealBloomPass có sẵn trong three, không cần thêm thư viện).
 * Render vào target HDR (HalfFloat) → bloom chỉ bắt vùng sáng vượt ngưỡng → OutputPass
 * lo tone mapping + chuyển sRGB như khi render thẳng ra màn hình.
 */
export default function Effects() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  const [composer, bloom] = useMemo(() => {
    // MSAA cho render target, vì khi dùng composer thì khử răng cưa mặc định của canvas mất tác dụng
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: LOW_POWER ? 0 : 4 })
    const c = new EffectComposer(gl, target)
    c.addPass(new RenderPass(scene, camera))
    const b = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.55, THRESHOLD)
    c.addPass(b)
    c.addPass(new OutputPass())
    return [c, b] as const
  }, [gl, scene, camera])

  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio())
    composer.setSize(size.width, size.height)
    // điện thoại: bloom ở nửa độ phân giải cho nhẹ (bloom vốn mờ nên khó nhận ra khác biệt)
    if (LOW_POWER) {
      const pr = gl.getPixelRatio()
      bloom.setSize(Math.round((size.width * pr) / 2), Math.round((size.height * pr) / 2))
    }
  }, [composer, bloom, gl, size])

  useEffect(() => () => composer.dispose(), [composer])

  // priority 1 → R3F nhường việc render cho composer
  useFrame((_, dt) => {
    bloom.strength = 0.5 + ambient.night * 0.45 // đêm xuống thì nến, đèn lồng toả rõ hơn
    composer.render(dt)
  }, 1)

  return null
}
