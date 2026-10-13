import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../services/api.js'
import { useProgress } from '../hooks/useProgress.jsx'
import { Badge, CodeBlock, Loading } from '../components/ui.jsx'
import RunPanel from '../components/RunPanel.jsx'
import FixIt from '../components/FixIt.jsx'
import { guideUrl } from '../services/links.js'

const TABS = ['Learn', 'Exploit', 'Code', 'Validate']

function List({ items, ordered }) {
  const Tag = ordered ? 'ol' : 'ul'
  return <Tag className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-1 pl-5 text-fog-300`}>{items.map((i) => <li key={i}>{i}</li>)}</Tag>
}

function Hints({ module }) {
  const [hints, setHints] = useState([])
  const [error, setError] = useState(null)
  async function reveal() {
    try { const h = await api.hint(module.id, hints.length + 1); setHints((x) => [...x, h.hint]) } catch (e) { setError(e.message) }
  }
  return (
    <div className="panel p-3">
      <h3 className="font-medium">Hints</h3>
      {hints.length > 0 && <ol className="mt-2 list-decimal space-y-1 pl-5 text-fog-300">{hints.map((h) => <li key={h}>{h}</li>)}</ol>}
      {error && <p role="alert" className="text-vuln-400">{error}</p>}
      <button className="btn mt-2" disabled={hints.length >= module.hint_count} onClick={reveal}>
        {hints.length >= module.hint_count ? 'No more hints' : `Reveal hint ${hints.length + 1} of ${module.hint_count}`}
      </button>
    </div>
  )
}

function FlagForm({ module }) {
  const { mark } = useProgress()
  const [flag, setFlag] = useState('')
  const [msg, setMsg] = useState(null)
  async function submit(e) {
    e.preventDefault()
    try {
      const r = await api.flag(module.id, flag)
      setMsg({ ok: r.correct, text: r.message })
      if (r.correct) mark(module.id, 'flag')
    } catch (err) { setMsg({ ok: false, text: err.message }) }
  }
  return (
    <form onSubmit={submit} className="space-y-2">
      <p className="text-fog-300">{module.challenge}</p>
      <label className="block text-sm text-fog-300">Flag
        <input aria-label="Flag" className="input mt-1" value={flag} onChange={(e) => setFlag(e.target.value)} placeholder="FLAG{...}" maxLength={200} />
      </label>
      <button className="btn btn-primary" type="submit" disabled={!flag.trim()}>Submit flag</button>
      {msg && <p role="status" className={msg.ok ? 'text-safe-400' : 'text-vuln-400'}>{msg.text}</p>}
    </form>
  )
}

export default function Lab() {
  const { id } = useParams()
  const { mode, modules } = useProgress()
  const [module, setModule] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('Learn')
  useEffect(() => {
    let live = true
    setModule(null); setError(null)
    api.module(id).then((m) => live && setModule(m)).catch((e) => live && setError(e.message))
    return () => { live = false }
  }, [id])
  if (error || !module) return <Loading error={error} />
  const done = modules[id] || {}

  return (
    <div className="space-y-5">
      <header>
        <div className="flex flex-wrap items-center gap-2"><Badge tone={module.difficulty}>{module.difficulty}</Badge><Badge>{module.owasp_id}</Badge><Badge>{module.estimated_minutes} min</Badge>
          {done.explored && <Badge>Explored</Badge>}{done.flag && <Badge>Flag captured</Badge>}{done.fixit && <Badge>Fixed</Badge>}</div>
        <h1 className="mt-2 text-2xl font-semibold">{module.name}</h1>
        <p className="text-sm text-fog-500">{module.category} · Mode: {mode}</p>
      </header>
      <div role="tablist" aria-label="Lab sections" className="flex gap-1 border-b border-ink-700">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t ? 'border-steel-400 text-fog-100' : 'border-transparent text-fog-300 hover:text-fog-100'}`}>{t}</button>
        ))}
      </div>

      {tab === 'Learn' && (
        <div className="space-y-5">
          <p className="max-w-prose text-fog-300">{module.overview}</p>
          <a className="inline-block text-sm text-steel-400 underline" href={guideUrl(module.id)} target="_blank" rel="noreferrer">Open the full written lab guide</a>
          <section><h2 className="mb-1 font-medium">Learning objectives</h2><List items={module.objectives} /></section>
          {mode === 'beginner' && <>
            <section><h2 className="mb-1 font-medium">Guided steps</h2><List ordered items={module.guided_steps} /></section>
            <section><h2 className="mb-1 font-medium">Expected outcome</h2><p className="text-fog-300">{module.expected_outcome}</p></section>
          </>}
          {mode === 'intermediate' && <section><h2 className="mb-1 font-medium">Challenge</h2><p className="text-fog-300">{module.challenge}</p></section>}
          <section className="panel p-4"><h2 className="mb-2 font-medium">Threat model ({module.owasp_id})</h2>
            <dl className="space-y-2 text-fog-300"><div><dt className="text-fog-500">Threat</dt><dd>{module.threat}</dd></div><div><dt className="text-fog-500">Security impact</dt><dd>{module.impact}</dd></div></dl>
          </section>
          <section><h2 className="mb-1 font-medium">Mitigation</h2><List items={module.mitigation} /><p className="mt-2 max-w-prose text-fog-300">{module.remediation}</p></section>
        </div>
      )}

      {tab === 'Exploit' && (
        <div className="space-y-4">
          <p className="text-sm text-fog-300">Everything runs inside this local lab. Do not use these payloads against systems you do not own.</p>
          {mode === 'intermediate' && <Hints module={module} />}
          <RunPanel module={module} />
        </div>
      )}

      {tab === 'Code' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <CodeBlock tone="vuln" label="Vulnerable implementation" code={module.vulnerable_code} />
          <CodeBlock tone="safe" label="Secure implementation" code={module.secure_code} />
        </div>
      )}

      {tab === 'Validate' && (mode === 'advanced' ? <FixIt module={module} /> : (
        <div className="space-y-3">
          <FlagForm module={module} />
          <p className="text-sm text-fog-500">Switch to Advanced mode to fix the code and have the platform test your remediation.</p>
        </div>
      ))}
    </div>
  )
}
