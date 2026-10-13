// Base URL for the written lab guides in the repository. Forks can point
// VITE_GUIDE_BASE at their own copy of labs/guided/.
export const GUIDE_BASE = (import.meta.env.VITE_GUIDE_BASE || 'https://github.com/owaspsiliguri/Owasp_LLM_Lab/blob/main').replace(/\/+$/, '')

export function guideUrl(moduleId) {
  return `${GUIDE_BASE}/labs/guided/${moduleId}.md`
}
