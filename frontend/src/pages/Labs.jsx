import { useDeferredValue, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useModules } from '../hooks/useModules.js'
import { labStatus, useProgress } from '../hooks/useProgress.jsx'
import { DIFFICULTIES, STATUS_FILTERS, filterModules, filterQuery, riskOf, risksIn } from '../services/labFilters.js'
import { LAB_MAX_POINTS, labPoints } from '../services/points.js'
import { Badge, DifficultyBadge, EmptyState, Loading, PageHeader, ProgressBar } from '../components/ui'
import Icon from '../components/Icons.jsx'

const STATUS_BADGE = {
  completed: ['Completed', 'badge-success'],
  flag: ['Flag captured', 'badge-brand'],
  'in-progress': ['In progress', 'badge-neutral'],
  'not-started': ['Not started', 'badge-neutral'],
}

function CardSkeleton() {
  return (
    <div className="card h-[19rem] animate-pulse p-5">
      <div className="flex gap-2"><div className="h-5 w-20 rounded bg-slate-200" /><div className="h-5 w-14 rounded bg-slate-200" /></div>
      <div className="mt-4 h-5 w-4/5 rounded bg-slate-200" />
      <div className="mt-3 h-4 w-full rounded bg-slate-200" />
      <div className="mt-2 h-4 w-11/12 rounded bg-slate-200" />
      <div className="mt-2 h-4 w-2/3 rounded bg-slate-200" />
      <div className="mt-6 h-2 w-full rounded bg-slate-200" />
    </div>
  )
}

export default function Labs() {
  const { modules, loading, error, reload } = useModules()
  const progress = useProgress()
  const [searchParams, setSearchParams] = useSearchParams()

  const queryKey = searchParams.toString()
  const filters = useMemo(() => {
    const params = new URLSearchParams(queryKey)
    return {
      q: params.get('q') || '',
      level: params.get('level') || 'All',
      category: params.get('category') || 'All',
      status: params.get('status') || 'all',
    }
  }, [queryKey])

  const deferredQuery = useDeferredValue(filters.q)
  const visible = useMemo(
    () => filterModules(modules, { ...filters, q: deferredQuery }, progress),
    [modules, filters.level, filters.category, filters.status, deferredQuery, progress],
  )
  const risks = useMemo(() => risksIn(modules), [modules])
  const active = Boolean(filters.q) || filters.level !== 'All' || filters.category !== 'All' || filters.status !== 'all'

  function update(key, value) {
    const next = new URLSearchParams(queryKey)
    const fallback = { level: 'All', category: 'All', status: 'all' }[key]
    if (!value || value === fallback) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  const actions = active ? (
    <button type="button" className="btn" onClick={() => setSearchParams({}, { replace: true })}>
      <Icon name="reset" size={14} />
      Clear filters
    </button>
  ) : null

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Explorer"
        title="Labs"
        description="Every lab is a working application with a vulnerable build, a secure build, a server-validated flag and a remediation the sandbox will test. Filter by what you want to learn or what you have left to finish."
        actions={actions}
      />

      <section aria-label="Filter labs" className="card p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_9.5rem_13rem_11rem]">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500" htmlFor="lab-search">Search</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-slate-400">
                <Icon name="search" size={16} />
              </span>
              <input
                id="lab-search"
                type="search"
                className="input pl-9"
                value={filters.q}
                onChange={(event) => update('q', event.target.value)}
                placeholder="Name, risk, technique…"
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500" htmlFor="lab-level">Difficulty</label>
            <select id="lab-level" className="input" value={filters.level} onChange={(event) => update('level', event.target.value)}>
              <option value="All">All levels</option>
              {DIFFICULTIES.map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500" htmlFor="lab-category">OWASP risk</label>
            <select id="lab-category" className="input" value={filters.category} onChange={(event) => update('category', event.target.value)}>
              <option value="All">All risks</option>
              {risks.map((risk) => <option key={risk.code} value={risk.code}>{risk.code} — {risk.name}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500" htmlFor="lab-status">Status</label>
            <select id="lab-status" className="input" value={filters.status} onChange={(event) => update('status', event.target.value)}>
              {STATUS_FILTERS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-slate-500">
          <p aria-live="polite">
            Showing <span className="font-medium text-slate-700">{visible.length}</span> of {modules.length} labs
            {filters.q && <> for “{filters.q}”</>}.
          </p>
          <p>{progress ? `${Object.values(progress.modules).filter((entry) => entry.flag && entry.fixit).length} completed on this account` : ''}</p>
        </div>
      </section>

      {loading && !modules.length && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((key) => <CardSkeleton key={key} />)}
        </div>
      )}
      {error && <Loading error={error} onRetry={reload} />}

      {!loading && !error && visible.length === 0 && (
        <EmptyState
          icon="search"
          title="No labs match these filters"
          body="Try a broader search or clear one of the filters. Every lab is still in the catalogue."
          action={active ? <button className="btn btn-primary" type="button" onClick={() => setSearchParams({}, { replace: true })}>Clear filters</button> : null}
        />
      )}

      {visible.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((module) => {
            const entry = progress.modules[module.id] || {}
            const status = labStatus(entry)
            const [statusLabel, statusClass] = STATUS_BADGE[status]
            const earned = labPoints(entry)
            const to = `/labs/${module.id}${filterQuery(filters)}`
            return (
              <article key={module.id} className="card card-hover flex flex-col">
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <DifficultyBadge level={module.difficulty} />
                    <Badge>{riskOf(module).code}</Badge>
                    <span className={`badge ml-auto ${statusClass}`}>{statusLabel}</span>
                  </div>

                  <h2 className="mt-3 text-base font-semibold leading-snug text-ink">
                    <Link to={to} className="hover:text-brand-700">{module.name}</Link>
                  </h2>
                  <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-slate-600">{module.overview}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Icon name="clock" size={13} /> {module.estimated_minutes} min</span>
                    <span className="inline-flex items-center gap-1"><Icon name="target" size={13} /> {LAB_MAX_POINTS} pts</span>
                    <span className="truncate">{riskOf(module).name}</span>
                  </div>

                  <div className="mt-auto pt-4">
                    <ProgressBar value={earned} max={LAB_MAX_POINTS} size="sm" label={`${module.name} points`} />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-line px-5 py-3">
                  <span className="text-xs text-slate-500">{earned} / {LAB_MAX_POINTS} pts</span>
                  <Link className={`btn btn-sm ${status === 'completed' ? '' : 'btn-primary'}`} to={to}>
                    {status === 'completed' ? 'Review lab' : entry.explored ? 'Continue' : 'Open lab'}
                    <Icon name="arrowRight" size={13} />
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
