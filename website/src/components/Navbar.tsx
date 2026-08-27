import React from 'react';
import { Music, CheckSquare, Flame, Download } from 'lucide-react';
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
          <div className="nav-logo-icon">
            <Music size={20} color="white" />
          </div>
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
