import React, { useState } from 'react';
import { X, Lock, Mail, User as UserIcon, Loader2, Sparkles } from 'lucide-react';
import { signInWithEmail, signUpWithEmail } from '../utils/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(trimmedEmail, password, displayName);
      } else {
        await signInWithEmail(trimmedEmail, password);
      }
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Auth error:', err);
      const msg = err?.message || 'Authentication failed';
      if (msg.includes('user-not-found') || msg.includes('invalid-credential')) {
        setError("Invalid email or password. If you don't have an account, click 'Sign Up'.");
      } else if (msg.includes('email-already-in-use')) {
        setError('An account with this email already exists. Please sign in instead.');
        setIsSignUp(false);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content auth-modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
          <X size={18} />
        </button>

        <div className="auth-header">
          <div className="auth-icon-wrap">
            <Lock size={24} color="#fa2d48" />
          </div>
          <h3>{isSignUp ? 'Create App Account' : 'Firebase Sign In'}</h3>
          <p className="auth-subtitle">
            Sign in with your AMLL TTML app account to manage your profile and published songs.
          </p>
        </div>

        {error && <div className="auth-error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {isSignUp && (
            <div className="form-group">
              <label>Display Name</label>
              <div className="input-with-icon">
                <UserIcon size={16} className="input-icon" />
                <input
                  type="text"
                  placeholder="Your Creator Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <div className="input-with-icon">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block auth-submit-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={16} className="spin" />
                <span>{isSignUp ? 'Creating account...' : 'Signing in...'}</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-toggle-footer">
          {isSignUp ? (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setIsSignUp(false);
                  setError(null);
                }}
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              Don't have an account yet?{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setIsSignUp(true);
                  setError(null);
                }}
              >
                Create Account
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
