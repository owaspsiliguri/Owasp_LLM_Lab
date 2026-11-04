import { Link } from 'react-router-dom'
import { useModules } from '../hooks/useModules.js'
import { risksIn } from '../services/labFilters.js'
import { PageHeader } from '../components/ui.jsx'
import Icon from '../components/Icons.jsx'

const PRINCIPLES = [
  ['Real code, both sides', 'Every lab ships a vulnerable implementation and the secure version of the same feature. The code shown in the lab is the code the server runs.'],
  ['Flags are evidence', 'A flag is derived per installation from a server secret. It is returned only when an exploit reaches the secret inside the target; a benign message reveals nothing.'],
  ['Fixes are tested', 'Fix-It runs the original attack and a set of regression checks against the code you write. Passing requires both security and correct behaviour for legitimate input.'],
  ['Local by design', 'All targets are simulated inside this application. No lab touches a third-party service, sends real email or spends real money.'],
]

export default function About() {
  const { modules } = useModules()
  const risks = risksIn(modules)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="About"
        title="A practical range for LLM application security"
        description="OWASP LLM Lab is a hands-on training environment for developers, students and security engineers who need to understand how LLM features fail — and how to make them fail safely."
        actions={<Link to="/labs" className="btn btn-primary">Explore labs</Link>}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <section className="card p-5 sm:p-6">
          <h2 className="text-base font-semibold text-ink">What this is</h2>
          <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
            <p>
              Each lab is a small, deliberately vulnerable application with a realistic scenario and a single security
              failure. You read the brief, attack the running target, compare it with the secure implementation, capture a
              server-validated flag and then write the remediation yourself.
            </p>
            <p>
              The catalogue covers the OWASP Top 10 for LLM Applications, including the failure modes that matter in
              production: direct and indirect prompt injection, unsafe retrieval, tool and agent authorisation,
              persistent memory, multimodal input and generated-code execution.
            </p>
            <p>
              Difficulty is fixed per lab. Beginner labs include a guided walkthrough and example payloads; Intermediate
              labs keep the brief but remove the ready-made exploit; Advanced and Expert labs require both the flag and a
              passing fix before the lab counts as complete.
            </p>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="text-base font-semibold text-ink">Scope at a glance</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-slate-500">Labs in the catalogue</dt>
              <dd className="font-semibold text-ink">{modules.length || '—'}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-slate-500">OWASP risk categories</dt>
              <dd className="font-semibold text-ink">{risks.length || '—'}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-slate-500">Estimated practice</dt>
              <dd className="font-semibold text-ink">
                {modules.length ? `${Math.round(modules.reduce((sum, module) => sum + module.estimated_minutes, 0) / 60)} hours` : '—'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-slate-500">Flag validation</dt>
              <dd className="font-semibold text-ink">Server-side</dd>
            </div>
          </dl>
          <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-xs text-slate-500">
            {risks.map((risk) => (
              <li key={risk.code} className="flex justify-between gap-2">
                <span>{risk.code} {risk.name}</span>
                <span>{risk.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-ink">How the platform is built</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {PRINCIPLES.map(([title, body]) => (
            <article key={title} className="card p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Icon name="check" size={15} className="text-brand-600" />
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-amber-900">
          <Icon name="alert" size={17} />
          Train only on what you own
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-amber-900/90">
          This is a deliberately vulnerable training application. Run it locally or on a deployment you control, and never
          point these payloads at systems you do not own or have permission to test. Every failure here is simulated
          inside the application; no real target, mailbox or payment provider is touched.
        </p>
        <p className="mt-2 text-xs leading-5 text-amber-800">
          Proposed by OWASP Siliguri and released under the MIT License. Not an official OWASP project and not endorsed by OWASP.
        </p>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-base font-semibold text-ink">Credits and further reading</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          The taxonomy follows the OWASP Top 10 for LLM Applications. The lab engine, vulnerable targets and Fix-It
          sandbox are built by the OWASP Siliguri community. Contributions that add a risk, sharpen an explanation or
          prove a remediation are welcome.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="btn btn-sm" href="https://genai.owasp.org/llm-top-10/" target="_blank" rel="noreferrer noopener">
            OWASP Top 10 for LLMs <Icon name="external" size={13} />
          </a>
          <Link className="btn btn-sm" to="/contribute">Contribute</Link>
          <a className="btn btn-sm" href="https://owasp.org/chapters/siliguri" target="_blank" rel="noreferrer noopener">
            OWASP Siliguri <Icon name="external" size={13} />
          </a>
        </div>
      </section>
    </div>
  )
}
