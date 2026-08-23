// Mobile build (VITE_MOBILE=1) — the standalone app-store version (Capacitor native shell).
//
// Now supports optional server sync: if the user signs in with username/password,
// their data syncs to the self-hosted server. Without sign-in, it works fully offline
// like before. Unlike guest mode in a browser, this is the user's only copy of their
// training log, so it can't depend on WebView localStorage alone (iOS evicts that
// under storage pressure). Every persist() therefore also lands in a JSON file in the
// app's private data directory, and boot() restores from it. The workout reminder uses
// native local notifications scheduled per planned weekday — no server involved, unlike
// Web Push in the self-hosted version.
//
// Like the demo build, MOBILE is replaced at build time, so all of this folds away in
// web bundles; the Capacitor plugins are only ever imported behind it.
import { t } from './i18n.js'
import { api, setAuthToken, getAuthToken } from './api.js'

export const MOBILE = import.meta.env.VITE_MOBILE === '1'

const FILE = 'opengym-state.json'
const TOKEN_FILE = 'opengym-token.json'

export async function nativeLoad() {
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    const r = await Filesystem.readFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8 })
    return JSON.parse(r.data)
  } catch (e) { return null }
}

export async function nativeSave(state) {
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    await Filesystem.writeFile({ path: FILE, directory: Directory.Data, data: JSON.stringify(state), encoding: Encoding.UTF8 })
  } catch (e) { /* keep the localStorage copy */ }
}

export async function loadToken() {
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    const r = await Filesystem.readFile({ path: TOKEN_FILE, directory: Directory.Data, encoding: Encoding.UTF8 })
    const data = JSON.parse(r.data)
    if (data.token) setAuthToken(data.token)
    return data.token
  } catch { return null }
}

export async function saveToken(token) {
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    await Filesystem.writeFile({ path: TOKEN_FILE, directory: Directory.Data, data: JSON.stringify({ token }), encoding: Encoding.UTF8 })
  } catch (e) { /* ignore */ }
}

export async function clearToken() {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    await Filesystem.deleteFile({ path: TOKEN_FILE, directory: Directory.Data })
  } catch { /* ignore */ }
  setAuthToken(null)
}

// (Re)schedule the workout-day reminder: one repeating notification per weekday that has a
// routine in the weekly plan. Cheap enough to run after any state change — the plan or the
// reminder time may just have been edited. `interactive` gates the OS permission prompt to
// the Settings toggle; a background resync never pops a dialog.
export async function syncReminder(S, interactive = false) {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [0, 1, 2, 3, 4, 5, 6].map(d => ({ id: 100 + d })) }).catch(() => {})
    const r = S.reminder
    if (!r?.on) return true
    let perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted' && interactive) perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') return false
    const [hour, minute] = (r.time || '08:00').split(':').map(Number)
    const notifications = Object.entries(S.week || {})
      .filter(([, rid]) => rid && (S.routines || []).some(x => x.id === rid))
      .map(([day, rid]) => ({
        id: 100 + Number(day),
        title: t('Workout day'),
        body: t('{0} is on the plan today — let\'s go!', S.routines.find(x => x.id === rid).name),
        schedule: { on: { weekday: Number(day) + 1, hour, minute }, allowWhileIdle: true },
      }))
    if (notifications.length) await LocalNotifications.schedule({ notifications })
    return true
  } catch (e) { return false }
}

// WKWebView can't do blob-URL downloads, so the backup goes out through the OS share sheet
// (Files, AirDrop, mail, …) from a temp file instead.
export async function shareExport(json, filename) {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  const w = await Filesystem.writeFile({ path: filename, directory: Directory.Cache, data: json, encoding: Encoding.UTF8 })
  await Share.share({ title: filename, url: w.uri })
}

// Sync state with server if authenticated
export async function syncWithServer(S, push = true) {
  const token = getAuthToken()
  if (!token) return false
  try {
    if (push) {
      await api('/api/data', { method: 'PUT', body: JSON.stringify({ state: S }) })
    } else {
      const { state } = await api('/api/data')
      return state
    }
    return true
  } catch (e) {
    console.error('Server sync failed:', e)
    return false
  }
}

// Login with username/password on mobile
export async function mobileLogin(username, password) {
  const { user, token } = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
  setAuthToken(token)
  await saveToken(token)
  return user
}

// Register with username/password on mobile
export async function mobileRegister(username, name, password, code = '') {
  const { user, token } = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, name, password, code }) })
  setAuthToken(token)
  await saveToken(token)
  return user
}

// Logout on mobile
export async function mobileLogout() {
  const token = getAuthToken()
  if (token) {
    try { await api('/api/logout', { method: 'POST', body: '{}' }) } catch { /* ignore */ }
  }
  await clearToken()
}