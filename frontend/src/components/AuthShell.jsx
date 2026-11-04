import { Link } from 'react-router-dom'
import Icon from './Icons.jsx'

const POINTS = [
  ['Real vulnerable targets', 'Every lab runs a working vulnerable implementation next to the secure version of the same feature.'],
  ['Flags you have to earn', 'A flag appears only when your payload actually reaches the secret. A benign message reveals nothing.'],
  ['Fixes validated in code', 'Write the remediation yourself and replay the original attack against it in a sandbox.'],
]

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-mist lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-navy-900 px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10"
        />
        <div aria-hidden className="pointer-events-none absolute -right-10 top-10 h-72 w-72 rounded-full border border-white/5" />

        <Link to="/" className="relative inline-flex w-fit items-center gap-2.5 rounded focus-visible:outline-white">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600"><Icon name="shield" size={19} /></span>
          <span className="leading-tight">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">OWASP</span>
            <span className="block text-sm font-semibold">LLM Lab</span>
          </span>
        </Link>

        <div className="relative my-10 max-w-md">
          <span className="badge border-white/15 bg-white/5 text-slate-200">Hands-on LLM security</span>
          <h2 className="mt-5 text-3xl font-semibold leading-tight xl:text-4xl">
            Break the application.<br />Then prove the fix.
          </h2>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            A practical training range for the OWASP Top 10 for LLM Applications. Every challenge is a running
            target, every flag is server-validated, and every remediation is tested against the original attack.
          </p>
          <ul className="mt-8 space-y-4">
            {POINTS.map(([point, detail]) => (
              <li key={point} className="flex gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-slate-200">
                  <Icon name="check" size={13} />
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{point}</p>
                  <p className="mt-0.5 text-sm leading-6 text-slate-400">{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs leading-5 text-slate-500">
          Training environment only. Do not use these techniques against systems you do not own or have permission to test.
        </p>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[26rem]">
          <Link to="/" className="mb-6 inline-flex items-center gap-2.5 rounded lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy-900 text-white"><Icon name="shield" size={18} /></span>
            <span className="text-sm font-semibold text-ink">OWASP LLM Lab</span>
          </Link>

          <div className="card p-6 sm:p-8">
            <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm leading-6 text-slate-600">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>

          {footer && <div className="mt-5 text-center text-sm text-slate-600">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
