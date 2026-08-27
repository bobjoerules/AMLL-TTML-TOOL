import React from 'react';
import { Music, Heart, ExternalLink, Flame } from 'lucide-react';
import { GithubIcon } from './GithubIcon';

interface FooterProps {
  onSelectTab: (tab: 'home' | 'finished' | 'spicy') => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab }) => {
  return (
    <footer className="footer">
      <div className="container footer-content">
        <div className="footer-info">
          <div className="nav-brand" onClick={() => onSelectTab('home')}>
            <div className="nav-logo-icon" style={{ width: 28, height: 28 }}>
              <Music size={16} color="white" />
            </div>
            <span style={{ fontSize: 17 }}>AMLL TTML Tool</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            The premier syllable-by-syllable TTML lyric timing and visual editor.
          </p>
        </div>

        <div className="footer-links">
          <button className="footer-link" onClick={() => onSelectTab('home')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            Home
          </button>
          <button className="footer-link" onClick={() => onSelectTab('finished')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            Finished TTMLs
          </button>
          <button className="footer-link" onClick={() => onSelectTab('spicy')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            Spicy Player
          </button>
          <a
            href="https://ttmleditor.bobjoerules.com"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <ExternalLink size={13} />
            Web App (Browser)
          </a>
          <a
            href="https://github.com/bobjoerules/AMLL-TTML-TOOL"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <GithubIcon size={14} />
            Repository
          </a>
          <a
            href="https://github.com/bobjoerules/Spicy-Player"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <Flame size={14} color="#ff416c" />
            Spicy Player Repo
          </a>
        </div>
      </div>
    </footer>
  );
};
