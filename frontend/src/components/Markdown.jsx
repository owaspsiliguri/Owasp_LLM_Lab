import { Fragment } from 'react'

// Renders the markdown subset our guide generator emits: headings, quotes,
// lists, tables, fenced code, rules, paragraphs and inline formatting.
// Deliberately dependency-free so the guides work offline inside the app.

function inline(text, keyBase = 'i') {
  const parts = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m
  let i = 0
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const token = m[0]
    const key = `${keyBase}-${i++}`
    if (token.startsWith('**')) parts.push(<strong key={key} className="font-semibold text-fog-100">{token.slice(2, -2)}</strong>)
    else if (token.startsWith('`')) parts.push(<code key={key} className="rounded bg-ink-800 px-1 py-0.5 font-mono text-[0.9em] text-steel-400">{token.slice(1, -1)}</code>)
    else if (token.startsWith('[')) {
      const match = /\[([^\]]+)\]\(([^)]+)\)/.exec(token)
      const href = match[2]
      const external = /^https?:\/\//.test(href)
      parts.push(
        <a key={key} href={href} className="text-steel-400 underline" target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
          {match[1]}
        </a>,
      )
    } else parts.push(<em key={key}>{token.slice(1, -1)}</em>)
    last = m.index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function table(rows) {
  const [head, ...body] = rows
  const cells = (line) => line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
  return (
    <div className="overflow-x-auto rounded border border-ink-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink-800 text-fog-100"><tr>{cells(head).map((c, i) => <th key={i} className="px-3 py-2 font-medium">{inline(c, `h${i}`)}</th>)}</tr></thead>
        <tbody className="text-fog-300">
          {body.filter((r) => !/^\|?\s*:?-{3,}/.test(r.trim())).map((r, ri) => (
            <tr key={ri} className="border-t border-ink-800">{cells(r).map((c, i) => <td key={i} className="px-3 py-2 align-top">{inline(c, `c${ri}-${i}`)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Markdown({ source }) {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i += 1; continue }

    if (line.startsWith('```')) {
      const code = []
      i += 1
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i += 1 }
      i += 1
      blocks.push(<pre key={i} className="overflow-x-auto rounded border border-ink-700 bg-ink-950 p-3 font-mono text-[13px] leading-relaxed text-fog-300">{code.join('\n')}</pre>)
      continue
    }
    if (/^#{1,4} /.test(line)) {
      const level = line.match(/^#+/)[0].length
      const text = line.replace(/^#+\s*/, '')
      const cls = level <= 1 ? 'text-xl' : level === 2 ? 'text-lg' : 'text-base'
      blocks.push(<div key={i} className={`${cls} font-semibold text-fog-100 ${level <= 2 ? 'mt-6' : 'mt-4'}`}>{inline(text, `t${i}`)}</div>)
      i += 1
      continue
    }
    if (/^---+\s*$/.test(line)) { blocks.push(<hr key={i} className="border-ink-700" />); i += 1; continue }
    if (line.startsWith('>')) {
      const quote = []
      while (i < lines.length && lines[i].startsWith('>')) { quote.push(lines[i].replace(/^>\s?/, '')); i += 1 }
      blocks.push(
        <blockquote key={i} className="rounded-r border-l-2 border-steel-500 bg-ink-800/60 px-3 py-2 text-fog-300 space-y-1">
          {quote.map((q, qi) => <p key={qi}>{inline(q, `q${i}-${qi}`)}</p>)}
        </blockquote>,
      )
      continue
    }
    if (/^\|.*\|$/.test(line.trim())) {
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].trim()); i += 1 }
      blocks.push(<div key={i}>{table(rows)}</div>)
      continue
    }
    if (/^[-*] /.test(line)) {
      const items = []
      while (i < lines.length && /^[-*] /.test(lines[i])) { items.push(lines[i].replace(/^[-*] /, '')); i += 1 }
      blocks.push(<ul key={i} className="list-disc space-y-1 pl-5 text-fog-300">{items.map((it, xi) => <li key={xi}>{inline(it, `u${i}-${xi}`)}</li>)}</ul>)
      continue
    }
    if (/^\d+\. /.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\d+\. /, '')); i += 1 }
      blocks.push(<ol key={i} className="list-decimal space-y-1 pl-5 text-fog-300">{items.map((it, xi) => <li key={xi}>{inline(it, `o${i}-${xi}`)}</li>)}</ol>)
      continue
    }
    const para = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,4} |```|[->*] |\d+\. |>|\|)/.test(lines[i])) { para.push(lines[i]); i += 1 }
    if (!para.length) { i += 1; continue }
    blocks.push(<p key={i} className="text-fog-300">{inline(para.join(' '), `p${i}`)}</p>)
  }
  return <div className="space-y-3 text-[15px]">{blocks.map((b, k) => <Fragment key={k}>{b}</Fragment>)}</div>
}
