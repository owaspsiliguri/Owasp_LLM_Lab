export default function Contribute() {
  const steps = ['Read CONTRIBUTING.md and docs/Module_Development.md.', 'Copy an existing module, implement the VulnerabilityModule contract and register it.', 'Add a Fix-It specification with deterministic tests, plus backend and security-regression tests.', 'Open a pull request; CI runs lint, tests, security tests, Docker builds and dependency scans.']
  return (
    <div className="max-w-prose space-y-4">
      <h1 className="text-2xl font-semibold">Contribute</h1>
      <ol className="list-decimal space-y-2 pl-5 text-fog-300">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
      <p className="text-fog-300">Report security issues in the platform itself privately, following SECURITY.md.</p>
    </div>
  )
}
