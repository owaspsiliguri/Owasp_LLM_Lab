import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../services/api.js'
import { useModules } from '../hooks/useModules.js'
import { labStatus, useProgress } from '../hooks/useProgress.jsx'
import { DIFFICULTIES, filterQuery, riskOf, sequenceFor } from '../services/labFilters.js'
import { PATHS } from '../content/paths.js'
import { LAB_MAX_POINTS, POINT_ROWS, labPoints } from '../services/points.js'
import { Badge, CodeBlock, DifficultyBadge, EmptyState, Loading } from '../components/ui.jsx'
import Markdown from '../components/Markdown.jsx'
import RunPanel from '../components/RunPanel.jsx'
import FixIt from '../components/FixIt.jsx'
import FlagForm from '../components/FlagForm.jsx'
import Icon from '../components/Icons.jsx'
import { GUIDES } from '../content/guides.js'

const TABS = [
  ['challenge', 'Challenge'],
  ['background', 'Background'],
  ['fixit', 'Fix-It'],
  ['code', 'Code'],
  ['guide', 'Guide'],
]

const STATUS = {
  completed: ['Completed', 'badge-success'],
  flag: ['Flag captured', 'badge-brand'],
  'in-progress': ['In progress', 'badge-neutral'],
  'not-started': ['Not started', 'badge-neutral'],
}

const detailCache = new Map()
const detailInflight = new Map()

function peekDetail(id) {
  return detailCache.get(id) || null
}

function loadDetail(id, force = false) {
  if (force) {
    detailCache.delete(id)
    detailInflight.delete(id)
  }
  if (detailCache.has(id)) return Promise.resolve(detailCache.get(id))
  if (detailInflight.has(id)) return detailInflight.get(id)
  const request = api.module(id)
    .then((data) => {
      detailCache.set(id, data)
      detailInflight.delete(id)
      return data
    })
    .catch((error) => {
      detailInflight.delete(id)
      throw error
    })
  detailInflight.set(id, request)
  return request
}

function ReadList({ items, ordered = false }) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-1.5 pl-5 text-sm leading-6 text-slate-600`}>
      {items.map((item) => <li key={item}>{item}</li>)}
    </Tag>
  )
}

function Hints({ module }) {
  const [hints, setHints] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!module.hints_available) {
    return (
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Icon name="lightbulb" size={16} /> Hints</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This lab has no hints. The target and the brief are everything you get — work the mechanism out from the response.
        </p>
      </section>
    )
  }

  async function reveal() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.hint(module.id, hints.length + 1)
      setHints((current) => [...current, result.hint])
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const total = module.hint_count
  const exhausted = hints.length >= total

  return (
    <section className="card p-5" aria-labelledby={`hints-${module.id}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={`hints-${module.id}`} className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Icon name="lightbulb" size={16} /> Hints
        </h2>
        <span className="text-xs text-slate-500">{hints.length} of {total} revealed</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">Hints unlock one at a time and never reduce your score.</p>

      {hints.length > 0 && (
        <ol className="mt-3 space-y-2" aria-live="polite">
          {hints.map((hint, index) => (
            <li key={hint} className="flex gap-2.5 rounded-lg border border-line bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[11px] font-medium text-slate-500 ring-1 ring-line">{index + 1}</span>
              <span>{hint}</span>
            </li>
          ))}
        </ol>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

      <button type="button" className="btn btn-sm mt-3" onClick={reveal} disabled={busy || exhausted || total === 0}>
        {exhausted ? 'No more hints' : busy ? 'Revealing…' : `Reveal hint ${hints.length + 1} of ${total}`}
      </button>
    </section>
  )
}

