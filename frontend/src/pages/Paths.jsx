import { Link } from 'react-router-dom'
import { useModules } from '../hooks/useModules.js'
import { useProgress } from '../hooks/useProgress.jsx'
import { PATHS } from '../content/paths.js'
import { riskOf } from '../services/labFilters.js'
import { Badge, DifficultyBadge, EmptyState, Loading, PageHeader, ProgressBar } from '../components/ui'
import Icon from '../components/Icons.jsx'

export default function Paths() {
  const { modules, loading, error, errorKind, reload } = useModules()
  const { modules: progress } = useProgress()

  if (loading || error) return <Loading error={error} errorKind={errorKind} onRetry={reload} />

  const byId = new Map(modules.map((module) => [module.id, module]))
  const done = (id) => Boolean(progress[id]?.flag && progress[id]?.fixit)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Guided tracks"
        title="Learning paths"
        description="Curated sequences through the catalogue. Each path builds one theme end-to-end: understand the failure, exploit it, then write the fix. A lab counts when its flag and its fix are both done."
      />

      {!modules.length && (
        <EmptyState icon="paths" title="The catalogue is empty" body="The backend returned no labs, so there are no paths to assemble yet." />
      )}

      <div className="space-y-5">
        {PATHS.map((path) => {
          const labs = path.ids.map((id) => byId.get(id)).filter(Boolean)
          if (!labs.length) return null
          const complete = labs.filter((module) => done(module.id)).length
          const minutes = labs.reduce((sum, module) => sum + (module.estimated_minutes || 0), 0)
          const next = labs.find((module) => !done(module.id)) || labs[0]
          const percent = Math.round((complete / labs.length) * 100)
          const started = labs.some((module) => progress[module.id]?.explored || progress[module.id]?.flag || progress[module.id]?.fixit)

          return (
            <section key={path.slug} className="card overflow-hidden" aria-labelledby={`path-${path.slug}`}>
              <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id={`path-${path.slug}`} className="text-lg font-semibold text-ink">{path.title}</h2>
                    {complete === labs.length && <Badge tone="success">Complete</Badge>}
                  </div>
                  <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">{path.description}</p>

                  <div className="mt-4 max-w-xl">
                    <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                      <span>{complete} of {labs.length} labs complete</span>
                      <span>{minutes} min total</span>
                    </div>
                    <ProgressBar value={percent} label={`${path.title} progress`} />
                  </div>

                  <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Labs in this track</h3>
                  <ol className="mt-2 divide-y divide-line">
                    {labs.map((module, index) => {
                      const completeLab = done(module.id)
                      return (
                        <li key={module.id}>
                          <Link
                            to={`/labs/${module.id}?path=${path.slug}`}
                            className="group flex items-center gap-3 py-2.5 text-sm"
                          >
                            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-medium ${completeLab ? 'bg-emerald-600 text-ink-950' : 'border border-line text-slate-400'}`}>
                              {completeLab ? <Icon name="check" size={11} strokeWidth={3} /> : index + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-ink group-hover:text-brand-700">{module.name}</span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                                <span>{riskOf(module).code}</span>
                                <span>·</span>
                                <span>{module.difficulty}</span>
                                <span>·</span>
                                <span>{module.estimated_minutes} min</span>
                              </span>
                            </span>
                            <Icon name="chevronRight" size={15} className="shrink-0 text-slate-300 group-hover:text-slate-500" />
                          </Link>
                        </li>
                      )
                    })}
                  </ol>
                </div>

                <div className="flex flex-col gap-4 rounded-xl border border-line bg-slate-50 p-4 sm:p-5">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">What you will learn</h3>
                    <ul className="mt-2 space-y-2">
                      {path.learns.map((item) => (
                        <li key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
                          <Icon name="check" size={14} className="mt-1 shrink-0 text-brand-600" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-auto border-t border-line pt-4">
                    <p className="text-xs text-slate-500">{complete === labs.length ? 'Track complete.' : started ? 'Next up' : 'Start here'}</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-ink">{next.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <DifficultyBadge level={next.difficulty} />
                      <span className="text-xs text-slate-500">{next.estimated_minutes} min</span>
                    </div>
                    <Link className="btn btn-primary mt-3 w-full sm:w-auto" to={`/labs/${next.id}?path=${path.slug}`}>
                      {complete === labs.length ? 'Review the track' : started ? 'Continue path' : 'Start path'}
                      <Icon name="arrowRight" size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
