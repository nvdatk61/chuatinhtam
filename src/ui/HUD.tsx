import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { sfx } from '../audio/sfx'
import { FORTUNES } from '../data/fortunes'
import { connect } from '../net/net'
import { ROBE_COLORS, MAX_NAME } from '../../shared/protocol'

const NAMES = ['Minh', 'An', 'Tâm', 'Huệ', 'Phúc', 'Thiện', 'Quang', 'Từ', 'Bình', 'Lạc']
function loadIdentity() {
  try {
    const v = JSON.parse(localStorage.getItem('chua-identity') ?? 'null')
    if (v?.name && ROBE_COLORS.includes(v.color)) return v as { name: string; color: string }
  } catch { /* localStorage có thể bị chặn */ }
  return {
    name: `Tiểu ${NAMES[Math.floor(Math.random() * NAMES.length)]}`,
    color: ROBE_COLORS[Math.floor(Math.random() * ROBE_COLORS.length)],
  }
}

/* ---------- Màn hình chào ---------- */
export function Welcome() {
  const enter = useStore((s) => s.enter)
  const setIdentity = useStore((s) => s.setIdentity)
  const [id, setId] = useState(loadIdentity)
  const go = () => {
    const name = id.name.trim().slice(0, MAX_NAME) || 'Chú tiểu'
    try { localStorage.setItem('chua-identity', JSON.stringify({ name, color: id.color })) } catch { /* bỏ qua */ }
    setIdentity(name, id.color)
    connect(name, id.color)
    sfx.unlock(); sfx.startAmbient(); sfx.bell()
    enter()
  }
  return (
    <div className="welcome">
      <div className="card welcome-card">
        <div className="lotus">❀</div>
        <h1>Chùa Tịnh Tâm</h1>
        <p className="sub">Một góc yên tĩnh giữa ngày bận rộn</p>
        <ul className="guide">
          <li><kbd>W A S D</kbd> / phím mũi tên / joystick: đi lại</li>
          <li>Kéo chuột hoặc vuốt màn hình: xoay góc nhìn</li>
          <li><kbd>E</kbd> hoặc nút <b>Tương tác</b>: khi đứng gần bàn thờ, mõ, chuông, bồ đoàn, ống xăm</li>
          <li><kbd>Space</kbd>: lần tràng hạt · <kbd>G</kbd>: chắp tay chào người khác</li>
        </ul>
        <label className="field">
          <span>Pháp danh của bạn</span>
          <input
            value={id.name}
            maxLength={MAX_NAME}
            onChange={(e) => setId({ ...id, name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && go()}
          />
        </label>
        <div className="swatches" role="radiogroup" aria-label="Màu áo">
          {ROBE_COLORS.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={id.color === c}
              className={`swatch${id.color === c ? ' on' : ''}`}
              style={{ background: c }}
              onClick={() => setId({ ...id, color: c })}
            />
          ))}
        </div>
        <button className="btn primary" onClick={go}>Bước vào chùa</button>
        <p className="note">Bật âm thanh để có trải nghiệm tốt nhất</p>
      </div>
    </div>
  )
}

/* ---------- Joystick cho màn hình cảm ứng ---------- */
function Joystick() {
  const setJoystick = useStore((s) => s.setJoystick)
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const R = 46
  const move = (e: React.PointerEvent) => {
    const b = base.current!.getBoundingClientRect()
    let x = e.clientX - (b.left + b.width / 2)
    let y = e.clientY - (b.top + b.height / 2)
    const d = Math.hypot(x, y)
    if (d > R) { x = (x / d) * R; y = (y / d) * R }
    setKnob({ x, y })
    setJoystick(x / R, y / R)
  }
  const end = () => { setKnob({ x: 0, y: 0 }); setJoystick(0, 0) }
  return (
    <div
      ref={base}
      className="joystick"
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e) }}
      onPointerMove={(e) => e.buttons && move(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  )
}

/* ---------- Bảng ngồi thiền ---------- */
function MeditationPanel() {
  const endsAt = useStore((s) => s.meditationEndsAt)
  const start = useStore((s) => s.startMeditation)
  const stop = useStore((s) => s.stopMeditation)
  const setPanel = useStore((s) => s.setPanel)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!endsAt) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [endsAt])

  const done = useRef(false)
  useEffect(() => {
    if (!endsAt) { done.current = false; return }
    if (now >= endsAt && !done.current) {
      done.current = true
      // 3 tiếng chuông báo kết thúc
      ;[0, 2500, 5000].forEach((ms) => setTimeout(() => sfx.smallBell(), ms))
      setTimeout(stop, 6000)
    }
  }, [now, endsAt, stop])

  if (!endsAt) {
    return (
      <div className="card panel">
        <h2>Ngồi thiền</h2>
        <p>Chọn thời gian. Hãy ngồi thẳng lưng, thả lỏng vai và theo dõi hơi thở.</p>
        <div className="row">
          {[1, 5, 10, 20].map((m) => (
            <button key={m} className="btn" onClick={() => { sfx.smallBell(); start(m) }}>{m} phút</button>
          ))}
        </div>
        <button className="btn ghost" onClick={() => setPanel(null)}>Để sau</button>
      </div>
    )
  }

  const left = Math.max(0, endsAt - now)
  const mm = String(Math.floor(left / 60000)).padStart(2, '0')
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0')
  // chu kỳ thở 4s hít – 6s thở
  const phase = (now / 1000) % 10
  const inhale = phase < 4
  return (
    <div className="meditation">
      <div className={`breath ${inhale ? 'in' : 'out'}`} />
      <div className="breath-text">{left === 0 ? 'Xả thiền' : inhale ? 'Hít vào…' : 'Thở ra…'}</div>
      <div className="timer">{mm}:{ss}</div>
      <button className="btn ghost" onClick={stop}>Kết thúc</button>
    </div>
  )
}

