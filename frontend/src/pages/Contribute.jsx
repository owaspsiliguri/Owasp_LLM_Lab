import { PageHeader } from '../components/ui.jsx'
import Icon from '../components/Icons.jsx'

const STEPS = [
  {
    title: 'Create your OWASP account',
    body: 'Every contributor needs a free OWASP account. It takes a minute: name, email, password, confirm.',
    link: 'https://owasp.org/auth/sign-up',
    cta: 'Sign up at owasp.org',
  },
  {
    title: 'Join the OWASP Siliguri chapter',
    body: 'Take part in local meetups, workshops and training nights where this platform is taught.',
    link: 'https://owasp.org/chapters/siliguri',
    cta: 'Join the chapter',
  },
  {
    title: 'Follow chapter announcements',
    body: 'Event recaps and call-for-speakers go out here first.',
    link: 'https://www.linkedin.com/company/owasp-siliguri',
    cta: 'Follow OWASP Siliguri',
  },
]

const REVIEWED = [
  'The vulnerable build honestly demonstrates the risk, and the exploit is reproducible from the brief.',
  'The secure build actually stops the original attack without breaking legitimate input.',
  'The flag is server-derived and never appears in page source, API responses or configuration.',
  'Hints teach the mechanism instead of handing over a payload, and the remediation is testable.',
]

export default function Contribute() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Community"
        title="Contribute"
        description="This platform is built by the OWASP Siliguri community and open to everyone. Write a lab, sharpen an explanation, fix a bug or report what confused you."
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="card p-5 sm:p-6">
          <h2 className="text-base font-semibold text-ink">Join the chapter</h2>
          <ol className="mt-4 space-y-5">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-slate-50 text-sm font-medium text-slate-600">{index + 1}</span>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-ink">{step.title}</h3>
                  <p className="mt-0.5 text-sm leading-6 text-slate-600">{step.body}</p>
                  <a className="btn btn-sm mt-2" href={step.link} target="_blank" rel="noreferrer noopener">
                    {step.cta} <Icon name="external" size={12} />
                  </a>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 rounded-lg border border-line bg-slate-50 p-3 text-sm text-slate-600">
            Questions at any step? Email{' '}
            <a className="font-medium text-brand-700 underline decoration-brand-500/50 underline-offset-2" href="mailto:owaspsiliguri@gmail.com">owaspsiliguri@gmail.com</a>
            {' '}and a human will help.
          </p>
        </section>

        <div className="space-y-5">
          <section className="card p-5 sm:p-6">
            <h2 className="text-base font-semibold text-ink">Contribute to the platform</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600">
              <li>Open a lab and note what could be clearer: a missing hint, a confusing payload, a typo.</li>
              <li>
                Have a new lab idea? Pick one OWASP LLM risk and describe the vulnerable application, the exploit and
                the secure implementation. One risk per lab; do not re-title an existing challenge.
              </li>
              <li>
                Send it to{' '}
                <a className="font-medium text-brand-700 underline decoration-brand-500/50 underline-offset-2" href="mailto:owaspsiliguri@gmail.com">owaspsiliguri@gmail.com</a>
                {' '}or open a pull request against the project repository.
              </li>
            </ol>
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="text-base font-semibold text-ink">What review checks</h2>
            <ul className="mt-3 space-y-2">
              {REVIEWED.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
                  <Icon name="check" size={14} className="mt-1 shrink-0 text-brand-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-ink-900 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Icon name="shield" size={17} className="text-slate-500" />
          Security issues in the platform itself
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
          The labs are meant to be vulnerable; the platform around them is not. If you find a real flaw in authentication,
          flag protection, progress isolation or the code sandbox, report it privately to{' '}
          <a className="font-medium text-brand-700 underline decoration-brand-500/50 underline-offset-2" href="mailto:owaspsiliguri@gmail.com">owaspsiliguri@gmail.com</a>
          {' '}first. We will work with you on a fix before anything is disclosed.
        </p>
      </section>
    </div>
  )
}
