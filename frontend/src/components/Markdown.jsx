import { Fragment } from 'react'

function inline(text, keyBase = 'i') {
  const parts = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let match
  let index = 0
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const token = match[0]
    const key = `${keyBase}-${index++}`
    if (token.startsWith('**')) parts.push(<strong key={key} className="font-semibold text-ink">{token.slice(2, -2)}</strong>)
    else if (token.startsWith('`')) parts.push(<code key={key} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.86em] text-navy-800">{token.slice(1, -1)}</code>)
    else if (token.startsWith('[')) {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(token)
      const href = link[2]
      const external = /^https?:\/\//.test(href)
      parts.push(
        <a key={key} href={href} className="text-brand-700 underline decoration-brand-300 underline-offset-2" target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
          {link[1]}
        </a>,
      )
    } else parts.push(<em key={key}>{token.slice(1, -1)}</em>)
    last = match.index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function Table({ rows }) {
  const [head, ...body] = rows
  const cells = (line) => line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())
  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[28rem] text-left text-sm">
        <thead className="bg-slate-50 text-ink">
          <tr>{cells(head).map((cell, index) => <th key={index} className="px-3 py-2 font-medium">{inline(cell, `h${index}`)}</th>)}</tr>
        </thead>
        <tbody className="text-slate-600">
          {body.filter((row) => !/^\|?\s*:?-{3,}/.test(row.trim())).map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-line">
              {cells(row).map((cell, index) => <td key={index} className="px-3 py-2 align-top">{inline(cell, `c${rowIndex}-${index}`)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Markdown({ source }) {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) { index += 1; continue }

    if (line.startsWith('```')) {
      const code = []
      index += 1
      while (index < lines.length && !lines[index].startsWith('```')) { code.push(lines[index]); index += 1 }
      index += 1
      blocks.push(
        <pre key={index} className="my-4 overflow-x-auto rounded-xl border border-navy-700 bg-navy-950 p-4 font-mono text-[13px] leading-relaxed text-slate-200">
          <code>{code.join('\n')}</code>
        </pre>,
      )
      continue
    }
    if (/^#{1,4} /.test(line)) {
      const level = line.match(/^#+/)[0].length
      const text = line.replace(/^#+\s*/, '')
      const className = level <= 1 ? 'mt-0 text-xl' : level === 2 ? 'mt-8 text-lg' : 'mt-5 text-base'
      blocks.push(<h2 key={index} className={`${className} font-semibold text-ink`}>{inline(text, `t${index}`)}</h2>)
      index += 1
      continue
    }
    if (/^---+\s*$/.test(line)) { blocks.push(<hr key={index} className="my-6 border-line" />); index += 1; continue }
    if (line.startsWith('>')) {
      const quote = []
      while (index < lines.length && lines[index].startsWith('>')) { quote.push(lines[index].replace(/^>\s?/, '')); index += 1 }
      blocks.push(
        <blockquote key={index} className="my-4 space-y-1 rounded-r-lg border-l-2 border-brand-500 bg-brand-50/60 px-4 py-3 text-sm text-slate-600">
          {quote.map((text, quoteIndex) => <p key={quoteIndex}>{inline(text, `q${index}-${quoteIndex}`)}</p>)}
        </blockquote>,
      )
      continue
    }
    if (/^\|.*\|$/.test(line.trim())) {
      const rows = []
      while (index < lines.length && lines[index].trim().startsWith('|')) { rows.push(lines[index].trim()); index += 1 }
      blocks.push(<Table key={index} rows={rows} />)
      continue
    }
    if (/^[-*] /.test(line)) {
      const items = []
      while (index < lines.length && /^[-*] /.test(lines[index])) { items.push(lines[index].replace(/^[-*] /, '')); index += 1 }
      blocks.push(<ul key={index} className="my-3 list-disc space-y-1.5 pl-5 text-slate-600">{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item, `u${index}-${itemIndex}`)}</li>)}</ul>)
      continue
    }
    if (/^\d+\. /.test(line)) {
      const items = []
      while (index < lines.length && /^\d+\. /.test(lines[index])) { items.push(lines[index].replace(/^\d+\. /, '')); index += 1 }
      blocks.push(<ol key={index} className="my-3 list-decimal space-y-1.5 pl-5 text-slate-600">{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item, `o${index}-${itemIndex}`)}</li>)}</ol>)
      continue
    }
    const paragraph = []
    while (index < lines.length && lines[index].trim() && !/^(#{1,4} |```|[->*] |\d+\. |>|\|)/.test(lines[index])) {
      paragraph.push(lines[index])
      index += 1
    }
    if (!paragraph.length) { index += 1; continue }
    blocks.push(<p key={index} className="my-3 text-[15px] leading-7 text-slate-600">{inline(paragraph.join(' '), `p${index}`)}</p>)
  }
  return <div>{blocks.map((block, key) => <Fragment key={key}>{block}</Fragment>)}</div>
}
