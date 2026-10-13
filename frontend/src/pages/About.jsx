export default function About() {
  return (
    <div className="max-w-prose space-y-4">
      <h1 className="text-2xl font-semibold">About</h1>
      <p className="text-fog-300">OWASP LLM Learning Lab is a structured, progressive, hands-on environment for developers learning to secure classic (non-agentic) LLM applications. Each module follows one cycle: learn, exploit, understand, fix, validate.</p>
      <p className="text-fog-300">The project is proposed by OWASP Siliguri and developed by the community. It is not an official OWASP project and has not been endorsed or accepted by OWASP. Released under the MIT License.</p>
      <p className="text-fog-300">Everything runs locally. No cloud API key is needed, and the lab never contacts real-world targets.</p>
    </div>
  )
}
