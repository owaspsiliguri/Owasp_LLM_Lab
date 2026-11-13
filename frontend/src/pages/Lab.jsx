import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../services/api.js'
import { useModules } from '../hooks/useModules.js'
import { labStatus, useProgress } from '../hooks/useProgress.jsx'
import { filterQuery, riskOf, sequenceFor } from '../services/labFilters.js'
import { PATHS, courseSlugFor } from '../content/paths.js'
import { LAB_MAX_POINTS, POINT_ROWS, labPoints } from '../services/points.js'
import { Badge, Button, CodeBlock, CodeDiff, EmptyState, Loading, ProgressBar, Tabs } from '../components/ui'
import Markdown from '../components/Markdown.jsx'
import RunPanel, { useRun } from '../components/RunPanel.jsx'
import FixIt from '../components/FixIt.jsx'
import FlagForm from '../components/FlagForm.jsx'
import Icon from '../components/Icons.jsx'
import { GUIDES } from '../content/guides.js'

const TABS = [
  { value: 'challenge', label: 'Challenge' },
  { value: 'background', label: 'Background' },
  { value: 'fixit', label: 'Fix-It' },
  { value: 'code', label: 'Code' },
  { value: 'guide', label: 'Guide' },
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
    <Tag className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-1.5 pl-5 text-sm leading-6 text-fg-muted marker:text-fg-subtle`}>
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
      <section className="card p-4" aria-labelledby={`hints-${module.id}`}>
        <h2 id={`hints-${module.id}`} className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Icon name="lightbulb" size={15} className="text-fg-muted" /> Hints
        </h2>
        <p className="mt-1.5 text-xs leading-5 text-fg-muted">
          This lab has no hints. The brief and the target are everything you get — work the mechanism out from the response.
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
    <section className="card p-4" aria-labelledby={`hints-${module.id}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={`hints-${module.id}`} className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Icon name="lightbulb" size={15} className="text-fg-muted" /> Hints
        </h2>
        <span className="text-xs tabular-nums text-fg-subtle">{hints.length}/{total}</span>
      </div>

      {hints.length > 0 && (
        <ol className="mt-2.5 space-y-2" aria-live="polite">
          {hints.map((hint, index) => (
            <li key={hint} className="flex gap-2 rounded-md border border-line bg-surface-2 p-2.5 text-xs leading-5 text-fg-muted">
              <span className="font-mono text-[11px] font-medium text-accent-text">{index + 1}</span>
              <span>{hint}</span>
            </li>
          ))}
        </ol>
      )}

      {error && <p role="alert" className="mt-2 text-xs text-danger-text">{error}</p>}

      <Button size="sm" className="mt-2.5 w-full" onClick={reveal} disabled={busy || exhausted || total === 0} loading={busy}>
        {exhausted ? 'No more hints' : `Reveal hint ${hints.length + 1} of ${total}`}
      </Button>
    </section>
  )
}

