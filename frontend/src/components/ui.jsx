const TONES = { Beginner: 'text-safe-400 border-safe-400/40', Intermediate: 'text-warn-400 border-warn-400/40', Advanced: 'text-vuln-400 border-vuln-400/40', neutral: 'text-fog-300 border-ink-600' }

export function Badge({ children, tone = 'neutral' }) {
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs ${TONES[tone] || TONES.neutral}`}>{children}</span>
}

export function CodeBlock({ code, label, tone }) {
  const edge = tone === 'vuln' ? 'border-vuln-400/50' : tone === 'safe' ? 'border-safe-400/50' : 'border-ink-700'
  return (
    <figure className={`overflow-hidden rounded-md border ${edge} bg-ink-950`}>
      {label && <figcaption className="border-b border-ink-700 px-3 py-1.5 text-xs text-fog-300">{label}</figcaption>}
      <pre className="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed"><code>{code}</code></pre>
    </figure>
  )
}

export function Stat({ label, value }) {
  return <div className="panel p-4"><div className="text-2xl font-semibold">{value}</div><div className="text-sm text-fog-300">{label}</div></div>
}

export function Loading({ error, children }) {
  if (error) return <p role="alert" className="panel border-vuln-400/50 p-4 text-vuln-400">Could not reach the backend: {error}. Check that the stack is running with <code>docker compose up</code>.</p>
  return <p className="text-fog-300">{children || 'Loading…'}</p>
}
