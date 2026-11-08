import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { useModules } from '../hooks/useModules.js'
import { labStatus, recentLabs, summarize, useProgress } from '../hooks/useProgress.jsx'
import { DIFFICULTIES, riskOf } from '../services/labFilters.js'
import { LAB_MAX_POINTS, labPoints } from '../services/points.js'
import { Badge, DifficultyBadge, EmptyState, Loading, PageHeader, ProgressBar, SectionTitle, Stat } from '../components/ui'
import Icon from '../components/Icons.jsx'

const STATUS_LABEL = {
  completed: ['Completed', 'badge-success'],
  flag: ['Flag captured', 'badge-brand'],
  'in-progress': ['In progress', 'badge-neutral'],
  'not-started': ['Not started', 'badge-neutral'],
}

const LEVEL_COLOUR = {
  Beginner: 'bg-emerald-500', Intermediate: 'bg-amber-500', Advanced: 'bg-orange-500', Expert: 'bg-red-500',
}

function when(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function StatusBadge({ entry }) {
  const [label, className] = STATUS_LABEL[labStatus(entry)] || STATUS_LABEL['not-started']
  return <span className={`badge ${className}`}>{label}</span>
}

export default function Dashboard() {
  const { profile, session } = useAuth()
  const { modules, loading, error, errorKind, reload } = useModules()
  const progress = useProgress()

  if (loading || error) return <Loading error={error} errorKind={errorKind} onRetry={reload} />

  const summary = summarize(modules, progress)
  const recent = recentLabs(modules, progress, 4)
  const remaining = modules.filter((module) => labStatus(progress.modules[module.id] || {}) !== 'completed')
  const recommended = remaining.slice(0, 3)
  const name = (profile?.full_name || session?.user?.email || '').split(/[\s@]/)[0]

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description={`${name ? `Welcome back, ${name}. ` : ''}Track your progress, pick up a challenge, and see which risks you have not covered yet.`}
        actions={(
          <>
            <Link to="/labs" className="btn btn-primary">Browse labs</Link>
            <Link to="/paths" className="btn">Learning paths</Link>
          </>
        )}
      />

      <section aria-label="Your statistics" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Labs completed" value={`${summary.completed}/${summary.total}`} hint="Flag and fix both validated" icon="check" tone="brand" />
        <Stat label="Flags captured" value={`${summary.flags}/${summary.total}`} hint={`${summary.explored} labs explored`} icon="flag" />
        <Stat label="Fixes validated" value={`${summary.fixes}/${summary.total}`} hint="Your code beat the replay" icon="code" />
        <Stat label="Points earned" value={summary.score} hint={`of ${summary.maxScore} available`} icon="trophy" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className="card p-5 sm:p-6" aria-labelledby="progress-heading">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="progress-heading" className="text-base font-semibold text-ink">Learning progress</h2>
              <p className="mt-0.5 text-sm text-slate-500">One point for each stage of each lab.</p>
            </div>
            <span className="text-2xl font-semibold tracking-tight text-ink">{summary.percent}%</span>
          </div>
          <ProgressBar value={summary.percent} className="mt-4" />
          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
            {[
              ['Explored', summary.explored, 'overview'],
              ['Flag', summary.flags, 'flag'],
              ['Fix-It', summary.fixes, 'code'],
            ].map(([label, value, icon]) => (
              <div key={label}>
                <dt className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                  <Icon name={icon} size={13} /> {label}
                </dt>
                <dd className="mt-1 text-lg font-semibold text-ink">{value}<span className="text-sm font-normal text-slate-400">/{summary.total}</span></dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            <Icon name="info" size={14} className="mt-0.5 shrink-0 text-slate-400" />
            <p>A lab counts as completed only when its flag is captured and the Fix-It sandbox accepts your remediation.</p>
          </div>
        </section>

        <section className="card p-5 sm:p-6" aria-labelledby="difficulty-heading">
          <h2 id="difficulty-heading" className="text-base font-semibold text-ink">Difficulty distribution</h2>
          <p className="mt-0.5 text-sm text-slate-500">Labs completed at each level.</p>
          <ul className="mt-4 space-y-3.5">
            {DIFFICULTIES.map((level) => {
              const labs = modules.filter((module) => module.difficulty === level)
              if (!labs.length) return null
              const complete = labs.filter((module) => labStatus(progress.modules[module.id] || {}) === 'completed').length
              return (
                <li key={level}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${LEVEL_COLOUR[level]}`} aria-hidden />
                      <span className="font-medium text-slate-700">{level}</span>
                    </span>
                    <span className="text-xs text-slate-500">{complete} of {labs.length}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${LEVEL_COLOUR[level]}`} style={{ width: `${labs.length ? (complete / labs.length) * 100 : 0}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-4 border-t border-line pt-3 text-xs text-slate-500">
            {remaining.length ? `${remaining.length} labs still open.` : 'Every lab is complete. Revisit one to keep the techniques fresh.'}
          </p>
        </section>
      </div>

      <section aria-labelledby="recommended-heading">
        <SectionTitle
          id="recommended-heading"
          title="Recommended next"
          description="Next in the catalogue, skipping labs you have already completed."
          action={<Link to="/labs" className="text-sm font-medium text-brand-700 hover:text-brand-800">View all labs →</Link>}
        />
        {recommended.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recommended.map((module) => {
              const entry = progress.modules[module.id] || {}
              return (
                <article key={module.id} className="card card-hover flex flex-col p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <DifficultyBadge level={module.difficulty} />
                    <Badge>{riskOf(module).code}</Badge>
                    <StatusBadge entry={entry} />
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-ink">{module.name}</h3>
                  <p className="mt-1.5 line-clamp-2 flex-1 text-sm leading-6 text-slate-600">{module.overview}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Icon name="clock" size={13} /> {module.estimated_minutes} min</span>
                    <Link to={`/labs/${module.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
                      {entry.explored ? 'Continue' : 'Start lab'} <Icon name="arrowRight" size={14} />
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon="check"
            title="Every lab is complete"
            body="You have captured every flag and validated every fix. Replay a lab to practise a different approach."
            action={<Link className="btn btn-primary" to="/labs">Review labs</Link>}
          />
        )}
      </section>

      <section aria-labelledby="recent-heading">
        <SectionTitle
          id="recent-heading"
          title="Recently attempted"
          description="The last labs you opened or submitted, newest first."
          action={<Link to="/progress" className="text-sm font-medium text-brand-700 hover:text-brand-800">Full progress →</Link>}
        />
        {recent.length ? (
          <div className="card divide-y divide-line">
            {recent.map(({ module, at, entry }) => (
              <Link key={module.id} to={`/labs/${module.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:px-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 font-mono text-[10px] font-semibold text-slate-500">
                  {riskOf(module).code.replace('LLM', '')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{module.name}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{riskOf(module).name} · {module.difficulty}</span>
                </span>
                <StatusBadge entry={entry} />
                <span className="w-16 text-right text-xs text-slate-400">{when(at)}</span>
                <span className="text-xs text-slate-400">{labPoints(entry)}/{LAB_MAX_POINTS}</span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="labs"
            title="No labs started yet"
            body="Open your first lab and send a payload to the vulnerable target. The dashboard fills in from there."
            action={<Link className="btn btn-primary" to="/labs">Choose a lab</Link>}
          />
        )}
      </section>
    </div>
  )
}
