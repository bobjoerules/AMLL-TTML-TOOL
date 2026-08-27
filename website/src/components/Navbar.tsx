import React from 'react';
import { Music, CheckSquare, Flame, Download, Globe, ExternalLink } from 'lucide-react';
import { GithubIcon } from './GithubIcon';

interface NavbarProps {
  currentTab: 'home' | 'finished' | 'spicy';
  onSelectTab: (tab: 'home' | 'finished' | 'spicy') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  return (
    <header className="navbar">
      <div className="container nav-content">
        <div className="nav-brand" onClick={() => onSelectTab('home')}>
          <img
            src="/logo.svg"
            alt="AMLL TTML Tool Logo"
            style={{ width: 32, height: 32, objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(250, 45, 72, 0.4))' }}
          />
          <span>AMLL TTML Tool</span>
        </div>

        <nav>
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
            className="btn btn-secondary btn-sm"
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
            className="btn btn-secondary btn-sm"
          >
            <GithubIcon size={16} />
            <span>GitHub</span>
          </a>
          <a
            href="https://github.com/bobjoerules/AMLL-TTML-TOOL/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm"
          >
            <Download size={16} />
            <span>Download</span>
          </a>
        </div>
      </div>
    </header>
  );
};
