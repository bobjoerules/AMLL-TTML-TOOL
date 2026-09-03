import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  collectionGroup,
  getDocs,
  query,
  limit,
  doc,
  deleteDoc,
  updateDoc,
  setDoc,
  type Firestore,
  type DocumentData
} from 'firebase/firestore';

export interface FinishedTTML {
  id: string;
  title: string;
  artist: string;
  album?: string;
  coverArt?: string;
  lineCount?: number;
  durationMs?: number;
  tags?: string[];
  rawTTML?: string;
  authorUid?: string;
  authorName?: string;
  createdAt?: number;
  updatedAt?: number;
  downloadUrl?: string;
}

export const MODERATOR_UIDS = new Set(["s41Sey8PJUSYHQUsS6aLLb7lsf02"]);

export function isUserModerator(uid?: string | null): boolean {
  return Boolean(uid && MODERATOR_UIDS.has(uid));
}

export function normalizeSongKey(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`´"]/g, "")
    .replace(/&/g, "and")
    .replace(/[\s\-_.,/\\()[\]{}!?:;+*]/g, "");
}

export function getSongKey(title: string, artist: string): string {
  const nTitle = normalizeSongKey(title);
  const nArtist = normalizeSongKey(artist);
  return `${nTitle}:::${nArtist}`;
}

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBLreHn7aJHItOdp9Sq8EHEf-cQtKIjvus",
  authDomain: "amll-ttml.firebaseapp.com",
  projectId: "amll-ttml",
  storageBucket: "amll-ttml.firebasestorage.app",
  messagingSenderId: "733113073433",
  appId: "1:733113073433:web:37a70a2f3741dd3847cf88",
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

try {
  if (getApps().length === 0) {
    app = initializeApp(FIREBASE_CONFIG);
  } else {
    app = getApps()[0];
  }
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.warn("Firebase initialization failed:", e);
}

export function getWebsiteAuth(): Auth | null {
  return auth;
}

export async function signInWithEmail(email: string, pass: string): Promise<User> {
  if (!auth) throw new Error("Firebase Auth not initialized");
  const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return result.user;
}

export async function signUpWithEmail(email: string, pass: string, displayName?: string): Promise<User> {
  if (!auth) throw new Error("Firebase Auth not initialized");
  const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  if (displayName && result.user) {
    await updateProfile(result.user, { displayName: displayName.trim() });
  }
  return result.user;
}

export async function signOutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function updateUserProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
  if (!auth?.currentUser) throw new Error("Not signed in");
  const user = auth.currentUser;
  await updateProfile(user, updates);
  if (db) {
    await setDoc(doc(db, "users", user.uid), { ...updates, updatedAt: Date.now() }, { merge: true }).catch(() => {});
  }
}

export async function removeFromFinishedList(ttml: FinishedTTML, currentUserUid: string): Promise<void> {
  if (!db) throw new Error("Database not connected");
  const isOwner = Boolean(ttml.authorUid && ttml.authorUid === currentUserUid);
  const isMod = isUserModerator(currentUserUid);

  if (!isOwner && !isMod) {
    throw new Error("You do not have permission to remove this song from the Finished list.");
  }

  // 1. Delete from public finished lists
  await Promise.all([
    deleteDoc(doc(db, "finished_ttmls", ttml.id)).catch(() => {}),
    deleteDoc(doc(db, "public_ttmls", ttml.id)).catch(() => {}),
  ]);

  // 2. Safely toggle public status in author's cloud saves WITHOUT deleting the private file
  if (ttml.authorUid) {
    try {
      await updateDoc(doc(db, "users", ttml.authorUid, "ttmls", ttml.id), {
        finished: false,
        publishedToCommunity: false,
        tags: [],
      });
    } catch {
      // User doc may not exist if it was directly in finished_ttmls
    }
  }
}

function parseTTMLDoc(id: string, data: DocumentData, inferredAuthorUid?: string): FinishedTTML {
  const rawTTML = data.rawTTML || data.ttmlContent || data.ttml || "";
  
  let coverArt = data.coverArt || data.cover_art || data.cover || data.songCover || null;
  if (!coverArt && rawTTML) {
    const match =
      rawTTML.match(/key=["']cover(?:_art)?["'][^>]*value=["']([^"']+)["']/i) ||
      rawTTML.match(/<amll:meta[^>]*key=["']cover(?:_art)?["'][^>]*>([^<]+)<\/amll:meta>/i) ||
      rawTTML.match(/https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|webp)/i);
    if (match?.[1] || match?.[0]) {
      coverArt = match[1] || match[0];
    }
  }

  let title = data.title;
  let artist = data.artist;
  let album = data.album;

  if (!title && rawTTML) {
    const titleMatch = rawTTML.match(/<ttm:title>([^<]+)<\/ttm:title>/i);
    if (titleMatch) title = titleMatch[1];
  }

  if (!artist && rawTTML) {
    const artistMatch = rawTTML.match(/<ttm:agent[^>]*type=["']person["'][^>]*>([^<]+)<\/ttm:agent>/i);
    if (artistMatch) artist = artistMatch[1];
  }

  const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt || Date.now();
  const updatedAt = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt || createdAt;

  return {
    id,
    title: title || "Untitled",
    artist: artist || "Unknown Artist",
    album: album || undefined,
    coverArt: coverArt || undefined,
    lineCount: data.lineCount || (data.lines ? data.lines.length : 0) || (rawTTML.match(/<p\b/g)?.length || 0),
    durationMs: data.durationMs || 0,
    tags: data.tags || (data.finished ? ["finished"] : ["community"]),
    rawTTML,
    authorUid: data.authorUid || data.author_uid || data.userId || inferredAuthorUid || undefined,
    authorName: data.authorName || data.author_name || data.author || undefined,
    createdAt,
    updatedAt,
    downloadUrl: data.downloadUrl || data.audioUrl,
  };
}

export async function fetchFinishedTTMLs(): Promise<FinishedTTML[]> {
  if (!db) return FEATURED_FINISHED_TTMLS;

  const rawDocs: FinishedTTML[] = [];

  try {
    // 1. Query collection "finished_ttmls" (opt-in community shares)
    try {
      const snap = await getDocs(query(collection(db, "finished_ttmls"), limit(100)));
      snap.forEach((docSnap) => {
        rawDocs.push(parseTTMLDoc(docSnap.id, docSnap.data()));
      });
    } catch (e) {
      console.warn("Could not read finished_ttmls collection:", e);
    }

    // 2. Query collection "public_ttmls"
    try {
      const snap = await getDocs(query(collection(db, "public_ttmls"), limit(100)));
      snap.forEach((docSnap) => {
        rawDocs.push(parseTTMLDoc(docSnap.id, docSnap.data()));
      });
    } catch (e) {
      console.warn("Could not read public_ttmls collection:", e);
    }

    // 3. Query collectionGroup "ttmls", but ONLY include documents where user opted in
    try {
      const snap = await getDocs(query(collectionGroup(db, "ttmls"), limit(100)));
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const isOptedIn =
          data.publishedToCommunity === true ||
          data.finished === true ||
          (Array.isArray(data.tags) && (data.tags.includes("finished") || data.tags.includes("community")));
        if (isOptedIn) {
          const authorUidFromPath = docSnap.ref.parent?.parent?.id;
          rawDocs.push(parseTTMLDoc(docSnap.id, data, authorUidFromPath));
        }
      });
    } catch (e) {
      console.warn("Could not read collectionGroup(ttmls):", e);
    }
  } catch (err) {
    console.error("Error connecting to Firebase:", err);
  }

  // Deduplicate by song key so that ONLY THE NEWEST VERSION of each song is shown
  const latestBySong = new Map<string, FinishedTTML>();

  for (const item of rawDocs) {
    const key = getSongKey(item.title, item.artist);
    const existing = latestBySong.get(key);

    if (!existing) {
      latestBySong.set(key, item);
      continue;
    }

    const itemTime = item.updatedAt || item.createdAt || 0;
    const existingTime = existing.updatedAt || existing.createdAt || 0;

    if (itemTime > existingTime) {
      latestBySong.set(key, item);
    } else if (itemTime === existingTime) {
      // Tie-breaker: keep the version with more lyrics or rich metadata
      if (
        (item.lineCount || 0) > (existing.lineCount || 0) ||
        (item.rawTTML?.length || 0) > (existing.rawTTML?.length || 0)
      ) {
        latestBySong.set(key, item);
      }
    }
  }

  // Include featured verified tracks if not already superseded by a live upload
  for (const featured of FEATURED_FINISHED_TTMLS) {
    const key = getSongKey(featured.title, featured.artist);
    if (!latestBySong.has(key)) {
      latestBySong.set(key, featured);
    }
  }

  return Array.from(latestBySong.values()).sort(
    (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0),
  );
}

// Built-in showcase finished TTMLs (empty by default; library loads live verified community uploads)
export const FEATURED_FINISHED_TTMLS: FinishedTTML[] = [];



export function downloadTTMLFile(ttml: FinishedTTML) {
  const content = ttml.rawTTML || `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Word">
  <head>
    <metadata>
      <ttm:title>${ttml.title}</ttm:title>
      <ttm:agent type="person">${ttml.artist}</ttm:agent>
    </metadata>
  </head>
  <body>
    <div></div>
  </body>
</tt>`;

  const filename = `${ttml.artist} - ${ttml.title}.ttml`.replace(/[/\\?%*:|"<>]/g, '-');
  const blob = new Blob([content], { type: 'application/xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Reads and compresses an image File into a square JPEG data URL (~512x512 max).
 */
export async function compressImageToDataUrl(file: File, maxSize = 512, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const width = img.width;
        const height = img.height;

        // Center-crop to a square aspect ratio
        const size = Math.min(width, height);
        const startX = (width - size) / 2;
        const startY = (height - size) / 2;

        const targetSize = Math.min(size, maxSize);
        canvas.width = targetSize;
        canvas.height = targetSize;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, startX, startY, size, size, 0, 0, targetSize, targetSize);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Updates the cover art of a song across Firestore documents.
 */
export async function updateSongCoverArt(
  ttml: FinishedTTML,
  coverArtDataUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!db) return { success: false, error: "Firestore is not connected." };

  try {
    const payload = {
      coverArt: coverArtDataUrl,
      updatedAt: Date.now(),
    };
    const promises: Promise<any>[] = [];

    if (ttml.authorUid) {
      const userDocRef = doc(db, "users", ttml.authorUid, "ttmls", ttml.id);
      promises.push(setDoc(userDocRef, payload, { merge: true }).catch(() => {}));
    }

    const finishedRef = doc(db, "finished_ttmls", ttml.id);
    promises.push(setDoc(finishedRef, payload, { merge: true }).catch(() => {}));

    const publicRef = doc(db, "public_ttmls", ttml.id);
    promises.push(setDoc(publicRef, payload, { merge: true }).catch(() => {}));

    await Promise.all(promises);
    return { success: true };
  } catch (err: any) {
    console.error("Error updating song cover art:", err);
    return { success: false, error: err?.message || "Failed to update artwork in Firestore." };
  }
}

