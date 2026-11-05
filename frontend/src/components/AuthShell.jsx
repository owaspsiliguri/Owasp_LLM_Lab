import { Link } from 'react-router-dom'
import Icon from './Icons.jsx'

const POINTS = [
  ['Real vulnerable targets', 'Every lab runs a working vulnerable implementation next to the secure version of the same feature.'],
  ['Flags you have to earn', 'A flag appears only when your payload actually reaches the secret. A benign message reveals nothing.'],
  ['Fixes validated in code', 'Write the remediation yourself and replay the original attack against it in a sandbox.'],
]

function Logo({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 rounded ${className}`}>
      <span className="logo grid h-9 w-9 place-items-center rounded-lg border border-accent-line bg-accent-tint text-[13px] font-bold text-accent-text">
        &gt;_
      </span>
      <span className="leading-tight">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">OWASP</span>
        <span className="block font-mono text-sm font-semibold text-fg">LLM Lab</span>
      </span>
    </span>
  )
}

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-surface px-10 py-10 lg:flex lg:flex-col lg:justify-between xl:px-14">
        <Link to="/" className="w-fit"><Logo /></Link>

        <div className="my-10 max-w-md">
          <span className="badge badge-brand">Hands-on LLM security</span>
          <h2 className="mt-5 text-display-sm font-semibold">
            Break the application.<br />Then prove the fix.
          </h2>
          <p className="mt-4 text-sm leading-6 text-fg-muted">
            A practical training range for the OWASP Top 10 for LLM Applications. Every challenge is a running
            target, every flag is server-validated, and every remediation is tested against the original attack.
          </p>
          <ul className="mt-8 space-y-4">
            {POINTS.map(([point, detail]) => (
              <li key={point} className="flex gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-accent-line bg-accent-tint text-accent-text">
                  <Icon name="check" size={13} strokeWidth={2.4} />
                </span>
                <div>
                  <p className="text-sm font-medium text-fg">{point}</p>
                  <p className="mt-0.5 text-sm leading-6 text-fg-muted">{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs leading-5 text-fg-subtle">
          Training environment only. Do not use these techniques against systems you do not own or have permission to test.
        </p>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[26rem]">
          <Link to="/" className="mb-6 inline-flex lg:hidden"><Logo /></Link>

          <div className="card p-6 sm:p-7">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm leading-6 text-fg-muted">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>

          {footer && <div className="mt-5 text-center text-sm text-fg-muted">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
