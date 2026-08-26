import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { webauthnOK, passkeyLogin, passkeyRegister, loginWithPassword, registerWithPassword, api, BIO, setAuthToken } from '../lib/api.js'
import { MOBILE, mobileLogin, mobileRegister } from '../lib/mobile.js'
import { hasData } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { DEMO, REPO } from '../lib/demo.js'
import { useState, useRef, useEffect } from 'react'
import Icon from '../components/Icon.jsx'
import { Button, TextField } from '../components/ui.jsx'

function LoginForm({ close }) {
  const { setUser, pushState, pullState } = useStore()
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [inviteOnly, setInviteOnly] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const usernameRef = useRef(null)
  const passwordRef = useRef(null)

  useEffect(() => { api('/api/config').then(c => setInviteOnly(!!c.invite_only)).catch(() => {}) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (isRegister) {
        if (password !== confirmPassword) { setError('Passwords do not match'); return }
        // Mobile persists the token to a file (WebView memory doesn't survive restarts);
        // the web build rides on the session cookie alone.
        const u = MOBILE
          ? await mobileRegister(username.trim().toLowerCase(), name.trim(), password, code.trim().toUpperCase())
          : await registerWithPassword(username.trim().toLowerCase(), name.trim(), password, code.trim().toUpperCase())
        setUser(u); close()
        if (hasData(useStore.getState().S)) { await pushState(); useUI.getState().toast(t('Profile created — data from this device moved into it')) }
        else { await pullState(); useUI.getState().toast(t('Welcome, {0}', u.name)) }
      } else {
        const u = MOBILE
          ? await mobileLogin(username.trim().toLowerCase(), password)
          : await loginWithPassword(username.trim().toLowerCase(), password)
        setUser(u); await pullState(); close()
        useUI.getState().toast(t('Welcome back, {0}', u.name))
      }
    } catch (e) { setError(e.message || t(isRegister ? 'Registration failed' : 'Sign-in failed')) }
  }

  const toggleMode = () => {
    setIsRegister(!isRegister)
    setError('')
    setUsername('')
    setName('')
    setPassword('')
    setConfirmPassword('')
    setCode('')
  }

  const title = isRegister ? t('Create your profile') : t('Sign in')
  const subtitle = isRegister
    ? t('Pick a username and name, then set a password. No passkey needed.')
    : t('Enter your username and password to continue.')

  return (
    <form onSubmit={handleSubmit} className="narrow" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3>{title}</h3>
      <div className="muted small" style={{ marginBottom: 4 }}>{subtitle}</div>
      {error && <div className="card small" style={{ background: 'var(--red)', color: 'white', padding: 10, borderRadius: 8 }}>{error}</div>}
      <TextField ref={usernameRef} placeholder={t('Username')} maxLength={40} value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} autoComplete="username" required />
      {isRegister && <TextField placeholder={t('Display name')} maxLength={40} value={name} onChange={e => setName(e.target.value)} autoComplete="name" required />}
      <TextField ref={passwordRef} type="password" placeholder={t('Password')} maxLength={100} value={password} onChange={e => setPassword(e.target.value)} autoComplete={isRegister ? 'new-password' : 'current-password'} required />
      {isRegister && <TextField type="password" placeholder={t('Confirm password')} maxLength={100} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" required />}
      {inviteOnly && (
        <>
          <div style={{ height: 10 }} />
          <TextField placeholder={t('Invite code')} maxLength={40} value={code} onChange={e => setCode(e.target.value.toUpperCase())} style={{ letterSpacing: '.14em', fontWeight: 600, textAlign: 'center' }} />
          <div className="dim small" style={{ marginTop: 6 }}>{t('This app is invite-only — enter the code you were given.')}</div>
        </>
      )}
      <Button variant="primary" type="submit" style={{ marginTop: 4 }}>{isRegister ? t('Create account') : t('Sign in')}</Button>
      <Button variant="ghost" type="button" onClick={toggleMode} className="dim" style={{ marginTop: -8 }}>
        {isRegister ? t('Already have an account? Sign in') : t('Need an account? Create one')}
      </Button>
    </form>
  )
}

