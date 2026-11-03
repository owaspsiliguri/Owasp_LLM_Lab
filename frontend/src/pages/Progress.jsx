import { Link } from 'react-router-dom'
import { useModules } from '../hooks/useModules.js'
import { summarize, useProgress } from '../hooks/useProgress.jsx'
import { Loading } from '../components/ui.jsx'
import { LAB_MAX_POINTS, labPoints } from '../services/points.js'

export default function Progress() {
  const { modules, loading, error } = useModules()
  const progress = useProgress()
  if (loading || error) return <Loading error={error} />
  const s = summarize(modules, progress)
  const yn = (v) => (v ? 'Yes' : '–')
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Progress</h1>
        <span className="text-fog-300">
          <span>{s.percent}% complete</span> · <span className="font-semibold text-steel-400">{s.score}</span> / {s.maxScore} pts
        </span>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-700 text-fog-500"><tr><th className="p-3">Module</th><th className="p-3">Explored</th><th className="p-3">Flag</th><th className="p-3">Fix-It</th><th className="p-3">Points</th></tr></thead>
          <tbody>{modules.map((m) => { const p = progress.modules[m.id] || {}; return (
            <tr key={m.id} className="border-b border-ink-800"><td className="p-3"><Link className="text-steel-400 underline" to={`/labs/${m.id}`}>{m.owasp_id} {m.name}</Link></td><td className="p-3">{yn(p.explored)}</td><td className="p-3">{yn(p.flag)}</td><td className="p-3">{yn(p.fixit)}</td><td className="p-3">{labPoints(p)} / {LAB_MAX_POINTS}</td></tr>) })}</tbody>
        </table>
      </div>
      <button className="btn" onClick={() => { if (window.confirm('Reset all progress stored in this browser?')) progress.reset() }}>Reset progress</button>
    </div>
  )
}
