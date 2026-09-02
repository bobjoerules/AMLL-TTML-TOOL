import React, { useState } from 'react';
import { X, User as UserIcon, Shield, Image, LogOut, Check, Loader2, Save } from 'lucide-react';
import type { User } from 'firebase/auth';
import { isUserModerator, signOutUser, updateUserProfile } from '../utils/firebase';

interface ProfileModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  user,
  onClose,
  onProfileUpdated,
}) => {
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const isMod = isUserModerator(user.uid);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await updateUserProfile({
        displayName: displayName.trim() || undefined,
        photoURL: photoURL.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      console.error('Update profile error:', err);
      setError(err?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      onClose();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const avatarSrc = photoURL || user.photoURL;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content profile-modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close profile">
          <X size={18} />
        </button>

        <div className="profile-header">
          <div className="profile-avatar-large">
            {avatarSrc ? (
              <img src={avatarSrc} alt={user.displayName || 'User'} />
            ) : (
              <div className="profile-avatar-fallback">
                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="profile-identity">
            <div className="profile-name-row">
              <h3>{user.displayName || 'Unnamed Creator'}</h3>
              {isMod && (
                <span className="badge badge-mod">
                  <Shield size={12} />
                  <span>MODERATOR</span>
                </span>
              )}
            </div>
            <p className="profile-email">{user.email}</p>
            <p className="profile-uid">
              UID: <code>{user.uid}</code>
            </p>
          </div>
        </div>

        {error && <div className="auth-error-banner">{error}</div>}
        {success && (
          <div className="auth-success-banner">
            <Check size={16} />
            <span>Profile successfully updated!</span>
          </div>
        )}

        <form onSubmit={handleSave} className="profile-edit-form">
          <div className="form-group">
            <label>Display Name</label>
            <div className="input-with-icon">
              <UserIcon size={16} className="input-icon" />
              <input
                type="text"
                placeholder="e.g. BeatsMaster"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Avatar Photo URL</label>
            <div className="input-with-icon">
              <Image size={16} className="input-icon" />
              <input
                type="url"
                placeholder="https://example.com/avatar.png"
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="profile-actions-row">
            <button
              type="button"
              className="btn btn-secondary btn-signout"
              onClick={handleSignOut}
              disabled={saving}
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
