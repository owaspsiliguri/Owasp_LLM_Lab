import { useState } from 'react'
import { api } from '../services/api.js'
import { useProgress } from '../hooks/useProgress.jsx'
import { CodeBlock } from './ui.jsx'

function Timeline({ timeline }) {
  const { values, limit, label } = timeline
  const top = Math.max(limit || 0, ...values, 0.0001)
  const pts = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * 300},${70 - (v / top) * 66}`).join(' ')
  const limitY = limit ? 70 - (limit / top) * 66 : null
  return (
    <figure className="rounded border border-ink-700 bg-ink-950 p-2">
      <figcaption className="mb-1 text-xs text-fog-300">{label}: final {values[values.length - 1]?.toLocaleString()}{limit ? ` (limit ${limit})` : ''}</figcaption>
      <svg role="img" aria-label={label} viewBox="0 0 300 72" className="h-20 w-full">
        {limitY !== null && <line x1="0" x2="300" y1={limitY} y2={limitY} stroke="#e7c36b" strokeDasharray="4 3" strokeWidth="1" />}
        <polyline points={pts} fill="none" stroke="#7fb2e5" strokeWidth="2" />
      </svg>
    </figure>
  )
}

function Table({ label, rows }) {
  const cols = Object.keys(rows[0])
  return (
    <div className="overflow-x-auto rounded border border-ink-700">
      <table aria-label={label} className="w-full text-left text-xs">
        <caption className="border-b border-ink-700 px-2 py-1 text-left text-fog-300">{label}</caption>
        <thead className="text-fog-500"><tr>{cols.map((c) => <th key={c} className="px-2 py-1 font-normal">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-ink-800">{cols.map((c) => <td key={c} className="px-2 py-1 font-mono">{typeof r[c] === 'object' && r[c] !== null ? JSON.stringify(r[c]) : String(r[c])}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

function Result({ title, tone, data, error }) {
  const border = tone === 'vuln' ? 'border-vuln-400/50' : 'border-safe-400/50'
  const text = (v) => (typeof v === 'string' ? v : JSON.stringify(v, null, 2))
  return (
    <section aria-label={`${title} result`} className={`rounded-md border ${border} bg-ink-900 p-3`}>
      <div className="mb-2 flex items-center justify-between text-sm">
        <h3 className="font-medium">{title}</h3>
        {data && <span className={data.leaked ? 'text-vuln-400' : 'text-safe-400'}>{data.leaked ? 'Exploit succeeded' : 'Attack contained'}</span>}
      </div>
      {error && <p role="alert" className="text-vuln-400">{error}</p>}
      {!data && !error && <p className="text-sm text-fog-500">Not run yet.</p>}
      {data && (
        <div className="space-y-2">
          {data.judge && (
            <p aria-label="LLM judge verdict" className={`rounded border px-2 py-1 text-xs ${data.judge.verdict === 'leaked' ? 'border-vuln-400/50 text-vuln-400' : 'border-safe-400/50 text-safe-400'}`}>
              LLM judge ({data.judge.provider}): <strong className="capitalize">{data.judge.verdict}</strong> — {data.judge.reason}
            </p>
          )}
          {data.output !== undefined && data.variant !== 'html' && <CodeBlock label="Response" code={text(data.output)} />}
          {data.variant === 'html' && (
            <>
              <CodeBlock label="HTML produced by the application" code={data.output} />
              <p className="text-xs text-fog-300">Preview (sandboxed, scripts disabled):</p>
              <iframe title={`${title} preview`} sandbox="" srcDoc={data.output} className="h-24 w-full rounded border border-ink-700 bg-white" />
            </>
          )}
          {data.findings && <CodeBlock label="Security findings" code={data.findings.length ? data.findings.join('\n') : 'None: output is inert text'} />}
          {data.model_output !== undefined && <CodeBlock label="Model output" code={text(data.model_output)} />}
          {data.sql && <CodeBlock label="Executed SQL" code={data.sql + (data.params ? `\n-- params: ${JSON.stringify(data.params)}` : '')} />}
          {data.rows && <CodeBlock label="Rows returned" code={text(data.rows)} />}
          {data.state && <CodeBlock label="Application state after action" code={text(data.state)} />}
          {data.error && <p className="text-sm text-warn-400">{data.error}</p>}
          {(data.prompt_sent || data.context_sent) && <CodeBlock label={data.context_sent ? 'Context window' : 'Prompt sent to model'} code={text(data.prompt_sent || data.context_sent)} />}
          {data.details && (
            <dl aria-label="Details" className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded border border-ink-700 bg-ink-950 p-2 text-xs">
              {Object.entries(data.details).map(([k, v]) => <div key={k} className="contents"><dt className="text-fog-500">{k}</dt><dd className="break-all font-mono">{typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}</dd></div>)}
            </dl>
          )}
          {data.timeline && <Timeline timeline={data.timeline} />}
          {data.tables?.filter((t) => t.rows.length > 0).map((t) => <Table key={t.label} label={t.label} rows={t.rows} />)}
          {data.retrieved?.length > 0 && <Table label="Retrieved from ChromaDB" rows={data.retrieved} />}
          {data.quarantined?.length > 0 && <Table label="Quarantined documents" rows={data.quarantined.map((q) => ({ ...q, reasons: q.reasons.join('; ') }))} />}
          {data.alerts?.length > 0 && <p className="text-xs text-warn-400">Alerts: {data.alerts.join(', ')}</p>}
          {data.proof && <p role="status" className="rounded border border-warn-400/50 p-2 font-mono text-xs text-warn-400">Exploit proof: {data.proof}</p>}
          {data.controls?.length > 0 && <p className="text-xs text-safe-400">Controls: {data.controls.join(', ')}</p>}
        </div>
      )}
    </section>
  )
}

export default function RunPanel({ module }) {
  const { mode, mark } = useProgress()
  const [input, setInput] = useState('')
  const [variant, setVariant] = useState(module.variants[0] || null)
  const [res, setRes] = useState({ vulnerable: null, secure: null })
  const [err, setErr] = useState({ vulnerable: null, secure: null })
  const [busy, setBusy] = useState(false)

  async function go(which) {
    setBusy(true)
    // No engine is ever chosen in the browser: the server uses Groq or Gemini
    // when a key is configured, otherwise its built-in simulator.
    const payload = { input, mode, ...(variant ? { variant } : {}) }
    try {
      const data = await api.run(module.id, which, payload)
      setRes((r) => ({ ...r, [which]: data })); setErr((e) => ({ ...e, [which]: null }))
      if (which === 'vulnerable') mark(module.id, 'explored')
    } catch (e) {
      setRes((r) => ({ ...r, [which]: null })); setErr((x) => ({ ...x, [which]: e.message }))
    } finally { setBusy(false) }
  }

  const examples = mode === 'beginner' ? module.example_payloads : []
  return (
    <div className="space-y-4">
      {examples.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Example payloads">
          {examples.map((p) => (
            <button key={p.label} className="btn" onClick={() => { setInput(p.input); if (p.variant) setVariant(p.variant) }}>{p.label}</button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {module.variants.length > 0 && (
          <label className="flex items-center gap-2">{module.variant_label}
            <select aria-label="Variant" className="rounded border border-ink-600 bg-ink-950 px-2 py-1" value={variant} onChange={(e) => setVariant(e.target.value)}>
              {module.variants.map((v) => <option key={v} value={v}>{v.toUpperCase()}</option>)}
            </select>
          </label>
        )}
      </div>
      {variant && module.variant_help?.[variant] && <p className="text-xs text-fog-500">{module.variant_help[variant]}</p>}
      <label className="block text-sm text-fog-300">Your input
        <textarea aria-label="Your input" className="input mt-1 h-24" maxLength={2000} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message or payload…" />
      </label>
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy || !input.trim()} onClick={() => go('vulnerable')}>Run vulnerable</button>
        <button className="btn" disabled={busy || !input.trim()} onClick={() => go('secure')}>Run secure</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Result title="Vulnerable implementation" tone="vuln" data={res.vulnerable} error={err.vulnerable} />
        <Result title="Secure implementation" tone="safe" data={res.secure} error={err.secure} />
      </div>
    </div>
  )
}
