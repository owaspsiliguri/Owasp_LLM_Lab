import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { EmptyState, Loading, PageHeader } from '../components/ui'
import Icon from '../components/Icons.jsx'

function PodiumCard({ entry, me }) {
  const highlight = me?.rank === entry.rank
  return (
    <article className={`card p-5 ${highlight ? 'border-brand-500/40 ring-2 ring-brand-500/20' : ''}`}>
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${entry.rank === 1 ? 'bg-brand-600 text-ink-950' : 'bg-slate-100 text-slate-600'}`}>
          {entry.rank}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-ink" title={entry.display}>{entry.display}</h2>
          <p className="text-xs text-slate-500">Rank {entry.rank}</p>
        </div>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-ink">{entry.score}<span className="ml-1 text-xs font-normal text-slate-400">pts</span></p>
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center text-xs">
        <div><dt className="text-slate-400">Flags</dt><dd className="mt-0.5 font-medium text-slate-700">{entry.flags}</dd></div>
        <div><dt className="text-slate-400">Fixes</dt><dd className="mt-0.5 font-medium text-slate-700">{entry.fixes}</dd></div>
        <div><dt className="text-slate-400">Complete</dt><dd className="mt-0.5 font-medium text-slate-700">{entry.completed}</dd></div>
      </dl>
    </article>
  )
}

export default function Leaderboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let live = true
    api.leaderboard()
      .then((result) => { if (live) setData(result) })
      .catch((err) => { if (live) setError(err) })
    return () => { live = false }
  }, [])

  if (error) return <Loading error={error.message} errorKind={error.kind} onRetry={() => window.location.reload()} />
  if (!data) return <Loading>Loading the ranking…</Loading>

  if (!data.enabled) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Community" title="Global leaderboard" description="Scores are computed server-side from persisted lab progress." />
        <EmptyState
          icon="leaderboard"
          title="No global ranking on this deployment"
          body="The leaderboard appears when an identity provider is configured and learners have accounts. Without one there is no account to rank."
        />
      </div>
    )
  }

  const entries = data.entries || []
  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Community"
        title="Global leaderboard"
        description="Ranked from persisted flags and validated fixes. Identities are masked unless a learner sets a display name."
        actions={<span className="badge badge-neutral">Scoring: {data.formula}</span>}
      />

      {data.me && data.me.rank > 50 && (
        <div className="card flex flex-wrap items-center gap-3 border-brand-500/30 bg-brand-50/50 p-4">
          <Icon name="trophy" size={18} className="text-brand-700" />
          <p className="text-sm text-slate-700">
            Your rank is <span className="font-semibold text-ink">#{data.me.rank}</span> with {data.me.score} points.
          </p>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState icon="trophy" title="No ranked learners yet" body="The leaderboard is live; it fills as accounts capture flags and validate fixes." />
      ) : (
        <>
          {podium.length > 0 && (
            <section aria-label="Top three" className="grid gap-4 sm:grid-cols-3">
              {podium.map((entry) => <PodiumCard key={entry.rank} entry={entry} me={data.me} />)}
            </section>
          )}

          {rest.length > 0 && (
            <>
              <section className="card hidden overflow-hidden md:block" aria-label="Full ranking">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[42rem] text-left text-sm">
                    <thead className="border-b border-line bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th scope="col" className="px-4 py-2.5 font-medium">Rank</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Learner</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Score</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Flags</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Fixes</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Explored</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Complete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {rest.map((entry) => {
                        const me = data.me?.rank === entry.rank
                        return (
                          <tr key={entry.rank} className={me ? 'bg-brand-50/60' : 'hover:bg-slate-50/70'}>
                            <td className="px-4 py-3 text-slate-500">{entry.rank}</td>
                            <td className="px-4 py-3 font-medium text-ink">
                              {entry.display}
                              {me && <span className="ml-2 text-xs font-normal text-brand-700">(you)</span>}
                            </td>
                            <td className="px-4 py-3 font-semibold text-ink">{entry.score}</td>
                            <td className="px-4 py-3 text-slate-600">{entry.flags}</td>
                            <td className="px-4 py-3 text-slate-600">{entry.fixes}</td>
                            <td className="px-4 py-3 text-slate-600">{entry.explored}</td>
                            <td className="px-4 py-3 text-slate-600">{entry.completed}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <ul className="space-y-2 md:hidden" aria-label="Full ranking">
                {rest.map((entry) => {
                  const me = data.me?.rank === entry.rank
                  return (
                    <li key={entry.rank} className={`card flex items-center gap-3 p-4 ${me ? 'border-brand-500/30 bg-brand-50/50' : ''}`}>
                      <span className="w-7 shrink-0 text-sm font-medium text-slate-400">{entry.rank}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{entry.display}{me && <span className="ml-1.5 text-xs text-brand-700">(you)</span>}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{entry.flags} flags · {entry.fixes} fixes · {entry.completed} complete</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-ink">{entry.score}</span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </>
      )}

      <p className="text-xs leading-5 text-slate-500">
        Only the top 50 accounts are listed. Personal progress is private; the public list exposes a masked name and aggregate counts.
      </p>
    </div>
  )
}
