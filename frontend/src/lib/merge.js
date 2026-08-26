// Merging two copies of one profile — this device's and the server's.
//
// Sync used to be last-write-wins on the whole blob: edit the plan on your laptop while a
// workout is still being logged on your phone, and whichever copy arrived second silently
// deleted the other's work. The blob is still one unit everywhere else (there is no field
// the server understands inside it), so the merge stays deliberately small:
//
//   · everything a profile *is* — plan, routines, settings — resolves to the newer snapshot
//     by `_ts`. Two devices editing the plan at once is a conflict a person has to settle;
//     guessing here would be worse than picking.
//   · everything a profile *accumulates* — logged workouts and weigh-ins — is unioned.
//     These rows are only ever appended in normal use, so a row one side has and the other
//     lacks was logged, not deleted, and dropping it would lose real history.
//
// Pure function of the two snapshots; the caller owns what happens with the result.

const clone = o => JSON.parse(JSON.stringify(o))

// A logged session's identity. Sessions have carried their own uid since they gained one;
// rows from before (and from imports, which never had one) fall back to what distinguishes
// them — the day is not enough on its own, two-a-days exist.
const wId = w => w.id || (w.d + '|' + (w.start || 0) + '|' + (w.name || ''))

/**
 * Merge two snapshots of the same profile. Either side may be null (nothing stored there
 * yet). Returns a fresh object; neither input is touched. `active` is deliberately not
 * special-cased: the server never stores it, and the caller restores the local session.
 */
export function mergeStates(local, server) {
  if (!local) return server ? clone(server) : null
  if (!server) return clone(local)
  const newer = (server._ts || 0) >= (local._ts || 0) ? server : local
  const older = newer === server ? local : server
  const out = clone(newer)

  const seenW = new Set((out.workouts || []).map(wId))
  const extraW = (older.workouts || []).filter(w => w && !seenW.has(wId(w)))
  // Same order mergeImport keeps: by day, then by start within a day — the progression
  // engine reads the log oldest-first and trusts the array order.
  if (extraW.length) out.workouts = (out.workouts || []).concat(extraW)
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : (a.start || 0) - (b.start || 0)))

  // One weigh-in per day: on a clash the newer snapshot's row already won above, so only
  // days the newer side doesn't know about arrive here.
  const seenD = new Set((out.bodyweight || []).map(b => b.d))
  const extraB = (older.bodyweight || []).filter(b => b && b.d != null && !seenD.has(b.d))
  if (extraB.length) out.bodyweight = (out.bodyweight || []).concat(extraB)
    .sort((a, b) => (a.d < b.d ? -1 : 1))

  out._ts = Math.max(local._ts || 0, server._ts || 0)
  return out
}

/**
 * Whether `local` holds anything the server is missing — log rows the server lacks, or a
 * newer `_ts` (i.e. settings/plan edits not yet pushed). What decides after a pull whether
 * this device owes the server an upload.
 */
export function localOnly(local, server) {
  if (!local) return false
  if (!server) return !!((local.workouts || []).length || (local.bodyweight || []).length)
  const sw = new Set((server.workouts || []).map(wId))
  const sd = new Set((server.bodyweight || []).map(b => b.d))
  return (local.workouts || []).some(w => w && !sw.has(wId(w))) ||
    (local.bodyweight || []).some(b => b && b.d != null && !sd.has(b.d)) ||
    (local._ts || 0) > (server._ts || 0)
}
