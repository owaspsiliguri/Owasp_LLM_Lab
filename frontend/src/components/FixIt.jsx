import { useState } from 'react'
import { api } from '../services/api.js'
import { useProgress } from '../hooks/useProgress.jsx'

export default function FixIt({ module }) {
  const { mark } = useProgress()
  const [code, setCode] = useState(module.fixit.starter_code)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true); setError(null)
    try {
      const r = await api.validateFix(module.id, code)
      setResult(r)
      if (r.passed) mark(module.id, 'fixit')
    } catch (e) { setError(e.message); setResult(null) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-medium">{module.fixit.title}</h3>
      <p className="text-fog-300">{module.fixit.brief}</p>
      <label className="block text-sm text-fog-300">Edit function <code>{module.fixit.function}</code>
        <textarea aria-label="Fix-It code editor" spellCheck={false} className="input mt-1 h-64" value={code} onChange={(e) => setCode(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Validating…' : 'Validate fix'}</button>
        <button className="btn" onClick={() => { setCode(module.fixit.starter_code); setResult(null) }}>Reset to vulnerable code</button>
      </div>
      {error && <p role="alert" className="text-vuln-400">{error}</p>}
      {result && (
        <section aria-label="Validation result" className="panel p-3">
          <p className={result.passed ? 'font-medium text-safe-400' : 'font-medium text-vuln-400'}>{result.passed ? 'Fix validated: the vulnerability is mitigated.' : 'Not fixed yet.'}</p>
          {result.error && <p className="mt-1 text-warn-400">{result.error}</p>}
          <ul className="mt-2 space-y-1 text-sm">
            {result.tests.map((t) => (
              <li key={t.name} className={t.passed ? 'text-safe-400' : 'text-vuln-400'}>
                {t.passed ? 'Pass' : 'Fail'}: {t.name}{!t.passed && t.detail ? ` (${t.detail})` : ''}
              </li>
            ))}
          </ul>
          {result.review && (
            <p aria-label="LLM judge review" className="mt-3 rounded border border-steel-400/40 bg-ink-950 p-2 text-sm text-fog-300">
              <span className="font-medium text-steel-400">Instructor review (LLM judge):</span> {result.review}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
