const STEPS = [
  {
    title: 'Create your OWASP account',
    body: 'Every contributor needs a free OWASP account. It takes a minute — name, email, password, confirm.',
    link: 'https://owasp.org/auth/sign-up',
    cta: 'Sign up at owasp.org',
  },
  {
    title: 'Sign in',
    body: 'Return to the OWASP site with your new credentials whenever you contribute, review or register for events.',
    link: 'https://owasp.org/auth/sign-in',
    cta: 'Sign in',
  },
  {
    title: 'Join the OWASP Siliguri chapter',
    body: 'Join our chapter to take part in local meetups, workshops and training nights where this platform is taught.',
    link: 'https://owasp.org/chapters/siliguri',
    cta: 'Join the Siliguri chapter',
  },
  {
    title: 'Follow us on LinkedIn',
    body: 'Chapter announcements, event recaps and call-for-speakers go out here first.',
    link: 'https://www.linkedin.com/company/owasp-siliguri',
    cta: 'Follow OWASP Siliguri',
  },
]

export default function Contribute() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Contribute</h1>
        <p className="mt-2 max-w-4xl text-fog-300">
          This platform is built by the OWASP Siliguri community and open to everyone. Whether you want to write a new lab,
          improve an existing one, fix a bug or just report what confused you — here is exactly how to get involved.
        </p>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-2">
      <section className="panel p-5">
        <h2 className="mb-3 text-lg font-semibold">Join OWASP Siliguri — start here</h2>
        <ol className="space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded border border-neon-line font-mono text-neon">{i + 1}</span>
              <div className="min-w-0">
                <h3 className="font-medium text-fog-100">{s.title}</h3>
                <p className="mt-0.5 text-sm text-fog-300">{s.body}</p>
                <a className="btn btn-primary mt-2" href={s.link} target="_blank" rel="noreferrer noopener">{s.cta} ↗</a>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 rounded border border-ink-700 bg-ink-950 p-3 text-sm text-fog-300">
          Questions at any step? Email <a className="text-neon underline decoration-dotted" href="mailto:owaspsiliguri@gmail.com">owaspsiliguri@gmail.com</a> and a human will help you out.
        </div>
      </section>

      <div className="space-y-6">
      <section className="panel p-5">
        <h2 className="mb-2 text-lg font-semibold">Contribute to this platform</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-fog-300">
          <li>Pick a lab under <strong>Labs</strong> and note what could be clearer: a missing hint, a confusing payload, a typo.</li>
          <li>New lab idea? Each lab maps to one OWASP LLM risk — tell us which risk you want to cover and how the vulnerable app should behave.</li>
          <li>Send your lab, fix or idea to <a className="text-neon underline decoration-dotted" href="mailto:owaspsiliguri@gmail.com">owaspsiliguri@gmail.com</a> or open a pull request on the project repository.</li>
          <li>Every contribution is reviewed for two things: does the vulnerable lab teach the risk honestly, and does the secure lab actually stop the attack?</li>
        </ol>
      </section>

      <section className="panel border-vuln-400/40 p-5">
        <h2 className="mb-2 text-lg font-semibold text-vuln-400">Security issues in this platform</h2>
        <p className="text-sm text-fog-300">
          The labs are <em>meant</em> to be vulnerable — that is the curriculum. The platform around them is not.
          If you find a real flaw in the platform itself (authentication, flag protection, sandbox escape), report it
          privately to <a className="text-neon underline decoration-dotted" href="mailto:owaspsiliguri@gmail.com">owaspsiliguri@gmail.com</a> first, and we will work with you on a fix before anything is disclosed.
        </p>
      </section>
      </div>
      </div>
    </div>
  )
}
