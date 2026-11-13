import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api.js'
import { useModules } from '../hooks/useModules.js'
import { labStatus, summarize, useProgress } from '../hooks/useProgress.jsx'
import { DIFFICULTIES, riskOf, risksIn } from '../services/labFilters.js'
import { PATHS } from '../content/paths.js'
import { LAB_MAX_POINTS } from '../services/points.js'
import { Badge, Button, ProgressBar as Bar, WakeNotice } from '../components/ui'
import Icon from '../components/Icons.jsx'

const STEPS = [
  ['Read the brief', 'A working feature, its threat model and the code behind it.'],
  ['Exploit the target', 'Send payloads to the vulnerable build, then the secure one.'],
  ['Capture the flag', 'The flag appears only when your attack reaches the secret.'],
  ['Prove the fix', 'Rewrite the function and replay the original attack against it.'],
]

const PRACTICE = [
  {
    title: 'Input and context',
    body: 'Prompt injection, context over-sharing and system prompt leakage — how untrusted text becomes instructions.',
    lab: 'llm01',
  },
  {
    title: 'Retrieval and agents',
    body: 'Poisoned documents, cross-tenant retrieval, tool output injection and confused-deputy agent behaviour.',
    lab: 'llm13',
  },
  {
    title: 'Output and execution',
    body: 'Model output flowing into browsers, SQL, shells and generated code, and the controls that stop it.',
    lab: 'llm22',
  },
]

function useStats() {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    let live = true
    api.stats().then((data) => { if (live) setStats(data) }).catch(() => {})
    return () => { live = false }
  }, [])
  return stats
}

function StatBlock({ value, label, detail }) {
  return (
    <div>
      <p className="text-xl font-semibold tabular-nums tracking-tight text-fg">{value}</p>
      <p className="mt-0.5 text-sm font-medium text-fg-muted">{label}</p>
      {detail && <p className="mt-0.5 text-xs leading-5 text-fg-subtle">{detail}</p>}
    </div>
  )
}

function LabCard({ module, entry }) {
  const status = labStatus(entry)
  return (
    <article className="card card-hover flex flex-col">
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={module.difficulty}>{module.difficulty}</Badge>
          <Badge>{riskOf(module).code}</Badge>
          {status === 'completed' && <Badge tone="success" className="ml-auto">Completed</Badge>}
          {status === 'flag' && <Badge tone="brand" className="ml-auto">Flag captured</Badge>}
        </div>
        <h3 className="mt-3 text-base font-semibold leading-snug">
          <Link to={`/labs/${module.id}`} className="transition-colors hover:text-accent-text">{module.name}</Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 flex-1 text-sm leading-6 text-fg-muted">{module.overview}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-subtle">
          <span className="inline-flex items-center gap-1"><Icon name="clock" size={13} /> {module.estimated_minutes} min</span>
          <span className="inline-flex items-center gap-1"><Icon name="target" size={13} /> {LAB_MAX_POINTS} pts</span>
          <span className="truncate">{riskOf(module).name}</span>
        </div>
      </div>
    </article>
  )
}

