import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { FinishedTTMLsPage } from './pages/FinishedTTMLsPage';
import { StatsPage } from './pages/StatsPage';
import { LiquidPlayerPage } from './pages/LiquidPlayerPage';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'home' | 'finished' | 'stats' | 'liquid'>('home');

  // Handle URL hash and path routing
  useEffect(() => {
    const handleRoute = () => {
      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();

      if (hash.includes('stats') || hash.includes('user=') || path.includes('/stats') || path.includes('/user/')) {
        setCurrentTab('stats');
      } else if (hash.includes('finished') || hash.includes('ttmls') || path.includes('/finished')) {
        setCurrentTab('finished');
      } else if (hash.includes('liquid') || hash.includes('tinko') || path.includes('/liquid')) {
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

  const handleSelectTab = (tab: 'home' | 'finished' | 'stats' | 'liquid') => {
    setCurrentTab(tab);
    window.location.hash = tab === 'home' ? '' : tab;
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
