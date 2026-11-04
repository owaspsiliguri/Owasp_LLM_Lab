import { useCallback, useEffect, useMemo, useState } from 'react'
import { useModules } from '../hooks/useModules.js'
import { supabase } from '../services/supabase.js'
import { Badge, EmptyState, Loading, PageHeader, ProgressBar, Stat } from '../components/ui.jsx'
import Icon from '../components/Icons.jsx'

function percentOf(row, total) {
  if (!total) return 0
  return Math.round(((row.explored + row.flags + row.fixes) / (total * 3)) * 100)
}

function formatDate(value, withTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export default function Admin() {
  const { modules } = useModules()
  const total = modules.length
  const [state, setState] = useState({ loading: true, error: null, profiles: [], progress: [], attempts: [], attemptCount: 0 })
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    const sb = supabase()
    if (!sb) {
      setState({ loading: false, error: 'Supabase is not configured on this deployment.', profiles: [], progress: [], attempts: [], attemptCount: 0 })
      return
    }
    setState((current) => ({ ...current, loading: true, error: null }))
    const [profiles, progress, attempts, attemptCount] = await Promise.all([
      sb.from('profiles').select('id,email,full_name,role,created_at,last_sign_in_at').order('created_at'),
      sb.from('progress').select('user_id,module_id,explored,flag,fixit,updated_at'),
      sb.from('attempts').select('id,user_id,module_id,kind,correct,created_at').order('created_at', { ascending: false }).limit(60),
      sb.from('attempts').select('id', { count: 'exact', head: true }),
    ])
    const error = profiles.error || progress.error || attempts.error || attemptCount.error
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
      const aggregate = perUser.get(row.user_id) || { explored: 0, flags: 0, fixes: 0 }
      if (row.explored) aggregate.explored += 1
      if (row.flag) aggregate.flags += 1
      if (row.fixit) aggregate.fixes += 1
      perUser.set(row.user_id, aggregate)
    }
    const needle = query.trim().toLowerCase()
    return state.profiles
      .filter((profile) => profile.role === 'student')
      .filter((profile) => !needle || (profile.email || '').toLowerCase().includes(needle) || (profile.full_name || '').toLowerCase().includes(needle))
      .map((profile) => {
        const aggregate = perUser.get(profile.id) || { explored: 0, flags: 0, fixes: 0 }
        return { ...profile, ...aggregate, percent: percentOf(aggregate, total) }
      })
      .sort((a, b) => b.percent - a.percent || (a.email || '').localeCompare(b.email || ''))
  }, [state, query, total])

  const stats = useMemo(() => ({
    students: state.profiles.filter((profile) => profile.role === 'student').length,
    flags: state.progress.filter((row) => row.flag).length,
    fixes: state.progress.filter((row) => row.fixit).length,
    explored: state.progress.filter((row) => row.explored).length,
  }), [state])

  const emailById = useMemo(() => new Map(state.profiles.map((profile) => [profile.id, profile.email])), [state.profiles])

  if (state.loading) return <Loading>Loading admin data…</Loading>

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Admin console"
        description="Every account, lab run, captured flag and validated fix. Data is read directly from the Supabase project attached to this deployment."
        actions={(
          <>
            <label className="sr-only" htmlFor="admin-search">Search students</label>
            <input
              id="admin-search" className="input w-full sm:w-64" placeholder="Search email or name…"
              value={query} onChange={(event) => setQuery(event.target.value)} type="search"
            />
            <button type="button" className="btn" onClick={load} disabled={state.loading}>
              <Icon name="refresh" size={14} />
              Refresh
            </button>
          </>
        )}
      />

      {state.error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">Could not load admin data</p>
          <p className="mt-1">{state.error}</p>
          <p className="mt-1 text-xs">If this is a fresh project, run <code className="rounded bg-white px-1 font-mono">supabase/schema.sql</code> in the Supabase SQL editor.</p>
        </div>
      )}

      <section aria-label="Platform totals" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Stat label="Students" value={stats.students} icon="user" />
        <Stat label="Labs explored" value={stats.explored} icon="labs" />
        <Stat label="Flags captured" value={stats.flags} icon="flag" />
        <Stat label="Fixes validated" value={stats.fixes} icon="code" />
        <Stat label="Attempts logged" value={state.attemptCount} icon="terminal" />
      </section>

      <section aria-labelledby="students-heading">
        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            <h2 id="students-heading" className="text-lg font-semibold text-ink">Students</h2>
            <p className="text-sm text-slate-500">{rows.length} {rows.length === 1 ? 'account' : 'accounts'}{query ? ` matching “${query}”` : ''}.</p>
          </div>
          <span className="hidden text-xs text-slate-500 sm:block">{total} labs in the catalogue</span>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon="user"
            title={query ? 'No student matches that search' : 'No students yet'}
            body={query ? 'Try a different email or name.' : 'Share the signup link with your class and their progress will appear here.'}
          />
        ) : (
          <>
            <div className="card hidden overflow-hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] text-left text-sm">
                  <thead className="border-b border-line bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-medium">Student</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Joined</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Explored</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Flags</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Fixes</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink">{row.email}</p>
                          {row.full_name && <p className="text-xs text-slate-500">{row.full_name}</p>}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(row.created_at)}</td>
                        <td className="px-4 py-3 text-slate-600">{row.explored}/{total}</td>
                        <td className="px-4 py-3 text-slate-600">{row.flags}/{total}</td>
                        <td className="px-4 py-3 text-slate-600">{row.fixes}/{total}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ProgressBar value={row.percent} size="sm" className="w-28" label={`${row.email} progress`} />
                            <span className="text-xs text-slate-500">{row.percent}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <ul className="space-y-2 md:hidden">
              {rows.map((row) => (
                <li key={row.id} className="card p-4">
                  <p className="break-all text-sm font-medium text-ink">{row.email}</p>
                  {row.full_name && <p className="text-xs text-slate-500">{row.full_name}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge>{row.explored} explored</Badge>
                    <Badge>{row.flags} flags</Badge>
                    <Badge>{row.fixes} fixes</Badge>
                  </div>
                  <ProgressBar value={row.percent} size="sm" className="mt-3" label={`${row.email} progress`} />
                  <p className="mt-1 text-xs text-slate-500">Joined {formatDate(row.created_at)}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card overflow-hidden" aria-labelledby="activity-heading">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
          <h2 id="activity-heading" className="text-sm font-semibold text-ink">Recent attempts</h2>
          <span className="text-xs text-slate-500">Newest first, 60 shown</span>
        </div>
        {state.attempts.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No flag or Fix-It attempts have been recorded yet.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {state.attempts.map((attempt) => (
              <li key={attempt.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm sm:px-5">
                <span className="min-w-0 truncate text-slate-700">{emailById.get(attempt.user_id) || 'unknown user'}</span>
                <span className="font-mono text-[11px] text-slate-500">{attempt.module_id.toUpperCase()}</span>
                <span className="badge badge-neutral capitalize">{attempt.kind}</span>
                <span className={attempt.correct ? 'text-xs font-medium text-emerald-700' : 'text-xs font-medium text-red-700'}>
                  {attempt.correct ? 'passed' : 'failed'}
                </span>
                <span className="ml-auto text-xs text-slate-400">{formatDate(attempt.created_at, true)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
