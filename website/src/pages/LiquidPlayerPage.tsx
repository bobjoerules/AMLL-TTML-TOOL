import React, { useState } from 'react';
import {
  Flame,
  Maximize2,
  X,
  Sparkles,
  Music2,
  ExternalLink,
  Layers,
  Laptop
} from 'lucide-react';
import { GithubIcon } from '../components/GithubIcon';

interface LiquidPlayerGalleryItem {
  id: string;
  title: string;
  subtitle: string;
  src: string;
}

const LIQUID_PLAYER_GALLERY: LiquidPlayerGalleryItem[] = [
  {
    id: 'now-playing-screen',
    title: 'Now Playing Screen',
    subtitle: 'Real-time Spotify playback sync, scrubbable seek bar, full remote controls, and syllable-synchronized lyrics.',
    src: '/images/liquid-player/IMG_1455.PNG',
  },
];

export const LiquidPlayerPage: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <div className="container" style={{ padding: '60px 24px 100px' }}>
      {/* Hero Header */}
      <div className="section-header">
        <span className="section-tag section-tag-liquid">
          <Flame size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          Interactive Music & Synced Lyrics
        </span>
        <h1 className="section-title">
          <span className="text-gradient-liquid">Liquid Player</span>
        </h1>
        <p className="section-desc">
          An interactive music player and synchronized lyrics companion for iOS and macOS, powered by the Spotify Web API and Spicy Lyrics API. Built with SwiftUI to deliver real-time playback synchronization and syllable-timed bouncing lyrics with fluid physics animations.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 28, flexWrap: 'wrap' }}>
          <a
            href="https://github.com/bobjoerules/Spicy-Player"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-liquid"
          >
            <GithubIcon size={18} />
            <span>View on GitHub</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* Screenshot Showcase Gallery */}
      <section style={{ marginBottom: 80 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24, textAlign: 'center' }}>
          Interface Gallery
        </h2>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'stretch',
            flexWrap: 'wrap',
            gap: 24,
          }}
        >
          {LIQUID_PLAYER_GALLERY.map((item) => (
            <div
              key={item.id}
              className="glass-panel"
              style={{
                width: '100%',
                maxWidth: '420px',
                padding: 20,
                cursor: 'pointer',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s ease',
              }}
              onClick={() => setSelectedImage(item.src)}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  background: 'rgba(0, 0, 0, 0.4)',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                }}
              >
                <img
                  src={item.src}
                  alt={item.title}
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: '580px',
                    objectFit: 'contain',
                    borderRadius: 'var(--radius-md)',
                    transition: 'transform 0.3s ease',
                    display: 'block',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.3)',
                    opacity: 0,
                    transition: 'opacity 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                >
                  <span
                    style={{
                      background: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: 9999,
                      fontSize: 13,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Maximize2 size={14} />
                    View Fullscreen
                  </span>
                </div>
              </div>

              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 6 }}>
                {item.title}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
                {item.subtitle}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Key Features */}
      <section>
        <div className="section-header">
          <span className="section-tag section-tag-liquid">Next-Gen Audio Experience</span>
          <h2 className="section-title">Why You'll Love Liquid Player</h2>
        </div>

        <div className="features-grid">
          <div className="glass-panel feature-card">
            <div className="feature-icon" style={{ background: 'rgba(255, 65, 108, 0.12)', color: '#ff416c' }}>
              <Sparkles size={24} />
            </div>
            <h3 className="feature-title">Syllable-Level Physics Animations</h3>
            <p className="feature-desc">
              Word-by-word and syllable-by-syllable karaoke highlighting powered by damped harmonic oscillator springs for fluid bounces and clean typography.
            </p>
          </div>

          <div className="glass-panel feature-card">
            <div className="feature-icon" style={{ background: 'rgba(255, 75, 43, 0.12)', color: '#ff4b2b' }}>
              <Music2 size={24} />
            </div>
            <h3 className="feature-title">Live Spotify Playback Sync</h3>
            <p className="feature-desc">
              Connects directly to the Spotify Web API to sync your currently playing song, album artwork, progress, queue, and duration in real time with 60/120fps micro-interpolation.
            </p>
          </div>

          <div className="glass-panel feature-card">
            <div className="feature-icon" style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899' }}>
              <Layers size={24} />
            </div>
            <h3 className="feature-title">Duet-Aware & Multi-Language</h3>
            <p className="feature-desc">
              Intelligently separates lead and background vocalists with opposite-aligned layouts, plus live romanization and translations powered by the Spicy Lyrics API.
            </p>
          </div>

          <div className="glass-panel feature-card">
            <div className="feature-icon" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' }}>
              <Laptop size={24} />
            </div>
            <h3 className="feature-title">iOS & macOS Catalyst Support</h3>
            <p className="feature-desc">
              Run natively on iPhone, iPad, and Mac with desktop keyboard shortcuts (like Spacebar play/pause), fullscreen mode, and modern Liquid Glass styling.
            </p>
          </div>
        </div>
      </section>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div className="lightbox-backdrop" onClick={() => setSelectedImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setSelectedImage(null)}>
              <X size={24} />
            </button>
            <img src={selectedImage} alt="Fullscreen View" className="lightbox-image" />
          </div>
        </div>
      )}
    </div>
  );
};

export default LiquidPlayerPage;
