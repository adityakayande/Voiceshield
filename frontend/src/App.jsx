import { useEffect, useRef, useState } from 'react'
import {
  Activity, AudioLines, ArrowDownToLine, ArrowRight, BadgeCheck, Check, ChevronDown,
  CircleHelp, Clock3, FileImage, FileText, Fingerprint, History, Languages, LoaderCircle,
  LockKeyhole, Mic, Plus, Radio, ScanLine, Shield, ShieldAlert, ShieldCheck, Sparkles,
  Upload, Volume2, X,
} from 'lucide-react'

const modes = [
  { id: 'audio', title: 'Voice check', sub: 'Detect synthetic speech', icon: AudioLines },
  { id: 'text', title: 'Claim check', sub: 'Verify text claims', icon: FileText },
  { id: 'image', title: 'Screenshot', sub: 'Extract & check text', icon: FileImage },
]

async function request(path, options) {
  const response = await fetch(path, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || 'Something went wrong. Please try again.')
  return data
}

function App() {
  const [mode, setMode] = useState('text')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [apiOnline, setApiOnline] = useState(null)
  const [recording, setRecording] = useState(false)
  const inputRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])

  const refreshHistory = async () => {
    try { setHistory(await request('/api/history?limit=8')) } catch { /* API can start after the web server. */ }
  }
  useEffect(() => {
    request('/api/health').then(() => setApiOnline(true)).catch(() => setApiOnline(false))
    refreshHistory()
  }, [])

  const chooseMode = (id) => { setMode(id); setFile(null); setResult(null); setError('') }
  const submit = async (event) => {
    event?.preventDefault()
    setBusy(true); setError(''); setResult(null)
    try {
      let data
      if (mode === 'text') {
        if (text.trim().length < 8) throw new Error('Add a little more text so there is something to review.')
        data = await request('/api/analyze/text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
      } else {
        if (!file) throw new Error(`Choose a ${mode === 'audio' ? 'voice recording' : 'screenshot'} first.`)
        const body = new FormData(); body.append('file', file)
        data = await request(`/api/analyze/${mode}`, { method: 'POST', body })
      }
      setResult(data); refreshHistory()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data)
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        setFile(new File([blob], 'voice-recording.webm', { type: blob.type }))
        stream.getTracks().forEach((track) => track.stop())
      }
      recorder.start(); recorderRef.current = recorder; setRecording(true)
    } catch { setError('Microphone access was unavailable. You can upload an audio file instead.') }
  }
  const stopRecording = () => { recorderRef.current?.stop(); setRecording(false) }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#top" aria-label="VoiceShield home"><span className="brand-mark"><Shield size={20} strokeWidth={2.2} /><span className="brand-spark">✳</span></span><span>voice<span className="brand-bold">shield</span></span></a>
      <div className="side-label">WORKSPACE</div>
      <button className="nav-item active"><ScanLine size={17} /><span>New analysis</span><span className="nav-shortcut">⌘ K</span></button>
      <button className="nav-item" onClick={() => document.getElementById('recent')?.scrollIntoView({ behavior: 'smooth' })}><History size={17} /><span>Analysis history</span></button>
      <div className="side-divider" />
      <div className="side-label">TOOLS</div>
      {modes.map(({ id, title, icon: Icon }) => <button key={id} className="nav-item" onClick={() => chooseMode(id)}><Icon size={17} /><span>{title}</span></button>)}
      <div className="sidebar-bottom"><div className="privacy-card"><span className="privacy-icon"><LockKeyhole size={16} /></span><div><strong>Your checks stay private</strong><p>Analysis history is stored locally.</p></div></div><div className="profile"><div className="avatar">VS</div><div className="profile-name"><strong>Personal workspace</strong><span>Free plan</span></div><ChevronDown size={16} /></div></div>
    </aside>

    <main className="main-content" id="top">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>New analysis</strong></div><div className="top-actions"><span className={`api-status ${apiOnline === false ? 'offline' : ''}`}><span className="status-dot" />{apiOnline === false ? 'API offline' : 'System operational'}</span><button className="help-button" title="About VoiceShield"><CircleHelp size={18} /></button><div className="top-avatar">A</div></div></header>
      <div className="page-wrap">
        <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line" />A LITTLE MORE CERTAINTY</div><h1>Trust, with <span>evidence.</span></h1><p className="page-subtitle">Check a voice, claim, or screenshot before you act on it.</p></div><div className="privacy-pill"><LockKeyhole size={14} /> Private by design</div></section>

        <section className="workspace-grid">
          <div className="analyzer-card">
            <div className="card-heading"><div><span className="section-kicker">ANALYSIS STUDIO</span><h2>What would you like to check?</h2></div><span className="step-label"><span>01</span> / 02</span></div>
            <div className="mode-tabs" role="tablist" aria-label="Analysis type">{modes.map(({ id, title, sub, icon: Icon }) => <button role="tab" aria-selected={mode === id} key={id} onClick={() => chooseMode(id)} className={`mode-tab ${mode === id ? 'selected' : ''}`}><Icon size={18} strokeWidth={1.8} /><span className="mode-copy"><strong>{title}</strong><small>{sub}</small></span></button>)}</div>
            <form onSubmit={submit}>
              {mode === 'text' ? <div className="text-entry"><label htmlFor="claim-input" className="input-label">PASTE A CLAIM OR MESSAGE</label><textarea id="claim-input" value={text} onChange={(e) => setText(e.target.value)} maxLength={12000} placeholder={'Paste a message or claim you’d like to check…\n\nFor example: “Forwarded as received — urgent, share this with everyone…”'} /><div className="input-footer"><span><LockKeyhole size={12} /> Your text is only used for this check</span><span>{text.length.toLocaleString()} / 12,000</span></div></div> : <div className="file-entry">
                <input ref={inputRef} type="file" hidden accept={mode === 'audio' ? 'audio/*' : 'image/png,image/jpeg,image/webp'} onChange={(e) => setFile(e.target.files?.[0] || null)} />
                {file ? <div className="selected-file"><span className="file-icon">{mode === 'audio' ? <Volume2 size={19} /> : <FileImage size={19} />}</span><div className="file-meta"><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to analyze</small></div><button type="button" className="remove-file" onClick={() => setFile(null)} aria-label="Remove file"><X size={16} /></button></div> : <button className="drop-zone" type="button" onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]) }}><span className="upload-icon">{mode === 'audio' ? <AudioLines size={21} /> : <Upload size={20} />}</span><strong>Drop your {mode === 'audio' ? 'audio file' : 'screenshot'} here</strong><span>or <b>browse files</b></span><small>{mode === 'audio' ? 'WAV, MP3, M4A, WebM · max 20 MB' : 'PNG, JPG, WebP · max 8 MB'}</small></button>}
                {mode === 'audio' && <div className="record-row"><span>Have a voice note? Check it here.</span><button type="button" onClick={recording ? stopRecording : startRecording} className={`record-button ${recording ? 'recording' : ''}`}><span className="record-dot" />{recording ? 'Stop recording' : 'Record audio'}</button></div>}
              </div>}
              {error && <div className="error-banner"><ShieldAlert size={16} />{error}</div>}
              <div className="submit-row"><span className="safe-note"><LockKeyhole size={13} /> Your analysis is private</span><button className="analyze-button" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={16} /> Analyzing…</> : <>Analyze {mode === 'audio' ? 'voice' : mode === 'image' ? 'screenshot' : 'claim'} <ArrowRight size={16} /></>}</button></div>
            </form>
            <div className="card-bottom-note"><Sparkles size={14} /><span>Every result includes an explanation. No black-box verdicts.</span><button title="Learn how analysis works"><CircleHelp size={14} /></button></div>
          </div>

          <aside className="how-card"><div className="how-top"><div className="how-icon"><Fingerprint size={20} /></div><span className="how-tag"><span /> EVIDENCE FIRST</span></div><h3>Clarity over certainty.</h3><p>VoiceShield brings useful signals together to help you make a more informed decision.</p><div className="how-list"><div className="how-item"><span className="how-check"><Check size={12} /></span><div><strong>Signals, not verdicts</strong><small>See the clues behind every result.</small></div></div><div className="how-item"><span className="how-check"><Check size={12} /></span><div><strong>Sources you can inspect</strong><small>Published fact-checks shown in context.</small></div></div><div className="how-item"><span className="how-check"><Check size={12} /></span><div><strong>Hindi & Marathi aware</strong><small>Regional scripts are recognized.</small></div></div></div><div className="how-footer"><ShieldCheck size={15} /><span>Built for thoughtful verification</span></div></aside>
        </section>

        {result && <ResultCard result={result} onDismiss={() => setResult(null)} />}

        <section className="recent-section" id="recent"><div className="recent-heading"><div><span className="section-kicker">YOUR WORKSPACE</span><h2>Recent analyses</h2></div><button className="view-all" onClick={refreshHistory}>Refresh <ArrowRight size={14} /></button></div>{history.length ? <div className="history-list">{history.slice(0, 5).map((item) => <button key={item.id} className="history-row" onClick={() => setResult(item)}><span className={`history-icon ${item.kind}`}>{item.kind === 'audio' ? <AudioLines size={17} /> : item.kind === 'image' ? <FileImage size={17} /> : <FileText size={17} />}</span><span className="history-info"><strong>{item.kind === 'audio' ? 'Voice recording' : item.kind === 'image' ? 'Screenshot analysis' : 'Text claim'}</strong><small>{item.summary}</small></span><span className={`history-badge ${item.kind === 'audio' ? 'neutral' : item.risk_score >= 30 ? 'amber' : 'green'}`}>{item.kind === 'audio' ? 'Model needed' : `${Math.round(item.risk_score)}% demo signals`}</span><span className="history-time"><Clock3 size={13} />{new Date(item.created_at).toLocaleDateString()}</span><ArrowRight className="history-arrow" size={15} /></button>)}</div> : <div className="empty-history"><span className="empty-history-icon"><History size={20} /></span><div><strong>Your checks will show up here</strong><p>Start an analysis and your recent activity will be saved to this workspace.</p></div><button onClick={() => document.querySelector('.analyzer-card')?.scrollIntoView({ behavior: 'smooth' })}>Start a check <ArrowRight size={14} /></button></div>}</section>
        <footer className="page-footer"><span>© 2026 VoiceShield · Built for a more informed internet</span><div><a href="#top">How it works</a><a href="#top">Privacy</a><a href="#top">About</a></div></footer>
      </div>
    </main>
  </div>
}

