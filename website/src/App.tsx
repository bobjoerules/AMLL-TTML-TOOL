import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { FinishedTTMLsPage } from './pages/FinishedTTMLsPage';
import { StatsPage } from './pages/StatsPage';
import { LiquidPlayerPage } from './pages/LiquidPlayerPage';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'home' | 'finished' | 'stats' | 'liquid'>(() => {
    if (typeof window === 'undefined') return 'home';
    const hash = window.location.hash.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    if (hash.includes('stats') || hash.includes('user=') || path.includes('/stats') || path.includes('/user/')) {
      return 'stats';
    } else if (hash.includes('finished') || hash.includes('ttmls') || path.includes('/finished') || path.includes('/song/') || path.includes('/track/') || path.includes('/s/')) {
      return 'finished';
    } else if (hash.includes('liquid') || hash.includes('tinko') || path.includes('/liquid')) {
      return 'liquid';
    }
    return 'home';
  });

  // Handle URL hash and path routing with automatic upgrade from legacy hashes to clean paths
  useEffect(() => {
    const handleRoute = () => {
      const hash = window.location.hash;
      const lowerHash = hash.toLowerCase();

      // Automatically upgrade legacy hash URLs (#stats, #user=...) to clean paths without reload
      if (lowerHash.startsWith('#stats') || lowerHash.startsWith('#user=')) {
        if (lowerHash.startsWith('#user=')) {
          const uid = hash.replace(/^#user=/i, '');
          window.history.replaceState(null, '', `/user/${uid}`);
        } else {
          window.history.replaceState(null, '', '/stats');
        }
      } else if (lowerHash.startsWith('#finished') || lowerHash.startsWith('#ttmls')) {
        window.history.replaceState(null, '', '/finished');
      } else if (lowerHash.startsWith('#liquid') || lowerHash.startsWith('#tinko')) {
        window.history.replaceState(null, '', '/liquid');
      }

      const activePath = window.location.pathname.toLowerCase();
      if (activePath.startsWith('/stats') || activePath.startsWith('/user/') || activePath.startsWith('/u/')) {
        setCurrentTab('stats');
      } else if (activePath.startsWith('/finished') || activePath.startsWith('/song/') || activePath.startsWith('/track/') || activePath.startsWith('/s/')) {
        setCurrentTab('finished');
      } else if (activePath.startsWith('/liquid') || activePath.startsWith('/tinko')) {
        setCurrentTab('liquid');
      } else {
        setCurrentTab('home');
      }
    };

    handleRoute();
    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('popstate', handleRoute);
    return () => {
      window.removeEventListener('hashchange', handleRoute);
      window.removeEventListener('popstate', handleRoute);
    };
  }, []);

  // Synchronize document.title and meta description on tab changes
  useEffect(() => {
    let title = 'AMLL TTML Tool — The Premier Syllable-by-Syllable TTML Lyric Editor & Community Hub';
    let desc = 'Official community hub for AMLL TTML Tool and Liquid Player. Browse and download community Apple Music syllable TTML lyrics, view creator stats, and get the desktop editor.';
    if (currentTab === 'finished') {
      title = 'Browse Community TTML Lyrics — AMLL TTML Tool';
      desc = 'Search, preview, and download community-synced syllable & line Apple Music TTML lyrics directly.';
    } else if (currentTab === 'stats') {
      const path = window.location.pathname;
      if (!path.startsWith('/user/') && !path.startsWith('/u/')) {
        title = 'Contributor Stats & Leaderboard — AMLL TTML Tool';
        desc = 'Explore lyric synchronization leaderboards, contributor rankings, and creator statistics on AMLL TTML Tool.';
      }
    } else if (currentTab === 'liquid') {
      title = 'Liquid Player — Apple Music Style Fluid Lyrics Canvas | AMLL TTML Tool';
      desc = 'Sleek Apple Music style desktop & mobile player with fluid, glowing lyrics canvas.';
    }
    document.title = title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', desc);
    }
  }, [currentTab]);

  const handleSelectTab = (tab: 'home' | 'finished' | 'stats' | 'liquid') => {
    setCurrentTab(tab);
    const targetPath = tab === 'home' ? '/' : `/${tab}`;
    window.history.pushState(null, '', targetPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-container">
      {/* Ambient background glows */}
      <div className="bg-glow-1" />
      <div className="bg-glow-2" />

      <Navbar currentTab={currentTab} onSelectTab={handleSelectTab} />

      <main style={{ flex: 1 }}>
        {currentTab === 'home' && <HomePage onNavigate={handleSelectTab} />}
        {currentTab === 'finished' && <FinishedTTMLsPage />}
        {currentTab === 'stats' && <StatsPage onNavigateTab={handleSelectTab} />}
        {currentTab === 'liquid' && <LiquidPlayerPage />}
      </main>

      <Footer onSelectTab={handleSelectTab} />
    </div>
  );
};

export default App;
