import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useModules } from '../hooks/useModules.js'
import { Badge, Loading } from '../components/ui.jsx'
import { useProgress } from '../hooks/useProgress.jsx'

const LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced']

export default function Labs() {
  const { modules, loading, error } = useModules()
  const { modules: done } = useProgress()
  const [level, setLevel] = useState('All')
  if (loading || error) return <Loading error={error} />
  const visible = modules.filter((m) => level === 'All' || m.difficulty === level)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Labs</h1>
          <p className="mt-1 text-sm text-fog-300">Ten real vulnerable labs mapped to the OWASP Top 10 for LLMs. Pick a level, then choose your learning mode in the header.</p>
        </div>
        <div role="group" aria-label="Filter by level" className="flex flex-wrap gap-1">
          {LEVELS.map((l) => (
            <button key={l} onClick={() => setLevel(l)} aria-pressed={level === l}
              className={`rounded border px-3 py-1.5 text-sm ${level === l ? 'border-steel-400 bg-steel-500/15 text-steel-400' : 'border-ink-600 text-fog-300 hover:bg-ink-800'}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((m) => {
          const p = done[m.id] || {}
          return (
            <article key={m.id} className="panel flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2"><Badge tone={m.difficulty}>{m.difficulty}</Badge><Badge>{m.owasp_id}</Badge>
                {p.flag && <Badge tone="Beginner">Flag</Badge>}{p.fixit && <Badge tone="Advanced">Fixed</Badge>}</div>
              <h2 className="text-lg font-medium">{m.name}</h2>
              <p className="text-sm text-fog-300">{m.overview}</p>
              <dl className="text-sm text-fog-300">
                <div className="flex gap-2"><dt className="text-fog-500">Estimated time</dt><dd>{m.estimated_minutes} min</dd></div>
                <div><dt className="text-fog-500">Prerequisites</dt><dd>{m.prerequisites.join(', ')}</dd></div>
                <div><dt className="text-fog-500">OWASP mapping</dt><dd>{m.category}</dd></div>
              </dl>
              <ul className="list-disc pl-5 text-sm text-fog-300">{m.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                <Link className="btn btn-primary" to={`/labs/${m.id}`}>{p.explored ? 'Continue lab' : 'Start lab'}</Link>
                <span className="text-xs text-fog-500">{p.fixit ? 'Fixed' : p.flag ? 'Flag captured' : p.explored ? 'Explored' : 'Not started'}</span>
              </div>
            </article>
          )
        })}
        {visible.length === 0 && <p className="text-fog-500">No labs at this level yet.</p>}
      </div>
    </div>
  )
}