function Scoring({ entry }) {
  const earned = labPoints(entry)
  return (
    <section className="card p-4" aria-labelledby="scoring-heading">
      <div className="flex items-center justify-between">
        <h2 id="scoring-heading" className="text-sm font-semibold text-fg">Scoring</h2>
        <span className="text-sm tabular-nums text-fg">
          <span className="font-semibold">{earned}</span>
          <span className="text-fg-subtle"> / {LAB_MAX_POINTS}</span>
        </span>
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {POINT_ROWS.map(({ field, label, points }) => {
          const done = Boolean(entry[field])
          return (
            <li key={field} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${done ? 'border-success bg-success text-[color:rgb(var(--accent-contrast))]' : 'border-line-strong text-transparent'}`}
                  aria-hidden
                >
                  <Icon name="check" size={9} strokeWidth={3} />
                </span>
                <span className={done ? 'text-fg' : 'text-fg-muted'}>{label}</span>
              </span>
              <span className={`shrink-0 tabular-nums ${done ? 'font-medium text-success-text' : 'text-fg-subtle'}`}>
                {points === 0 ? 'Free' : `+${points}`}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function CodeTab({ module }) {
  const [view, setView] = useState('split')
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-reading text-sm leading-6 text-fg-muted">
          Both implementations are live source served by the API. Compare what the vulnerable build trusts with what the secure build validates.
        </p>
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5" role="group" aria-label="Code view">
          <button type="button" onClick={() => setView('split')} aria-pressed={view === 'split'} className={`tab ${view === 'split' ? 'tab-active' : ''}`}>Side by side</button>
          <button type="button" onClick={() => setView('diff')} aria-pressed={view === 'diff'} className={`tab ${view === 'diff' ? 'tab-active' : ''}`}>Diff</button>
        </div>
      </div>

      {view === 'split' ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <CodeBlock tone="vuln" label="Vulnerable implementation" code={module.vulnerable_code} />
          <CodeBlock tone="safe" label="Secure implementation" code={module.secure_code} />
        </div>
      ) : (
        <CodeDiff before={module.vulnerable_code} after={module.secure_code} />
      )}
    </div>
  )
}

function BackgroundTab({ module, backTo }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-fg">Threat model</h2>
        <dl className="mt-3 space-y-3.5 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-fg-subtle">OWASP mapping</dt>
            <dd className="mt-0.5 text-fg">{module.category}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Threat</dt>
            <dd className="mt-0.5 leading-6 text-fg-muted">{module.threat}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Impact if exploited</dt>
            <dd className="mt-0.5 leading-6 text-fg-muted">{module.impact}</dd>
          </div>
        </dl>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-fg">Mitigation</h2>
        <div className="mt-3"><ReadList items={module.mitigation} /></div>
        <p className="mt-3 border-t border-line pt-3 text-sm leading-6 text-fg-muted">{module.remediation}</p>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-fg">Before you start</h2>
        <p className="mt-2 text-sm leading-6 text-fg-muted">{module.expected_outcome}</p>
        {module.prerequisites.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {module.prerequisites.map((item) => <li key={item}><Badge>{item}</Badge></li>)}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-fg">This lab</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div><dt className="text-xs text-fg-subtle">Difficulty</dt><dd className="mt-0.5 text-fg">{module.difficulty}</dd></div>
          <div><dt className="text-xs text-fg-subtle">Estimated time</dt><dd className="mt-0.5 text-fg">{module.estimated_minutes} minutes</dd></div>
          <div><dt className="text-xs text-fg-subtle">Points available</dt><dd className="mt-0.5 text-fg">{LAB_MAX_POINTS}</dd></div>
          <div><dt className="text-xs text-fg-subtle">Format</dt><dd className="mt-0.5 text-fg">Self-paced, browser-based</dd></div>
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button as={Link} to={backTo} size="sm">{backTo === '/paths' ? 'Back to path' : 'All labs'}</Button>
          {module.difficulty === 'Beginner' && module.guided_steps?.length > 0 && (
            <span className="text-xs text-fg-subtle">A guided walkthrough is on the Challenge tab.</span>
          )}
        </div>
      </section>
    </div>
  )
}

function ChallengeTab({ module, entry, runner, onOpenFixIt }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
      {/* Mobile reading order: scenario, objective and instructions, then the
          live target, then the explanation of the flaw and its remediation. */}
      <div className="order-1 min-w-0 space-y-4 xl:col-start-1 xl:row-start-1">
        <section className="card p-5" aria-labelledby="scenario-heading">
          <h2 id="scenario-heading" className="text-xs font-semibold uppercase tracking-[0.1em] text-fg-subtle">Scenario</h2>
          <p className="mt-1.5 text-[15px] leading-7 text-fg-muted">{module.overview}</p>
          <div className="mt-4 rounded-lg border border-line bg-surface-2 p-3.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
              <Icon name="target" size={15} className="text-fg-muted" />
              Objective
            </h3>
            <p className="mt-1 text-sm leading-6 text-fg-muted">{module.challenge}</p>
          </div>
        </section>

        <section className="card p-5" aria-labelledby="instructions-heading">
          <h2 id="instructions-heading" className="text-sm font-semibold text-fg">Instructions</h2>
          {module.guided_steps?.length > 0 ? (
            <div className="mt-2"><ReadList ordered items={module.guided_steps} /></div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-fg-muted">
              Read the scenario, then use the target to test the mechanism. Every reply is the real lab response.
            </p>
          )}
          <p className="mt-4 border-t border-line pt-3 text-sm leading-6 text-fg-subtle">
            Choose the <span className="font-medium text-fg-muted">vulnerable build</span> to exploit the flaw, then send the
            same input to the <span className="font-medium text-fg-muted">secure build</span> to confirm the control blocks it.
            Enter sends; Shift+Enter adds a line.
          </p>

          <h3 className="mt-4 text-sm font-semibold text-fg">Learning objectives</h3>
          <div className="mt-2"><ReadList items={module.objectives} /></div>
        </section>
      </div>

      <aside className="order-2 min-w-0 space-y-4 xl:sticky xl:top-[7rem] xl:col-start-2 xl:row-span-2 xl:row-start-1">
        <RunPanel module={module} runner={runner} />

        <section className="card p-4" aria-labelledby="flag-heading">
          <div className="flex items-start justify-between gap-2">
            <h2 id="flag-heading" className="text-sm font-semibold text-fg">Submit the flag</h2>
            <Badge tone={entry.flag ? 'success' : 'neutral'}>{entry.flag ? 'Captured' : 'Not captured'}</Badge>
          </div>
          <div className="mt-3">
            <FlagForm module={module} disabled={Boolean(entry.flag)} suggestion={runner.capturedFlag} />
          </div>
          {entry.flag && (
            <p className="mt-2 text-xs leading-5 text-success-text">This flag is already recorded on your account.</p>
          )}
        </section>

        <Hints module={module} />
        <Scoring entry={entry} />
      </aside>

      <div className="order-3 grid min-w-0 gap-4 lg:grid-cols-2 xl:col-start-1 xl:row-start-2">
        <section className="card p-5" aria-labelledby="explanation-heading">
          <h2 id="explanation-heading" className="text-sm font-semibold text-fg">Explanation</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Why it works</dt>
              <dd className="mt-0.5 leading-6 text-fg-muted">{module.threat}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Impact if exploited</dt>
              <dd className="mt-0.5 leading-6 text-fg-muted">{module.impact}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-fg-subtle">What a successful run proves</dt>
              <dd className="mt-0.5 leading-6 text-fg-muted">{module.expected_outcome}</dd>
            </div>
          </dl>
        </section>

        <section className="card p-5" aria-labelledby="remediation-heading">
          <h2 id="remediation-heading" className="text-sm font-semibold text-fg">Remediation</h2>
          <p className="mt-2 text-sm leading-6 text-fg-muted">{module.remediation}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <Button size="sm" onClick={onOpenFixIt}>Practise the fix</Button>
            <span className="text-xs text-fg-subtle">Replay the original attack against your own patch in Fix-It.</span>
          </div>
        </section>
      </div>
    </div>
  )
}

function SequenceCard({ direction, module, linkFor }) {
  const isPrev = direction === 'prev'
  const label = isPrev ? 'Previous' : 'Next'
  const chevron = (
    <Icon
      name={isPrev ? 'chevronLeft' : 'chevronRight'}
      size={16}
      className={`shrink-0 text-fg-subtle transition-transform duration-150 ${
        module ? (isPrev ? 'group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5') : ''
      }`}
    />
  )

  const text = (
    <span className="min-w-0 flex-1">
      <span className="block text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{label}</span>
      <span className={`mt-0.5 block truncate text-sm font-medium ${module ? 'text-fg' : 'text-fg-muted'}`}>
        {module ? module.name : isPrev ? 'First lab in this sequence' : 'Last lab in this sequence'}
      </span>
    </span>
  )

  const badge = module ? (
    <span className="hidden shrink-0 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-subtle sm:block">
      {riskOf(module).code}
    </span>
  ) : null

  if (!module) {
    return (
      <span
        aria-disabled="true"
        className="flex min-h-[3.25rem] min-w-0 items-center gap-3 rounded-lg border border-dashed border-line px-3 py-2.5"
      >
        {isPrev ? chevron : null}
        {text}
        {isPrev ? null : chevron}
      </span>
    )
  }

  const content = isPrev ? <>{chevron}{text}{badge}</> : <>{text}{badge}{chevron}</>

  return (
    <Link
      to={linkFor(module)}
      rel={isPrev ? 'prev' : 'next'}
      className="group flex min-h-[3.25rem] min-w-0 items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      {content}
    </Link>
  )
}

function LabSequence({ prev, next, position, total, linkFor }) {
  return (
    <nav
      aria-label="Lab navigation"
      className="grid grid-cols-2 gap-2 border-t border-line pt-5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3"
    >
      <SequenceCard direction="prev" module={prev} linkFor={linkFor} />

      <span className="hidden whitespace-nowrap px-2 text-xs tabular-nums text-fg-subtle sm:block">
        {position > 0 ? `Lab ${position} of ${total}` : `${total} labs`}
      </span>

      <SequenceCard direction="next" module={next} linkFor={linkFor} />
    </nav>
  )
}

export default function Lab() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { modules, loading: modulesLoading, error: modulesError, errorKind: modulesErrorKind, reload } = useModules()
  const progress = useProgress()
  const progressRef = useRef(progress)
  progressRef.current = progress

  const [detail, setDetail] = useState(() => peekDetail(id))
  const [detailError, setDetailError] = useState(null)
  const [tab, setTab] = useState('challenge')

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

  const module = detail
  const runner = useRun(module)

  useEffect(() => {
    if (!detail) return undefined
    const previous = document.title
    document.title = `${detail.name} · OWASP LLM Lab`
    return () => { document.title = previous }
  }, [detail])

  if (modulesError) return <Loading error={modulesError} errorKind={modulesErrorKind} onRetry={reload} />
  if (modulesLoading && !modules.length) return <Loading>Loading the lab catalogue…</Loading>
  if (!known) {
    return (
      <EmptyState
        icon="search"
        title="Lab not found"
        body={`There is no lab with the id "${id}". The catalogue lists every available challenge.`}
        action={<Button as={Link} to="/labs" variant="primary">Browse labs</Button>}
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
          action={<Button as={Link} to="/labs" variant="primary">Browse labs</Button>}
        />
      )
    }
    return (
      <div className="space-y-3">
        <Loading error={detailError.message} errorKind={detailError.kind} />
        <Button
          onClick={() => {
            setDetailError(null)
            loadDetail(id, true).then(setDetail).catch(setDetailError)
          }}
        >
          Try again
        </Button>
      </div>
    )
  }
  if (!module) return <Loading>Loading the lab…</Loading>

  const entry = progress.modules[id] || {}
  const [statusLabel, statusClass] = STATUS[labStatus(entry)]
  const risk = riskOf(module)
  const earned = labPoints(entry)

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="badge badge-neutral font-mono">{risk.code}</span>
          <Badge tone={module.difficulty}>{module.difficulty}</Badge>
          <Badge><Icon name="clock" size={12} /> {module.estimated_minutes} min</Badge>
          <Badge><Icon name="target" size={12} /> {LAB_MAX_POINTS} pts</Badge>
          <span className={`badge ${statusClass}`}>{statusLabel}</span>
          <Link
            to={`/courses/${courseSlugFor(module.id)}`}
            className="badge badge-neutral transition-colors hover:text-accent-text"
            aria-label={`${module.name} companion course`}
          >
            <Icon name="book" size={12} /> Companion course
          </Link>
          {position > 0 && <span className="text-xs text-fg-subtle">Lab {position} of {effective.length}</span>}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-display-sm font-semibold">{module.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-fg-muted">
              <span className="font-mono text-xs text-fg-subtle">{risk.code}</span>
              <span aria-hidden>·</span>
              <span>{risk.name}</span>
              {selectedPath && (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-fg-subtle">{selectedPath.title}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
            <div className="w-36">
              <ProgressBar value={earned} max={LAB_MAX_POINTS} size="sm" label={`${earned} of ${LAB_MAX_POINTS} points`} showValue />
            </div>
            <Button as={Link} to={backTo} size="sm">
              <Icon name="arrowLeft" size={13} />
              {filters.path ? 'Back to path' : 'All labs'}
            </Button>
          </div>
        </div>
      </header>

      <div className="sticky top-14 z-20 -mx-4 border-b border-line bg-canvas/95 px-4 py-1.5 backdrop-blur sm:-mx-6 sm:px-6">
        <Tabs tabs={TABS.map((item) => ({ ...item, done: item.value === 'fixit' && entry.fixit }))} value={tab} onChange={setTab} label="Lab sections" />
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-w-0">
        {tab === 'challenge' && <ChallengeTab module={module} entry={entry} runner={runner} onOpenFixIt={() => setTab('fixit')} />}
        {tab === 'background' && <BackgroundTab module={module} backTo={backTo} />}
        {tab === 'fixit' && (
          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-fg">Fix the vulnerability, not the test</h2>
              <p className="mt-1.5 max-w-reading text-sm leading-6 text-fg-muted">
                The sandbox replays the original attack against your implementation and runs regression checks so a shortcut
                that breaks legitimate input does not pass. Every check is deterministic and runs server-side.
                {['Advanced', 'Expert'].includes(module.difficulty) && ' This level requires both the flag and a passing fix to count as complete.'}
              </p>
            </div>
            <FixIt module={module} />
          </div>
        )}
        {tab === 'code' && <CodeTab module={module} />}
        {tab === 'guide' && (
          GUIDES[module.id] ? (
            <article className="card max-w-reading p-5 sm:p-6">
              <Markdown source={GUIDES[module.id]} />
            </article>
          ) : (
            <EmptyState icon="book" title="No guide compiled for this lab" body="The Challenge tab still contains the full brief, and the backend source is on the Code tab." />
          )
        )}
      </div>

      <LabSequence prev={prev} next={next} position={position} total={effective.length} linkFor={linkFor} />
    </div>
  )
}
