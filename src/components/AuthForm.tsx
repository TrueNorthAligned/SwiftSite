import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

interface AuthFormProps {
  onSuccess?: () => void;
}

export default function AuthForm({ onSuccess }: AuthFormProps) {
  const { login, signup, user, logout } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const result = mode === 'login'
      ? await login(email, password)
      : await signup(email, password);

    setBusy(false);

    if (result === 'success') {
      onSuccess?.();
    } else {
      setError(result);
    }
  };

  if (user) {
    return (
      <div className="auth-status">
        <div className="auth-user-info">
          <span className="auth-user-avatar">{user.email[0].toUpperCase()}</span>
          <span className="auth-user-email">{user.email}</span>
        </div>
        <button className="auth-btn auth-btn-ghost" onClick={logout}>
          Log Out
        </button>
      </div>
    );
  }

  return (
    <div className="auth-form-container">
      <div className="auth-tabs">
        <button
          className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
          onClick={() => { setMode('login'); setError(null); }}
        >
          Log In
        </button>
        <button
          className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
          onClick={() => { setMode('signup'); setError(null); }}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="auth-input"
          />
        </div>
        <div className="auth-field">
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            required
            minLength={6}
            className="auth-input"
          />
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="auth-btn auth-btn-primary" disabled={busy}>
          {busy ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}