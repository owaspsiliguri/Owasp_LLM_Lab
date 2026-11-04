import { labStatus } from '../hooks/useProgress.jsx'

export const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced', 'Expert']

const RISK_NAMES = {
  LLM01: 'Prompt Injection',
  LLM02: 'Sensitive Information Disclosure',
  LLM03: 'Supply Chain',
  LLM04: 'Data and Model Poisoning',
  LLM05: 'Improper Output Handling',
  LLM06: 'Excessive Agency',
  LLM07: 'System Prompt Leakage',
  LLM08: 'Vector and Embedding Weaknesses',
  LLM09: 'Misinformation',
  LLM10: 'Unbounded Consumption',
}

export function riskOf(module) {
  const code = String(module?.category || '').split(':')[0] || 'LLM'
  return { code, name: RISK_NAMES[code] || module?.category || 'Unclassified' }
}

export function risksIn(modules) {
  const codes = [...new Set(modules.map((module) => riskOf(module).code))]
  return codes.map((code) => ({ code, name: RISK_NAMES[code] || code, count: modules.filter((module) => riskOf(module).code === code).length }))
}

export const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'not-started', label: 'Not started' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'flag', label: 'Flag captured' },
  { value: 'completed', label: 'Completed' },
]

function statusMatches(entry, status) {
  if (status === 'flag') return Boolean(entry.flag)
  if (status === 'completed') return labStatus(entry) === 'completed'
  if (status === 'not-started') return !entry.explored && !entry.flag && !entry.fixit
  if (status === 'in-progress') return labStatus(entry) === 'in-progress'
  return true
}

export function filterModules(modules, { q = '', level = 'All', category = 'All', status = 'all' } = {}, progress = { modules: {} }) {
  const needle = String(q).trim().toLowerCase()
  return modules.filter((module) => {
    if (level !== 'All' && module.difficulty !== level) return false
    if (category !== 'All' && riskOf(module).code !== category) return false
    if (!statusMatches(progress.modules?.[module.id] || {}, status)) return false
    if (!needle) return true
    const haystack = [
      module.name, module.overview, module.category, module.owasp_id,
      ...(module.objectives || []), ...(module.prerequisites || []),
    ].join(' ').toLowerCase()
    return haystack.includes(needle)
  })
}

export function sequenceFor(modules, params, progress, paths = []) {
  const path = paths.find((item) => item.slug === params.path)
  const base = path
    ? path.ids.map((id) => modules.find((module) => module.id === id)).filter(Boolean)
    : modules
  const level = DIFFICULTIES.includes(params.level) ? params.level : 'All'
  const status = STATUS_FILTERS.some((item) => item.value === params.status) ? params.status : 'all'
  return filterModules(base, {
    q: params.q || '',
    level,
    category: params.category || 'All',
    status,
  }, progress)
}

export function filterQuery(filters) {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.level && filters.level !== 'All') params.set('level', filters.level)
  if (filters.category && filters.category !== 'All') params.set('category', filters.category)
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters.path) params.set('path', filters.path)
  const query = params.toString()
  return query ? `?${query}` : ''
}
