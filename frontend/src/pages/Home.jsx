import { Link } from 'react-router-dom'
import { useModules } from '../hooks/useModules.js'
import { Badge } from '../components/ui.jsx'

const STEPS = [
  ['Learn', 'Read the threat, the code that causes it, and what a correct implementation looks like.'],
  ['Exploit', 'Attack the vulnerable build. When the payload really reaches the secret, the flag appears.'],
  ['Fix', 'Rewrite the vulnerable function yourself — no multiple guess, real code.'],
  ['Prove', 'The Fix-It sandbox replays the original attack against your version and scores it.'],
]

const LEVELS = [
  ['Beginner', 'Fully guided: walkthrough, example payloads and hints on demand.', 'badge-safe'],
  ['Intermediate', 'The mechanism and hints, but no ready-made exploit — you write the attack.', 'badge-warn'],
  ['Advanced', 'No hints, no examples. Capture the flag and pass the fix to finish the lab.', 'badge-vuln'],
]

export default function Home() {
  const { modules } = useModules()

  return (
    <div className="space-y-14 pb-8">
      <section className="relative overflow-hidden rounded-lg border border-ink-700 bg-ink-950/60 px-6 py-12 sm:px-10 sm:py-16">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 15% 0%, rgba(0,255,156,0.18), transparent 50%), radial-gradient(circle at 85% 100%, rgba(56,189,248,0.14), transparent 45%)' }} />
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-neon-line bg-black/40 px-3 py-1 font-mono text-xs text-neon">
            OWASP Siliguri · 12 hands-on labs
          </span>
          <h1 className="mt-5 text-3xl font-semibold leading-tight sm:text-5xl">Break real LLM applications.</h1>
          <p className="mt-3 text-lg text-fog-200 sm:text-xl">Then write the fix that stops you.</p>
          <p className="mt-4 max-w-2xl text-fog-300">
            A deliberately vulnerable range for the OWASP Top 10 for LLM Applications. Prompt injection, data poisoning, excessive agency,
            vector weaknesses — every lab is a running application, every flag has to be earned, and every fix is validated in code.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="btn btn-primary px-5 py-2.5" to="/signup">Create free account</Link>
            <Link className="btn px-5 py-2.5" to="/login">Sign in</Link>
          </div>
          <p className="mt-4 font-mono text-xs text-fog-500">No card · free tiers · progress synced to your account</p>
        </div>
      </section>

      <section aria-label="Platform at a glance" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[['12', 'vulnerable labs'], ['3', 'difficulty tiers'], ['Groq + Gemini', 'real models + LLM judge'], ['Sandboxed', 'Fix-It validation']].map(([v, l]) => (
          <div key={l} className="panel p-4">
            <div className="text-xl font-semibold text-neon">{v}</div>
            <div className="text-sm text-fog-400">{l}</div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-2xl font-semibold">How a lab works</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <div key={t} className="panel p-4">
              <div className="font-mono text-xs text-neon">0{i + 1}</div>
              <h3 className="mt-1 font-medium">{t}</h3>
              <p className="mt-1 text-sm text-fog-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {modules.length > 0 && (
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl font-semibold">The labs</h2>
            <Link className="text-sm text-neon underline decoration-dotted" to="/labs">See the full list →</Link>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((m) => (
              <article key={m.id} className="panel flex flex-col p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={m.difficulty}>{m.difficulty}</Badge>
                  <Badge>{m.owasp_id}</Badge>
                  <span className="font-mono text-xs text-fog-500">{m.estimated_minutes} min</span>
                </div>
                <h3 className="mt-2 font-medium">{m.name}</h3>
                <p className="mt-1 line-clamp-3 text-sm text-fog-400">{m.overview}</p>
                <Link className="btn mt-3 self-start" to={`/labs/${m.id}`}>Open lab</Link>
              </article>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-2xl font-semibold">Difficulty is fixed per lab</h2>
        <p className="mt-1 max-w-3xl text-fog-300">There is no “easy mode” switch: each lab ships at the level its risk deserves, so a badge means something.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {LEVELS.map(([name, d, tone]) => (
            <div key={name} className="panel p-4">
              <Badge tone={tone}>{name}</Badge>
              <p className="mt-2 text-sm text-fog-300">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="text-xl font-semibold">Ready to break something?</h2>
          <p className="mt-1 text-sm text-fog-400">Create an account and your flags, fixes and rank follow you across devices.</p>
        </div>
        <div className="flex gap-3">
          <Link className="btn btn-primary px-5 py-2.5" to="/signup">Create account</Link>
          <Link className="btn px-5 py-2.5" to="/login">Sign in</Link>
        </div>
      </section>
    </div>
  )
}
