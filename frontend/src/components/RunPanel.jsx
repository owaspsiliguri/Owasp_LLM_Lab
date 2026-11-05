import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { useProgress } from '../hooks/useProgress.jsx'
import { CodeBlock, Badge, Button, Select } from './ui'
import Icon from './Icons.jsx'

/** Owns payload and result state so the workspace and the results grid can be laid out separately. */
export function useRun(module) {
  const { mark } = useProgress()
  const [input, setInput] = useState('')
  const [variant, setVariant] = useState(module?.variants?.[0] || null)
  const [results, setResults] = useState({ vulnerable: null, secure: null })
  const [errors, setErrors] = useState({ vulnerable: null, secure: null })
  const [busy, setBusy] = useState(false)

  // A new lab means a clean workspace: fresh variant, payload and results.
  useEffect(() => {
    setVariant(module?.variants?.[0] || null)
    setInput('')
    setResults({ vulnerable: null, secure: null })
    setErrors({ vulnerable: null, secure: null })
  }, [module?.id, module?.variants])

  const moduleId = module?.id

  const run = useCallback(async (side) => {
    if (!moduleId || busy || !input.trim()) return
    setBusy(true)
    try {
      const data = await api.run(moduleId, side, { input, ...(variant ? { variant } : {}) })
      setResults((current) => ({ ...current, [side]: data }))
      setErrors((current) => ({ ...current, [side]: null }))
      if (side === 'vulnerable') mark(moduleId, 'explored')
    } catch (error) {
      setResults((current) => ({ ...current, [side]: null }))
      setErrors((current) => ({ ...current, [side]: error.message }))
    } finally {
      setBusy(false)
    }
  }, [moduleId, busy, input, variant, mark])

  return { input, setInput, variant, setVariant, results, errors, busy, run }
}

