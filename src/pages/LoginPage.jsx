import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import plusLogo from '../assets/plusLogo.png'
import { useAuth } from '../context/AuthContext'

function getDefaultAppPath(user) {
  const role = String(user?.role || '').toLowerCase()
  if (role === 'sales') return '/app/sales'
  return '/app'
}

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, user } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (isAuthenticated) {
      const nextPath = location.state?.from?.pathname || getDefaultAppPath(user)
      navigate(nextPath, { replace: true })
    }
  }, [isAuthenticated, location.state, navigate, user])

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    if (!identifier.trim() || !password.trim()) {
      setErrorMessage('Enter both email/username and password to continue.')
      return
    }

    setIsSubmitting(true)
    try {
      const nextUser = await login(identifier.trim(), password)
      const nextPath = location.state?.from?.pathname || getDefaultAppPath(nextUser)
      navigate(nextPath, { replace: true })
    } catch (error) {
      setErrorMessage(error.message || 'Invalid credentials. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell">
        <section className="login-brand-panel">
          <div className="login-brand-stack">
            <img src={plusLogo} alt="Plus Yoghurt logo" className="login-brand-logo" />
            <div className="login-brand-copy">
              <h1>Plus Treat</h1>
              <p>Yoghurt business management system</p>
            </div>
          </div>
        </section>

        <section className="login-form-panel">
          <form className="login-form-card" onSubmit={handleSubmit}>
            <div className="login-form-header">
              <span className="login-kicker">Staff Login</span>
              <h2>Welcome back</h2>
            </div>

            <label className="login-field">
              <span>Email or Username</span>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="staff@plustreat.com"
                autoComplete="username"
                autoFocus
              />
            </label>

            <label className="login-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
              />
            </label>

            <button type="submit" className="login-button" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>

            {errorMessage ? <p className="login-error">{errorMessage}</p> : null}
          </form>
        </section>
      </section>
    </main>
  )
}

export default LoginPage
