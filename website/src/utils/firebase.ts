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
  getDoc,
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

  // 2. Safely toggle public status in author's cloud saves WITHOUT deleting the private file or completion status
  if (ttml.authorUid) {
    try {
      const userDocRef = doc(db, "users", ttml.authorUid, "ttmls", ttml.id);
      const userDocSnap = await getDoc(userDocRef);
      const existingTags: string[] = userDocSnap.exists() && Array.isArray(userDocSnap.data().tags)
        ? userDocSnap.data().tags
        : [];
      const updatedTags = existingTags.filter((t) => t !== "community");
      await updateDoc(userDocRef, {
        publishedToCommunity: false,
        tags: updatedTags,
      });
    } catch {
      // User doc may not exist if it was directly in finished_ttmls
    }
  }
}

export function isTTMLPubliclyOptedIn(data: DocumentData): boolean {
  return (
    data.publishedToCommunity === true ||
    (Array.isArray(data.tags) && data.tags.includes("community"))
  );
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
    tags: data.tags || (data.publishedToCommunity ? ["community"] : (data.finished ? ["finished"] : [])),
    rawTTML,
    authorUid: data.authorUid || data.author_uid || data.userId || inferredAuthorUid || undefined,
    authorName: data.authorName || data.author_name || data.author || undefined,
    createdAt,
    updatedAt,
    downloadUrl: data.downloadUrl || data.audioUrl,
  };
}

