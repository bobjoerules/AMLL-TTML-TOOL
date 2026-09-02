import React, { useState, useEffect } from 'react';
import { Flame, Download, Globe, ExternalLink, LogIn, User as UserIcon, Shield, Menu, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import { GithubIcon } from './GithubIcon';
import { AuthModal } from './AuthModal';
import { ProfileModal } from './ProfileModal';
import { isUserModerator, subscribeToAuth } from '../utils/firebase';

interface NavbarProps {
  currentTab: 'home' | 'finished' | 'spicy';
  onSelectTab: (tab: 'home' | 'finished' | 'spicy') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const isMod = isUserModerator(user?.uid);

  return (
    <>
      <header className="navbar">
        <div className="container nav-content">
          <div
            className="nav-brand"
            onClick={() => {
              onSelectTab('home');
              setMobileMenuOpen(false);
            }}
          >
            <img
              src="/logo.svg"
              alt="AMLL TTML Tool Logo"
              style={{ width: 32, height: 32, objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(250, 45, 72, 0.4))' }}
            />
            <span>AMLL TTML Tool</span>
          </div>

          <nav className="nav-desktop-only">
            <ul className="nav-links">
              <li>
                <button
                  className={`nav-link ${currentTab === 'home' ? 'active' : ''}`}
                  onClick={() => onSelectTab('home')}
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  className={`nav-link ${currentTab === 'finished' ? 'active' : ''}`}
                  onClick={() => onSelectTab('finished')}
                >
                  Finished TTMLs
                </button>
              </li>
              <li>
                <button
                  className={`nav-link ${currentTab === 'spicy' ? 'active' : ''}`}
                  onClick={() => onSelectTab('spicy')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Flame size={15} color="#ff416c" />
                    Spicy Player
                  </span>
                </button>
              </li>
            </ul>
          </nav>

          <div className="nav-actions">
            <a
              href="https://ttmleditor.bobjoerules.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm nav-desktop-action"
              style={{ borderColor: 'rgba(250, 45, 72, 0.4)', background: 'rgba(250, 45, 72, 0.1)' }}
            >
              <Globe size={15} color="var(--accent-pink)" />
              <span>Open in Browser</span>
              <ExternalLink size={12} style={{ opacity: 0.7 }} />
            </a>
            <a
              href="https://github.com/bobjoerules/AMLL-TTML-TOOL"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm nav-desktop-action"
            >
              <GithubIcon size={16} />
              <span>GitHub</span>
            </a>
            <a
              href="https://github.com/bobjoerules/AMLL-TTML-TOOL/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm nav-desktop-action"
            >
              <Download size={16} />
              <span>Download</span>
            </a>

            {user ? (
              <button
                className="nav-user-profile-btn"
                onClick={() => setProfileModalOpen(true)}
                title={user.displayName || user.email || 'User Profile'}
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'Avatar'} className="nav-avatar-img" />
                ) : (
                  <div className="nav-avatar-initial">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="nav-user-name">{user.displayName || user.email?.split('@')[0] || 'User'}</span>
                {isMod && (
                  <span className="badge badge-mod-pill" title="Verified Moderator">
                    <Shield size={10} />
                    <span>MOD</span>
                  </span>
                )}
              </button>
            ) : (
              <button
                className="btn btn-secondary btn-sm nav-login-btn"
                onClick={() => setAuthModalOpen(true)}
              >
                <LogIn size={15} color="#fa2d48" />
                <span>Sign In</span>
              </button>
            )}

            <button
              className="nav-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="nav-mobile-drawer">
            <div className="nav-mobile-links">
              <button
                className={`nav-mobile-link ${currentTab === 'home' ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab('home');
                  setMobileMenuOpen(false);
                }}
              >
                Home
              </button>
              <button
                className={`nav-mobile-link ${currentTab === 'finished' ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab('finished');
                  setMobileMenuOpen(false);
                }}
              >
                Finished TTMLs
              </button>
              <button
                className={`nav-mobile-link ${currentTab === 'spicy' ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab('spicy');
                  setMobileMenuOpen(false);
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Flame size={16} color="#ff416c" />
                  Spicy Player
                </span>
              </button>
            </div>

            <div className="nav-mobile-divider" />

            <div className="nav-mobile-actions">
              <a
                href="https://ttmleditor.bobjoerules.com"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm nav-mobile-action-btn"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Globe size={15} color="var(--accent-pink)" />
                <span>Open in Browser</span>
                <ExternalLink size={12} style={{ opacity: 0.7 }} />
              </a>
              <a
                href="https://github.com/bobjoerules/AMLL-TTML-TOOL"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm nav-mobile-action-btn"
                onClick={() => setMobileMenuOpen(false)}
              >
                <GithubIcon size={16} />
                <span>GitHub</span>
              </a>
              <a
                href="https://github.com/bobjoerules/AMLL-TTML-TOOL/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm nav-mobile-action-btn"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Download size={16} />
                <span>Download App</span>
              </a>
            </div>
          </div>
        )}
      </header>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      <ProfileModal
        isOpen={profileModalOpen}
        user={user}
        onClose={() => setProfileModalOpen(false)}
        onProfileUpdated={() => {
          // Force refresh user state if needed
          if (user) {
            setUser({ ...user });
          }
        }}
      />
    </>
  );
};
