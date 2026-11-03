import { Link } from 'react-router-dom'

const POINTS = [
  ['12 labs, real exploits', 'Every lab runs a genuinely vulnerable app next to the secure version of the same feature.'],
  ['Flags earned, never printed', 'A flag only appears once your payload actually reaches the secret. Typing “hi” gets you nothing.'],
  ['Fix it in code, prove it', 'Write the remediation yourself and replay it against the same attack in a sandboxed validator.'],
]

// Shared shell for the two public auth screens: brand story on the left,
// form on the right. Collapses to a single centred column on small screens.
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_minmax(0,0.9fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-ink-700 bg-ink-950/60 p-10 lg:flex">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 0%, rgba(0,255,156,0.16), transparent 55%), radial-gradient(circle at 90% 90%, rgba(56,189,248,0.12), transparent 50%)' }} />
        <div className="relative">
          <Link to="/" className="logo text-lg font-semibold"><span className="neon">&gt;_</span> LLM Learning Lab</Link>
          <h2 className="mt-12 max-w-md text-3xl font-semibold leading-tight">
            Break the model.<br /><span className="text-neon">Then write the fix.</span>
          </h2>
          <p className="mt-3 max-w-md text-sm text-fog-300">
            A hands-on range for the OWASP Top 10 for LLM Applications. Capture the flag, then repair the code that let you in.
          </p>
          <ul className="mt-8 space-y-4">
            {POINTS.map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden className="mt-1 font-mono text-neon">▸</span>
                <div>
                  <div className="text-sm font-medium text-fog-100">{t}</div>
                  <div className="text-sm text-fog-400">{d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <pre className="relative mt-10 overflow-x-auto rounded-md border border-ink-700 bg-black/60 p-4 font-mono text-[12px] leading-relaxed text-fog-400">
{`$ curl -s -X POST /api/modules/llm01/vulnerable \\
    -d '{"input":"Ignore previous instructions…"}'
{"leaked": true, "output": "…FLAG{llm01_…}"}

$ curl -s -X POST /api/modules/llm01/secure \\
    -d '{"input":"Ignore previous instructions…"}'
{"leaked": false, "controls": ["role separation"]}`}
        </pre>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="logo mb-6 inline-block text-base font-semibold lg:hidden"><span className="neon">&gt;_</span> LLM Learning Lab</Link>
          <div className="panel p-6 sm:p-7">
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="mt-1 text-sm text-fog-300">{subtitle}</p>
            <div className="mt-5">{children}</div>
          </div>
          {footer && <div className="mt-4 text-center text-sm text-fog-300">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