function RegisterSheet({ close }) {
  const { setUser, pushState, pullState } = useStore()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [inviteOnly, setInviteOnly] = useState(false)
  const ref = useRef(null)
  useEffect(() => { setTimeout(() => ref.current?.focus(), 250) }, [])
  useEffect(() => { api('/api/config').then(c => setInviteOnly(!!c.invite_only)).catch(() => {}) }, [])
  const go = async () => {
    const n = name.trim()
    if (!n) { useUI.getState().toast(t('Enter a name')); return }
    if (inviteOnly && !code.trim()) { useUI.getState().toast(t('An invite code is required')); return }
    try {
      const u = await passkeyRegister(n, code.trim())
      setUser(u); close()
      if (hasData(useStore.getState().S)) { await pushState(); useUI.getState().toast(t('Profile created — data from this device moved into it')) }
      else { await pullState(); useUI.getState().toast(t('Welcome, {0}', u.name)) }
    } catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') useUI.getState().toast(e.message || t('Registration failed')) }
  }
  return <>
    <h3>{t('Create passkey profile')}</h3>
    <div className="muted small" style={{ marginBottom: 14 }}>{t('Pick a name, then confirm with {0}. The passkey is saved in your device — no password needed.', BIO)}</div>
    <input ref={ref} className="input" placeholder={t('Your name')} maxLength={40} value={name} onChange={e => setName(e.target.value)} />
    {inviteOnly && <>
      <div style={{ height: 10 }} />
      <input className="input" placeholder={t('Invite code')} maxLength={40} value={code}
        onChange={e => setCode(e.target.value.toUpperCase())} style={{ letterSpacing: '.14em', fontWeight: 600, textAlign: 'center' }} />
      <div className="dim small" style={{ marginTop: 6 }}>{t('This app is invite-only — enter the code you were given.')}</div>
    </>}
    <div style={{ height: 12 }} />
    <Button variant="primary" onClick={go}>{t('Create passkey')}</Button>
  </>
}

export default function Login() {
  const { setUser, pullState, setGuest } = useStore()
  const signIn = async () => {
    try { const u = await passkeyLogin(); setUser(u); await pullState(); useUI.getState().toast(t('Welcome back, {0}', u.name)) }
    catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') useUI.getState().toast(e.message || t('Sign-in failed')) }
  }
  const head = <>
    <div style={{ fontSize: 54, display: 'flex', justifyContent: 'center', color: 'var(--acc)' }}><Icon name="dumbbell" /></div>
    <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.028em', margin: '10px 0 4px' }}>openGym</h1>
  </>
  const wrap = { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '78vh', textAlign: 'center' }

  if (DEMO) return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 30 }}>{t('Live demo — everything stays in this browser.')}</div>
      <Button variant="primary" icon="sparkles" onClick={() => setGuest(true)}>{t('Start the demo')}</Button>
      <div className="card small muted" style={{ textAlign: 'left', marginTop: 16 }}>
        {t('This demo runs entirely in your browser on example data — nothing is sent anywhere. Passkey sign-in and sync across your devices come with the openGym server, which you get by self-hosting it.')}
      </div>
      <div className="dim small" style={{ marginTop: 22, lineHeight: 1.6 }}>
        <a href={REPO} target="_blank" rel="noopener">{t('Self-host it in a minute →')}</a>
      </div>
    </div>
  )

  return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 34 }}>{t('Your workouts. Your weights. Your profile.')}</div>
      <LoginForm />
      <div style={{ height: 10 }} />
      {webauthnOK() ? <>
        <div className="divider" style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--label-3)' }}>
          <div style={{ flex: 1, borderBottom: '1px solid var(--border)' }} />
          <span>{t('or')}</span>
          <div style={{ flex: 1, borderBottom: '1px solid var(--border)' }} />
        </div>
        <Button variant="primary" icon="person" onClick={signIn}>{t('Sign in with passkey')}</Button>
        <div style={{ height: 10 }} />
        <Button icon="sparkles" onClick={() => useUI.getState().openSheet(close => <RegisterSheet close={close} />)}>{t('Create passkey profile')}</Button>
        <div style={{ height: 10 }} />
      </> : <div className="card small muted" style={{ textAlign: 'left' }}>{t("This browser doesn't support passkeys — you can still use openGym with a username and password.")}</div>}
      <Button variant="ghost" className="dim" onClick={() => setGuest(true)}>{t('Continue without account')}</Button>
      <div className="dim small" style={{ marginTop: 26, lineHeight: 1.5 }}>{t('Passkeys use {0} — no passwords.', BIO)}<br />{t('Each profile keeps its own plan, workouts & body weight.')}</div>
    </div>
  )
}