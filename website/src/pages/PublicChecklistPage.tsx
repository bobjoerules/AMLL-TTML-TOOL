import React, { useState, useEffect, useMemo } from 'react';
import {
  ListTodo,
  Search,
  RefreshCw,
  Music,
  ExternalLink,
  Copy,
  CheckCircle2,
  Clock,
  Sparkles,
  User as UserIcon,
  Globe,
  Radio,
  FileText,
} from 'lucide-react';
import {
  fetchPublicChecklistSongs,
  type PublicChecklistSong,
} from '../utils/firebase';

interface PublicChecklistPageProps {
  onNavigateTab?: (tab: 'home' | 'finished' | 'checklist' | 'stats' | 'liquid') => void;
}

export const PublicChecklistPage: React.FC<PublicChecklistPageProps> = ({ onNavigateTab }) => {
  const [songs, setSongs] = useState<PublicChecklistSong[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in-progress' | 'not-started' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'title-asc' | 'artist-asc' | 'recent'>('default');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadChecklist = async () => {
    setLoading(true);
    try {
      const data = await fetchPublicChecklistSongs();
      setSongs(data);
    } catch (err) {
      console.error('Failed to load public checklist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChecklist();
  }, []);

  const inProgressCount = useMemo(() => songs.filter((s) => s.status === 'in-progress').length, [songs]);
  const plannedCount = useMemo(() => songs.filter((s) => s.status === 'not-started').length, [songs]);
  const completedCount = useMemo(() => songs.filter((s) => s.status === 'completed').length, [songs]);

  const filteredSongs = useMemo(() => {
    let result = [...songs];

    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter);
    }

    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (s) =>
          s.song.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q) ||
          (s.album && s.album.toLowerCase().includes(q)) ||
          (s.authorName && s.authorName.toLowerCase().includes(q)) ||
          (s.notes && s.notes.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'title-asc') {
      result.sort((a, b) => a.song.localeCompare(b.song));
    } else if (sortBy === 'artist-asc') {
      result.sort((a, b) => a.artist.localeCompare(b.artist));
    } else if (sortBy === 'recent') {
      result.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    return result;
  }, [songs, statusFilter, searchQuery, sortBy]);

  const handleCopySong = (item: PublicChecklistSong) => {
    const text = `${item.song} - ${item.artist}${item.album ? ` (${item.album})` : ''}`;
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getStatusBadge = (status: PublicChecklistSong['status']) => {
    switch (status) {
      case 'in-progress':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              background: 'rgba(234, 179, 8, 0.16)',
              color: '#facc15',
              border: '1px solid rgba(234, 179, 8, 0.3)',
            }}
          >
            <Clock size={11} />
            In Progress
          </span>
        );
      case 'completed':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              background: 'rgba(16, 185, 129, 0.16)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <CheckCircle2 size={11} />
            Completed
          </span>
        );
      case 'not-started':
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              background: 'rgba(59, 130, 246, 0.16)',
              color: '#60a5fa',
              border: '1px solid rgba(59, 130, 246, 0.3)',
            }}
          >
            <Radio size={11} />
            Planned
          </span>
        );
    }
  };

  return (
    <div className="container" style={{ padding: '60px 24px 100px' }}>
      <div className="section-header">
        <span className="section-tag">
          <ListTodo size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          Community Sync Pipeline
        </span>
        <h1 className="section-title">Public TTML Checklist</h1>
        <p className="section-desc">
          Browse songs currently planned or in-progress by community synchronizers. Avoid duplicated efforts and see what Apple Music TTML lyrics are currently in development!
        </p>
      </div>

      {/* Summary KPI Badges */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 36,
          maxWidth: 900,
          marginInline: 'auto',
        }}
      >
        <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Total Public Songs</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: 4 }}>{songs.length}</div>
        </div>
        <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#facc15', fontWeight: 600 }}>Currently In Progress</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: 4, color: '#facc15' }}>{inProgressCount}</div>
        </div>
        <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#60a5fa', fontWeight: 600 }}>Planned / Queued</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: 4, color: '#60a5fa' }}>{plannedCount}</div>
        </div>
        <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#34d399', fontWeight: 600 }}>Finished & Synced</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: 4, color: '#34d399' }}>{completedCount}</div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 14,
          marginBottom: 28,
          flexWrap: 'wrap',
          maxWidth: 1040,
          marginInline: 'auto',
        }}
      >
        <div className="search-box" style={{ margin: 0, flex: '1 1 320px' }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            className="search-input"
            placeholder="Search planned songs, artists, or creators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['all', 'in-progress', 'not-started', 'completed'] as const).map((key) => {
            const labels = {
              all: `All (${songs.length})`,
              'in-progress': `In Progress (${inProgressCount})`,
              'not-started': `Planned (${plannedCount})`,
              completed: `Finished (${completedCount})`,
            };
            const active = statusFilter === key;
            return (
              <button
                key={key}
                className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(key)}
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  borderRadius: 20,
                  height: 34,
                }}
              >
                {labels[key]}
              </button>
            );
          })}

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="btn btn-secondary btn-sm"
            style={{
              height: 34,
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 20,
              background: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              outline: 'none',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            <option value="default" style={{ background: '#18181b' }}>Sort: Default</option>
            <option value="recent" style={{ background: '#18181b' }}>Recently Updated</option>
            <option value="title-asc" style={{ background: '#18181b' }}>Title (A–Z)</option>
            <option value="artist-asc" style={{ background: '#18181b' }}>Artist (A–Z)</option>
          </select>

          <button
            className="btn btn-secondary btn-sm"
            onClick={loadChecklist}
            disabled={loading}
            style={{ height: 34, borderRadius: 20, padding: '4px 12px' }}
            title="Refresh list"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Grid of Public Checklist Songs */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div
            style={{
              display: 'inline-block',
              width: 40,
              height: 40,
              border: '3px solid rgba(255,255,255,0.1)',
              borderTopColor: 'var(--accent-pink)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>
            Loading community checklist from Firebase...
          </p>
        </div>
      ) : filteredSongs.length === 0 ? (
        <div
          className="glass-panel"
          style={{ textAlign: 'center', padding: '60px 24px', maxWidth: 640, margin: '0 auto', borderRadius: 16 }}
        >
          <ListTodo size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No checklist songs found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
            {searchQuery
              ? `No public checklist entries match "${searchQuery}". Try searching for another artist or title.`
              : 'No publicly shared checklist songs found yet. Creators can share their songs by clicking "🌐 Public" in the desktop or web editor\'s TTML Checklist!'}
          </p>
          <div style={{ marginTop: 24 }}>
            <a
              href="https://ttmleditor.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Globe size={14} />
              <span>Open TTML Editor</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
            maxWidth: 1040,
            marginInline: 'auto',
          }}
        >
          {filteredSongs.map((item) => (
            <div
              key={item.id}
              className="glass-panel"
              style={{
                padding: 16,
                borderRadius: 14,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 12,
                transition: 'transform 0.15s ease, border-color 0.15s ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 12, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        overflow: 'hidden',
                      }}
                    >
                      {item.coverArt ? (
                        <img src={item.coverArt} alt={item.song} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Music size={20} color="var(--text-muted)" />
                      )}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'var(--text-primary)',
                        }}
                        title={item.song}
                      >
                        {item.song}
                      </h3>
                      <p
                        style={{
                          fontSize: 13,
                          color: 'var(--text-secondary)',
                          margin: '2px 0 0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={item.artist}
                      >
                        {item.artist}
                      </p>
                      {item.album && (
                        <p
                          style={{
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            margin: '2px 0 0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={item.album}
                        >
                          {item.album}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>{getStatusBadge(item.status)}</div>
                </div>

                {item.notes && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: 'rgba(255, 255, 255, 0.03)',
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4,
                      borderLeft: '2px solid var(--accent-pink)',
                    }}
                  >
                    {item.notes}
                  </div>
                )}
              </div>

              {/* Card Footer: Creator info and actions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 10,
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  gap: 8,
                }}
              >
                {/* Contributor Profile Link */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {item.authorPhoto ? (
                    <img
                      src={item.authorPhoto}
                      alt={item.authorName || 'User'}
                      style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {item.authorName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}

                  <a
                    href={item.authorUid ? `/user/${item.authorUid}` : '#'}
                    onClick={(e) => {
                      if (item.authorUid && onNavigateTab) {
                        e.preventDefault();
                        window.history.pushState(null, '', `/user/${item.authorUid}`);
                        onNavigateTab('stats');
                      }
                    }}
                    style={{
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      textDecoration: 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 120,
                    }}
                    title={`View ${item.authorName}'s profile`}
                  >
                    {item.authorName || 'Contributor'}
                  </a>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCopySong(item)}
                    style={{ padding: '4px 8px', height: 28, fontSize: 11 }}
                    title="Copy song name & artist"
                  >
                    {copiedId === item.id ? <CheckCircle2 size={12} color="#10b981" /> : <Copy size={12} />}
                    <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                  </button>

                  <a
                    href={`https://ttmleditor.com?song=${encodeURIComponent(item.song)}&artist=${encodeURIComponent(item.artist)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '4px 8px', height: 28, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    title="Open song in TTML Editor"
                  >
                    <ExternalLink size={12} />
                    <span>Editor</span>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Callout Banner */}
      <div
        className="glass-panel"
        style={{
          maxWidth: 720,
          margin: '48px auto 0',
          padding: '20px 24px',
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'rgba(236, 72, 153, 0.15)',
            color: 'var(--accent-pink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Sparkles size={20} />
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Want your planned songs listed here?</strong>
          <br />
          Open the <strong style={{ color: 'var(--accent-pink)' }}>TTML Checklist</strong> in the TTML Editor (Tools &rarr; TTML Checklist), and click the <strong style={{ color: '#818cf8' }}>🌐 Public</strong> button on any track to share your progress with the community!
        </div>
      </div>
    </div>
  );
};
