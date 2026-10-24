import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../services/api.js'
import { useProgress } from '../hooks/useProgress.jsx'
import { Badge, CodeBlock, Loading } from '../components/ui.jsx'
import Markdown from '../components/Markdown.jsx'
import RunPanel from '../components/RunPanel.jsx'
import FixIt from '../components/FixIt.jsx'
import { GUIDES } from '../content/guides.js'

const TABS = ['Learn', 'Exploit', 'Code', 'Validate', 'Guide']

function List({ items, ordered }) {
  const Tag = ordered ? 'ol' : 'ul'
  return <Tag className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-1 pl-5 text-fog-300`}>{items.map((i) => <li key={i}>{i}</li>)}</Tag>
}

function Hints({ module, mode }) {
  const [hints, setHints] = useState([])
  const [error, setError] = useState(null)
  async function reveal() {
    try { const h = await api.hint(module.id, hints.length + 1, mode); setHints((x) => [...x, h.hint]) } catch (e) { setError(e.message) }
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

function FlagForm({ module, mode }) {
  const { mark } = useProgress()
  const [flag, setFlag] = useState('')
  const [msg, setMsg] = useState(null)
  async function submit(e) {
    e.preventDefault()
    try {
      const r = await api.flag(module.id, flag, mode)
      setMsg({ ok: r.correct, text: r.message })
      if (r.correct) mark(module.id, 'flag')
    } catch (err) { setMsg({ ok: false, text: err.message }) }
  }
  return (
    <form onSubmit={submit} className="space-y-2">
      <p className="text-fog-300">{mode === 'advanced' ? module.advanced_challenge : module.challenge}</p>
      <label className="block text-sm text-fog-300">Flag
        <input aria-label="Flag" className="input mt-1" value={flag} onChange={(e) => setFlag(e.target.value)} placeholder="FLAG{...}" maxLength={200} />
      </label>
      <button className="btn btn-primary" type="submit" disabled={!flag.trim()}>Submit flag</button>
      {msg && <p role="status" className={msg.ok ? 'text-safe-400' : 'text-vuln-400'}>{msg.text}</p>}
    </form>
  )
}

// Right-hand rail: everything contextual about this lab. On small screens it
// simply stacks below the content, so no space is wasted and nothing hides.
function Sidebar({ module, mode, done }) {
  const { modules: all, mode: progressMode } = useProgress()
  const steps = [
    ['Explored the vulnerability', done.explored],
    ['Captured the flag', done.flag],
    ['Passed Fix-It validation', done.fixit],
  ]
  return (
    <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start" aria-label="Lab information">
      <section className="panel p-4">
        <h2 className="font-medium">In this lab</h2>
        <dl className="mt-2 space-y-1 text-sm text-fog-300">
          <div className="flex justify-between gap-2"><dt className="text-fog-500">Level</dt><dd>{module.difficulty}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-fog-500">Mode</dt><dd className="capitalize">{progressMode}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-fog-500">Time</dt><dd>{module.estimated_minutes} min</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-fog-500">OWASP</dt><dd>{module.owasp_id}</dd></div>
        </dl>
      </section>
      <section className="panel p-4">
        <h2 className="font-medium">Prerequisites</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fog-300">{module.prerequisites.map((p) => <li key={p}>{p}</li>)}</ul>
      </section>
      <section className="panel p-4">
        <h2 className="font-medium">Your progress</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {steps.map(([label, ok]) => (
            <li key={label} className="flex items-center gap-2">
              <span aria-hidden className={ok ? 'text-safe-400' : 'text-fog-500'}>{ok ? '✔' : '○'}</span>
              <span className={ok ? 'text-fog-100' : 'text-fog-300'}>{label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-fog-500">{Object.keys(all).length ? 'Synced to your account when signed in.' : ''}</p>
      </section>
      <section className="panel p-4">
        <h2 className="font-medium">Mode rules</h2>
        <p className="mt-2 text-sm text-fog-300">
          {mode === 'beginner' && 'Guided steps and ready-made payloads are on. Follow the walkthrough, then read the guide.'}
          {mode === 'intermediate' && 'No walkthrough, no example payloads. Hints unlock one at a time; you write the attacks.'}
          {mode === 'advanced' && 'No hints, no examples — copy-paste attacks are rejected by the server. Capture the flag and pass Fix-It to finish.'}
        </p>
      </section>
    </aside>
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
    api.module(id, mode).then((m) => live && setModule(m)).catch((e) => live && setError(e.message))
    return () => { live = false }
  }, [id, mode])
  if (error || !module) return <Loading error={error} />
  const done = modules[id] || {}
  const guide = GUIDES[id]

  return (
    <div className="space-y-5 xl:grid xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start xl:gap-8">
      <div className="min-w-0 space-y-5">
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={module.difficulty}>Level: {module.difficulty}</Badge>
            <Badge tone={mode === 'advanced' ? 'Advanced' : mode === 'intermediate' ? 'Intermediate' : 'Beginner'}>Mode: {mode}</Badge>
            <Badge>{module.owasp_id}</Badge><Badge>{module.estimated_minutes} min</Badge>
            {done.explored && <Badge>Explored</Badge>}{done.flag && <Badge>Flag captured</Badge>}{done.fixit && <Badge>Fixed</Badge>}
          </div>
          <h1 className="mt-2 text-2xl font-semibold">{module.name}</h1>
          <p className="text-sm text-fog-500">{module.category}</p>
        </header>
        <div role="tablist" aria-label="Lab sections" className="flex gap-1 overflow-x-auto border-b border-ink-700">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm ${tab === t ? 'border-steel-400 text-fog-100' : 'border-transparent text-fog-300 hover:text-fog-100'}`}>{t}</button>
          ))}
        </div>

        {tab === 'Learn' && (
          <div className="space-y-5">
            <p className="max-w-prose text-fog-300">{module.overview}</p>
            <section><h2 className="mb-1 font-medium">Learning objectives</h2><List items={module.objectives} /></section>
            {mode === 'beginner' && <>
              <section><h2 className="mb-1 font-medium">Guided steps</h2><List ordered items={module.guided_steps || []} /></section>
              <section><h2 className="mb-1 font-medium">Expected outcome</h2><p className="text-fog-300">{module.expected_outcome}</p></section>
            </>}
            {mode === 'intermediate' && <section className="panel border-warn-400/40 p-4"><h2 className="mb-1 font-medium text-warn-400">Challenge</h2><p className="text-fog-300">{module.challenge}</p></section>}
            {mode === 'advanced' && <section className="panel border-vuln-400/40 p-4"><h2 className="mb-1 font-medium text-vuln-400">Advanced challenge — insane mode</h2><p className="text-fog-300">{module.advanced_challenge}</p></section>}
            <section className="panel p-4"><h2 className="mb-2 font-medium">Threat model ({module.owasp_id})</h2>
              <dl className="space-y-2 text-fog-300"><div><dt className="text-fog-500">Threat</dt><dd>{module.threat}</dd></div><div><dt className="text-fog-500">Security impact</dt><dd>{module.impact}</dd></div></dl>
            </section>
            <section><h2 className="mb-1 font-medium">Mitigation</h2><List items={module.mitigation} /><p className="mt-2 max-w-prose text-fog-300">{module.remediation}</p></section>
          </div>
        )}

        {tab === 'Exploit' && (
          <div className="space-y-4">
            <p className="text-sm text-fog-300">Everything runs inside this local lab. Do not use these payloads against systems you do not own.</p>
            {mode === 'intermediate' && <Hints module={module} mode={mode} />}
            {mode === 'advanced' && <p className="rounded border border-vuln-400/40 bg-vuln-900/40 px-3 py-2 text-sm text-vuln-400">Advanced: no hints here, and example payloads are rejected by the server. Craft your own.</p>}
            <RunPanel module={module} />
          </div>
        )}

        {tab === 'Code' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <CodeBlock tone="vuln" label="Vulnerable implementation" code={module.vulnerable_code} />
            <CodeBlock tone="safe" label="Secure implementation" code={module.secure_code} />
          </div>
        )}

        {tab === 'Validate' && (
          <div className="space-y-5">
            <section className="panel p-4"><h2 className="mb-3 font-medium">Capture the flag</h2><FlagForm module={module} mode={mode} /></section>
            {mode === 'advanced' && (
              <section className="panel border-vuln-400/40 p-4">
                <h2 className="mb-1 font-medium">Fix-It — required to complete</h2>
                <p className="mb-3 text-sm text-fog-300">In Advanced mode a lab is finished only when the flag is captured <em>and</em> your remediation passes the sandboxed attack replay.</p>
                <FixIt module={module} />
              </section>
            )}
            {mode !== 'advanced' && (
              <p className="text-sm text-fog-500">Switch to Advanced mode to attempt the Fix-It challenge — the hardest layer of this lab.</p>
            )}
          </div>
        )}

        {tab === 'Guide' && (
          <article className="panel p-5">
            {guide ? <Markdown source={guide} /> : <p className="text-fog-300">No guide compiled for this module yet.</p>}
          </article>
        )}
      </div>

      <Sidebar module={module} mode={mode} done={done} />
    </div>
  )
}
