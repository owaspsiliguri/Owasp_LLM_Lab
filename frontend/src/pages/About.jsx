export default function About() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">About</h1>
        <p className="mt-1 max-w-4xl text-fog-300">A structured, progressive, hands-on environment for developers learning to secure classic (non-agentic) LLM applications.</p>
      </header>

      <section className="panel p-5">
        <h2 className="mb-3 text-lg font-semibold">What this is</h2>
        <div className="grid gap-x-10 gap-y-4 text-fog-300 lg:grid-cols-2">
          <p>OWASP LLM Learning Lab is a structured, progressive, hands-on environment for developers learning to secure classic (non-agentic) LLM applications. Each module follows one cycle: learn, exploit, understand, fix, validate.</p>
          <p>Every lab is a real, running application with two implementations side by side. The vulnerable one is what a careless team would ship; the secure one is the same feature written defensively. You attack the first, prove it with a flag, then write the second yourself and prove the remediation with the Fix-It sandbox.</p>
          <p>Flags are never printed in the page: they are derived per installation with HMAC from a server secret, so a flag only exists once an exploit actually reaches the secret sitting in the model's context. Typing “hi” reveals nothing.</p>
          <p>Twelve labs cover the OWASP Top 10 for LLM Applications, each with a fixed difficulty — Beginner labs are fully guided, Intermediate labs keep the walkthrough but hand over no ready-made exploit, Advanced labs give no hints at all. Accounts, progress and the global leaderboard live in your own Supabase project.</p>
        </div>
      </section>

      <section className="panel border-vuln-400/40 p-5">
        <h2 className="mb-2 text-lg font-semibold text-vuln-400">Train only on what you own</h2>
        <p className="max-w-5xl text-sm text-fog-300">This is a deliberately vulnerable training application, proposed by OWASP Siliguri and released under the MIT License. It is not an official OWASP project and has not been endorsed or accepted by OWASP. Run it locally or on your own deployment, and never point these payloads at systems you do not own or have permission to test — every failure here is simulated inside the application, so no real target is ever touched.</p>
      </section>
    </div>
  )
}