export function deduplicateAndMergeTTMLs(rawDocs: FinishedTTML[]): FinishedTTML[] {
  // Deduplicate by song key so that ONLY THE NEWEST VERSION of each song is shown
  const latestBySong = new Map<string, FinishedTTML>();

  for (const item of rawDocs) {
    const key = getSongKey(item.title, item.artist);
    const existing = latestBySong.get(key);

    if (!existing) {
      latestBySong.set(key, { ...item });
      continue;
    }

    const itemTime = item.updatedAt || item.createdAt || 0;
    const existingTime = existing.updatedAt || existing.createdAt || 0;

    if (itemTime > existingTime) {
      const merged = { ...item };
      // If newer doc doesn't have rawTTML, retain existing rawTTML
      if (!merged.rawTTML && existing.rawTTML) {
        merged.rawTTML = existing.rawTTML;
      }
      latestBySong.set(key, merged);
    } else if (itemTime === existingTime) {
      // Tie-breaker: keep the version with more lyrics or rich metadata
      const hasBetterContent =
        (item.lineCount || 0) > (existing.lineCount || 0) ||
        (item.rawTTML?.length || 0) > (existing.rawTTML?.length || 0);

      if (hasBetterContent) {
        const merged = { ...item };
        if (!merged.rawTTML && existing.rawTTML) {
          merged.rawTTML = existing.rawTTML;
        }
        latestBySong.set(key, merged);
      } else if (!existing.rawTTML && item.rawTTML) {
        existing.rawTTML = item.rawTTML;
      }
    } else {
      // existingTime > itemTime: ensure existing retains rawTTML if missing
      if (!existing.rawTTML && item.rawTTML) {
        existing.rawTTML = item.rawTTML;
      }
    }
  }

  // Include featured verified tracks if not already superseded by a live upload
  for (const featured of FEATURED_FINISHED_TTMLS) {
    const key = getSongKey(featured.title, featured.artist);
    if (!latestBySong.has(key)) {
      latestBySong.set(key, { ...featured });
    }
  }

  return Array.from(latestBySong.values()).sort(
    (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0),
  );
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

    // 3. Query collectionGroup "ttmls", but ONLY include documents where user explicitly opted in to community
    try {
      const snap = await getDocs(query(collectionGroup(db, "ttmls"), limit(100)));
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (isTTMLPubliclyOptedIn(data)) {
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

  return deduplicateAndMergeTTMLs(rawDocs);
}

// Built-in showcase finished TTMLs (empty by default; library loads live verified community uploads)
export const FEATURED_FINISHED_TTMLS: FinishedTTML[] = [];



export async function downloadTTMLFile(ttml: FinishedTTML): Promise<void> {
  let content = ttml.rawTTML || "";
  if (!content && db && ttml.authorUid && ttml.id) {
    try {
      const payloadRef = doc(db, "users", ttml.authorUid, "ttmls", ttml.id, "payload", "content");
      const payloadSnap = await getDoc(payloadRef);
      if (payloadSnap.exists()) {
        content = payloadSnap.data().rawTTML || "";
      }
    } catch (e) {
      console.warn("Could not fetch ttml payload for download:", e);
    }
  }

  if (!content) {
    content = `<?xml version="1.0" encoding="utf-8"?>
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
  }

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

export async function downloadAudioFile(ttml: FinishedTTML): Promise<void> {
  const url = ttml.downloadUrl;
  if (!url) throw new Error("No audio download URL available for this song");
  const filename = `${ttml.artist ? `${ttml.artist} - ` : ""}${ttml.title || "audio"}.mp3`.replace(/[/\\?%*:|"<>]/g, '-');
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch audio file (${resp.status})`);
  const blob = await resp.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
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
 * Restricted to the song author or designated moderators.
 */
export async function updateSongCoverArt(
  ttml: FinishedTTML,
  coverArtDataUrl: string,
  currentUserUid?: string
): Promise<{ success: boolean; error?: string }> {
  if (!db) return { success: false, error: "Firestore is not connected." };

  const callerUid = currentUserUid || auth?.currentUser?.uid;
  if (!callerUid) {
    return { success: false, error: "You must be logged in to update artwork." };
  }

  const isAuthor = Boolean(ttml.authorUid && ttml.authorUid === callerUid);
  const isMod = isUserModerator(callerUid);

  if (!isAuthor && !isMod) {
    return {
      success: false,
      error: "You do not have permission to update artwork for this song.",
    };
  }

  try {
    const payload = {
      coverArt: coverArtDataUrl,
      updatedAt: Date.now(),
    };
    const promises: Promise<any>[] = [];

    if (ttml.authorUid && (isAuthor || isMod)) {
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

export interface UserProfileStats {
  uid: string;
  displayName: string;
  photoURL?: string;
  isModerator: boolean;
  totalSongs: number;
  totalLines: number;
  totalDurationMs: number;
  wordSyncSongs: number;
  lineSyncSongs: number;
  uniqueArtists: string[];
  firstContribution?: number;
  lastContribution?: number;
  songs: FinishedTTML[];
}

export interface CommunityGlobalStats {
  totalSongs: number;
  totalLines: number;
  totalDurationMs: number;
  totalCreators: number;
  totalWordSync: number;
  totalArtists: number;
}

export function isSongWordSync(ttml: FinishedTTML): boolean {
  if (!ttml.rawTTML) return false;
  return (
    /itunes:timing=["']Word["']/i.test(ttml.rawTTML) ||
    /<span\b[^>]*\bbegin=/i.test(ttml.rawTTML)
  );
}

export async function fetchUserProfilesWithStats(): Promise<{
  profiles: UserProfileStats[];
  globalStats: CommunityGlobalStats;
}> {
  const songs = await fetchFinishedTTMLs();

  // Fetch registered user profiles for rich avatar & up-to-date display name
  const userDocsMap = new Map<string, { displayName?: string; photoURL?: string }>();
  if (db) {
    try {
      const snap = await getDocs(query(collection(db, "users"), limit(150)));
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        userDocsMap.set(docSnap.id, {
          displayName: data.displayName || data.name,
          photoURL: data.photoURL || data.avatarUrl || data.photoUrl,
        });
      });
    } catch {
      // Allowed to fail gracefully if security rules restrict users collection
    }
  }

  const creatorsMap = new Map<
    string,
    {
      uid: string;
      displayName: string;
      photoURL?: string;
      songs: FinishedTTML[];
      artistsSet: Set<string>;
      totalLines: number;
      totalDurationMs: number;
      wordSyncSongs: number;
      lineSyncSongs: number;
      firstContribution: number;
      lastContribution: number;
    }
  >();

  const allArtistsSet = new Set<string>();
  let globalTotalLines = 0;
  let globalTotalDuration = 0;
  let globalWordSync = 0;

  for (const song of songs) {
    const isWord = isSongWordSync(song);
    if (isWord) globalWordSync++;
    globalTotalLines += song.lineCount || 0;
    globalTotalDuration += song.durationMs || 0;
    if (song.artist && song.artist.trim()) {
      allArtistsSet.add(song.artist.trim().toLowerCase());
    }

    const uid = song.authorUid || (song.authorName ? `author:${song.authorName.toLowerCase()}` : "community");
    const userDoc = song.authorUid ? userDocsMap.get(song.authorUid) : undefined;
    const displayName =
      userDoc?.displayName ||
      song.authorName ||
      (song.authorUid ? `Creator (${song.authorUid.slice(0, 6)})` : "Community Creator");
    const photoURL = userDoc?.photoURL;

    let creator = creatorsMap.get(uid);
    if (!creator) {
      creator = {
        uid: song.authorUid || uid,
        displayName,
        photoURL,
        songs: [],
        artistsSet: new Set<string>(),
        totalLines: 0,
        totalDurationMs: 0,
        wordSyncSongs: 0,
        lineSyncSongs: 0,
        firstContribution: song.createdAt || Date.now(),
        lastContribution: song.updatedAt || song.createdAt || Date.now(),
      };
      creatorsMap.set(uid, creator);
    } else {
      // Prioritize registered user doc or better non-generic displayName
      if (userDoc?.displayName) {
        creator.displayName = userDoc.displayName;
      } else if (!creator.displayName || creator.displayName.startsWith("Creator (")) {
        if (song.authorName) creator.displayName = song.authorName;
      }
      if (photoURL && !creator.photoURL) {
        creator.photoURL = photoURL;
      }
    }

    creator.songs.push(song);
    if (song.artist && song.artist.trim()) {
      creator.artistsSet.add(song.artist.trim());
    }
    creator.totalLines += song.lineCount || 0;
    creator.totalDurationMs += song.durationMs || 0;
    if (isWord) {
      creator.wordSyncSongs++;
    } else {
      creator.lineSyncSongs++;
    }

    const t = song.updatedAt || song.createdAt || 0;
    if (t > 0) {
      if (!creator.firstContribution || t < creator.firstContribution) {
        creator.firstContribution = t;
      }
      if (t > creator.lastContribution) {
        creator.lastContribution = t;
      }
    }
  }

  const profiles: UserProfileStats[] = Array.from(creatorsMap.values()).map((c) => ({
    uid: c.uid,
    displayName: c.displayName,
    photoURL: c.photoURL,
    isModerator: isUserModerator(c.uid),
    totalSongs: c.songs.length,
    totalLines: c.totalLines,
    totalDurationMs: c.totalDurationMs,
    wordSyncSongs: c.wordSyncSongs,
    lineSyncSongs: c.lineSyncSongs,
    uniqueArtists: Array.from(c.artistsSet),
    firstContribution: c.firstContribution,
    lastContribution: c.lastContribution,
    songs: c.songs.sort(
      (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0),
    ),
  }));

  // Sort creators by song count descending, then total lines
  profiles.sort((a, b) => b.totalSongs - a.totalSongs || b.totalLines - a.totalLines);

  const globalStats: CommunityGlobalStats = {
    totalSongs: songs.length,
    totalLines: globalTotalLines,
    totalDurationMs: globalTotalDuration,
    totalCreators: profiles.length,
    totalWordSync: globalWordSync,
    totalArtists: allArtistsSet.size,
  };

  return { profiles, globalStats };
}


