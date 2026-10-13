import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api.js'
import { useModules } from '../hooks/useModules.js'
import { summarize, useProgress } from '../hooks/useProgress.jsx'
import { Loading, Stat } from '../components/ui.jsx'

export default function Dashboard() {
  const { modules, loading, error } = useModules()
  const progress = useProgress()
  const [health, setHealth] = useState(null)
  useEffect(() => { api.health().then(setHealth).catch(() => setHealth(null)) }, [])
  if (loading || error) return <Loading error={error} />

  const s = summarize(modules, progress)
  const next = modules.find((m) => !(progress.modules[m.id] || {}).fixit) || modules[0]
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 max-w-prose text-fog-300">Learn how classic LLM applications fail, exploit them in a safe local lab, then fix the code and prove the fix works.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Modules completed" value={`${s.completed}/${s.total}`} />
        <Stat label="Vulnerabilities explored" value={s.explored} />
        <Stat label="Flags captured" value={s.flags} />
        <Stat label="Fix-It challenges completed" value={s.fixes} />
        <Stat label="Current difficulty" value={progress.mode[0].toUpperCase() + progress.mode.slice(1)} />
      </div>
      <div className="panel p-4">
        <div className="flex items-center justify-between text-sm"><span>Overall progress</span><span>{s.percent}%</span></div>
        <div className="mt-2 h-2 rounded bg-ink-700" role="progressbar" aria-valuenow={s.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Overall progress"><div className="h-2 rounded bg-steel-500" style={{ width: `${s.percent}%` }} /></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <h2 className="font-medium">Continue</h2>
          <p className="mt-1 text-fog-300">{next.owasp_id}: {next.name}</p>
          <Link className="btn btn-primary mt-3" to={`/labs/${next.id}`}>Open lab</Link>
        </div>
        <div className="panel p-4" aria-label="Service status">
          <h2 className="font-medium">Service status</h2>
          {health ? (
            <ul className="mt-2 space-y-1 text-sm text-fog-300">
              <li>Backend: <span className="text-safe-400">online</span> ({health.modules} modules)</li>
              <li>Ollama: {health.ollama.reachable ? (health.ollama.model_ready ? <span className="text-safe-400">ready ({health.ollama.model})</span> : <span className="text-warn-400">reachable, model {health.ollama.model} still downloading</span>) : <span className="text-warn-400">not reachable (deterministic engine still works)</span>}</li>
            </ul>
          ) : <p className="mt-2 text-sm text-warn-400">Backend not reachable.</p>}
        </div>
      </div>
    </div>
  )
}
