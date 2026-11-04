import { useState } from 'react'
import { api } from '../services/api.js'
import { useProgress } from '../hooks/useProgress.jsx'
import { CodeBlock } from './ui.jsx'
import Icon from './Icons.jsx'

function Timeline({ timeline }) {
  const { values, limit, label } = timeline
  const top = Math.max(limit || 0, ...values, 0.0001)
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 300},${70 - (value / top) * 66}`).join(' ')
  const limitY = limit ? 70 - (limit / top) * 66 : null
  return (
    <figure className="rounded-lg border border-line bg-white p-3">
      <figcaption className="mb-1 text-xs text-slate-500">
        {label}: final {values[values.length - 1]?.toLocaleString()}{limit ? ` (limit ${limit})` : ''}
      </figcaption>
      <svg role="img" aria-label={label} viewBox="0 0 300 72" className="h-20 w-full">
        {limitY !== null && <line x1="0" x2="300" y1={limitY} y2={limitY} stroke="#b45309" strokeDasharray="4 3" strokeWidth="1" />}
        <polyline points={points} fill="none" stroke="#1d4ed8" strokeWidth="2" />
      </svg>
    </figure>
  )
}

function DataTable({ label, rows }) {
  if (!rows?.length) return null
  const columns = Object.keys(rows[0])
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table aria-label={label} className="w-full min-w-[26rem] text-left text-xs">
        <caption className="border-b border-line bg-slate-50 px-3 py-2 text-left font-medium text-slate-600">{label}</caption>
        <thead className="bg-white text-slate-500">
          <tr>{columns.map((column) => <th key={column} scope="col" className="px-3 py-1.5 font-normal">{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-line">
              {columns.map((column) => (
                <td key={column} className="px-3 py-1.5 font-mono text-slate-700">
                  {typeof row[column] === 'object' && row[column] !== null ? JSON.stringify(row[column]) : String(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function asText(value) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function Result({ title, tone, data, error }) {
  const leaked = Boolean(data?.leaked)
  return (
    <section aria-label={`${title} result`} className="min-w-0 rounded-xl border border-line bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
          <span className={`h-2 w-2 rounded-full ${tone === 'vuln' ? 'bg-red-500' : 'bg-emerald-600'}`} aria-hidden />
          {title}
        </h3>
        {data ? (
          <span className={`badge ${leaked ? 'badge-danger' : 'badge-success'}`}>
            {leaked ? 'Exploit succeeded' : 'Attack contained'}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Not run</span>
        )}
      </header>

      <div className="space-y-3 p-4">
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
        {!data && !error && (
          <p className="py-6 text-center text-sm text-slate-400">Run a payload to see this implementation's response.</p>
        )}

        {data && (
          <>
            {data.proof && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Proof captured</p>
                <p className="mt-1 break-all font-mono text-sm text-amber-900">{data.proof}</p>
              </div>
            )}

            {data.judge && (
              <p className={`rounded-lg border px-3 py-2 text-xs ${data.judge.verdict === 'leaked' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                Independent judge ({data.judge.provider}): <strong className="capitalize">{data.judge.verdict}</strong> — {data.judge.reason}
              </p>
            )}

            {data.output !== undefined && data.variant !== 'html' && <CodeBlock label="Response" code={asText(data.output)} />}
            {data.variant === 'html' && (
              <>
                <CodeBlock label="HTML produced by the application" code={asText(data.output)} language="html" />
                <div>
                  <p className="mb-1 text-xs text-slate-500">Sandboxed preview (scripts disabled):</p>
                  <iframe title={`${title} preview`} sandbox="" srcDoc={String(data.output)} className="h-28 w-full rounded-lg border border-line bg-white" />
                </div>
              </>
            )}
            {data.findings && <CodeBlock label="Security findings" code={data.findings.length ? data.findings.join('\n') : 'None: output is inert text'} />}
            {data.model_output !== undefined && <CodeBlock label="Model output" code={asText(data.model_output)} />}
            {data.sql && <CodeBlock label="Executed SQL" code={data.sql + (data.params ? `\n-- params: ${JSON.stringify(data.params)}` : '')} language="sql" />}
            {data.rows && <CodeBlock label="Rows returned" code={asText(data.rows)} language="json" />}
            {data.state && <CodeBlock label="Application state after action" code={asText(data.state)} language="json" />}
            {data.error && <p className="text-sm text-amber-700">{data.error}</p>}
            {(data.prompt_sent || data.context_sent) && (
              <CodeBlock label={data.context_sent ? 'Context window' : 'Prompt sent to model'} code={asText(data.prompt_sent || data.context_sent)} wrap />
            )}
            {data.details && (
              <dl aria-label="Details" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg border border-line bg-slate-50 p-3 text-xs">
                {Object.entries(data.details).map(([key, value]) => (
                  <div key={key} className="contents">
                    <dt className="text-slate-500">{key}</dt>
                    <dd className="break-all font-mono text-slate-700">{asText(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {data.timeline && <Timeline timeline={data.timeline} />}
            {data.tables?.filter((table) => table.rows.length > 0).map((table) => (
              <DataTable key={table.label} label={table.label} rows={table.rows} />
            ))}
            {data.retrieved?.length > 0 && <DataTable label="Retrieved documents" rows={data.retrieved} />}
            {data.quarantined?.length > 0 && (
              <DataTable label="Quarantined documents" rows={data.quarantined.map((row) => ({ ...row, reasons: row.reasons.join('; ') }))} />
            )}
            {data.alerts?.length > 0 && <p className="text-xs text-amber-700">Alerts: {data.alerts.join(', ')}</p>}
            {data.controls?.length > 0 && <p className="text-xs text-emerald-700">Controls: {data.controls.join(', ')}</p>}
          </>
        )}
      </div>
    </section>
  )
}

export default function RunPanel({ module }) {
  const { mark } = useProgress()
  const [input, setInput] = useState('')
  const [variant, setVariant] = useState(module.variants[0] || null)
  const [results, setResults] = useState({ vulnerable: null, secure: null })
  const [errors, setErrors] = useState({ vulnerable: null, secure: null })
  const [busy, setBusy] = useState(false)

  async function run(side) {
    if (busy || !input.trim()) return
    setBusy(true)
    const payload = { input, ...(variant ? { variant } : {}) }
    try {
      const data = await api.run(module.id, side, payload)
      setResults((current) => ({ ...current, [side]: data }))
      setErrors((current) => ({ ...current, [side]: null }))
      if (side === 'vulnerable') mark(module.id, 'explored')
    } catch (error) {
      setResults((current) => ({ ...current, [side]: null }))
      setErrors((current) => ({ ...current, [side]: error.message }))
    } finally {
      setBusy(false)
    }
  }

  const examples = module.difficulty === 'Beginner' ? module.example_payloads : []

  return (
    <div className="space-y-4">
      <section aria-label="Target environment" className="overflow-hidden rounded-xl border border-navy-800 bg-navy-900 text-white shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Icon name="terminal" size={16} className="text-slate-300" />
            <h2 className="text-sm font-medium">Target environment</h2>
          </div>
          <span className="badge border-white/15 bg-white/5 text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            Local sandbox
          </span>
        </header>

        <div className="space-y-4 p-4 sm:p-5">
          {module.variants.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
              <label className="text-xs font-medium text-slate-300" htmlFor={`variant-${module.id}`}>{module.variant_label}</label>
              <select
                id={`variant-${module.id}`}
                className="w-full rounded-lg border border-white/15 bg-navy-950 px-3 py-2 text-sm text-white focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
                value={variant || ''}
                onChange={(event) => setVariant(event.target.value)}
              >
                {module.variants.map((option) => <option key={option} value={option}>{option.toUpperCase()}</option>)}
              </select>
              {variant && module.variant_help?.[variant] && (
                <p className="text-xs leading-5 text-slate-400 sm:col-start-2">{module.variant_help[variant]}</p>
              )}
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-300" htmlFor={`payload-${module.id}`}>Your payload</label>
              <span className="font-mono text-[11px] text-slate-500">{input.length}/2000</span>
            </div>
            <textarea
              id={`payload-${module.id}`}
              className="h-28 w-full resize-y rounded-lg border border-white/15 bg-navy-950 px-3 py-2 font-mono text-[13px] leading-6 text-slate-100 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
              maxLength={2000}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Type a message or payload…"
              spellCheck={false}
            />
          </div>

          {examples.length > 0 && (
            <div aria-label="Example payloads">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">Guided examples</p>
              <div className="flex flex-wrap gap-1.5">
                {examples.map((payload) => (
                  <button
                    key={payload.label}
                    type="button"
                    className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 transition-colors hover:border-white/30 hover:bg-white/10"
                    onClick={() => { setInput(payload.input); if (payload.variant) setVariant(payload.variant) }}
                  >
                    {payload.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn btn-primary flex-1 disabled:border-white/20 disabled:bg-white/10 disabled:text-slate-400 disabled:opacity-100"
              disabled={busy || !input.trim()}
              onClick={() => run('vulnerable')}
            >
              {busy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden /> : <Icon name="play" size={14} />}
              Run vulnerable
            </button>
            <button
              type="button"
              className="btn flex-1 border-white/15 bg-white/5 text-white shadow-none hover:bg-white/10 disabled:opacity-50"
              disabled={busy || !input.trim()}
              onClick={() => run('secure')}
            >
              Run secure
            </button>
          </div>
          <p className="text-[11px] leading-5 text-slate-500">
            The server chooses the model engine from its own configuration. Nothing leaves this environment.
          </p>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Result title="Vulnerable implementation" tone="vuln" data={results.vulnerable} error={errors.vulnerable} />
        <Result title="Secure implementation" tone="safe" data={results.secure} error={errors.secure} />
      </div>
    </div>
  )
}
