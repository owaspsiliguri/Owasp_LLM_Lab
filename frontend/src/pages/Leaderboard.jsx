import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { Loading } from '../components/ui.jsx'

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let live = true
    api.leaderboard().then((d) => live && setData(d)).catch((e) => live && setError(e.message))
    return () => { live = false }
  }, [])

  if (error) return <Loading error={error} />
  if (!data) return <Loading />

  if (!data.enabled) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold">Global leaderboard</h1>
        <div className="panel p-5">
          <p className="text-fog-300">The global leaderboard appears when this deployment is connected to Supabase — scores are then computed server-side from every student's progress and attempt history.</p>
          <p className="mt-2 text-sm text-fog-500">Local Docker mode keeps everything in your browser, so there is nothing to rank yet. Follow the deployment guide to enable it.</p>
        </div>
      </div>
    )
  }

  const top = data.entries
  const podium = top.slice(0, 3)
  const rest = top.slice(3)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Global leaderboard</h1>
        <p className="text-sm text-fog-500">Scoring: {data.formula}</p>
      </div>

      {data.me && data.me.rank > 50 && (
        <div className="panel border-steel-400/40 p-4 text-sm">
          Your rank: <span className="font-semibold text-steel-400">#{data.me.rank}</span> — {data.me.score} pts
        </div>
      )}

      {podium.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {podium.map((e) => (
            <div key={e.rank} className={`panel p-4 text-center ${data.me && e.rank === data.me.rank ? 'border-steel-400/60' : ''}`}>
              <div className="text-2xl">{MEDALS[e.rank - 1]}</div>
              <div className="mt-1 truncate font-medium" title={e.display}>{e.display}</div>
              <div className="text-lg font-semibold text-steel-400">{e.score}</div>
              <div className="text-xs text-fog-500">{e.flags} flags · {e.fixes} fixes · {e.completed} complete</div>
            </div>
          ))}
        </div>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-700 text-fog-500">
            <tr><th className="p-3">#</th><th className="p-3">Player</th><th className="p-3">Score</th><th className="p-3">Flags</th><th className="p-3">Fixes</th><th className="p-3">Explored</th><th className="p-3">Complete</th></tr>
          </thead>
          <tbody>
            {rest.map((e) => (
              <tr key={e.rank} className={`border-b border-ink-800 ${data.me && e.rank === data.me.rank ? 'bg-steel-500/10' : ''}`}>
                <td className="p-3 text-fog-500">{e.rank}</td>
                <td className="p-3 font-medium">{e.display}{data.me && e.rank === data.me.rank && <span className="ml-2 text-xs text-steel-400">(you)</span>}</td>
                <td className="p-3 font-semibold text-steel-400">{e.score}</td>
                <td className="p-3">{e.flags}</td>
                <td className="p-3">{e.fixes}</td>
                <td className="p-3">{e.explored}</td>
                <td className="p-3">{e.completed}</td>
              </tr>
            ))}
            {rest.length === 0 && <tr><td colSpan={7} className="p-4 text-fog-500">No ranked learners yet — be the first.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
