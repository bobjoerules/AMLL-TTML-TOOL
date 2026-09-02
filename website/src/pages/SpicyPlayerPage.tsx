import React, { useState } from 'react';
import {
  Flame,
  Maximize2,
  X,
  Sparkles,
  Music2,
  SlidersHorizontal,
  ExternalLink,
  Layers,
  Heart
} from 'lucide-react';
import { GithubIcon } from '../components/GithubIcon';

interface SpicyGalleryItem {
  id: string;
  title: string;
  subtitle: string;
  src: string;
}

const SPICY_GALLERY: SpicyGalleryItem[] = [
  {
    id: 'now-playing-fullscreen',
    title: 'Now Playing Fullscreen',
    subtitle: 'Immersive animated lyrics with dynamic background fluid blur matching album artwork colors.',
    src: '/images/spicy-player/now-playing-fullscreen.jpg',
  },
  {
    id: 'now-playing-page',
    title: 'Now Playing Screen',
    subtitle: 'High fidelity audio playback controls, volume slider, queue, and synchronized lyric stream.',
    src: '/images/spicy-player/now-playing-page.jpg',
  },
  {
    id: 'home-page',
    title: 'Home & Discovery',
    subtitle: 'Personalized dashboard, recently played albums, top tracks, and quick lyric loading.',
    src: '/images/spicy-player/home-page.jpg',
  },
  {
    id: 'library-page',
    title: 'Local Music Library',
    subtitle: 'Organize your music collection by artist, album, genre, and custom TTML lyric folders.',
    src: '/images/spicy-player/library-page.jpg',
  },
];

export const SpicyPlayerPage: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <div className="container" style={{ padding: '60px 24px 100px' }}>
      {/* Hero Header */}
      <div className="section-header">
        <span className="section-tag section-tag-spicy">
          <Flame size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          Dedicated Music Player
        </span>
        <h1 className="section-title">
          <span className="text-gradient-spicy">Spicy Player</span>
        </h1>
        <p className="section-desc">
          A breathtaking modern desktop music player designed from the ground up to render syllable-timed TTML lyrics with silky smooth Apple Music animations.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 28, flexWrap: 'wrap' }}>
          <a
            href="https://github.com/bobjoerules/Spicy-Player"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-spicy"
          >
            <GithubIcon size={18} />
            <span>View on GitHub</span>
            <ExternalLink size={14} />
          </a>
          <a
            href="https://github.com/bobjoerules/Spicy-Player/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            <span>Download Releases</span>
          </a>
        </div>
      </div>

      {/* Screenshot Showcase Gallery */}
      <section style={{ marginBottom: 80 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24, textAlign: 'center' }}>
          Interface Gallery
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 24 }}>
          {SPICY_GALLERY.map((item) => (
            <div
              key={item.id}
              className="glass-panel"
              style={{
                padding: 16,
                cursor: 'pointer',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
              onClick={() => setSelectedImage(item.src)}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  background: 'transparent',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={item.src}
                  alt={item.title}
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: '450px',
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
          <span className="section-tag section-tag-spicy">Next-Gen Audio Experience</span>
          <h2 className="section-title">Why You'll Love Spicy Player</h2>
        </div>

        <div className="features-grid">
          <div className="glass-panel feature-card">
            <div className="feature-icon" style={{ background: 'rgba(255, 65, 108, 0.12)', color: '#ff416c' }}>
              <Sparkles size={24} />
            </div>
            <h3 className="feature-title">Real-Time Syllable Glow</h3>
            <p className="feature-desc">
              Renders syllable timing with silky smooth color glow transitions matching Apple Music's fluid animations.
            </p>
          </div>

          <div className="glass-panel feature-card">
            <div className="feature-icon" style={{ background: 'rgba(255, 75, 43, 0.12)', color: '#ff4b2b' }}>
              <Maximize2 size={24} />
            </div>
            <h3 className="feature-title">Fullscreen Immersive Mode</h3>
            <p className="feature-desc">
              Transform your display into a live visual stage with animated canvas gradients and responsive typography.
            </p>
          </div>

          <div className="glass-panel feature-card">
            <div className="feature-icon" style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899' }}>
              <Music2 size={24} />
            </div>
            <h3 className="feature-title">Native TTML Compatibility</h3>
            <p className="feature-desc">
              Directly loads and synchronizes `.ttml` files created and exported by AMLL TTML Tool without any conversion.
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
