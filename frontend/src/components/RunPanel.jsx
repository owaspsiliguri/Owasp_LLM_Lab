import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../services/api.js'
import { useProgress } from '../hooks/useProgress.jsx'
import { CodeBlock, Badge, Button, Select } from './ui'
import Icon from './Icons.jsx'

const FLAG_RE = /FLAG\{[^}\s]+\}/g
let messageSeq = 0
const nextId = () => `msg-${++messageSeq}`

function asText(value) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function flagsIn(data) {
  try {
    return [...new Set(String(JSON.stringify(data)).match(FLAG_RE) || [])]
  } catch {
    return []
  }
}

function responseText(data) {
  if (typeof data?.output === 'string') return data.output
  if (data?.output !== undefined) return asText(data.output)
  if (typeof data?.model_output === 'string') return data.model_output
  if (data?.model_output !== undefined) return asText(data.model_output)
  if (typeof data?.reply === 'string') return data.reply
  if (typeof data?.message === 'string' && data.message) return data.message
  // Derived from the response itself, never invented assistant prose.
  return data?.leaked
    ? 'The target returned proof that the attack succeeded. Open the captured details below.'
    : 'The target processed the request and reported no proof of exploitation.'
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

/** Structured evidence returned by the real lab endpoint. No fabricated content. */
function CapturedDetails({ data }) {
  return (
    <details className="rounded-lg border border-line bg-surface-2/60">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-fg-muted">
        Captured details
      </summary>
      <div className="space-y-3 border-t border-line p-3">
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

        {data.output !== undefined && <CodeBlock label="Raw response" code={asText(data.output)} maxHeight="18rem" wrap />}
        {data.variant === 'html' && (
          <div>
            <p className="mb-1 text-xs text-fg-subtle">Sandboxed preview (scripts disabled)</p>
            <iframe title="Captured HTML preview" sandbox="" srcDoc={String(data.output)} className="h-28 w-full rounded-lg border border-line bg-white" />
          </div>
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
          <dl aria-label="Details" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg border border-line bg-surface p-3 text-xs">
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
      </div>
    </details>
  )
}

function ChatMessage({ message, onCopy, copied }) {
  if (message.role === 'user') {
    return (
      <li className="flex flex-col items-end gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">You · {message.side === 'secure' ? 'secure build' : 'vulnerable build'}</span>
        <p className="max-w-[92%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-sm leading-6 text-[color:rgb(var(--accent-contrast))]">
          {message.text}
        </p>
      </li>
    )
  }

  if (message.role === 'error') {
    return (
      <li role="alert" className="flex items-start gap-2 rounded-lg border border-danger-line bg-danger-tint px-3 py-2.5 text-sm text-danger-text">
        <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
        <span>{message.text}</span>
      </li>
    )
  }

  const data = message.data || {}
  const leaked = Boolean(data.leaked)
  return (
    <li className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${message.side === 'secure' ? 'bg-success' : 'bg-danger'}`} aria-hidden />
        <span className="text-xs font-medium text-fg">
          {message.side === 'secure' ? 'Secure build' : 'Vulnerable build'}
        </span>
        <Badge tone={leaked ? 'danger' : 'success'}>{leaked ? 'Exploit succeeded' : 'Attack contained'}</Badge>
      </div>
      <p className="whitespace-pre-wrap break-words rounded-2xl rounded-tl-md border border-line bg-surface px-3.5 py-2.5 text-sm leading-6 text-fg-muted">
        {responseText(data)}
      </p>

      {message.flags?.length > 0 && (
        <div className="rounded-lg border border-warning-line bg-warning-tint p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-warning-text">Flag captured in the response</p>
          {message.flags.map((flag) => (
            <div key={flag} className="mt-1.5 flex flex-wrap items-center gap-2">
              <code className="min-w-0 break-all font-mono text-sm text-warning-text">{flag}</code>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onCopy(flag)}
              >
                <Icon name="copy" size={13} />
                {copied === flag ? 'Copied' : 'Copy'}
              </button>
            </div>
          ))}
          <p className="mt-2 text-xs leading-5 text-warning-text">Paste it into the flag form to claim the 100 points.</p>
        </div>
      )}

      <CapturedDetails data={data} />
    </li>
  )
}

/** Owns the transcript, target selection and the real API calls. */
export function useRun(module) {
  const { refresh } = useProgress()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [side, setSide] = useState('vulnerable')
  const [variant, setVariant] = useState(module?.variants?.[0] || null)
  const [busy, setBusy] = useState(false)
  const [capturedFlags, setCapturedFlags] = useState([])
  const moduleId = module?.id
  const firstVariant = module?.variants?.[0] || null

  // A new lab means a clean transcript and a fresh target selection.
  useEffect(() => {
    setMessages([])
    setInput('')
    setSide('vulnerable')
    setVariant(firstVariant)
    setCapturedFlags([])
    setBusy(false)
  }, [moduleId, firstVariant])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!moduleId || busy || !text) return
    const activeSide = side
    setMessages((current) => [...current, { id: nextId(), role: 'user', side: activeSide, text }])
    setInput('')
    setBusy(true)
    try {
      const data = await api.run(moduleId, activeSide, { input: text, ...(variant ? { variant } : {}) })
      const flags = flagsIn(data)
      setMessages((current) => [...current, { id: nextId(), role: 'assistant', side: activeSide, data, flags }])
      if (flags.length) setCapturedFlags((current) => [...new Set([...current, ...flags])])
      if (activeSide === 'vulnerable') refresh()
    } catch (error) {
      setMessages((current) => [...current, { id: nextId(), role: 'error', side: activeSide, text: error.message }])
    } finally {
      setBusy(false)
    }
  }, [moduleId, busy, input, side, variant, refresh])

  const clear = useCallback(() => setMessages([]), [])

  return {
    messages,
    input,
    setInput,
    side,
    setSide,
    variant,
    setVariant,
    busy,
    send,
    clear,
    capturedFlags,
    capturedFlag: capturedFlags[capturedFlags.length - 1] || null,
  }
}

/** In-page chat with the lab target. Every reply is the real endpoint output. */
export default function RunPanel({ module, runner }) {
  const { messages, input, setInput, side, setSide, variant, setVariant, busy, send, clear } = runner
  const [copied, setCopied] = useState(null)
  const endRef = useRef(null)
  const examples = module.difficulty === 'Beginner' ? module.example_payloads : []
  const canSend = Boolean(input.trim()) && !busy

  useEffect(() => {
    if (typeof endRef.current?.scrollIntoView === 'function') {
      endRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [messages.length, busy])

  async function copy(flag) {
    try {
      await navigator.clipboard.writeText(flag)
      setCopied(flag)
    } catch {
      setCopied(null)
    }
  }

  return (
    <section aria-label="Target chat" className="card flex min-h-[30rem] flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Icon name="terminal" size={15} className="text-fg-muted" />
          Target environment
        </h2>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            Local sandbox
          </span>
          {messages.length > 0 && (
            <button type="button" onClick={clear} className="text-xs text-fg-subtle underline-offset-2 hover:text-fg hover:underline">
              Clear chat
            </button>
          )}
        </div>
      </header>

      <div className="border-b border-line px-3 py-2.5 sm:px-4" role="group" aria-label="Target build">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => setSide('vulnerable')}
            aria-pressed={side === 'vulnerable'}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${side === 'vulnerable' ? 'bg-danger-tint text-danger-text shadow-sm' : 'text-fg-muted hover:text-fg'}`}
          >
            Vulnerable build
          </button>
          <button
            type="button"
            onClick={() => setSide('secure')}
            aria-pressed={side === 'secure'}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${side === 'secure' ? 'bg-success-tint text-success-text shadow-sm' : 'text-fg-muted hover:text-fg'}`}
          >
            Secure build
          </button>
        </div>
        <p className="mt-1.5 text-[11px] leading-5 text-fg-subtle">
          Both builds receive the same message. Only real target responses appear below.
        </p>
      </div>

      <div role="log" aria-live="polite" aria-label="Conversation with the target" className="min-h-[14rem] flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 text-center">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface-2 text-fg-subtle">
              <Icon name="terminal" size={16} />
            </span>
            <p className="max-w-[24rem] text-xs leading-5 text-fg-muted">
              Send a message or payload to the {side === 'vulnerable' ? 'vulnerable' : 'secure'} build. Its reply appears here.
            </p>
          </div>
        )}
        <ol className="space-y-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} onCopy={copy} copied={copied} />
          ))}
        </ol>
        {busy && (
          <p role="status" className="flex items-center gap-2 text-xs text-fg-subtle">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-line-strong border-t-accent" aria-hidden />
            Waiting for the {side === 'vulnerable' ? 'vulnerable' : 'secure'} build…
          </p>
        )}
        <div ref={endRef} />
      </div>

      <div className="space-y-3 border-t border-line p-3 sm:p-4">
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

        {examples.length > 0 && messages.length === 0 && (
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

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="block text-xs font-medium text-fg-muted" htmlFor={`payload-${module.id}`}>Your message</label>
            <span className="font-mono text-[11px] tabular-nums text-fg-subtle">{input.length}/2000</span>
          </div>
          <textarea
            id={`payload-${module.id}`}
            aria-label="Message to the target"
            className="input input-mono h-24 w-full resize-y leading-6"
            maxLength={2000}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
            placeholder={`Message the ${side === 'vulnerable' ? 'vulnerable' : 'secure'} build… (Enter sends, Shift+Enter adds a line)`}
            spellCheck={false}
          />
        </div>

        <Button variant="primary" className="w-full" disabled={!canSend} loading={busy} onClick={() => send()}>
          {!busy && <Icon name="send" size={14} />}
          Send to {side === 'vulnerable' ? 'vulnerable' : 'secure'} build
        </Button>
      </div>
    </section>
  )
}
