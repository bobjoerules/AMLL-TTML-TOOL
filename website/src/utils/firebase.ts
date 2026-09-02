import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  collectionGroup,
  getDocs,
  query,
  orderBy,
  limit,
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
  createdAt?: number;
  updatedAt?: number;
  downloadUrl?: string;
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

try {
  if (getApps().length === 0) {
    app = initializeApp(FIREBASE_CONFIG);
  } else {
    app = getApps()[0];
  }
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase initialization failed:", e);
}

function parseTTMLDoc(id: string, data: DocumentData): FinishedTTML {
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
          rawDocs.push(parseTTMLDoc(docSnap.id, data));
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

// Built-in showcase finished TTMLs crafted with syllable-level timings
export const FEATURED_FINISHED_TTMLS: FinishedTTML[] = [
  {
    id: "blinding-lights-ttml",
    title: "Blinding Lights",
    artist: "The Weeknd",
    album: "After Hours",
    coverArt: "https://images.genius.com/9780c107be66324db00676435c24e650.1000x1000x1.png",
    lineCount: 42,
    durationMs: 200040,
    tags: ["finished", "syllable-synced", "verified"],
    createdAt: Date.now() - 86400000 * 2,
    rawTTML: `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Word">
  <head>
    <metadata>
      <ttm:title>Blinding Lights</ttm:title>
      <ttm:agent type="person">The Weeknd</ttm:agent>
    </metadata>
  </head>
  <body>
    <div>
      <p begin="00:00:26.500" end="00:00:30.120"><span begin="00:00:26.500" end="00:00:27.100">Yeah </span></p>
      <p begin="00:00:30.200" end="00:00:34.500"><span begin="00:00:30.200" end="00:00:30.500">I've </span><span begin="00:00:30.500" end="00:00:30.800">been </span><span begin="00:00:30.800" end="00:00:31.200">try</span><span begin="00:00:31.200" end="00:00:31.500">in' </span><span begin="00:00:31.500" end="00:00:31.900">to </span><span begin="00:00:31.900" end="00:00:32.400">call</span></p>
      <p begin="00:00:34.600" end="00:00:39.200"><span begin="00:00:34.600" end="00:00:34.900">I've </span><span begin="00:00:34.900" end="00:00:35.300">been </span><span begin="00:00:35.300" end="00:00:35.800">on </span><span begin="00:00:35.800" end="00:00:36.100">my </span><span begin="00:00:36.100" end="00:00:36.800">own </span><span begin="00:00:36.800" end="00:00:37.300">for </span><span begin="00:00:37.300" end="00:00:37.700">long </span><span begin="00:00:37.700" end="00:00:38.400">e</span><span begin="00:00:38.400" end="00:00:39.200">nough</span></p>
      <p begin="00:00:39.300" end="00:00:43.700"><span begin="00:00:39.300" end="00:00:39.800">May</span><span begin="00:00:39.800" end="00:00:40.200">be </span><span begin="00:00:40.200" end="00:00:40.600">you </span><span begin="00:00:40.600" end="00:00:41.000">can </span><span begin="00:00:41.000" end="00:00:41.400">show </span><span begin="00:00:41.400" end="00:00:41.900">me </span><span begin="00:00:41.900" end="00:00:42.300">how </span><span begin="00:00:42.300" end="00:00:42.700">to </span><span begin="00:00:42.700" end="00:00:43.500">love, </span><span begin="00:00:43.500" end="00:00:43.700">may</span><span begin="00:00:43.700" end="00:00:44.200">be</span></p>
    </div>
  </body>
</tt>`
  },
  {
    id: "espresso-ttml",
    title: "Espresso",
    artist: "Sabrina Carpenter",
    album: "Short n' Sweet",
    coverArt: "https://images.genius.com/5f7936a7eaee7fa56a29be1db1d7bfd1.1000x1000x1.png",
    lineCount: 38,
    durationMs: 175400,
    tags: ["finished", "syllable-synced"],
    createdAt: Date.now() - 86400000 * 5,
    rawTTML: `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Word">
  <head>
    <metadata>
      <ttm:title>Espresso</ttm:title>
      <ttm:agent type="person">Sabrina Carpenter</ttm:agent>
    </metadata>
  </head>
  <body>
    <div>
      <p begin="00:00:04.200" end="00:00:08.500"><span begin="00:00:04.200" end="00:00:04.600">Now </span><span begin="00:00:04.600" end="00:00:04.900">he's </span><span begin="00:00:04.900" end="00:00:05.300">think</span><span begin="00:00:05.300" end="00:00:05.600">in' </span><span begin="00:00:05.600" end="00:00:06.100">'bout </span><span begin="00:00:06.100" end="00:00:06.900">me </span><span begin="00:00:06.900" end="00:00:07.400">eve</span><span begin="00:00:07.400" end="00:00:07.800">ry </span><span begin="00:00:07.800" end="00:00:08.500">night, </span><span begin="00:00:08.500" end="00:00:08.900">oh</span></p>
      <p begin="00:00:09.100" end="00:00:13.200"><span begin="00:00:09.100" end="00:00:09.600">Is </span><span begin="00:00:09.600" end="00:00:09.900">it </span><span begin="00:00:09.900" end="00:00:10.400">that </span><span begin="00:00:10.400" end="00:00:11.200">sweet? </span><span begin="00:00:11.200" end="00:00:11.800">I </span><span begin="00:00:11.800" end="00:00:12.300">guess </span><span begin="00:00:12.300" end="00:00:12.800">so</span></p>
      <p begin="00:00:13.000" end="00:00:17.500"><span begin="00:00:13.000" end="00:00:13.500">Say </span><span begin="00:00:13.500" end="00:00:13.900">you </span><span begin="00:00:13.900" end="00:00:14.300">can't </span><span begin="00:00:14.300" end="00:00:15.100">sleep, </span><span begin="00:00:15.100" end="00:00:15.500">ba</span><span begin="00:00:15.500" end="00:00:16.100">by, </span><span begin="00:00:16.100" end="00:00:16.500">I </span><span begin="00:00:16.500" end="00:00:17.200">know</span></p>
      <p begin="00:00:17.400" end="00:00:21.800"><span begin="00:00:17.400" end="00:00:18.000">That's </span><span begin="00:00:18.000" end="00:00:18.400">that </span><span begin="00:00:18.400" end="00:00:19.000">me, </span><span begin="00:00:19.000" end="00:00:19.800">es</span><span begin="00:00:19.800" end="00:00:20.400">pres</span><span begin="00:00:20.400" end="00:00:21.200">so</span></p>
    </div>
  </body>
</tt>`
  },
  {
    id: "starboy-ttml",
    title: "Starboy",
    artist: "The Weeknd ft. Daft Punk",
    album: "Starboy",
    coverArt: "https://images.genius.com/b39cfb33ad3be0d77d13054117b483be.1000x1000x1.png",
    lineCount: 56,
    durationMs: 230450,
    tags: ["finished", "syllable-synced"],
    createdAt: Date.now() - 86400000 * 10,
    rawTTML: `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Word">
  <head>
    <metadata>
      <ttm:title>Starboy</ttm:title>
      <ttm:agent type="person">The Weeknd</ttm:agent>
    </metadata>
  </head>
  <body>
    <div>
      <p begin="00:00:15.200" end="00:00:19.500"><span begin="00:00:15.200" end="00:00:15.800">I'm </span><span begin="00:00:15.800" end="00:00:16.400">try</span><span begin="00:00:16.400" end="00:00:16.800">in' </span><span begin="00:00:16.800" end="00:00:17.200">to </span><span begin="00:00:17.200" end="00:00:17.800">put </span><span begin="00:00:17.800" end="00:00:18.200">you </span><span begin="00:00:18.200" end="00:00:18.800">in </span><span begin="00:00:18.800" end="00:00:19.400">the </span><span begin="00:00:19.400" end="00:00:19.800">worst </span><span begin="00:00:19.800" end="00:00:20.500">mood, </span><span begin="00:00:20.500" end="00:00:21.000">ah</span></p>
    </div>
  </body>
</tt>`
  }
];



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