/* ---------- Bảng lời xăm ---------- */
function FortunePanel() {
  const n = useStore((s) => s.fortune)
  const setPanel = useStore((s) => s.setPanel)
  if (n === null) return null
  const f = FORTUNES[n]
  return (
    <div className="card panel fortune">
      <div className="fortune-no">Xăm số {n + 1} · {f.level}</div>
      <h2>{f.title}</h2>
      <p className="verse">{f.verse}</p>
      <p className="advice">{f.advice}</p>
      <p className="note">Lời xăm mang tính chiêm nghiệm, không phải lời tiên đoán.</p>
      <button className="btn primary" onClick={() => setPanel(null)}>Nam mô A Di Đà Phật</button>
    </div>
  )
}

/* ---------- Trạng thái kết nối + danh sách người trong chùa ---------- */
function OnlineBadge() {
  const net = useStore((s) => s.net)
  const roster = useStore((s) => s.roster)
  const [open, setOpen] = useState(false)
  const label =
    net === 'online' ? `${roster.length + 1} người trong chùa`
    : net === 'connecting' ? 'Đang kết nối…'
    : net === 'full' ? 'Chùa đã đông, bạn đang ở chế độ một mình'
    : 'Chế độ một mình (không kết nối được server)'
  return (
    <div className="presence">
      <button className={`btn pill ${net}`} onClick={() => setOpen(!open)} disabled={net !== 'online'}>
        <i className="dot" /> {label}
      </button>
      {open && net === 'online' && (
        <ul className="card roster">
          <li className="me">{useStore.getState().name} (bạn)</li>
          {roster.map((p) => (
            <li key={p.id}><i className="dot" style={{ background: p.color }} /> {p.name}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------- HUD chính ---------- */
export default function HUD() {
  const nearby = useStore((s) => s.nearby)
  const panel = useStore((s) => s.panel)
  const pose = useStore((s) => s.pose)
  const bows = useStore((s) => s.bows)
  const mala = useStore((s) => s.mala)
  const muted = useStore((s) => s.muted)
  const toggleMute = useStore((s) => s.toggleMute)
  const interact = useStore((s) => s.interact)
  const addMala = useStore((s) => s.addMala)
  const greet = useStore((s) => s.greet)
  const [touch] = useState(() => matchMedia('(pointer: coarse)').matches)

  useEffect(() => { sfx.muted = muted }, [muted])

  return (
    <>
      <div className="top-left card small">
        <div className="title">Chùa Tịnh Tâm</div>
        <div className="stats">
          <span>Lễ Phật: <b>{bows}</b></span>
          <span>Tràng hạt: <b>{mala}</b>/108</span>
        </div>
      </div>

      <OnlineBadge />

      <div className="top-right">
        <button className="btn round" onClick={toggleMute} aria-label="Bật/tắt âm thanh">{muted ? '🔇' : '🔊'}</button>
      </div>

      {!panel && pose === 'stand' && nearby && (
        <div className="prompt">
          <span>{nearby.name}</span>
          <button className="btn primary" onClick={interact}>
            {touch ? '' : <kbd>E</kbd>} {nearby.action}
          </button>
        </div>
      )}
      {pose === 'bow' && <div className="prompt"><span className="chant">Nam mô Bổn Sư Thích Ca Mâu Ni Phật</span></div>}

      <div className="bottom-right">
        <button className="btn round mala" onClick={greet} aria-label="Chắp tay chào">
          🙏<small>{touch ? 'Chào' : 'G'}</small>
        </button>
        <button className="btn round mala" onClick={() => { addMala(); sfx.bead() }} aria-label="Lần tràng hạt">
          📿<small>{touch ? 'Lần hạt' : 'Space'}</small>
        </button>
      </div>

      {touch && !panel && pose === 'stand' && <Joystick />}

      {panel === 'meditation' && <MeditationPanel />}
      {panel === 'fortune' && <FortunePanel />}
    </>
  )
}
