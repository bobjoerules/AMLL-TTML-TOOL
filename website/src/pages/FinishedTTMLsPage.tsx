import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Search,
  CheckCircle2,
  Music,
  Clock,
  FileText,
  Sparkles,
  RefreshCw,
  Trash2,
  Loader2,
  ShieldAlert,
  ImagePlus,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  fetchFinishedTTMLs,
  downloadTTMLFile,
  removeFromFinishedList,
  updateSongCoverArt,
  compressImageToDataUrl,
  subscribeToAuth,
  isUserModerator,
  type FinishedTTML,
} from '../utils/firebase';

export const FinishedTTMLsPage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [ttmls, setTtmls] = useState<FinishedTTML[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingCoverId, setUploadingCoverId] = useState<string | null>(null);
  const [activeTrackForUpload, setActiveTrackForUpload] = useState<FinishedTTML | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((u) => setUser(u));
    return () => unsubscribe();
  }, []);

  const loadTTMLs = async () => {
    setLoading(true);
    try {
      const data = await fetchFinishedTTMLs();
      setTtmls(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTTMLs();
  }, []);

  const handleDownload = (item: FinishedTTML) => {
    setDownloadingId(item.id);
    try {
      downloadTTMLFile(item);
    } finally {
      setTimeout(() => setDownloadingId(null), 1000);
    }
  };

  const handleDelete = async (item: FinishedTTML) => {
    if (!user) return;
    const isMod = isUserModerator(user.uid);
    const isAuthor = item.authorUid === user.uid;

    const confirmMsg = isMod && !isAuthor
      ? `Are you sure you want to remove "${item.title}" by ${item.artist} from the public Finished list? (Note: this only removes it from the website Finished list; it does NOT delete it from the creator's private cloud saves).`
      : `Are you sure you want to remove "${item.title}" from the public Finished list? (Note: it will still remain safely saved in your private cloud library).`;

    if (!window.confirm(confirmMsg)) return;

    setDeletingId(item.id);
    setFeedback(null);
    try {
      await removeFromFinishedList(item, user.uid);
      setTtmls((prev) => prev.filter((t) => t.id !== item.id));
      setFeedback({
        type: 'success',
        message: `"${item.title}" was removed from the Finished list. (Cloud save preserved)`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      console.error('Delete error:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to remove song from Finished list.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenArtworkPicker = (item: FinishedTTML) => {
    setActiveTrackForUpload(item);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleArtworkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTrackForUpload) return;

    const track = activeTrackForUpload;
    setUploadingCoverId(track.id);

    try {
      const dataUrl = await compressImageToDataUrl(file);
      const res = await updateSongCoverArt(track, dataUrl);
      if (res.success) {
        setTtmls((prev) =>
          prev.map((t) => (t.id === track.id ? { ...t, coverArt: dataUrl } : t))
        );
        setFeedback({
          type: 'success',
          message: `Artwork updated successfully for "${track.title}"!`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Failed to update artwork in the cloud.',
        });
      }
    } catch (err: any) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to process artwork image.',
      });
    } finally {
      setUploadingCoverId(null);
      setActiveTrackForUpload(null);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const filtered = ttmls.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.artist.toLowerCase().includes(q) ||
      (item.album && item.album.toLowerCase().includes(q))
    );
  });

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container" style={{ padding: '60px 24px 100px' }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleArtworkFileChange}
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
      />
      <div className="section-header">
        <span className="section-tag">
          <CheckCircle2 size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          Verified Community Library
        </span>
        <h1 className="section-title">Finished TTML Lyrics</h1>
        <p className="section-desc">
          Browse and download TTML files created in the app and tagged as finished.
        </p>
      </div>

      {feedback && (
        <div
          className={feedback.type === 'success' ? 'auth-success-banner' : 'auth-error-banner'}
          style={{ maxWidth: 640, margin: '0 auto 24px', textAlign: 'center' }}
        >
          {feedback.message}
        </div>
      )}

      {/* Search and Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 40, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ margin: 0, flex: '1 1 350px' }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by song title, artist, or album..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={loadTTMLs}
          disabled={loading}
          style={{ height: 46 }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Grid of Finished TTMLs */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ display: 'inline-block', width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-pink)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Loading finished TTMLs from Firebase...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 24px', maxWidth: 600, margin: '0 auto' }}>
          <Music size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No matching TTMLs found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
            {searchQuery
              ? `No finished lyrics match "${searchQuery}". Try a different song or artist.`
              : 'No finished TTMLs available yet. Upload yours directly from the desktop app!'}
          </p>
        </div>
      ) : (
        <div className="ttml-grid">
          {filtered.map((item) => (
            <div key={item.id} className="glass-panel ttml-card">
              <div className="ttml-cover-wrapper">
                {item.coverArt ? (
                  <>
                    <img src={item.coverArt} alt={item.title} className="ttml-cover" />
                    <button
                      className="ttml-cover-edit-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenArtworkPicker(item);
                      }}
                      title="Change artwork"
                      aria-label="Change artwork"
                    >
                      {uploadingCoverId === item.id ? (
                        <Loader2 size={15} className="spin" />
                      ) : (
                        <ImagePlus size={15} />
                      )}
                    </button>
                  </>
                ) : (
                  <div
                    className="ttml-cover-missing"
                    onClick={() => handleOpenArtworkPicker(item)}
                    role="button"
                    tabIndex={0}
                    title="Upload artwork for this song"
                  >
                    {uploadingCoverId === item.id ? (
                      <>
                        <Loader2 size={30} className="spin" color="var(--accent-pink)" />
                        <span className="ttml-cover-missing-label">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <div className="ttml-cover-missing-icon">
                          <ImagePlus size={22} />
                        </div>
                        <span className="ttml-cover-missing-label">Add Artwork</span>
                        <span className="ttml-cover-missing-sub">Click to upload cover</span>
                      </>
                    )}
                  </div>
                )}
                <span className="ttml-badge">Finished</span>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 className="ttml-title" title={item.title}>
                  {item.title}
                </h3>
                <p className="ttml-artist" title={item.artist}>
                  {item.artist}
                </p>
                {item.album && (
                  <p className="ttml-album" title={item.album}>
                    {item.album}
                  </p>
                )}

                {item.authorName && (
                  <p className="ttml-author" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Uploaded by <span style={{ color: 'var(--text-secondary)' }}>{item.authorName}</span>
                  </p>
                )}

                <div className="ttml-meta-bar">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {item.lineCount ? (
                      <span className="ttml-line-count" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <FileText size={12} />
                        {item.lineCount} lines
                      </span>
                    ) : null}
                    {item.durationMs ? (
                      <span className="ttml-line-count" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} />
                        {formatDuration(item.durationMs)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '10px 16px', fontSize: 14 }}
                    onClick={() => handleDownload(item)}
                    disabled={downloadingId === item.id || deletingId === item.id}
                  >
                    <Download size={16} />
                    <span>{downloadingId === item.id ? 'Downloaded!' : 'Download TTML'}</span>
                  </button>

                  {user && (user.uid === item.authorUid || isUserModerator(user.uid)) && (
                    <button
                      className="btn btn-secondary btn-delete-card"
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      title={
                        isUserModerator(user.uid) && user.uid !== item.authorUid
                          ? 'Moderator action: remove from public finished list'
                          : 'Remove from public finished list'
                      }
                      aria-label={
                        isUserModerator(user.uid) && user.uid !== item.authorUid
                          ? 'Moderator action: remove from public finished list'
                          : 'Remove from public finished list'
                      }
                    >
                      {deletingId === item.id ? (
                        <Loader2 size={16} className="spin" />
                      ) : (
                        <Trash2 size={16} color="#fa2d48" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