export default function Home() {
  const { modules, loading, error, errorKind, reload } = useModules()
  const stats = useStats()
  const progress = useProgress()
  const [level, setLevel] = useState('All')
  const [category, setCategory] = useState('All')

  const risks = useMemo(() => risksIn(modules), [modules])
  const summary = summarize(modules, progress)

  const filtered = useMemo(
    () => modules.filter((module) => (level === 'All' || module.difficulty === level) && (category === 'All' || riskOf(module).code === category)),
    [modules, level, category],
  )

  const labs = stats?.labs ?? modules.length
  const minutes = stats?.minutes ?? modules.reduce((sum, module) => sum + (module.estimated_minutes || 0), 0)

  // The API aggregates difficulty server-side; fall back to the loaded
  // catalogue when /stats has not answered yet. Counting only from `modules`
  // would show zeros whenever the catalogue is still in flight.
  const difficultyCounts = useMemo(() => {
    const local = Object.fromEntries(DIFFICULTIES.map((tier) => [tier, modules.filter((module) => module.difficulty === tier).length]))
    const server = stats?.difficulty
    if (!server) return local
    return Object.fromEntries(DIFFICULTIES.map((tier) => [tier, server[tier] ?? local[tier]]))
  }, [stats, modules])
  const tiers = DIFFICULTIES.filter((tier) => difficultyCounts[tier] > 0)
  const countsReady = tiers.length > 0

  return (
    <div className="space-y-14 pb-4">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-12">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-line bg-accent-tint px-3 py-1 text-xs font-medium text-accent-text">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            OWASP Top 10 for LLM Applications
          </span>

          <h1 className="mt-5 max-w-[34rem] text-display font-semibold sm:text-display-lg">
            Learn LLM security by breaking real applications.
          </h1>

          <p className="mt-4 max-w-[36rem] text-body leading-7 text-fg-muted">
            A hands-on range for developers, students and security engineers. Exploit working vulnerable
            implementations, earn server-validated flags, then write and prove the remediation.
          </p>

          <div className="mt-7 flex flex-col gap-2 sm:flex-row">
            <Button as={Link} to="/labs" variant="primary" size="lg">
              Explore labs
              <Icon name="arrowRight" size={16} />
            </Button>
            <Button as={Link} to="/paths" size="lg" variant="outline">
              Learning paths
            </Button>
          </div>

          <p className="mt-4 text-xs leading-5 text-fg-subtle">
            No simulated scoreboard and no fabricated activity. Every number on this page is read from the running platform.
          </p>
        </div>

        <aside className="card p-5" aria-labelledby="inside-heading">
          <div className="flex items-center justify-between gap-2">
            <h2 id="inside-heading" className="text-xs font-semibold uppercase tracking-[0.1em] text-fg-subtle">Inside every lab</h2>
            <Badge>4 stages</Badge>
          </div>
          <ol className="mt-4 space-y-4">
            {STEPS.map(([title, body], index) => (
              <li key={title} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-accent-line bg-accent-tint font-mono text-xs font-semibold text-accent-text">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">{title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-fg-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-lg border border-line bg-surface-2 px-3 py-2">
            <p className="font-mono text-[11px] leading-5 text-fg-muted">
              <span className="text-accent-text">flag</span> = only_when_attack_reaches_secret()
            </p>
          </div>
        </aside>
      </section>

      <section aria-label="Platform at a glance" className="grid grid-cols-2 gap-x-6 gap-y-6 border-y border-line py-6 sm:grid-cols-4">
        <StatBlock value={labs || '—'} label="hands-on labs" detail="Vulnerable and secure builds" />
        <StatBlock value={stats?.owasp_categories ?? (risks.length || '—')} label="OWASP risk categories" detail="Mapped to the 2025 list" />
        <StatBlock value={minutes ? `${Math.round(minutes / 60)}h` : '—'} label="estimated practice" detail="Sum of authored lab times" />
        <StatBlock value={countsReady ? tiers.length : '—'} label="difficulty tiers" detail={countsReady ? tiers.join(' · ') : 'Loading catalogue'} />
      </section>

      <section aria-labelledby="labs-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="labs-heading" className="text-xl font-semibold">Start where you are</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-muted">
              Each lab is fixed at the difficulty its risk deserves. Beginner labs are guided; harder labs hand you a target and get out of the way.
            </p>
          </div>
          <Link to="/labs" className="text-sm font-medium text-accent-text hover:underline">
            All {labs || ''} labs <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter labs">
          <button type="button" onClick={() => setLevel('All')} className={`chip ${level === 'All' ? 'chip-active' : ''}`} aria-pressed={level === 'All'}>All levels</button>
          {DIFFICULTIES.map((tier) => (
            <button key={tier} type="button" onClick={() => setLevel(tier)} className={`chip ${level === tier ? 'chip-active' : ''}`} aria-pressed={level === tier}>
              {tier}
            </button>
          ))}
          <label className="sr-only" htmlFor="home-risk">OWASP risk</label>
          <select
            id="home-risk"
            className="input ml-auto w-full sm:w-56"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="All">All OWASP risks</option>
            {risks.map((risk) => <option key={risk.code} value={risk.code}>{risk.code} — {risk.name}</option>)}
          </select>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading && !modules.length && [1, 2, 3].map((key) => (
            <div key={key} className="card p-5">
              <div className="skeleton h-5 w-24" />
              <div className="skeleton mt-4 h-5 w-3/4" />
              <div className="skeleton mt-3 h-4 w-full" />
              <div className="skeleton mt-2 h-4 w-5/6" />
            </div>
          ))}
          {filtered.slice(0, 6).map((module) => (
            <LabCard key={module.id} module={module} entry={progress.modules[module.id] || {}} />
          ))}
        </div>
        {loading && !modules.length && <WakeNotice className="mt-3" />}
        {error && (
          <p role="alert" className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-danger-line bg-danger-tint px-4 py-3 text-sm text-danger-text">
            {errorKind === 'timeout' || errorKind === 'unavailable'
              ? 'The backend is still starting up'
              : 'The lab catalogue could not be loaded'} ({error}).
            <button type="button" className="font-medium underline underline-offset-2" onClick={reload}>Try again</button>
          </p>
        )}
        {!loading && !error && modules.length > 0 && filtered.length === 0 && (
          <p className="mt-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-fg-muted">
            No lab matches that combination yet. <button type="button" className="font-medium text-accent-text hover:underline" onClick={() => { setLevel('All'); setCategory('All') }}>Clear the filters</button>.
          </p>
        )}
      </section>

      <section aria-labelledby="paths-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="paths-heading" className="text-xl font-semibold">Learning paths</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-muted">Ordered sequences that build one skill at a time. Progress is counted from the labs you have finished.</p>
          </div>
          <Link to="/paths" className="text-sm font-medium text-accent-text hover:underline">All paths <span aria-hidden>→</span></Link>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {PATHS.filter((path) => path.slug !== 'full-track').slice(0, 3).map((path) => {
            const labsInPath = path.ids.map((id) => modules.find((module) => module.id === id)).filter(Boolean)
            const done = labsInPath.filter((module) => labStatus(progress.modules[module.id] || {}) === 'completed').length
            return (
              <article key={path.slug} className="card card-hover flex flex-col p-5">
                <h3 className="text-base font-semibold leading-snug">
                  <Link to={`/labs?path=${path.slug}`} className="transition-colors hover:text-accent-text">{path.title}</Link>
                </h3>
                <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-6 text-fg-muted">{path.description}</p>
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-fg-subtle">
                    <span>{labsInPath.length} labs</span>
                    <span className="tabular-nums">{done} completed</span>
                  </div>
                  <Bar value={done} max={labsInPath.length || 1} size="sm" label={`${path.title} progress`} />
                </div>
              </article>
            )
          })}
        </div>
        {summary.completed > 0 && (
          <p className="mt-3 text-sm text-fg-muted">
            You have completed <span className="font-medium text-fg">{summary.completed}</span> of {summary.total} labs.
            <Link to="/progress" className="ml-1 font-medium text-accent-text hover:underline">See your progress</Link>.
          </p>
        )}
      </section>

      <section aria-labelledby="coverage-heading" className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12">
        <div>
          <h2 id="coverage-heading" className="text-xl font-semibold">The risks you will learn to defend</h2>
          <p className="mt-2 text-sm leading-6 text-fg-muted">
            The range tracks the OWASP Top 10 for LLM Applications, with several labs on the risks behind most
            production incidents: injection, retrieval integrity, excessive agency and unsafe output handling.
          </p>
          {stats?.learners > 0 && (
            <p className="mt-3 text-sm text-fg-muted">
              <span className="font-medium text-fg">{stats.completions}</span> lab completions recorded across{' '}
              <span className="font-medium text-fg">{stats.learners}</span> learner accounts.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-fg-subtle">
            {DIFFICULTIES.map((tier) => (
              <span key={tier} className="inline-flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${{
                  Beginner: 'bg-success', Intermediate: 'bg-warning', Advanced: 'bg-warning', Expert: 'bg-danger',
                }[tier]}`} aria-hidden />
                {tier}: {countsReady ? difficultyCounts[tier] : '—'}
              </span>
            ))}
          </div>
        </div>

        <ul className="grid gap-x-6 sm:grid-cols-2">
          {risks.map((risk) => (
            <li key={risk.code}>
              <Link
                to={`/labs?category=${risk.code}`}
                className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-sm text-fg-muted transition-colors hover:text-fg"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="font-mono text-xs text-fg-subtle">{risk.code}</span>
                  <span className="truncate">{risk.name}</span>
                </span>
                <span className="shrink-0 text-xs text-fg-subtle">{risk.count} {risk.count === 1 ? 'lab' : 'labs'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="method-heading" className="scroll-mt-24">
        <h2 id="method-heading" className="text-xl font-semibold">Three themes, one method</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {PRACTICE.map((item) => (
            <article key={item.title} className="card p-5">
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-fg-muted">{item.body}</p>
              <Link to={`/labs/${item.lab}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-text hover:underline">
                Try the lab <Icon name="arrowRight" size={14} />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ready to break something?</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-muted">
            Create an account and your flags, validated fixes and rank follow you across devices. Progress starts
            at zero — the first lab is the only shortcut.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button as={Link} to="/signup" variant="primary">Create an account</Button>
          <Button as={Link} to="/login">Sign in</Button>
        </div>
      </section>
    </div>
  )
}