function Timeline({ timeline }) {
  const { values, limit, label } = timeline
  const top = Math.max(limit || 0, ...values, 0.0001)
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 300},${70 - (value / top) * 66}`).join(' ')
  const limitY = limit ? 70 - (limit / top) * 66 : null
  return (
    <figure className="rounded-lg border border-line bg-surface-2 p-3">
      <figcaption className="mb-1 text-xs text-fg-subtle">
        {label}: final {values[values.length - 1]?.toLocaleString()}{limit ? ` (limit ${limit})` : ''}
      </figcaption>
      <svg role="img" aria-label={label} viewBox="0 0 300 72" className="h-20 w-full">
        {limitY !== null && <line x1="0" x2="300" y1={limitY} y2={limitY} stroke="rgb(var(--warning))" strokeDasharray="4 3" strokeWidth="1" />}
        <polyline points={points} fill="none" stroke="rgb(var(--accent))" strokeWidth="2" />
      </svg>
    </figure>
  )
}

function DataTable({ label, rows }) {
  if (!rows?.length) return null
  const columns = Object.keys(rows[0])
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table aria-label={label} className="w-full min-w-[24rem] text-left text-xs">
        <caption className="border-b border-line bg-surface-2 px-3 py-2 text-left font-medium text-fg">{label}</caption>
        <thead>
          <tr className="border-b border-line">
            {columns.map((column) => <th key={column} scope="col" className="px-3 py-1.5 font-medium text-fg-subtle">{column}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column} className="px-3 py-1.5 font-mono text-fg-muted">
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
  const empty = !data && !error
  return (
    <section aria-label={`${title} result`} className="min-w-0 rounded-xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-medium text-fg">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone === 'vuln' ? 'bg-danger' : 'bg-success'}`} aria-hidden />
          <span className="truncate">{title}</span>
        </h3>
        {data ? (
          <Badge tone={leaked ? 'danger' : 'success'}>{leaked ? 'Exploit succeeded' : 'Attack contained'}</Badge>
        ) : (
          <span className="text-xs text-fg-subtle">{error ? 'Failed' : 'Not run'}</span>
        )}
      </header>

      <div className={empty ? '' : 'space-y-3 p-3.5'}>
        {empty && (
          <div className={`flex flex-col items-center justify-center gap-2 px-4 py-8 text-center ${tone === 'vuln' ? '' : ''}`}>
            <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface-2 text-fg-subtle">
              <Icon name={tone === 'vuln' ? 'play' : 'shieldCheck'} size={15} />
            </span>
            <p className="max-w-[22rem] text-xs leading-5 text-fg-muted">
              Send a payload with <span className="font-medium text-fg">Run {tone === 'vuln' ? 'vulnerable' : 'secure'}</span> to see this implementation&apos;s response here.
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger-line bg-danger-tint px-3 py-2 text-sm text-danger-text">
            <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {data && (
          <>
            {data.proof && (
              <div className="rounded-lg border border-warning-line bg-warning-tint p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-warning-text">Proof captured</p>
                <p className="mt-1 break-all font-mono text-sm text-warning-text">{data.proof}</p>
              </div>
            )}

            {data.judge && (
              <p className={`rounded-lg border px-3 py-2 text-xs ${data.judge.verdict === 'leaked' ? 'border-danger-line bg-danger-tint text-danger-text' : 'border-success-line bg-success-tint text-success-text'}`}>
                Independent judge ({data.judge.provider}): <strong className="capitalize">{data.judge.verdict}</strong> — {data.judge.reason}
              </p>
            )}

            {data.output !== undefined && data.variant !== 'html' && <CodeBlock label="Response" code={asText(data.output)} maxHeight="20rem" wrap />}
            {data.variant === 'html' && (
              <>
                <CodeBlock label="HTML produced by the application" code={asText(data.output)} language="text" maxHeight="16rem" />
                <div>
                  <p className="mb-1 text-xs text-fg-subtle">Sandboxed preview (scripts disabled)</p>
                  <iframe title={`${title} preview`} sandbox="" srcDoc={String(data.output)} className="h-28 w-full rounded-lg border border-line bg-white" />
                </div>
              </>
            )}
            {data.findings && <CodeBlock label="Security findings" code={data.findings.length ? data.findings.join('\n') : 'None: output is inert text'} language="text" maxHeight="14rem" />}
            {data.model_output !== undefined && <CodeBlock label="Model output" code={asText(data.model_output)} maxHeight="16rem" wrap />}
            {data.sql && <CodeBlock label="Executed SQL" code={data.sql + (data.params ? `\n-- params: ${JSON.stringify(data.params)}` : '')} language="sql" maxHeight="14rem" />}
            {data.rows && <CodeBlock label="Rows returned" code={asText(data.rows)} language="json" maxHeight="14rem" />}
            {data.state && <CodeBlock label="Application state after action" code={asText(data.state)} language="json" maxHeight="14rem" />}
            {data.error && <p className="text-sm text-warning-text">{data.error}</p>}
            {(data.prompt_sent || data.context_sent) && (
              <CodeBlock label={data.context_sent ? 'Context window' : 'Prompt sent to model'} code={asText(data.prompt_sent || data.context_sent)} language="text" wrap maxHeight="16rem" />
            )}
            {data.details && (
              <dl aria-label="Details" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg border border-line bg-surface-2 p-3 text-xs">
                {Object.entries(data.details).map(([key, value]) => (
                  <div key={key} className="contents">
                    <dt className="text-fg-subtle">{key}</dt>
                    <dd className="break-all font-mono text-fg-muted">{asText(value)}</dd>
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
            {data.alerts?.length > 0 && <p className="text-xs text-warning-text">Alerts: {data.alerts.join(', ')}</p>}
            {data.controls?.length > 0 && <p className="text-xs text-success-text">Controls: {data.controls.join(', ')}</p>}
          </>
        )}
      </div>
    </section>
  )
}

/** Sticky workspace: variant picker, payload, guided examples and the two run buttons. */
export default function RunPanel({ module, runner }) {
  const { input, setInput, variant, setVariant, busy, run } = runner
  const examples = module.difficulty === 'Beginner' ? module.example_payloads : []
  const canRun = Boolean(input.trim()) && !busy

  return (
    <section aria-label="Target environment" className="card overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Icon name="terminal" size={15} className="text-fg-muted" />
          Target environment
        </h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
          Local sandbox
        </span>
      </header>

      <div className="space-y-3.5 p-4">
        {module.variants.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-fg-muted" htmlFor={`variant-${module.id}`}>{module.variant_label}</label>
            <Select id={`variant-${module.id}`} value={variant || ''} onChange={(event) => setVariant(event.target.value)}>
              {module.variants.map((option) => <option key={option} value={option}>{option.toUpperCase()}</option>)}
            </Select>
            {variant && module.variant_help?.[variant] && (
              <p className="mt-1 text-xs leading-5 text-fg-subtle">{module.variant_help[variant]}</p>
            )}
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="block text-xs font-medium text-fg-muted" htmlFor={`payload-${module.id}`}>Your payload</label>
            <span className="font-mono text-[11px] tabular-nums text-fg-subtle">{input.length}/2000</span>
          </div>
          <textarea
            id={`payload-${module.id}`}
            className="input input-mono h-28 w-full resize-y leading-6"
            maxLength={2000}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type a message or payload…"
            spellCheck={false}
            aria-describedby={`payload-${module.id}-help`}
          />
          <p id={`payload-${module.id}-help`} className="mt-1 text-[11px] leading-5 text-fg-subtle">
            Enter sends it to the vulnerable build. Nothing leaves this environment.
          </p>
        </div>

        {examples.length > 0 && (
          <div aria-label="Guided examples">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">Guided examples</p>
            <div className="flex flex-wrap gap-1.5">
              {examples.map((payload) => (
                <button
                  key={payload.label}
                  type="button"
                  className="chip"
                  onClick={() => { setInput(payload.input); if (payload.variant) setVariant(payload.variant) }}
                >
                  {payload.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="primary" className="flex-1" disabled={!canRun} loading={busy} onClick={() => run('vulnerable')}>
            {!busy && <Icon name="play" size={13} />}
            Run vulnerable
          </Button>
          <Button variant="outline" className="flex-1" disabled={!canRun || busy} onClick={() => run('secure')}>
            Run secure
          </Button>
        </div>
      </div>
    </section>
  )
}

/** Both implementations side by side, directly under the brief. */
export function RunResults({ module, runner }) {
  const { results, errors } = runner
  const ran = Boolean(results.vulnerable || results.secure || errors.vulnerable || errors.secure)

  return (
    <section id="run-results" aria-label="Run results" className="scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-fg">Results</h2>
        <p className="text-xs text-fg-subtle">
          {ran ? 'Both implementations receive the same payload.' : 'Run your payload to compare the vulnerable and secure builds.'}
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Result title="Vulnerable implementation" tone="vuln" data={results.vulnerable} error={errors.vulnerable} />
        <Result title="Secure implementation" tone="safe" data={results.secure} error={errors.secure} />
      </div>
      <p className="sr-only" aria-live="polite">
        {module.id} results updated
      </p>
    </section>
  )
}
