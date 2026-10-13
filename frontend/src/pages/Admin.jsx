import { useCallback, useEffect, useMemo, useState } from 'react'
import { useModules } from '../hooks/useModules.js'
import { supabase } from '../services/supabase.js'
import { Loading, Stat } from '../components/ui.jsx'

function cellPercent(p, total) {
  const done = (p.explored ? 1 : 0) + (p.flag ? 1 : 0) + (p.fixit ? 1 : 0)
  return Math.round((done / (total * 3)) * 100)
}

function when(value) {
  if (!value) return '–'
  return new Date(value).toLocaleDateString()
}

export default function Admin() {
  const { modules } = useModules()
  const total = modules.length || 10
  const [state, setState] = useState({ loading: true, error: null, profiles: [], progress: [], attempts: [], attemptCount: 0 })
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    const sb = supabase()
    if (!sb) return
    setState((s) => ({ ...s, loading: true, error: null }))
    const [profiles, progress, attempts, attemptCount] = await Promise.all([
      sb.from('profiles').select('id,email,full_name,role,created_at,last_sign_in_at').order('created_at'),
      sb.from('progress').select('user_id,module_id,explored,flag,fixit,updated_at'),
      sb.from('attempts').select('id,user_id,module_id,kind,correct,created_at').order('created_at', { ascending: false }).limit(60),
      sb.from('attempts').select('id', { count: 'exact', head: true }),
    ])
    const error = profiles.error || progress.error || attempts.error
    setState({
      loading: false,
      error: error ? error.message : null,
      profiles: profiles.data || [],
      progress: progress.data || [],
      attempts: attempts.data || [],
      attemptCount: attemptCount.count || 0,
    })
  }, [])

  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    const perUser = new Map()
    for (const row of state.progress) {
      const agg = perUser.get(row.user_id) || { explored: 0, flags: 0, fixes: 0 }
      if (row.explored) agg.explored += 1
      if (row.flag) agg.flags += 1
      if (row.fixit) agg.fixes += 1
      perUser.set(row.user_id, agg)
    }
    const emailOf = new Map(state.profiles.map((p) => [p.id, p.email]))
    const needle = query.trim().toLowerCase()
    return state.profiles
      .filter((p) => p.role === 'student')
      .filter((p) => !needle || (p.email || '').toLowerCase().includes(needle) || (p.full_name || '').toLowerCase().includes(needle))
      .map((p) => {
        const agg = perUser.get(p.id) || { explored: 0, flags: 0, fixes: 0 }
        return { ...p, ...agg, percent: cellPercent({ explored: agg.explored > 0, flag: agg.flags > 0, fixit: agg.fixes > 0 }, total) }
      })
      .sort((a, b) => b.percent - a.percent || (a.email || '').localeCompare(b.email || ''))
  }, [state, query, total])

  const stats = useMemo(() => {
    const students = state.profiles.filter((p) => p.role === 'student').length
    const flags = state.progress.filter((p) => p.flag).length
    const fixes = state.progress.filter((p) => p.fixit).length
    const explored = state.progress.filter((p) => p.explored).length
    return { students, flags, fixes, explored }
  }, [state])

  if (state.loading) return <Loading />

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admin console</h1>
          <p className="mt-1 text-sm text-fog-300">Every account, lab run, captured flag and validated fix in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <input aria-label="Search students" className="input w-56" placeholder="Search by email or name…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn" onClick={load} disabled={state.loading}>Refresh</button>
        </div>
      </header>

      {state.error && (
        <p role="alert" className="panel border-vuln-400/50 p-4 text-vuln-400">
          Could not load admin data: {state.error}. If this is a fresh project, run <code>supabase/schema.sql</code> in the Supabase SQL editor.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Students" value={stats.students} />
        <Stat label="Labs explored" value={stats.explored} />
        <Stat label="Flags captured" value={stats.flags} />
        <Stat label="Fixes validated" value={stats.fixes} />
        <Stat label="Attempts logged" value={state.attemptCount} />
      </div>

      <section className="panel overflow-x-auto" aria-label="Students">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-700 text-fog-500">
            <tr>
              <th className="p-3">Student</th><th className="p-3">Joined</th><th className="p-3">Last sign-in</th>
              <th className="p-3">Explored</th><th className="p-3">Flags</th><th className="p-3">Fixes</th><th className="p-3">Progress</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-ink-800">
                <td className="p-3">
                  <div className="text-fog-100">{r.email}</div>
                  {r.full_name && <div className="text-xs text-fog-500">{r.full_name}</div>}
                </td>
                <td className="p-3 text-fog-300">{when(r.created_at)}</td>
                <td className="p-3 text-fog-300">{when(r.last_sign_in_at)}</td>
                <td className="p-3 text-fog-300">{r.explored}/{total}</td>
                <td className="p-3 text-fog-300">{r.flags}/{total}</td>
                <td className="p-3 text-fog-300">{r.fixes}/{total}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded bg-ink-700" role="progressbar" aria-valuenow={r.percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.email} progress`}>
                      <div className="h-2 rounded bg-steel-500" style={{ width: `${r.percent}%` }} />
                    </div>
                    <span className="text-xs text-fog-300">{r.percent}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-4 text-fog-500" colSpan={7}>
                {query ? 'No student matches that search.' : 'No students yet. Share the /signup link with your class.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="panel p-4" aria-label="Recent activity">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Recent activity</h2>
          <span className="text-xs text-fog-500">Newest first</span>
        </div>
        {state.attempts.length === 0 ? (
          <p className="mt-2 text-sm text-fog-500">No flag or fix attempts recorded yet.</p>
        ) : (
          <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto text-sm">
            {state.attempts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 border-b border-ink-800 py-1.5 text-fog-300">
                <span className="text-fog-100">{emailFor(state.profiles, a.user_id)}</span>
                <span className="text-fog-500">·</span>
                <span className="font-mono text-xs">{a.module_id.toUpperCase()}</span>
                <span className="rounded border border-ink-600 px-1.5 py-0.5 text-xs uppercase text-fog-500">{a.kind}</span>
                <span className={a.correct ? 'text-safe-400' : 'text-vuln-400'}>{a.correct ? 'passed' : 'failed'}</span>
                <span className="ml-auto text-xs text-fog-500">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function emailFor(profiles, userId) {
  const p = profiles.find((x) => x.id === userId)
  return p ? p.email : 'unknown user'
}
