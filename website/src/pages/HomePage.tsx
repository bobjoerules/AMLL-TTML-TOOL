import React, { useState } from 'react';
import {
  Download,
  Play,
  Layers,
  Sparkles,
  Cloud,
  CheckCircle2,
  Radio,
  Sliders,
  Maximize2,
  X,
  Flame,
  ArrowRight,
  Globe,
  ExternalLink
} from 'lucide-react';
import { GithubIcon } from '../components/GithubIcon';

interface HomePageProps {
  onNavigate: (tab: 'home' | 'finished' | 'spicy') => void;
}

interface ScreenshotItem {
  id: string;
  title: string;
  category: string;
  desc: string;
  src: string;
}

const SCREENSHOTS: ScreenshotItem[] = [
  {
    id: 'preview',
    title: 'Apple Music Live Preview',
    category: 'Preview Mode',
    desc: 'Real-time rendering of animated syllable karaoke lyrics with Apple Music style glow, backdrop filters, and unsynced warnings.',
    src: '/images/preview tab.png',
  },
  {
    id: 'sync',
    title: 'Syllable Audio Syncing',
    category: 'Sync Engine',
    desc: 'Fast keyboard and waveform sync engine for recording precise start, end, and duration timestamps for every syllable.',
    src: '/images/sync tab.png',
  },
  {
    id: 'edit',
    title: 'Full TTML Lyric Editor',
    category: 'Editor',
    desc: 'Line-by-line management, auto syllabification, songwriter metadata extraction, and multi-track background vocal management.',
    src: '/images/edit tab.png',
  },
  {
    id: 'checklist',
    title: 'Smart TTML Checklist',
    category: 'Tools',
    desc: 'Song cover art thumbnails, live progress bar, direct Genius provider search, and 1-click lyric importing.',
    src: '/images/ttml checklist.png',
  },
  {
    id: 'cloud',
    title: 'Cloud Sync & Library',
    category: 'Cloud',
    desc: 'Upload, manage, and share your synced TTML lyrics and audio files seamlessly with Firebase Cloud integration.',
    src: '/images/cloud.png',
  },
  {
    id: 'rpc',
    title: 'Discord Rich Presence',
    category: 'Integration',
    desc: 'Broadcast your live editing sessions, current song, album cover art, and progress directly to Discord.',
    src: '/images/rpc page.png',
  },
  {
    id: 'theme',
    title: 'Custom Themes & Visuals',
    category: 'Settings',
    desc: 'Extensive customization with custom background artwork, equalizer curves, latency testing, and UI styling.',
    src: '/images/theme settings.png',
  },
];

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [activeScreenshot, setActiveScreenshot] = useState<string>('preview');
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const currentItem = SCREENSHOTS.find((s) => s.id === activeScreenshot) || SCREENSHOTS[0];

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      {/* Hero Section */}
      <section className="hero-section">

        <h1 className="hero-title">
          Sync Every Syllable.<br />
          <span className="text-gradient">Experience Living Lyrics.</span>
        </h1>

        <p className="hero-subtitle">
          The ultimate desktop app and suite for creating, timing, editing, and previewing Apple Music style syllable TTML lyrics with studio precision.
        </p>

        <div className="hero-badge">
          <span className="hero-badge-dot"></span>
          <span>AMLL TTML Tool v1.2.2 Released</span>
        </div>

        <div className="hero-buttons">
          <a
            href="https://ttmleditor.bobjoerules.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ padding: '12px 28px' }}
          >
            <Globe size={18} />
            <span>Open in Browser</span>
            <ExternalLink size={14} style={{ opacity: 0.8 }} />
          </a>

          <a
            href="https://github.com/bobjoerules/AMLL-TTML-TOOL/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            <Download size={18} />
            <span>Download Desktop App</span>
          </a>

          <button
            className="btn btn-secondary"
            onClick={() => onNavigate('finished')}
          >
            <CheckCircle2 size={18} color="#10b981" />
            <span>Browse Finished TTMLs</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => onNavigate('spicy')}
          >
            <Flame size={18} color="#ff416c" />
            <span>Discover Spicy Player</span>
          </button>
        </div>

        {/* Interactive App Showcase Carousel */}
        <div className="showcase-container">
          <div className="showcase-tabs">
            {SCREENSHOTS.map((item) => (
              <button
                key={item.id}
                className={`showcase-tab-btn ${activeScreenshot === item.id ? 'active' : ''}`}
                onClick={() => setActiveScreenshot(item.id)}
              >
                {item.category}
              </button>
            ))}
          </div>

          <div className="showcase-image-wrapper">
            <img
              src={currentItem.src}
              alt={currentItem.title}
              className="showcase-img"
              onClick={() => setLightboxImg(currentItem.src)}
              style={{ cursor: 'zoom-in' }}
            />
            <button
              onClick={() => setLightboxImg(currentItem.src)}
              style={{
                position: 'absolute',
                bottom: 16,
                right: 16,
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'white',
                padding: '8px 14px',
                borderRadius: 9999,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <Maximize2 size={14} />
              <span>Full Resolution</span>
            </button>
          </div>

          <div style={{ marginTop: 20, textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>{currentItem.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4, maxWidth: 800 }}>{currentItem.desc}</p>
            </div>
            <a
              href="https://github.com/bobjoerules/AMLL-TTML-TOOL"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              <span>View Source</span>
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section style={{ marginTop: 80 }}>
        <div className="section-header">
          <span className="section-tag">Powerful Toolset</span>
          <h2 className="section-title">Built for Precision & Speed</h2>
          <p className="section-desc">
            Everything you need to craft high-quality syllable synced lyrics that look and feel identical to Apple Music.
          </p>
        </div>

        <div className="features-grid">
          <div className="glass-panel feature-card">
            <div className="feature-icon">
              <Sparkles size={24} />
            </div>
            <h3 className="feature-title">Syllable-Level Timing</h3>
            <p className="feature-desc">
              Accurately mark every word and syllable boundary with hotkey recording, spectrogram alignment, and time-stretching tools.
            </p>
          </div>

          <div className="glass-panel feature-card">
            <div className="feature-icon" style={{ background: 'rgba(244, 63, 94, 0.12)', color: '#fb7185' }}>
              <Layers size={24} />
            </div>
            <h3 className="feature-title">Apple Music & Spicy Visuals</h3>
            <p className="feature-desc">
              Switch seamlessly between AMLL and SpicyLyrics preview renderers with live backdrop blur, glow animations, and color matching.
            </p>
          </div>

          <div className="glass-panel feature-card">
            <div className="feature-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399' }}>
              <CheckCircle2 size={24} />
            </div>
            <h3 className="feature-title">Smart TTML Checklist</h3>
            <p className="feature-desc">
              Organize your sync queue with cover art thumbnails, progress tracking, provider search (Genius, LRCLIB, Lyrically), and 1-click imports.
            </p>
          </div>

          <div className="glass-panel feature-card">
            <div className="feature-icon" style={{ background: 'rgba(217, 70, 239, 0.12)', color: '#e879f9' }}>
              <Cloud size={24} />
            </div>
            <h3 className="feature-title">Cloud Storage & Collaboration</h3>
            <p className="feature-desc">
              Save your finished lyrics, translations, romanizations, and audio files directly to the cloud for backup and community sharing.
            </p>
          </div>

          <div className="glass-panel feature-card">
            <div className="feature-icon" style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#f472b6' }}>
              <Radio size={24} />
            </div>
            <h3 className="feature-title">Discord Rich Presence</h3>
            <p className="feature-desc">
              Showcase your creative sessions on Discord with album art, title, artist, live timeline, and repository link buttons.
            </p>
          </div>

          <div className="glass-panel feature-card">
            <div className="feature-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24' }}>
              <Sliders size={24} />
            </div>
            <h3 className="feature-title">Audio Engine & EQ</h3>
            <p className="feature-desc">
              High-performance Web Audio engine featuring 10-band parametric EQ, pitch preservation, latency calibration, and sleep recovery.
            </p>
          </div>
        </div>
      </section>

      {/* Spicy Player Callout */}
      <section className="glass-panel" style={{ padding: 48, marginTop: 40, border: '1px solid rgba(255, 65, 108, 0.25)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 250, height: 250, background: 'radial-gradient(circle, rgba(255, 65, 108, 0.2) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 32 }}>
          <div style={{ maxWidth: 640 }}>
            <span className="section-tag section-tag-spicy">Featured Companion App</span>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: 'white', marginBottom: 12 }}>
              Play Synced TTMLs in <span className="text-gradient-spicy">Spicy Player</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.6 }}>
              Spicy Player is a gorgeous, feature-rich desktop music player built to render syllable-synced TTML lyrics created with AMLL TTML Tool in full glory.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <button className="btn btn-spicy" onClick={() => onNavigate('spicy')}>
              <Flame size={18} />
              <span>Explore Spicy Player</span>
            </button>
            <a
              href="https://github.com/bobjoerules/Spicy-Player"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              <GithubIcon size={18} />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </section>

      {/* Lightbox Modal */}
      {lightboxImg && (
        <div className="lightbox-backdrop" onClick={() => setLightboxImg(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setLightboxImg(null)}>
              <X size={24} />
            </button>
            <img src={lightboxImg} alt="Preview" className="lightbox-image" />
          </div>
        </div>
      )}
    </div>
  );
};
