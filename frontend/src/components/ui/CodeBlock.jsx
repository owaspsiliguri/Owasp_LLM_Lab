import { useMemo, useState } from 'react'
import Icon from '../Icons.jsx'
import { useToast } from '../Toast.jsx'

const KEYWORDS = {
  python: new Set([
    'def', 'return', 'if', 'elif', 'else', 'for', 'while', 'class', 'import', 'from', 'as', 'with', 'try',
    'except', 'finally', 'raise', 'pass', 'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False', 'lambda',
    'async', 'await', 'yield', 'global', 'assert', 'del', 'break', 'continue', 'self',
  ]),
  sql: new Set([
    'SELECT', 'FROM', 'WHERE', 'UNION', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'TABLE', 'DROP', 'JOIN',
    'ON', 'AND', 'OR', 'VALUES', 'INTO', 'SET', 'ORDER', 'BY', 'LIMIT', 'PARAMS', 'LEFT', 'GROUP',
  ]),
  json: new Set(['true', 'false', 'null']),
  javascript: new Set(['const', 'let', 'var', 'function', 'return', 'if', 'else', 'await', 'async', 'new', 'true', 'false', 'null']),
}

const PATTERNS = {
  python: /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"[^"\n]*"|'[^'\n]*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g,
  sql: /(--[^\n]*)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g,
  json: /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(\b-?\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g,
  javascript: /(\/\/[^\n]*)|("[^"\n]*"|'[^'\n]*'|`[^`]*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][A-Za-z0-9_$]*)/g,
}

function tokens(line, language) {
  const pattern = PATTERNS[language]
  if (!pattern) return line
  const keywords = KEYWORDS[language] || new Set()
  const nodes = []
  let last = 0
  let match
  let key = 0
  pattern.lastIndex = 0
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > last) nodes.push(line.slice(last, match.index))
    const text = match[0]
    if (match[1]) nodes.push(<span key={key++} className="code-comment">{text}</span>)
    else if (match[2]) nodes.push(<span key={key++} className={language === 'json' ? 'code-keyword' : 'code-string'}>{text}</span>)
    else if (match[3]) nodes.push(<span key={key++} className="code-number">{text}</span>)
    else if (match[4] && keywords.has(language === 'sql' ? text.toUpperCase() : text)) {
      nodes.push(<span key={key++} className="code-keyword">{text}</span>)
    } else nodes.push(<span key={key++} className="code-plain">{text}</span>)
    last = match.index + text.length
  }
  if (last < line.length) nodes.push(line.slice(last))
  return nodes
}

function CopyButton({ value, label = 'Copy' }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success('Copied to the clipboard.', { title: label })
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('The browser blocked clipboard access. Select the text and copy it manually.')
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[color:rgb(var(--code-muted))] transition-colors hover:bg-white/10 hover:text-white"
    >
      <Icon name={copied ? 'check' : 'copy'} size={13} />
      {copied ? 'Copied' : label}
    </button>
  )
}

export function CodeBlock({ code, label, tone = 'neutral', language = 'python', className = '', wrap = false, maxHeight = '30rem' }) {
  const source = String(code ?? '')
  const lines = useMemo(() => source.split('\n'), [source])
  const gutter = String(lines.length).length
  const accent = tone === 'vuln' ? 'text-danger-text' : tone === 'safe' ? 'text-success-text' : 'text-[color:rgb(var(--code-muted))]'

  return (
    <figure className={`overflow-hidden rounded-lg border border-[color:rgb(var(--code-border))] bg-[color:rgb(var(--code))] ${className}`}>
      <figcaption className="flex items-center justify-between gap-3 border-b border-[color:rgb(var(--code-border))] px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-[color:rgb(var(--code-text))]">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone === 'vuln' ? 'bg-danger' : tone === 'safe' ? 'bg-success' : 'bg-[color:rgb(var(--code-muted))]'}`} aria-hidden />
          <span className="truncate">{label || 'Code'}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {tone === 'vuln' && <span className={`text-[11px] font-medium uppercase tracking-wide ${accent}`}>Vulnerable</span>}
          {tone === 'safe' && <span className={`text-[11px] font-medium uppercase tracking-wide ${accent}`}>Secure</span>}
          <CopyButton value={source} />
        </span>
      </figcaption>
      <div className="overflow-auto" style={{ maxHeight }}>
        <pre className="min-w-full py-2 font-mono text-[12.5px] leading-[1.65]">
          <code>
            {lines.map((line, index) => (
              <span key={index} className="flex px-0">
                <span
                  className="sticky left-0 select-none bg-[color:rgb(var(--code))] pr-3 pl-3 text-right text-[color:rgb(var(--code-muted))]"
                  style={{ minWidth: `${gutter + 3}ch` }}
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span className={`flex-1 pr-4 ${wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}`}>
                  {line ? tokens(line, language) : ' '}
                </span>
              </span>
            ))}
          </code>
        </pre>
      </div>
    </figure>
  )
}

function lineDiff(a, b) {
  const left = a.split('\n')
  const right = b.split('\n')
  const table = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0))
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i][j] = left[i] === right[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const rows = []
  let i = 0
  let j = 0
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { rows.push({ type: 'same', text: left[i] }); i += 1; j += 1 }
    else if (table[i + 1][j] >= table[i][j + 1]) { rows.push({ type: 'removed', text: left[i] }); i += 1 }
    else { rows.push({ type: 'added', text: right[j] }); j += 1 }
  }
  while (i < left.length) { rows.push({ type: 'removed', text: left[i] }); i += 1 }
  while (j < right.length) { rows.push({ type: 'added', text: right[j] }); j += 1 }
  return rows
}

/** Unified diff: removed lines from the vulnerable build, added lines from the fix. */
export function CodeDiff({ before, after, language = 'python', label = 'Vulnerable → secure diff', maxHeight = '34rem' }) {
  const rows = useMemo(() => lineDiff(String(before ?? ''), String(after ?? '')), [before, after])
  const changed = rows.filter((row) => row.type !== 'same').length

  return (
    <figure className="overflow-hidden rounded-lg border border-[color:rgb(var(--code-border))] bg-[color:rgb(var(--code))]">
      <figcaption className="flex items-center justify-between gap-3 border-b border-[color:rgb(var(--code-border))] px-3 py-2">
        <span className="text-xs font-medium text-[color:rgb(var(--code-text))]">{label}</span>
        <span className="text-[11px] text-[color:rgb(var(--code-muted))]">{changed} changed {changed === 1 ? 'line' : 'lines'}</span>
      </figcaption>
      <div className="overflow-auto" style={{ maxHeight }}>
        <pre className="min-w-full py-2 font-mono text-[12.5px] leading-[1.65]">
          <code>
            {rows.map((row, index) => (
              <span
                key={index}
                className={`flex ${row.type === 'added' ? 'bg-[color:rgb(var(--code-added))]' : ''} ${row.type === 'removed' ? 'bg-[color:rgb(var(--code-removed))]' : ''}`}
              >
                <span className={`w-6 shrink-0 select-none text-center ${row.type === 'added' ? 'text-success' : row.type === 'removed' ? 'text-danger' : 'text-[color:rgb(var(--code-muted))]'}`} aria-hidden>
                  {row.type === 'added' ? '+' : row.type === 'removed' ? '−' : ' '}
                </span>
                <span className="flex-1 whitespace-pre pr-4">{row.text ? tokens(row.text, language) : ' '}</span>
              </span>
            ))}
          </code>
        </pre>
      </div>
    </figure>
  )
}
