import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../services/api.js'
import { useModules } from '../hooks/useModules.js'
import { useProgress } from '../hooks/useProgress.jsx'
import { LAB_MAX_POINTS, POINTS, POINT_ROWS, labPoints } from '../services/points.js'
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
  const [busy, setBusy] = useState(false)
  async function send() {
    const value = flag.trim()
    if (!value || busy) return
    setBusy(true)
    try {
      const r = await api.flag(module.id, value)
      setMsg({ ok: r.correct, text: r.message })
      if (r.correct) mark(module.id, 'flag')
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally { setBusy(false) }
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); send() }} className="space-y-2">
      <p className="text-fog-300">{module.challenge}</p>
      <p className="text-sm text-fog-500">Capturing the flag is worth <strong className="text-safe-400">{POINTS.flag} points</strong>. Press Enter or use the button to submit.</p>
      <label className="block text-sm text-fog-300">Flag
        <input
          aria-label="Flag" className="input mt-1" value={flag} placeholder="FLAG{...}" maxLength={200}
          onChange={(e) => setFlag(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
        />
      </label>
      <button className="btn btn-primary" type="submit" disabled={busy || !flag.trim()}>{busy ? 'Checking…' : 'Submit flag'}</button>
      {msg && <p role="status" className={msg.ok ? 'text-safe-400' : 'text-vuln-400'}>{msg.text}</p>}
    </form>
  )
}

// How the lab briefs the student, purely from its own fixed difficulty.
function Rules({ difficulty }) {
  const level = difficulty.toLowerCase()
  const text = {
    beginner: 'This is an entry-level lab: a guided walkthrough and one-click example payloads are on the Learn and Exploit tabs to teach the attack patterns.',
    intermediate: 'This is an intermediate lab: no walkthrough and no ready-made payloads. Hints unlock one at a time; you must write your own attacks.',
    advanced: 'This is an advanced lab: no hints, no examples, and the server rejects textbook payloads verbatim. Capture the flag and pass Fix-It to finish.',
  }[level] || ''
  return (
    <section className="panel p-4">
      <h2 className="font-medium">Expectations at this level</h2>
      <p className="mt-2 text-sm text-fog-300">{text}</p>
    </section>
  )
}

// Right-hand rail: everything contextual about this lab. On small screens it
// simply stacks below the content, so no space is wasted and nothing hides.
function Sidebar({ module, done }) {
  const { modules: all } = useProgress()
  const earned = labPoints(done)
  return (
    <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start" aria-label="Lab information">
      <section className="panel p-4">
        <h2 className="font-medium">In this lab</h2>
        <dl className="mt-2 space-y-1 text-sm text-fog-300">
          <div className="flex justify-between gap-2"><dt className="text-fog-500">Level</dt><dd>{module.difficulty}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-fog-500">Time</dt><dd>{module.estimated_minutes} min</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-fog-500">OWASP</dt><dd>{module.owasp_id}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-fog-500">Points</dt><dd className="font-semibold text-steel-400">{earned} / {LAB_MAX_POINTS}</dd></div>
        </dl>
      </section>
      <section className="panel p-4">
        <h2 className="font-medium">Prerequisites</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fog-300">{module.prerequisites.map((p) => <li key={p}>{p}</li>)}</ul>
      </section>
      <section className="panel p-4">
        <h2 className="font-medium">Points in this lab</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {POINT_ROWS.map(({ field, label, points }) => {
            const ok = Boolean(done[field])
            return (
              <li key={field} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span aria-hidden className={ok ? 'text-safe-400' : 'text-fog-500'}>{ok ? '✔' : '○'}</span>
                  <span className={ok ? 'text-fog-100' : 'text-fog-300'}>{label}</span>
                </span>
                <span className={ok ? 'text-safe-400' : 'text-fog-500'}>+{points}</span>
              </li>
            )
          })}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-ink-700 pt-2 text-sm">
          <span className="text-fog-500">Earned here</span>
          <span className="font-semibold text-steel-400">{earned} / {LAB_MAX_POINTS} pts</span>
        </div>
        <p className="mt-3 text-xs text-fog-500">{Object.keys(all).length ? 'Synced to your account when signed in.' : ''}</p>
      </section>
      <Rules difficulty={module.difficulty} />
    </aside>
  )
}

