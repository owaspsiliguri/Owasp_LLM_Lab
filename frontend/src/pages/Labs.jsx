import { Link } from 'react-router-dom'
import { useModules } from '../hooks/useModules.js'
import { Badge, Loading } from '../components/ui.jsx'
import { useProgress } from '../hooks/useProgress.jsx'
import { guideUrl } from '../services/links.js'

export default function Labs() {
  const { modules, loading, error } = useModules()
  const { modules: done } = useProgress()
  if (loading || error) return <Loading error={error} />
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Labs</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => {
          const p = done[m.id] || {}
          return (
            <article key={m.id} className="panel flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2"><Badge tone={m.difficulty}>{m.difficulty}</Badge><Badge>{m.owasp_id}</Badge></div>
              <h2 className="text-lg font-medium">{m.name}</h2>
              <p className="text-sm text-fog-300">{m.overview}</p>
              <dl className="text-sm text-fog-300">
                <div className="flex gap-2"><dt className="text-fog-500">Estimated time</dt><dd>{m.estimated_minutes} min</dd></div>
                <div><dt className="text-fog-500">Prerequisites</dt><dd>{m.prerequisites.join(', ')}</dd></div>
                <div><dt className="text-fog-500">OWASP mapping</dt><dd>{m.category}</dd></div>
              </dl>
              <ul className="list-disc pl-5 text-sm text-fog-300">{m.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Link className="btn btn-primary" to={`/labs/${m.id}`}>Start lab</Link>
                  <a className="text-sm text-steel-400 underline" href={guideUrl(m.id)} target="_blank" rel="noreferrer">Guide</a>
                </div>
                <span className="text-xs text-fog-500">{p.fixit ? 'Fixed' : p.flag ? 'Flag captured' : p.explored ? 'Explored' : 'Not started'}</span>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
