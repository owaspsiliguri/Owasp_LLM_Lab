import { Link } from 'react-router-dom'
import { useModules } from '../hooks/useModules.js'
import { Loading } from '../components/ui.jsx'
import { useProgress } from '../hooks/useProgress.jsx'

const PATHS = [
  {
    title: 'Foundations: input and context',
    desc: 'How untrusted text and over-shared context break LLM applications — the two flaws behind most real-world LLM incidents.',
    learns: ['Why one concatenated prompt channel is an attack surface', 'What must never enter a context window', 'Role separation, least-privilege context and output redaction'],
    ids: ['llm01', 'llm02'],
  },
  {
    title: 'Downstream safety',
    desc: 'What happens when model output reaches browsers, databases and business logic. The model is only the beginning of the blast radius.',
    learns: ['How model output becomes XSS, SQL injection and privilege escalation', 'Encoding, parameterisation and schema validation as output handling'],
    ids: ['llm01', 'llm10'],
  },
  {
    title: 'RAG and knowledge integrity',
    desc: 'Poisoned knowledge bases and ungrounded answers over a real ChromaDB vector store — retrieval is evidence, not truth.',
    learns: ['How provenance attacks steer a retrieval pipeline', 'Grounding, citations, confidence scoring and abstention'],
    ids: ['llm03', 'llm09'],
  },
  {
    title: 'Availability and cost',
    desc: 'Resource exhaustion and runaway spend, simulated safely in virtual units. Your attacker never touches a real GPU or a real credit card.',
    learns: ['Disproportionate-compute request shapes', 'Why looped calls with growing context cost quadratically', 'Cost guards, quotas and complexity scoring'],
    ids: ['llm04', 'llm06'],
  },
  {
    title: 'Trust and oversight',
    desc: 'Dependencies you did not write, tools the model can call, and reviews you should not delegate. Autonomy without authorisation is the theme.',
    learns: ['Typosquatting and tampered artifacts in ML supply chains', 'Excessive agency and the missing authorisation check', 'Why model confidence is not evidence of correctness'],
    ids: ['llm05', 'llm07', 'llm08'],
  },
  {
    title: 'Full track',
    desc: 'All ten modules in recommended order, each ending with hands-on remediation — the complete path from curious to dangerous.',
    learns: ['Every OWASP Top 10 for LLM Applications risk, exploited and fixed', 'A portfolio of validated remediations you wrote yourself'],
    ids: ['llm01', 'llm02', 'llm10', 'llm03', 'llm05', 'llm04', 'llm06', 'llm07', 'llm09', 'llm08'],
  },
]

export default function Paths() {
  const { modules, loading, error } = useModules()
  const { modules: progress } = useProgress()
  if (loading || error) return <Loading error={error} />
  const byId = Object.fromEntries(modules.map((m) => [m.id, m]))
  const done = (id) => { const p = progress[id] || {}; return p.flag && p.fixit }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Learning paths</h1>
        <p className="mt-1 max-w-prose text-fog-300">Curated tracks through the labs. Each track builds one theme end-to-end: learn the failure, exploit it, then fix it. Progress counts when a lab has both its flag and its fix.</p>
      </div>
      {PATHS.map((p) => {
        const labs = p.ids.filter((id) => byId[id])
        const complete = labs.filter(done).length
        const minutes = labs.reduce((sum, id) => sum + (byId[id].estimated_minutes || 0), 0)
        const next = labs.find((id) => !done(id)) || labs[0]
        return (
          <section key={p.title} className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-medium">{p.title}</h2>
                <p className="mt-1 max-w-prose text-fog-300">{p.desc}</p>
              </div>
              <div className="text-right text-sm text-fog-500">
                <div>{complete}/{labs.length} complete</div>
                <div>~{minutes} min total</div>
              </div>
            </div>
            <div className="mt-3 h-2 rounded bg-ink-700" role="progressbar" aria-valuenow={labs.length ? Math.round((complete / labs.length) * 100) : 0} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.title} progress`}>
              <div className="h-2 rounded bg-steel-500" style={{ width: `${labs.length ? (complete / labs.length) * 100 : 0}%` }} />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-fog-500">Labs in this track</h3>
                <ol className="mt-2 space-y-1">
                  {labs.map((id) => (
                    <li key={id} className="flex items-center gap-2 text-sm">
                      <span aria-hidden className={done(id) ? 'text-safe-400' : 'text-fog-500'}>{done(id) ? '✔' : '○'}</span>
                      <Link className="text-steel-400 underline" to={`/labs/${id}`}>{byId[id].owasp_id}: {byId[id].name}</Link>
                      <span className="text-xs text-fog-500">({byId[id].difficulty}, {byId[id].estimated_minutes} min)</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="text-sm font-medium text-fog-500">What you will learn</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fog-300">{p.learns.map((l) => <li key={l}>{l}</li>)}</ul>
              </div>
            </div>
            <Link className="btn btn-primary mt-4" to={`/labs/${next}`}>{complete ? 'Continue track' : 'Start track'}</Link>
          </section>
        )
      })}
    </div>
  )
}
