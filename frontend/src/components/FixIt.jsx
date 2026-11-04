import { useState } from 'react'
import { api } from '../services/api.js'
import { useProgress } from '../hooks/useProgress.jsx'
import { useToast } from './Toast.jsx'
import Icon from './Icons.jsx'

export default function FixIt({ module }) {
  const { mark } = useProgress()
  const toast = useToast()
  const [code, setCode] = useState(module.fixit.starter_code)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy || !code.trim()) return
    setBusy(true)
    setError(null)
    try {
      const response = await api.validateFix(module.id, code)
      setResult(response)
      if (response.passed) {
        mark(module.id, 'fixit')
        toast.success('Fix validated against the original attack.')
      }
    } catch (err) {
      setError(err.message)
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setCode(module.fixit.starter_code)
    setResult(null)
    setError(null)
  }

  return (
    <section className="card overflow-hidden" aria-label="Fix-It challenge">
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold text-ink">{module.fixit.title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{module.fixit.brief}</p>
      </header>

      <div className="space-y-3 p-5">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-medium text-ink" htmlFor={`fixit-${module.id}`}>
              Edit <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-brand-400">{module.fixit.function}</code>
            </label>
            <span className="text-xs text-slate-500">{code.split('\n').length} lines</span>
          </div>
          <textarea
            id={`fixit-${module.id}`}
            aria-label={`Fix-It code editor for ${module.fixit.function}`}
            spellCheck={false}
            className="h-72 w-full resize-y rounded-xl border border-ink-700 bg-ink-950 p-4 font-mono text-[12.5px] leading-6 text-slate-100 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">The code is sent only to the lab sandbox for validation. It is not stored or executed on your machine.</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn btn-primary" disabled={busy || !code.trim()} onClick={submit}>
            {busy ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                Validating…
              </>
            ) : (
              <>
                <Icon name="check" size={15} />
                Validate fix
              </>
            )}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={reset}>
            <Icon name="reset" size={14} />
            Reset to vulnerable code
          </button>
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {result && (
          <section aria-label="Validation result" className={`rounded-xl border p-4 ${result.passed ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50/50'}`}>
            <div className="flex items-start gap-2">
              <span className={`mt-0.5 ${result.passed ? 'text-emerald-600' : 'text-red-600'}`}>
                <Icon name={result.passed ? 'check' : 'x'} size={18} />
              </span>
              <div className="min-w-0">
                <p className={`font-medium ${result.passed ? 'text-emerald-900' : 'text-red-900'}`}>
                  {result.passed ? 'Fix validated: the original attack no longer works.' : 'Not fixed yet.'}
                </p>
                {result.summary && <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{result.summary}</p>}
                {result.error && <p className="mt-1 text-sm text-amber-800">{result.error}</p>}
              </div>
            </div>

            {result.tests?.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-line pt-3">
                {[...result.tests].sort((a, b) => Number(a.passed) - Number(b.passed)).map((test) => (
                  <li key={test.name} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 shrink-0 ${test.passed ? 'text-emerald-600' : 'text-red-600'}`}>
                      <Icon name={test.passed ? 'check' : 'x'} size={14} />
                    </span>
                    <span className="text-slate-700">
                      {test.name}
                      {!test.passed && test.detail && <span className="text-slate-500"> — {test.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {result.review && (
              <p className="mt-3 rounded-lg border border-line bg-ink-900 p-3 text-sm text-slate-600">
                <span className="font-medium text-ink">Reviewer note (advisory).</span> {result.review}
              </p>
            )}
          </section>
        )}
      </div>
    </section>
  )
}
