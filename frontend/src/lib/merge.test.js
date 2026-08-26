import { describe, it, expect } from 'vitest'
import { mergeStates, localOnly } from './merge.js'

const W = (id, d, start, name = 'Push') => ({ id, d, start, name, entries: [{ id: '0025', sets: [{ w: 60, r: 8, done: true }] }] })
const B = (d, w) => ({ d, w })

describe('mergeStates', () => {
  it('returns the only copy when the other side is empty', () => {
    const s = { _ts: 5, workouts: [W('a', '2026-01-01', 1)] }
    expect(mergeStates(null, s)).toEqual(s)
    expect(mergeStates(s, null)).toEqual(s)
    expect(mergeStates(null, null)).toBe(null)
  })

  it('never returns one of its inputs — callers mutate freely', () => {
    const s = { _ts: 5, workouts: [W('a', '2026-01-01', 1)] }
    const out = mergeStates(null, s)
    expect(out).not.toBe(s)
    expect(out.workouts).not.toBe(s.workouts)
  })

  it('takes plan and settings from the newer snapshot', () => {
    const local = { _ts: 10, unit: 'lb', routines: [{ id: 'r1' }] }
    const server = { _ts: 20, unit: 'kg', routines: [{ id: 'r2' }] }
    const out = mergeStates(local, server)
    expect(out.unit).toBe('kg')
    expect(out.routines).toEqual([{ id: 'r2' }])
    // and the other way around — "newer" is not "server"
    expect(mergeStates({ _ts: 20, unit: 'lb' }, { _ts: 10, unit: 'kg' }).unit).toBe('lb')
  })

  it('unions workouts the newer side has not seen, in day order', () => {
    const local = { _ts: 30, workouts: [W('b', '2026-01-03', 3)] }
    const server = { _ts: 20, workouts: [W('a', '2026-01-01', 1), W('c', '2026-01-05', 5)] }
    const out = mergeStates(local, server)
    expect(out.workouts.map(w => w.id)).toEqual(['a', 'b', 'c'])
  })

  it('never duplicates a workout both sides already have', () => {
    const local = { _ts: 30, workouts: [W('a', '2026-01-01', 1)] }
    const server = { _ts: 20, workouts: [W('a', '2026-01-01', 1)] }
    expect(mergeStates(local, server).workouts).toHaveLength(1)
  })

  it('identifies legacy rows without an id by day, start and name', () => {
    const mk = () => ({ d: '2026-01-01', start: 7, name: 'Pull', entries: [] })
    const out = mergeStates({ _ts: 2, workouts: [mk()] }, { _ts: 1, workouts: [mk()] })
    expect(out.workouts).toHaveLength(1)
    // same day, different session — a two-a-day is two rows, not a clash
    const other = { d: '2026-01-01', start: 9, name: 'Pull', entries: [] }
    expect(mergeStates({ _ts: 2, workouts: [mk()] }, { _ts: 1, workouts: [other] }).workouts).toHaveLength(2)
  })

  it('unions weigh-ins by day; on a clash the newer snapshot wins', () => {
    const local = { _ts: 30, bodyweight: [B('2026-01-02', 80.1)] }
    const server = { _ts: 20, bodyweight: [B('2026-01-01', 80.5), B('2026-01-02', 79.9)] }
    const out = mergeStates(local, server)
    expect(out.bodyweight.map(b => b.d)).toEqual(['2026-01-01', '2026-01-02'])
    expect(out.bodyweight[1].w).toBe(80.1)   // local was newer for that day's row
  })

  it('stamps the result with the newest _ts of the two', () => {
    expect(mergeStates({ _ts: 3 }, { _ts: 9 })._ts).toBe(9)
    expect(mergeStates({ _ts: 9 }, { _ts: 3 })._ts).toBe(9)
  })

  it('survives missing arrays on either side', () => {
    const out = mergeStates({ _ts: 2 }, { _ts: 1, workouts: [W('a', '2026-01-01', 1)] })
    expect(out.workouts.map(w => w.id)).toEqual(['a'])
    expect(mergeStates({ _ts: 2, workouts: [W('a', '2026-01-01', 1)] }, { _ts: 1 }).workouts).toHaveLength(1)
  })

  it('ties on _ts go to the server — it saw both devices more recently', () => {
    const out = mergeStates({ _ts: 5, unit: 'lb' }, { _ts: 5, unit: 'kg' })
    expect(out.unit).toBe('kg')
  })
})

describe('localOnly', () => {
  it('is false for an empty local side', () => {
    expect(localOnly(null, { _ts: 1 })).toBe(false)
  })

  it('is true when there is no server copy but local rows exist', () => {
    expect(localOnly({ workouts: [W('a', '2026-01-01', 1)] }, null)).toBe(true)
    expect(localOnly({ workouts: [], bodyweight: [] }, null)).toBe(false)
  })

  it('spots a workout or weigh-in the server lacks', () => {
    const server = { _ts: 9, workouts: [W('a', '2026-01-01', 1)], bodyweight: [B('2026-01-01', 80)] }
    expect(localOnly({ _ts: 1, workouts: [W('a', '2026-01-01', 1)] }, server)).toBe(false)
    expect(localOnly({ _ts: 1, workouts: [W('a', '2026-01-01', 1), W('b', '2026-01-02', 2)] }, server)).toBe(true)
    expect(localOnly({ _ts: 1, bodyweight: [B('2026-01-02', 79)] }, server)).toBe(true)
  })

  it('is true when local settings are simply newer', () => {
    expect(localOnly({ _ts: 10 }, { _ts: 9 })).toBe(true)
    expect(localOnly({ _ts: 9 }, { _ts: 10 })).toBe(false)
  })
})
