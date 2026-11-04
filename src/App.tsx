import { Suspense } from 'react'
import Scene from './scene/Scene'
import HUD, { Welcome } from './ui/HUD'
import { useStore } from './store'

export default function App() {
  const entered = useStore((s) => s.entered)
  return (
    <>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      {entered ? <HUD /> : <Welcome />}
    </>
  )
}