function Scoring({ entry }) {
  const earned = labPoints(entry)
  return (
    <section className="card p-5" aria-labelledby="scoring-heading">
      <div className="flex items-center justify-between">
        <h2 id="scoring-heading" className="text-sm font-semibold text-ink">Scoring</h2>
        <span className="text-sm font-medium text-ink">{earned} <span className="font-normal text-slate-400">/ {LAB_MAX_POINTS}</span></span>
      </div>
      <ul className="mt-3 space-y-2">
        {POINT_ROWS.map(({ field, label, points }) => {
          const done = Boolean(entry[field])
          return (
            <li key={field} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <span className={`grid h-4 w-4 place-items-center rounded-full ${done ? 'bg-emerald-600 text-white' : 'border border-slate-300 text-transparent'}`}>
                  <Icon name="check" size={10} strokeWidth={3} />
                </span>
                <span className={done ? 'text-slate-700' : 'text-slate-500'}>{label}</span>
              </span>
              <span className={done ? 'font-medium text-emerald-700' : 'text-slate-400'}>+{points}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function TabPanel({ tab, module, entry, backTo }) {
  if (tab === 'background') {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <h2 className="text-base font-semibold text-ink">Threat model</h2>
          <dl className="mt-3 space-y-4 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">OWASP mapping</dt>
              <dd className="mt-0.5 text-slate-700">{module.category}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Threat</dt>
              <dd className="mt-0.5 leading-6 text-slate-600">{module.threat}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Impact if exploited</dt>
              <dd className="mt-0.5 leading-6 text-slate-600">{module.impact}</dd>
            </div>
          </dl>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="text-base font-semibold text-ink">Mitigation</h2>
          <div className="mt-3"><ReadList items={module.mitigation} /></div>
          <p className="mt-4 border-t border-line pt-4 text-sm leading-6 text-slate-600">{module.remediation}</p>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="text-base font-semibold text-ink">Before you start</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{module.expected_outcome}</p>
          {module.prerequisites.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {module.prerequisites.map((item) => <li key={item}><Badge>{item}</Badge></li>)}
            </ul>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="text-base font-semibold text-ink">This lab</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div><dt className="text-xs text-slate-400">Difficulty</dt><dd className="mt-0.5 text-slate-700">{module.difficulty}</dd></div>
            <div><dt className="text-xs text-slate-400">Estimated time</dt><dd className="mt-0.5 text-slate-700">{module.estimated_minutes} minutes</dd></div>
            <div><dt className="text-xs text-slate-400">Points available</dt><dd className="mt-0.5 text-slate-700">{LAB_MAX_POINTS}</dd></div>
            <div><dt className="text-xs text-slate-400">Format</dt><dd className="mt-0.5 text-slate-700">Self-paced, browser-based</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="btn btn-sm" to={backTo}>{backTo === '/paths' ? 'Back to path' : 'All labs'}</Link>
            {module.difficulty === 'Beginner' && module.guided_steps?.length > 0 && (
              <span className="self-center text-xs text-slate-500">A guided walkthrough is included on the challenge tab.</span>
            )}
          </div>
        </section>
      </div>
    )
  }

  if (tab === 'fixit') {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-white p-5">
          <h2 className="text-base font-semibold text-ink">Fix the vulnerability, not the test</h2>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
            The sandbox replays the original attack against your implementation and runs regression checks so a shortcut
            that breaks legitimate input does not pass. Every check is deterministic and runs server-side.
            {['Advanced', 'Expert'].includes(module.difficulty) && ' This level requires both the flag and a passing fix to count as complete.'}
          </p>
        </div>
        <FixIt module={module} />
      </div>
    )
  }

  if (tab === 'code') {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-6 text-slate-600">
          Both implementations are live source served by the API. Compare what the vulnerable build trusts with what the secure build validates.
        </p>
        <div className="grid gap-4 xl:grid-cols-2">
          <CodeBlock tone="vuln" label="Vulnerable implementation" code={module.vulnerable_code} />
          <CodeBlock tone="safe" label="Secure implementation" code={module.secure_code} />
        </div>
      </div>
    )
  }

  if (tab === 'guide') {
    const guide = GUIDES[module.id]
    return guide ? (
      <article className="card max-w-4xl p-5 sm:p-7">
        <Markdown source={guide} />
      </article>
    ) : (
      <EmptyState icon="book" title="No guide compiled for this lab" body="The challenge tab still contains the full brief, and the backend source is on the Code tab." />
    )
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] xl:items-start">
      <section className="card p-5 sm:p-6 xl:col-start-1 xl:row-start-1">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">Scenario</p>
        <p className="mt-1.5 text-[15px] leading-7 text-slate-600">{module.overview}</p>

        <div className="mt-5 rounded-lg border border-line bg-slate-50 p-4">
          <h2 className="text-sm font-semibold text-ink">Your objective</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{module.challenge}</p>
        </div>

        <h2 className="mt-5 text-sm font-semibold text-ink">Learning objectives</h2>
        <div className="mt-2"><ReadList items={module.objectives} /></div>

        {module.difficulty === 'Beginner' && module.guided_steps?.length > 0 && (
          <>
            <h2 className="mt-5 text-sm font-semibold text-ink">Suggested approach</h2>
            <div className="mt-2"><ReadList ordered items={module.guided_steps} /></div>
          </>
        )}

        <p className="mt-5 border-t border-line pt-4 text-sm leading-6 text-slate-500">
          <span className="font-medium text-slate-700">Expected outcome:</span> {module.expected_outcome}
        </p>
      </section>

      <div className="min-w-0 xl:col-start-2 xl:row-start-1">
        <RunPanel module={module} />
      </div>

      <div className="space-y-4 xl:col-start-1 xl:row-start-2">
        <Hints module={module} />
        <Scoring entry={entry} />
      </div>

      <section className="card p-5 sm:p-6 xl:col-start-2 xl:row-start-2" aria-labelledby="flag-heading">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="flag-heading" className="text-base font-semibold text-ink">Submit the flag</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{module.challenge}</p>
          </div>
          <Badge tone={entry.flag ? 'success' : 'neutral'}>{entry.flag ? 'Captured' : 'Not captured'}</Badge>
        </div>
        <div className="mt-4">
          <FlagForm module={module} />
        </div>
        <p className="mt-4 border-t border-line pt-3 text-xs leading-5 text-slate-500">
          The flag is checked against the server-side secret and is never included in the page or API catalogue.
        </p>
      </section>
    </div>
  )
}

function LabSequence({ prev, next, position, total, linkFor }) {
  const base = 'flex min-h-[52px] min-w-0 items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-left'
  return (
    <nav aria-label="Lab navigation" className="grid grid-cols-2 gap-2 border-t border-line pt-5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3">
      {prev ? (
        <Link to={linkFor(prev)} className={`${base} transition-colors hover:border-slate-300 hover:bg-slate-50`} rel="prev">
          <Icon name="chevronLeft" size={16} className="shrink-0 text-slate-400" />
          <span className="min-w-0">
            <span className="block text-[11px] text-slate-400">Previous</span>
            <span className="block truncate text-sm font-medium text-ink">{prev.name}</span>
          </span>
        </Link>
      ) : (
        <span aria-disabled="true" className={`${base} border-dashed text-slate-400 opacity-70`}>
          <Icon name="chevronLeft" size={16} className="shrink-0" />
          <span className="min-w-0">
            <span className="block text-[11px]">Previous</span>
            <span className="block truncate text-sm">Start of this sequence</span>
          </span>
        </span>
      )}

      <span className="hidden whitespace-nowrap px-2 text-xs text-slate-500 sm:block">
        {position > 0 ? `Lab ${position} of ${total}` : `${total} labs`}
      </span>

      {next ? (
        <Link to={linkFor(next)} className={`${base} justify-end text-right transition-colors hover:border-slate-300 hover:bg-slate-50`} rel="next">
          <span className="min-w-0">
            <span className="block text-[11px] text-slate-400">Next</span>
            <span className="block truncate text-sm font-medium text-ink">{next.name}</span>
          </span>
          <Icon name="chevronRight" size={16} className="shrink-0 text-slate-400" />
        </Link>
      ) : (
        <span aria-disabled="true" className={`${base} justify-end border-dashed text-right text-slate-400 opacity-70`}>
          <span className="min-w-0">
            <span className="block text-[11px]">Next</span>
            <span className="block truncate text-sm">Last lab in this sequence</span>
          </span>
          <Icon name="chevronRight" size={16} className="shrink-0" />
        </span>
      )}
    </nav>
  )
}

export default function Lab() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { modules, loading: modulesLoading, error: modulesError, reload } = useModules()
  const progress = useProgress()
  const progressRef = useRef(progress)
  progressRef.current = progress

  const [detail, setDetail] = useState(() => peekDetail(id))
  const [detailError, setDetailError] = useState(null)
  const [tab, setTab] = useState('challenge')
  const tabRefs = useRef([])

  const queryKey = searchParams.toString()
  const filters = useMemo(() => {
    const params = new URLSearchParams(queryKey)
    return {
      q: params.get('q') || '',
      level: params.get('level') || 'All',
      category: params.get('category') || 'All',
      status: params.get('status') || 'all',
      path: params.get('path') || '',
    }
  }, [queryKey])

  const known = !modules.length || modules.some((module) => module.id === id)

  useEffect(() => {
    if (!known) return undefined
    let live = true
    setDetail(peekDetail(id))
    setDetailError(null)
    setTab('challenge')
    loadDetail(id)
      .then((data) => { if (live) setDetail(data) })
      .catch((error) => { if (live) setDetailError(error) })
    return () => { live = false }
  }, [id, known])

  const sequence = useMemo(() => {
    if (!modules.length) return []
    return sequenceFor(modules, filters, progressRef.current, PATHS)
  }, [modules, filters, id])

  const effective = sequence.some((module) => module.id === id) ? sequence : modules
  const index = effective.findIndex((module) => module.id === id)
  const position = index >= 0 ? index + 1 : 0
  const prev = index > 0 ? effective[index - 1] : null
  const next = index >= 0 && index < effective.length - 1 ? effective[index + 1] : null
  const backTo = filters.path ? '/paths' : `/labs${filterQuery({ ...filters, path: '' })}`
  const linkFor = (module) => `/labs/${module.id}${filterQuery(filters)}`
  const selectedPath = PATHS.find((path) => path.slug === filters.path)

  useEffect(() => {
    if (!detail) return undefined
    const previous = document.title
    document.title = `${detail.name} · OWASP LLM Lab`
    return () => { document.title = previous }
  }, [detail])

  if (modulesError) return <Loading error={modulesError} onRetry={reload} />
  if (modulesLoading && !modules.length) return <Loading>Loading the lab catalogue…</Loading>
  if (!known) {
    return (
      <EmptyState
        icon="search"
        title="Lab not found"
        body={`There is no lab with the id "${id}". The catalogue lists every available challenge.`}
        action={<Link className="btn btn-primary" to="/labs">Browse labs</Link>}
      />
    )
  }
  if (detailError) {
    if (detailError.status === 404) {
      return (
        <EmptyState
          icon="search"
          title="Lab not found"
          body="This lab is no longer in the catalogue. Its detail endpoint returned 404."
          action={<Link className="btn btn-primary" to="/labs">Browse labs</Link>}
        />
      )
    }
    return (
      <div className="space-y-3">
        <Loading error={detailError.message} />
        <button
          type="button"
          className="btn"
          onClick={() => {
            setDetailError(null)
            loadDetail(id, true).then(setDetail).catch(setDetailError)
          }}
        >
          Try again
        </button>
      </div>
    )
  }
  if (!detail) return <Loading>Loading the lab…</Loading>

  const module = detail
  const entry = progress.modules[id] || {}
  const [statusLabel, statusClass] = STATUS[labStatus(entry)]
  const risk = riskOf(module)

  function onTabKey(event, tabIndex) {
    let target = null
    if (event.key === 'ArrowRight') target = (tabIndex + 1) % TABS.length
    else if (event.key === 'ArrowLeft') target = (tabIndex - 1 + TABS.length) % TABS.length
    else if (event.key === 'Home') target = 0
    else if (event.key === 'End') target = TABS.length - 1
    if (target === null) return
    event.preventDefault()
    setTab(TABS[target][0])
    tabRefs.current[target]?.focus()
  }

  return (
    <div className="space-y-5">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          {position > 0 && <Badge tone="brand">Lab {position} of {effective.length}</Badge>}
          <DifficultyBadge level={module.difficulty} />
          <Badge>{module.owasp_id}</Badge>
          <Badge><Icon name="clock" size={12} /> {module.estimated_minutes} min</Badge>
          <Badge><Icon name="target" size={12} /> {LAB_MAX_POINTS} pts</Badge>
          <span className={`badge ${statusClass}`}>{statusLabel}</span>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[30px]">{module.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {risk.code} · {risk.name}
              {selectedPath && <> · <span className="text-slate-600">{selectedPath.title}</span></>}
            </p>
          </div>
          <Link to={backTo} className="btn btn-sm shrink-0">
            <Icon name="arrowLeft" size={14} />
            {filters.path ? 'Back to path' : 'All labs'}
          </Link>
        </div>
      </header>

      <div role="tablist" aria-label="Lab sections" className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([key, label], tabIndex) => (
          <button
            key={key}
            ref={(element) => { tabRefs.current[tabIndex] = element }}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            onKeyDown={(event) => onTabKey(event, tabIndex)}
            className={`tab ${tab === key ? 'tab-active' : ''}`}
          >
            {label}
            {key === 'fixit' && entry.fixit && <Icon name="check" size={13} className="text-emerald-600" />}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        <TabPanel tab={tab} module={module} entry={entry} backTo={backTo} />
      </div>

      <LabSequence prev={prev} next={next} position={position} total={effective.length} linkFor={linkFor} />
    </div>
  )
}
