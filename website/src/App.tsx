import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { FinishedTTMLsPage } from './pages/FinishedTTMLsPage';
import { SpicyPlayerPage } from './pages/SpicyPlayerPage';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'home' | 'finished' | 'spicy'>('home');

  // Handle URL hash routing
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('finished') || hash.includes('ttmls')) {
        setCurrentTab('finished');
      } else if (hash.includes('spicy')) {
        setCurrentTab('spicy');
      } else {
        setCurrentTab('home');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleSelectTab = (tab: 'home' | 'finished' | 'spicy') => {
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
        {currentTab === 'spicy' && <SpicyPlayerPage />}
      </main>

      <Footer onSelectTab={handleSelectTab} />
    </div>
  );
};

export default App;
