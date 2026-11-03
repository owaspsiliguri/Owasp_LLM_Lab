// The single source of the scoring table shown in the UI. It mirrors the
// server-side leaderboard formula (flag 100 · fix-it 150 · explored 10), so a
// learner always sees exactly what the ranking will count.
export const POINTS = {
  explored: 10,
  flag: 100,
  fixit: 150,
}

export const LAB_MAX_POINTS = POINTS.explored + POINTS.flag + POINTS.fixit

export const POINT_ROWS = [
  { field: 'explored', label: 'Run the vulnerable lab', points: POINTS.explored },
  { field: 'flag', label: 'Capture the flag', points: POINTS.flag },
  { field: 'fixit', label: 'Pass Fix-It validation', points: POINTS.fixit },
]

export function labPoints(done = {}) {
  let total = 0
  for (const { field, points } of POINT_ROWS) if (done[field]) total += points
  return total
}

export function scoreOf(modules = [], progress = {}) {
  const map = progress.modules || {}
  return modules.reduce((sum, m) => sum + labPoints(map[m.id] || {}), 0)
}