// Jump straight to the neighbouring lab instead of going back to the catalogue.
function LabNav({ prev, next }) {
  return (
    <nav aria-label="Lab navigation" className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-700 pt-4">
      <Link className="btn max-w-full" to={prev ? `/labs/${prev.id}` : '/labs'}>
        <span className="truncate">{prev ? `← ${prev.owasp_id}: ${prev.name}` : '← All labs'}</span>
      </Link>
      <Link className="btn btn-primary max-w-full" to={next ? `/labs/${next.id}` : '/labs'}>
        <span className="truncate">{next ? `${next.owasp_id}: ${next.name} →` : 'Back to all labs →'}</span>
      </Link>
    </nav>
  )
}

export default function Lab() {
  const { id } = useParams()
  const { modules } = useProgress()
  const { modules: catalog } = useModules()
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
  const guide = GUIDES[id]
  const level = module.difficulty.toLowerCase()
  const index = catalog.findIndex((m) => m.id === id)
  const prev = index > 0 ? catalog[index - 1] : null
  const next = index >= 0 && index < catalog.length - 1 ? catalog[index + 1] : null

  return (
    <div className="space-y-5 xl:grid xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start xl:gap-8">
      <div className="min-w-0 space-y-5">
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={module.difficulty}>Level: {module.difficulty}</Badge>
            <Badge>{module.owasp_id}</Badge><Badge>{module.estimated_minutes} min</Badge>
            <Badge>{LAB_MAX_POINTS} pts</Badge>
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
            {level === 'beginner' && <>
              <section><h2 className="mb-1 font-medium">Guided steps</h2><List ordered items={module.guided_steps || []} /></section>
              <section><h2 className="mb-1 font-medium">Expected outcome</h2><p className="text-fog-300">{module.expected_outcome}</p></section>
            </>}
            <section className="panel p-4"><h2 className="mb-2 font-medium">Threat model ({module.owasp_id})</h2>
              <dl className="space-y-2 text-fog-300"><div><dt className="text-fog-500">Threat</dt><dd>{module.threat}</dd></div><div><dt className="text-fog-500">Security impact</dt><dd>{module.impact}</dd></div></dl>
            </section>
            <section><h2 className="mb-1 font-medium">Mitigation</h2><List items={module.mitigation} /><p className="mt-2 max-w-prose text-fog-300">{module.remediation}</p></section>
          </div>
        )}

        {tab === 'Exploit' && (
          <div className="space-y-4">
            <p className="text-sm text-fog-300">Everything runs inside this local lab. Do not use these payloads against systems you do not own.</p>
            {level !== 'advanced' && <Hints module={module} />}
            {level === 'advanced' && <p className="rounded border border-vuln-400/40 bg-vuln-900/40 px-3 py-2 text-sm text-vuln-400">Advanced: no hints here, and example payloads crafted for other labs are rejected by the server. Write the attack yourself.</p>}
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
            <section className="panel p-4"><h2 className="mb-3 font-medium">Capture the flag</h2><FlagForm module={module} /></section>
            <section className={`panel p-4 ${level === 'advanced' ? 'border-vuln-400/40' : ''}`}>
              <h2 className="mb-1 font-medium">
                Fix-It — {level === 'advanced' ? 'required to complete' : 'optional, worth extra points'}
              </h2>
              <p className="mb-3 text-sm text-fog-300">
                Rewrite the vulnerable function so the sandboxed attack replay fails, and still behave correctly for legitimate input.
                Passing it is worth <strong className="text-safe-400">150 points</strong>
                {level === 'advanced' ? ', and an advanced lab only counts as finished when the flag and Fix-It are both done.' : '.'}
              </p>
              <FixIt module={module} />
            </section>
          </div>
        )}

        {tab === 'Guide' && (
          <article className="panel p-5">
            {guide ? <Markdown source={guide} /> : <p className="text-fog-300">No guide compiled for this module yet.</p>}
          </article>
        )}

        <LabNav prev={prev} next={next} />
      </div>

      <Sidebar module={module} done={done} />
    </div>
  )
}