function ResultCard({ result, onDismiss }) {
  const isAudio = result.kind === 'audio'
  const value = Math.round(result.risk_score || 0)
  return <section className="result-card"><div className="result-header"><div><span className="section-kicker">ANALYSIS COMPLETE · #{result.id}</span><h2>Your review</h2></div><button className="dismiss-result" onClick={onDismiss} aria-label="Dismiss result"><X size={17} /></button></div><div className="result-body"><div className={`score-ring ${isAudio ? 'muted' : value >= 30 ? 'risk' : 'calm'}`} style={{ '--score': `${isAudio ? 0 : value}%` }}><div className="score-inner"><strong>{isAudio ? '—' : `${value}%`}</strong><small>{isAudio ? 'NOT SCORED' : 'DEMO SIGNALS'}</small></div></div><div className="result-summary"><span className={`result-label ${isAudio ? 'neutral' : value >= 30 ? 'amber' : 'green'}`}>{isAudio ? <AudioLines size={14} /> : value >= 30 ? <ShieldAlert size={14} /> : <BadgeCheck size={14} />}{result.label}</span><h3>{result.summary}</h3><p>{isAudio ? 'Voice deepfake weights are not installed yet. We checked the file format only; no voice authenticity judgment was made.' : 'This demo checks a few wording patterns. It is not a trained model and cannot determine whether a claim is true or false.'}</p></div></div><div className="evidence-list"><div className="evidence-heading"><span><Activity size={15} /> Evidence & signals</span><span>{result.evidence?.length || 0} items</span></div>{result.evidence?.map((item, i) => <div className="evidence-row" key={i}><span className={`evidence-dot ${item.type}`} /><div><strong>{item.title}</strong><p>{item.quote}</p></div></div>)}</div>{result.fact_checks?.length > 0 && <div className="fact-checks"><strong><BadgeCheck size={15} /> Published fact-checks</strong>{result.fact_checks.map((check, i) => <a key={i} href={check.url} target="_blank" rel="noreferrer"><span>{check.publisher} · {check.rating || 'Review'}</span><b>{check.title}</b><ArrowDownToLine size={14} /></a>)}</div>}<div className="result-disclaimer"><CircleHelp size={14} /> Treat this as one input to your judgment. Verify important information with trusted sources.</div></section>
}

export default App
