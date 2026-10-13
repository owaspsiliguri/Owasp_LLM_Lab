import { Link } from 'react-router-dom'
import { useModules } from '../hooks/useModules.js'
import { Loading } from '../components/ui.jsx'

const PATHS = [
  { title: 'Foundations: input and context', desc: 'How untrusted text and over-shared context break LLM applications.', ids: ['llm01', 'llm02'] },
  { title: 'Downstream safety', desc: 'What happens when model output reaches browsers, databases and business logic.', ids: ['llm01', 'llm10'] },
  { title: 'RAG and knowledge integrity', desc: 'Poisoned knowledge bases and ungrounded answers over a real ChromaDB.', ids: ['llm03', 'llm09'] },
  { title: 'Availability and cost', desc: 'Resource exhaustion and runaway spend, simulated safely in virtual units.', ids: ['llm04', 'llm06'] },
  { title: 'Trust and oversight', desc: 'Dependencies you did not write, tools the model can call, and reviews you should not delegate.', ids: ['llm05', 'llm07', 'llm08'] },
  { title: 'Full track', desc: 'All ten modules in recommended order, each ending with hands-on remediation.', ids: ['llm01', 'llm02', 'llm10', 'llm03', 'llm05', 'llm04', 'llm06', 'llm07', 'llm09', 'llm08'] },
]

export default function Paths() {
  const { modules, loading, error } = useModules()
  if (loading || error) return <Loading error={error} />
  const byId = Object.fromEntries(modules.map((m) => [m.id, m]))
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Learning paths</h1>
      {PATHS.map((p) => (
        <section key={p.title} className="panel p-4">
          <h2 className="font-medium">{p.title}</h2>
          <p className="text-sm text-fog-300">{p.desc}</p>
          <ol className="mt-3 space-y-1">
            {p.ids.filter((id) => byId[id]).map((id) => <li key={id}><Link className="text-steel-400 underline" to={`/labs/${id}`}>{byId[id].owasp_id}: {byId[id].name}</Link> <span className="text-xs text-fog-500">({byId[id].estimated_minutes} min)</span></li>)}
          </ol>
        </section>
      ))}
    </div>
  )
}
