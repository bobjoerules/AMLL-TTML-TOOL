import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Music,
  FileText,
  Clock,
  Award,
  Sparkles,
  Search,
  ArrowLeft,
  Download,
  Share2,
  Shield,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Mic2,
  ExternalLink,
} from 'lucide-react';
import {
  fetchUserProfilesWithStats,
  downloadTTMLFile,
  isSongWordSync,
  type UserProfileStats,
  type CommunityGlobalStats,
  type FinishedTTML,
} from '../utils/firebase';

interface StatsPageProps {
  initialUserUid?: string | null;
  onNavigateTab?: (tab: 'home' | 'finished' | 'stats' | 'liquid') => void;
}

export const StatsPage: React.FC<StatsPageProps> = ({ initialUserUid, onNavigateTab }) => {
  const [profiles, setProfiles] = useState<UserProfileStats[]>([]);
  const [globalStats, setGlobalStats] = useState<CommunityGlobalStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUserUid, setSelectedUserUid] = useState<string | null>(initialUserUid || null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await fetchUserProfilesWithStats();
      setProfiles(data.profiles);
      setGlobalStats(data.globalStats);
    } catch (err) {
      console.error('Failed to load community stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Synchronize hash or pathname with selected user
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      const path = window.location.pathname;
      if (hash.startsWith('#user=')) {
        const uid = decodeURIComponent(hash.replace('#user=', ''));
        setSelectedUserUid(uid);
      } else if (path.startsWith('/user/')) {
        const uid = decodeURIComponent(path.replace('/user/', '').replace(/\/$/, ''));
        setSelectedUserUid(uid);
      } else if (hash === '#stats' || path === '/stats') {
        setSelectedUserUid(null);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    window.addEventListener('popstate', handleHash);
    return () => {
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('popstate', handleHash);
    };
  }, []);

  const handleSelectUser = (uid: string) => {
    setSelectedUserUid(uid);
    window.location.hash = `user=${encodeURIComponent(uid)}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToAll = () => {
    setSelectedUserUid(null);
    window.location.hash = 'stats';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDownloadSong = async (song: FinishedTTML) => {
    setDownloadingId(song.id);
    try {
      await downloadTTMLFile(song);
    } catch (err: any) {
      console.error('Failed to download song TTML:', err);
    } finally {
      setTimeout(() => setDownloadingId(null), 1000);
    }
  };

  const handleCopyProfileLink = () => {
    if (navigator.clipboard) {
      const shareUrl = selectedUserUid
        ? `${window.location.origin}/user/${encodeURIComponent(selectedUserUid)}`
        : `${window.location.origin}/stats`;
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  };

  const selectedProfile = useMemo(() => {
    if (!selectedUserUid) return null;
    return (
      profiles.find(
        (p) =>
          p.uid.toLowerCase() === selectedUserUid.toLowerCase() ||
          p.displayName.toLowerCase() === selectedUserUid.toLowerCase(),
      ) || null
    );
  }, [profiles, selectedUserUid]);

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        p.uniqueArtists.some((artist) => artist.toLowerCase().includes(q)) ||
        p.songs.some((song) => song.title.toLowerCase().includes(q)),
    );
  }, [profiles, searchQuery]);

  return (
    <div className="container" style={{ padding: '40px 20px 80px', minHeight: '80vh' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 999, background: 'rgba(250, 45, 72, 0.1)', color: 'var(--accent-pink)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              <Award size={14} />
              <span>Community Hub & Creator Ranks</span>
            </div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.02em', margin: '4px 0 8px' }}>
              {selectedProfile ? selectedProfile.displayName : 'Community Stats & Profiles'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 15, maxWidth: 640 }}>
              {selectedProfile
                ? `Creator portfolio, timing statistics, and synchronized songs by ${selectedProfile.displayName}.`
                : 'Explore community metrics, top synchronizers, and creator profiles across the AMLL TTML ecosystem.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {selectedProfile ? (
              <button className="btn btn-secondary" onClick={handleBackToAll} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ArrowLeft size={16} />
                <span>All Creators</span>
              </button>
            ) : null}

            <button
              className="btn btn-secondary"
              onClick={loadStats}
              disabled={loading}
              title="Refresh statistics"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 16 }}>
          <Loader2 size={36} className="spin" color="var(--accent-pink)" />
          <p style={{ color: 'var(--text-muted)' }}>Loading community statistics & creator profiles...</p>
        </div>
      ) : selectedProfile ? (
        /* SINGLE CREATOR PROFILE VIEW */
        <div>
          {/* Creator Profile Header Card */}
          <div
            className="glass-panel"
            style={{
              padding: '32px 28px',
              borderRadius: 20,
              marginBottom: 32,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 24,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'linear-gradient(135deg, rgba(250, 45, 72, 0.08) 0%, rgba(20, 20, 26, 0.7) 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              {selectedProfile.photoURL ? (
                <img
                  src={selectedProfile.photoURL}
                  alt={selectedProfile.displayName}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid var(--accent-pink)',
                    boxShadow: '0 0 20px rgba(250, 45, 72, 0.35)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #fa2d48 0%, #a855f7 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32,
                    fontWeight: 700,
                    color: '#fff',
                    boxShadow: '0 0 20px rgba(250, 45, 72, 0.35)',
                  }}
                >
                  {selectedProfile.displayName.charAt(0).toUpperCase()}
                </div>
              )}

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>
                    {selectedProfile.displayName}
                  </h2>
                  {selectedProfile.isModerator && (
                    <span className="badge badge-mod-pill" title="Verified Moderator">
                      <Shield size={12} />
                      <span>MODERATOR</span>
                    </span>
                  )}
                </div>

                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                  Synchronizing lyrics for {selectedProfile.uniqueArtists.length} distinct artists
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={handleCopyProfileLink}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px' }}
              >
                {copiedLink ? <CheckCircle2 size={16} color="#10b981" /> : <Share2 size={16} />}
                <span>{copiedLink ? 'Link Copied!' : 'Share Profile'}</span>
              </button>
            </div>
          </div>

          {/* Detailed Stats Cards for Single User */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
              marginBottom: 36,
            }}
          >
            <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-pink)', marginBottom: 6 }}>
                <Music size={18} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Songs Uploaded</span>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800 }}>{selectedProfile.totalSongs}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Finished TTML files</div>
            </div>

            <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#a855f7', marginBottom: 6 }}>
                <FileText size={18} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Lines Synced</span>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800 }}>{selectedProfile.totalLines.toLocaleString()}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Total lyric lines timed</div>
            </div>

            <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#06b6d4', marginBottom: 6 }}>
                <Clock size={18} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Total Duration</span>
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{formatDuration(selectedProfile.totalDurationMs)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Music synchronized</div>
            </div>

            <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', marginBottom: 6 }}>
                <Mic2 size={18} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Syllable / Word-Sync</span>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800 }}>
                {selectedProfile.totalSongs > 0
                  ? `${Math.round((selectedProfile.wordSyncSongs / selectedProfile.totalSongs) * 100)}%`
                  : '0%'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {selectedProfile.wordSyncSongs} of {selectedProfile.totalSongs} songs
              </div>
            </div>
          </div>

          {/* Creator Song Catalog */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
                Songs by {selectedProfile.displayName} ({selectedProfile.songs.length})
              </h3>
              {onNavigateTab && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onNavigateTab('finished')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <span>View All Community Songs</span>
                  <ExternalLink size={13} />
                </button>
              )}
            </div>

            <div className="ttml-grid">
              {selectedProfile.songs.map((song) => {
                const isWord = isSongWordSync(song);
                return (
                  <div key={song.id} className="glass-panel ttml-card">
                    <div className="ttml-cover-wrapper">
                      {song.coverArt ? (
                        <img src={song.coverArt} alt={song.title} className="ttml-cover" />
                      ) : (
                        <div className="ttml-cover-missing" style={{ cursor: 'default' }}>
                          <div className="ttml-cover-missing-icon" style={{ opacity: 0.5 }}>
                            <Music size={24} />
                          </div>
                          <span className="ttml-cover-missing-label" style={{ opacity: 0.6 }}>No Artwork</span>
                        </div>
                      )}
                      <span className="ttml-badge" style={{ background: isWord ? 'rgba(168, 85, 247, 0.85)' : undefined }}>
                        {isWord ? 'Word Sync' : 'Line Sync'}
                      </span>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <h4 className="ttml-title" title={song.title} style={{ fontSize: 16 }}>
                        {song.title}
                      </h4>
                      <p className="ttml-artist" title={song.artist}>
                        {song.artist}
                      </p>
                      {song.album && (
                        <p className="ttml-album" title={song.album}>
                          {song.album}
                        </p>
                      )}

                      <div className="ttml-meta-bar">
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {song.lineCount ? (
                            <span className="ttml-line-count" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <FileText size={12} />
                              {song.lineCount} lines
                            </span>
                          ) : null}
                          {song.durationMs ? (
                            <span className="ttml-line-count" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={12} />
                              {formatDuration(song.durationMs)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ marginTop: 14 }}>
                        <button
                          className="btn btn-primary"
                          style={{ width: '100%', padding: '9px 14px', fontSize: 13 }}
                          onClick={() => handleDownloadSong(song)}
                          disabled={downloadingId === song.id}
                        >
                          <Download size={15} />
                          <span>{downloadingId === song.id ? 'Downloaded!' : 'Download TTML'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* GLOBAL COMMUNITY OVERVIEW & LEADERBOARD */
        <div>
          {/* Global Summary KPI Bar */}
          {globalStats && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                marginBottom: 36,
              }}
            >
              <div className="glass-panel" style={{ padding: '22px 24px', borderRadius: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-pink)', marginBottom: 8 }}>
                  <Music size={18} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Total Finished TTMLs</span>
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>{globalStats.totalSongs.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Community synced tracks</div>
              </div>

              <div className="glass-panel" style={{ padding: '22px 24px', borderRadius: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#a855f7', marginBottom: 8 }}>
                  <Users size={18} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Active Creators</span>
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>{globalStats.totalCreators.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Lyric synchronizers</div>
              </div>

              <div className="glass-panel" style={{ padding: '22px 24px', borderRadius: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#06b6d4', marginBottom: 8 }}>
                  <FileText size={18} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Total Lines Timed</span>
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800 }}>{globalStats.totalLines.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Lyric lines preserved</div>
              </div>

              <div className="glass-panel" style={{ padding: '22px 24px', borderRadius: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', marginBottom: 8 }}>
                  <Clock size={18} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Synced Playtime</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800 }}>{formatDuration(globalStats.totalDurationMs)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Total synchronized duration</div>
              </div>
            </div>
          )}

          {/* Search bar */}
          <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
              <Search
                size={18}
                style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                placeholder="Search creators, songs, or artists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 46px',
                  borderRadius: 12,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Showing {filteredProfiles.length} of {profiles.length} creators
            </div>
          </div>

          {/* Creators Directory Grid */}
          {filteredProfiles.length === 0 ? (
            <div className="glass-panel" style={{ padding: '48px 20px', textAlign: 'center', borderRadius: 16 }}>
              <Users size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: 18, marginBottom: 6 }}>No creators found</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Try adjusting your search keywords.</p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                gap: 20,
              }}
            >
              {filteredProfiles.map((creator, index) => {
                const isTopThree = index < 3;
                const medalColors = ['#f59e0b', '#94a3b8', '#b45309'];

                return (
                  <div
                    key={creator.uid}
                    className="glass-panel"
                    onClick={() => handleSelectUser(creator.uid)}
                    role="button"
                    tabIndex={0}
                    style={{
                      padding: 24,
                      borderRadius: 18,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                      position: 'relative',
                      border: isTopThree
                        ? `1px solid ${medalColors[index]}44`
                        : '1px solid rgba(255, 255, 255, 0.07)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.borderColor = 'var(--accent-pink)';
                      e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = isTopThree
                        ? `${medalColors[index]}44`
                        : 'rgba(255, 255, 255, 0.07)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* Rank Badge */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 18,
                        right: 18,
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: isTopThree ? `${medalColors[index]}22` : 'rgba(255, 255, 255, 0.05)',
                        color: isTopThree ? medalColors[index] : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {isTopThree && <Sparkles size={11} />}
                      <span>#{index + 1}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                      {creator.photoURL ? (
                        <img
                          src={creator.photoURL}
                          alt={creator.displayName}
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid rgba(255, 255, 255, 0.1)',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(250, 45, 72, 0.8) 0%, rgba(168, 85, 247, 0.8) 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 20,
                            fontWeight: 700,
                            color: '#fff',
                          }}
                        >
                          {creator.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div style={{ minWidth: 0, flex: 1, paddingRight: 32 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <h4
                            style={{
                              fontSize: 16,
                              fontWeight: 700,
                              margin: 0,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={creator.displayName}
                          >
                            {creator.displayName}
                          </h4>
                        </div>
                        {creator.isModerator && (
                          <span
                            className="badge badge-mod-pill"
                            style={{ fontSize: 9, padding: '1px 6px', marginTop: 4, display: 'inline-flex' }}
                          >
                            <Shield size={9} />
                            <span>MOD</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats Summary Chips */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 10,
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: 'rgba(255, 255, 255, 0.03)',
                        marginBottom: 16,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Songs</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-pink)' }}>
                          {creator.totalSongs}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Lines Timed</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>
                          {creator.totalLines.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Duration</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {formatDuration(creator.totalDurationMs)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Word Sync</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>
                          {creator.wordSyncSongs}/{creator.totalSongs}
                        </div>
                      </div>
                    </div>

                    {/* Artist Preview tags */}
                    {creator.uniqueArtists.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                          Artists Timed:
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {creator.uniqueArtists.slice(0, 3).map((artist, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: 11,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-secondary)',
                                maxWidth: 140,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={artist}
                            >
                              {artist}
                            </span>
                          ))}
                          {creator.uniqueArtists.length > 3 && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
                              +{creator.uniqueArtists.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectUser(creator.uid);
                      }}
                    >
                      View Profile & Songs
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StatsPage;
