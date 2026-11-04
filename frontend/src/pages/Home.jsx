import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api.js'
import { useModules } from '../hooks/useModules.js'
import { DIFFICULTIES, riskOf, risksIn } from '../services/labFilters.js'
import { Badge, DifficultyBadge } from '../components/ui.jsx'
import Icon from '../components/Icons.jsx'

const STEPS = [
  ['Read the brief', 'A realistic vulnerable feature, its threat model and the code behind it.'],
  ['Exploit the target', 'Send payloads to the vulnerable build and compare it with the secure implementation.'],
  ['Capture the flag', 'A flag appears only when your attack actually reaches the secret. Guessing gets you nothing.'],
  ['Prove the fix', 'Rewrite the vulnerable function and replay the original attack against your code.'],
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
    <div className="border-l border-line pl-4 first:border-l-0 first:pl-0 sm:pl-6">
      <p className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{value}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-700">{label}</p>
      {detail && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}
    </div>
  )
}

export default function Home() {
  const { modules, loading } = useModules()
  const stats = useStats()

  const labs = stats?.labs ?? modules.length
  const risks = stats?.owasp_categories ?? risksIn(modules).length
  const minutes = stats?.minutes ?? modules.reduce((sum, module) => sum + (module.estimated_minutes || 0), 0)
  const featured = ['Beginner', 'Intermediate', 'Advanced']
    .map((level) => modules.find((module) => module.difficulty === level))
    .filter(Boolean)
  const riskList = risksIn(modules)

  return (
    <div className="space-y-12 pb-6 sm:space-y-16">
      <section className="relative overflow-hidden rounded-2xl bg-navy-900 text-white">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 h-[26rem] w-[26rem] rounded-full border border-white/10" />
        <div aria-hidden className="pointer-events-none absolute -right-4 -top-16 h-[26rem] w-[26rem] rounded-full border border-white/5" />

        <div className="relative grid gap-10 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-14 lg:px-12">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
              <Icon name="shield" size={13} />
              OWASP Top 10 for LLM Applications · 2025
            </span>
            <h1 className="mt-5 max-w-2xl text-[clamp(2rem,5vw,3.4rem)] font-semibold leading-[1.08] tracking-tight">
              Learn LLM security by breaking real applications.
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-slate-300 sm:text-base">
              A hands-on range for developers, students and security engineers. Exploit working vulnerable
              implementations, earn server-validated flags, then write and prove the remediation.
            </p>
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <Link to="/labs" className="btn btn-primary btn-lg border-brand-500 bg-brand-500 hover:bg-brand-600">
                Explore labs
                <Icon name="arrowRight" size={16} />
              </Link>
              <a href="#how-it-works" className="btn btn-lg border-white/15 bg-white/5 text-white shadow-none hover:bg-white/10">
                How a lab works
              </a>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">
              No simulated scoreboard. No fabricated activity. Every count on this page comes from the running platform.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-[2px] sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Inside every lab</p>
              <span className="badge border-white/15 bg-white/5 text-slate-300">4 stages</span>
            </div>
            <ol className="mt-4 space-y-4">
              {STEPS.map(([title, body], index) => (
                <li key={title} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/15 bg-navy-950 font-mono text-xs text-slate-300">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-400">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-5 rounded-lg border border-white/10 bg-navy-950/60 px-3 py-2.5">
              <p className="font-mono text-[11px] leading-5 text-slate-400">
                <span className="text-slate-500">$</span> flag = only_when_attack_reaches_secret()
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Platform at a glance" className="grid grid-cols-2 gap-x-6 gap-y-8 border-y border-line py-7 sm:grid-cols-4 sm:gap-x-0">
        <StatBlock value={labs || '—'} label="hands-on labs" detail="Each with a vulnerable and secure build" />
        <StatBlock value={risks || '—'} label="OWASP risk categories" detail="Mapped to the 2025 list" />
        <StatBlock value={minutes ? `${Math.round(minutes / 60)}h` : '—'} label="estimated practice" detail="Sum of the authored lab times" />
        <StatBlock
          value={DIFFICULTIES.filter((level) => modules.some((module) => module.difficulty === level)).length || '—'}
          label="difficulty tiers"
          detail={modules.length ? DIFFICULTIES.filter((level) => modules.some((module) => module.difficulty === level)).join(' · ') : 'Loading catalogue'}
        />
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">Featured challenges</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">Start where you are</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Each lab is fixed at the difficulty its risk deserves. Beginner labs are guided; harder labs hand you a target and get out of the way.
            </p>
          </div>
          <Link to="/labs" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            All {labs || ''} labs <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {loading && !featured.length && [0, 1, 2].map((key) => (
            <div key={key} className="card h-64 animate-pulse p-5">
              <div className="h-5 w-24 rounded bg-slate-200" />
              <div className="mt-4 h-6 w-3/4 rounded bg-slate-200" />
              <div className="mt-3 h-4 w-full rounded bg-slate-200" />
              <div className="mt-2 h-4 w-5/6 rounded bg-slate-200" />
            </div>
          ))}
          {featured.map((module) => (
            <article key={module.id} className="card card-hover flex flex-col p-5">
              <div className="flex flex-wrap items-center gap-2">
                <DifficultyBadge level={module.difficulty} />
                <Badge>{riskOf(module).code}</Badge>
                <span className="ml-auto flex items-center gap-1 text-xs text-slate-500">
                  <Icon name="clock" size={13} /> {module.estimated_minutes} min
                </span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-ink">{module.name}</h3>
              <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-6 text-slate-600">{module.overview}</p>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <span className="text-xs text-slate-500">{riskOf(module).name}</span>
                <Link to={`/labs/${module.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
                  Open lab <Icon name="arrowRight" size={14} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">Coverage</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">The risks you will learn to defend</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The range tracks the OWASP Top 10 for LLM Applications, with several labs on the risks that show up most
              often in production incidents: injection, retrieval integrity, excessive agency and unsafe output handling.
            </p>
            {stats?.learners > 0 && (
              <p className="mt-3 text-sm text-slate-500">
                <span className="font-medium text-ink">{stats.completions}</span> lab completions recorded across{' '}
                <span className="font-medium text-ink">{stats.learners}</span> learner accounts.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
              {DIFFICULTIES.map((level) => (
                <span key={level} className="inline-flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${{
                    Beginner: 'bg-emerald-500', Intermediate: 'bg-amber-500', Advanced: 'bg-orange-500', Expert: 'bg-red-500',
                  }[level]}`} aria-hidden />
                  {level}: {modules.filter((module) => module.difficulty === level).length}
                </span>
              ))}
            </div>
          </div>

          <ul className="grid gap-x-6 gap-y-0 sm:grid-cols-2">
            {riskList.map((risk) => (
              <li key={risk.code}>
                <Link
                  to={`/labs?category=${risk.code}`}
                  className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-sm text-slate-600 transition-colors hover:text-ink"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">{risk.code}</span>
                    <span className="truncate">{risk.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{risk.count} {risk.count === 1 ? 'lab' : 'labs'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">Practical, not theoretical</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">Three themes, one method</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {PRACTICE.map((item) => (
            <article key={item.title} className="card p-5">
              <h3 className="text-base font-semibold text-ink">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">{item.body}</p>
              <Link to={`/labs/${item.lab}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
                Try the lab <Icon name="arrowRight" size={14} />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 className="text-xl font-semibold text-ink">Ready to break something?</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Create an account and your flags, validated fixes and rank follow you across devices. Progress starts
            at zero — the first lab is the only shortcut.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Link to="/signup" className="btn btn-primary">Create an account</Link>
          <Link to="/login" className="btn">Sign in</Link>
        </div>
      </section>
    </div>
  )
}
