import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useModules } from '../hooks/useModules.js'
import { labStatus, summarize, useProgress } from '../hooks/useProgress.jsx'
import { riskOf } from '../services/labFilters.js'
import { LAB_MAX_POINTS, labPoints } from '../services/points.js'
import { useToast } from '../components/Toast.jsx'
import { Badge, EmptyState, Loading, PageHeader, ProgressBar, Stat } from '../components/ui'
import Icon from '../components/Icons.jsx'

const STATUS = {
  completed: ['Completed', 'badge-success'],
  flag: ['Flag captured', 'badge-brand'],
  'in-progress': ['In progress', 'badge-neutral'],
  'not-started': ['Not started', 'badge-neutral'],
}

function when(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function Status({ entry }) {
  const [label, className] = STATUS[labStatus(entry)] || STATUS['not-started']
  return <span className={`badge ${className}`}>{label}</span>
}

export default function Progress() {
  const { modules, loading, error, errorKind, reload } = useModules()
  const progress = useProgress()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)

  if (loading || error) return <Loading error={error} errorKind={errorKind} onRetry={reload} />

  const summary = summarize(modules, progress)
  const hasProgress = Object.values(progress.modules).some((entry) => entry.explored || entry.flag || entry.fixit)

  function reset() {
    progress.reset()
    setConfirming(false)
    toast.success('Progress cleared for this account.')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Records"
        title="Progress"
        description="Every lab, every stage and the points you have earned. Signed-in progress is also stored in your account; the browser keeps a local copy so the page works while offline."
        actions={hasProgress ? (
          confirming ? null : (
            <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
              <Icon name="reset" size={14} />
              Reset progress
            </button>
          )
        ) : null}
      />

      {confirming && (
        <div role="alertdialog" aria-labelledby="reset-heading" className="rounded-xl border border-red-200 bg-red-50 p-4 sm:p-5">
          <h2 id="reset-heading" className="text-sm font-semibold text-red-900">Reset all progress?</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-red-800">
            This clears explored, flag and Fix-It records for this account, including the cloud copy. Captured flags
            can be re-submitted, but the record itself cannot be restored. This does not delete the account.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-danger" onClick={reset}>Yes, reset progress</button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      )}

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Completed labs" value={`${summary.completed}/${summary.total}`} hint={`${summary.completionPercent}% of the catalogue`} icon="check" tone="brand" />
        <Stat label="Flags captured" value={`${summary.flags}/${summary.total}`} hint={`${summary.explored} labs explored`} icon="flag" />
        <Stat label="Fixes validated" value={`${summary.fixes}/${summary.total}`} hint="Passing sandbox checks" icon="code" />
        <Stat label="Points" value={`${summary.score}`} hint={`of ${summary.maxScore}`} icon="trophy" />
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-ink">Overall progress</h2>
            <p className="mt-0.5 text-sm text-slate-500">All three stages across every lab.</p>
          </div>
          <span className="text-2xl font-semibold tracking-tight text-ink">{summary.percent}%</span>
        </div>
        <ProgressBar value={summary.percent} className="mt-3" label="Overall progress" />
      </section>

      {!modules.length ? (
        <EmptyState icon="labs" title="No labs available" body="The catalogue is empty, so there is no progress to show." />
      ) : (
        <>
          <section className="card hidden overflow-hidden md:block" aria-label="Progress by lab">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead className="border-b border-line bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Lab</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Explored</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Flag</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Fix-It</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Points</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Last activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {modules.map((module) => {
                    const entry = progress.modules[module.id] || {}
                    return (
                      <tr key={module.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <Link to={`/labs/${module.id}`} className="font-medium text-ink hover:text-brand-700">{module.name}</Link>
                          <span className="mt-0.5 block text-xs text-slate-500">{riskOf(module).code} · {module.difficulty}</span>
                        </td>
                        <td className="px-4 py-3"><Status entry={entry} /></td>
                        {['explored', 'flag', 'fixit'].map((field) => (
                          <td key={field} className="px-4 py-3">
                            {entry[field] ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700"><Icon name="check" size={14} /> Done</span>
                            ) : <span className="text-slate-400">—</span>}
                          </td>
                        ))}
                        <td className="px-4 py-3 font-medium text-slate-700">{labPoints(entry)} <span className="font-normal text-slate-400">/ {LAB_MAX_POINTS}</span></td>
                        <td className="px-4 py-3 text-xs text-slate-500">{when(entry.at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <ul className="space-y-3 md:hidden" aria-label="Progress by lab">
            {modules.map((module) => {
              const entry = progress.modules[module.id] || {}
              return (
                <li key={module.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/labs/${module.id}`} className="block text-sm font-medium text-ink">{module.name}</Link>
                      <p className="mt-0.5 text-xs text-slate-500">{riskOf(module).code} · {module.difficulty}</p>
                    </div>
                    <Status entry={entry} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {[['Explored', 'explored'], ['Flag', 'flag'], ['Fix-It', 'fixit']].map(([label, field]) => (
                      <span key={field} className={`badge ${entry[field] ? 'badge-success' : 'badge-neutral'}`}>
                        {entry[field] && <Icon name="check" size={11} />}
                        {label}
                      </span>
                    ))}
                    <span className="ml-auto text-slate-500">{labPoints(entry)} / {LAB_MAX_POINTS} pts</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <p className="text-xs leading-5 text-slate-500">
        A completed lab requires both a captured flag and a validated fix. Points are informational here; the leaderboard is computed server-side from the same records.
      </p>
    </div>
  )
}
