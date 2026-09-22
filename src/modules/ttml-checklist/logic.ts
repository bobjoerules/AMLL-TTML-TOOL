import { uid } from "uid";
import { parseLyric } from "$/modules/project/logic/ttml-parser";

export interface TTMLChecklistEntry {
	id: string;
	song: string;
	artist: string;
	album?: string;
	coverArt?: string;
	source?: "genius" | "lyrically" | "lrclib" | "spotify";
	sourceId?: string | number;
	sourceUrl?: string;
	cloudDocId?: string;
	cloudAudioUrl?: string;
	notes: string;
	completed: boolean;
	status?: "not-started" | "in-progress" | "completed";
	favorite?: boolean;
	uploadedToDatabase?: boolean;
	createdAt: number;
}

export type TTMLChecklistEntryInput = {
	song: string;
	artist?: string;
	album?: string;
	coverArt?: string;
	source?: "genius" | "lyrically" | "lrclib" | "spotify";
	sourceId?: string | number;
	sourceUrl?: string;
	cloudDocId?: string;
	cloudAudioUrl?: string;
	notes?: string;
	completed?: boolean;
	status?: "not-started" | "in-progress" | "completed";
	favorite?: boolean;
	uploadedToDatabase?: boolean;
};

export function isChecklistEntryCompleted(entry: TTMLChecklistEntry): boolean {
	return Boolean(entry.completed || entry.status === "completed");
}

export function isChecklistEntryInProgress(entry: TTMLChecklistEntry): boolean {
	if (isChecklistEntryCompleted(entry)) return false;
	if (entry.status === "in-progress") return true;
	if (entry.status === "not-started") return false;
	return Boolean(entry.cloudDocId);
}

export function isChecklistEntryNotStarted(entry: TTMLChecklistEntry): boolean {
	if (isChecklistEntryCompleted(entry)) return false;
	return !isChecklistEntryInProgress(entry);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isTTML100PercentCompleted(lines: {
	lyricLines?: any[];
}): boolean {
	if (
		!lines ||
		!Array.isArray(lines.lyricLines) ||
		lines.lyricLines.length === 0
	) {
		return false;
	}
	const meaningfulLines = lines.lyricLines.filter((l) => {
		if (l.ignoreSync) return false;
		const text =
			(Array.isArray(l.words)
				? l.words.map((w: any) => w.word).join("")
				: "") || "";
		return text.trim().length > 0;
	});
	if (meaningfulLines.length === 0) return false;

	return meaningfulLines.every((line) => {
		const hasValidLineTiming =
			typeof line.endTime === "number" &&
			typeof line.startTime === "number" &&
			line.endTime > line.startTime &&
			line.endTime > 0;
		if (!hasValidLineTiming) return false;

		if (Array.isArray(line.words) && line.words.length > 0) {
			const validWords = line.words.filter(
				(w: any) =>
					w.word && typeof w.word === "string" && w.word.trim().length > 0,
			);
			if (validWords.length > 0) {
				const hasSyllableSync = validWords.some(
					(w: any) => typeof w.endTime === "number" && w.endTime > 0,
				);
				// If words have individual syllable sync, verify every word has timing
				if (hasSyllableSync) {
					return validWords.every(
						(w: any) =>
							typeof w.endTime === "number" &&
							typeof w.startTime === "number" &&
							w.endTime >= w.startTime &&
							w.endTime > 0,
					);
				}
			}
		}
		return true;
	});
}

const normKeyCache = new Map<string, string>();

export function normalizeSongKey(str: string): string {
	if (!str) return "";
	const cached = normKeyCache.get(str);
	if (cached !== undefined) return cached;

	const computed = str
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[’'"`´“”]/g, "")
		.replace(
			/[\s\-_.,/\\()[\]{}!?:;~～〜・―—–「」『』【】（）［］〈〉《》〔〕｛｝&+#$*^%@|<>]+/g,
			"",
		)
		.trim();

	if (normKeyCache.size > 5000) normKeyCache.clear();
	normKeyCache.set(str, computed);
	return computed;
}

const baseSongCache = new Map<string, string>();

/**
 * Strips featuring artists, version info (live, acoustic, remaster, radio edit, etc.),
 * and extra descriptor parentheticals to extract the core canonical song title.
 */
export function getBaseSongTitle(title: string): string {
	if (!title) return "";
	const cached = baseSongCache.get(title);
	if (cached !== undefined) return cached;

	let t = title.trim();

	// Convert unicode/fullwidth brackets to standard brackets
	t = t
		.replace(/[（［【「『〈《〔｛]/g, "(")
		.replace(/[）］】」』〉》〕｝]/g, ")");

	// 1. Remove parenthetical feature descriptions: (feat. ...), (with ...), etc.
	t = t.replace(
		/\s*\((?:feat\.?|ft\.?|featuring|with)\s+[^)]+\)/gi,
		"",
	);
	// 2. Remove dash features: - feat. ... or - with ...
	t = t.replace(
		/\s*[-–—~〜]\s*(?:feat\.?|ft\.?|featuring|with)\s+.*$/gi,
		"",
	);
	// 3. Remove trailing feat. ... / ft. ...
	t = t.replace(/\s+(?:feat\.?|ft\.?|featuring|with)\s+.*$/gi, "");

	// 4. Remove common version/descriptor parentheticals
	const versionRegex =
		/\s*\((?:remaster(?:ed)?(?:\s+\d{4})?|\d{4}\s+remaster|taylor'?s\s+version|from\s+the\s+vault|live(?:\s+at|\s+from)?(?:\s+[^)]*)?|acoustic(?:\s+version)?|instrumental|clean(?:\s+version)?|explicit(?:\s+version)?|radio\s+edit|radio\s+mix|single\s+version|album\s+version|extended(?:\s+mix|\s+version)?|deluxe(?:\s+edition)?|bonus\s+track|official\s+(?:audio|video|music\s+video)|original\s+soundtrack|ost|from\s+["'][^"']+["']|from\s+the\s+[^)]+|remix)\)/gi;
	t = t.replace(versionRegex, "");

	// 5. Remove trailing dash versions: - Remastered..., - Live..., etc.
	const dashVersionRegex =
		/\s*[-–—~〜]\s*(?:remaster(?:ed)?(?:\s+\d{4})?|\d{4}\s+remaster|taylor'?s\s+version|from\s+the\s+vault|live(?:\s+at|\s+from)?(?:\s+.*)?|acoustic(?:\s+version)?|instrumental|clean(?:\s+version)?|explicit(?:\s+version)?|radio\s+edit|single\s+version|album\s+version|extended(?:\s+mix|\s+version)?|deluxe(?:\s+edition)?|bonus\s+track|official\s+.*|remix)$/gi;
	t = t.replace(dashVersionRegex, "");

	// 6. If title still has trailing parenthetical e.g. "Song (Subtitle)", extract base if reasonable
	const genericParenMatch = t.match(/^(.*?)\s*\([^)]+\)\s*$/);
	if (genericParenMatch && genericParenMatch[1]?.trim().length >= 2) {
		t = genericParenMatch[1].trim();
	}

	const result = normalizeSongKey(t);
	if (baseSongCache.size > 5000) baseSongCache.clear();
	baseSongCache.set(title, result);
	return result;
}

const artistTokensCache = new Map<string, { primary: string; all: string[] }>();

export function extractArtistTokens(artist?: string): {
	primary: string;
	all: string[];
} {
	if (!artist || !artist.trim()) {
		return { primary: "", all: [] };
	}

	const cached = artistTokensCache.get(artist);
	if (cached !== undefined) return cached;

	const cleanRaw = artist.trim().replace(/^[Tt]he\s+/, "");
	const rawTokens = cleanRaw
		.split(/[\/,;+&xX]|\s+(?:and|with|feat\.?|ft\.?|featuring|vs\.?|pres\.?)\s+/i)
		.map((t) => normalizeSongKey(t))
		.filter((t) => t.length > 0);

	const primary = rawTokens[0] || normalizeSongKey(cleanRaw);
	const all = rawTokens.length > 0 ? rawTokens : [primary];

	const res = { primary, all };
	if (artistTokensCache.size > 5000) artistTokensCache.clear();
	artistTokensCache.set(artist, res);
	return res;
}

export function areArtistsCompatible(
	artistA?: string,
	artistB?: string,
): boolean {
	const a = (artistA || "").trim();
	const b = (artistB || "").trim();

	// If either artist is omitted, treat as compatible based on title
	if (!a || !b) return true;

	const normA = normalizeSongKey(a);
	const normB = normalizeSongKey(b);

	if (normA === normB) return true;

	const stripTheA = normA.replace(/^the/, "");
	const stripTheB = normB.replace(/^the/, "");
	if (stripTheA === stripTheB) return true;

	if (
		(normA.length >= 3 && normB.includes(normA)) ||
		(normB.length >= 3 && normA.includes(normB)) ||
		(stripTheA.length >= 3 && stripTheB.includes(stripTheA)) ||
		(stripTheB.length >= 3 && stripTheA.includes(stripTheB))
	) {
		return true;
	}

	const tokensA = extractArtistTokens(a);
	const tokensB = extractArtistTokens(b);

	if (
		tokensA.primary &&
		tokensB.primary &&
		(tokensA.primary === tokensB.primary ||
			tokensA.primary.replace(/^the/, "") ===
				tokensB.primary.replace(/^the/, ""))
	) {
		return true;
	}

	if (
		tokensA.primary.length >= 3 &&
		tokensB.primary.length >= 3 &&
		(tokensA.primary.includes(tokensB.primary) ||
			tokensB.primary.includes(tokensA.primary))
	) {
		return true;
	}

	for (const tA of tokensA.all) {
		if (tA.length >= 3) {
			for (const tB of tokensB.all) {
				if (tB.length >= 3 && (tA === tB || tA.includes(tB) || tB.includes(tA))) {
					return true;
				}
			}
		}
	}

	return false;
}

export function areSongTitlesDuplicate(songA: string, songB: string): boolean {
	if (!songA || !songB) return false;

	const normA = normalizeSongKey(songA);
	const normB = normalizeSongKey(songB);
	if (normA && normB && normA === normB) return true;

	const baseA = getBaseSongTitle(songA);
	const baseB = getBaseSongTitle(songB);
	if (baseA && baseB && baseA === baseB) return true;

	if (baseA && normB && baseA.length >= 2 && baseA === normB) return true;
	if (baseB && normA && baseB.length >= 2 && baseB === normA) return true;

	return false;
}

export function extractSpotifyTrackId(input?: string): string | null {
	if (!input) return null;
	const match = input.match(
		/(?:spotify:track:|https?:\/\/(?:open\.)?spotify\.com\/track\/)?([a-zA-Z0-9]{22})/,
	);
	return match ? match[1] : null;
}

export function areChecklistEntriesDuplicate(
	a: Partial<TTMLChecklistEntry>,
	b: Partial<TTMLChecklistEntry>,
): boolean {
	if (a.cloudDocId && b.cloudDocId && a.cloudDocId === b.cloudDocId) {
		return true;
	}

	const spotA =
		(a.source === "spotify" && a.sourceId ? String(a.sourceId) : null) ||
		extractSpotifyTrackId(a.sourceUrl);
	const spotB =
		(b.source === "spotify" && b.sourceId ? String(b.sourceId) : null) ||
		extractSpotifyTrackId(b.sourceUrl);
	if (spotA && spotB && spotA === spotB) {
		return true;
	}

	if (
		a.source &&
		b.source &&
		a.source === b.source &&
		a.sourceId !== undefined &&
		b.sourceId !== undefined &&
		String(a.sourceId) === String(b.sourceId)
	) {
		return true;
	}

	if (a.sourceUrl && b.sourceUrl && a.sourceUrl === b.sourceUrl) {
		return true;
	}

	if (!a.song || !b.song) return false;

	if (!areSongTitlesDuplicate(a.song, b.song)) {
		return false;
	}

	if (!areArtistsCompatible(a.artist, b.artist)) {
		return false;
	}

	return true;
}

function mergeNotes(notesA?: string, notesB?: string): string {
	const a = (notesA || "").trim();
	const b = (notesB || "").trim();
	if (!a) return b;
	if (!b) return a;
	if (a === b) return a;
	if (a === "Uploaded from Cloud") return b;
	if (b === "Uploaded from Cloud") return a;
	return `${a}\n${b}`;
}

export function mergeChecklistEntries(
	primary: TTMLChecklistEntry,
	secondary: TTMLChecklistEntry,
): TTMLChecklistEntry {
	const isCompleted = Boolean(
		primary.completed ||
			secondary.completed ||
			primary.status === "completed" ||
			secondary.status === "completed",
	);

	let status: "not-started" | "in-progress" | "completed" | undefined;
	if (isCompleted) {
		status = "completed";
	} else if (
		primary.status === "in-progress" ||
		secondary.status === "in-progress" ||
		primary.cloudDocId ||
		secondary.cloudDocId
	) {
		status = "in-progress";
	} else if (primary.status || secondary.status) {
		status = primary.status || secondary.status;
	}

	return {
		id: primary.id,
		song: primary.song || secondary.song,
		artist: primary.artist || secondary.artist,
		album: primary.album || secondary.album,
		coverArt: primary.coverArt || secondary.coverArt,
		source: primary.source || secondary.source,
		sourceId: primary.sourceId ?? secondary.sourceId,
		sourceUrl: primary.sourceUrl || secondary.sourceUrl,
		cloudDocId: primary.cloudDocId || secondary.cloudDocId,
		cloudAudioUrl: primary.cloudAudioUrl || secondary.cloudAudioUrl,
		notes: mergeNotes(primary.notes, secondary.notes),
		completed: isCompleted,
		status,
		...(primary.uploadedToDatabase || secondary.uploadedToDatabase
			? { uploadedToDatabase: true }
			: {}),
		...(primary.favorite || secondary.favorite ? { favorite: true } : {}),
		createdAt: Math.min(
			primary.createdAt || Date.now(),
			secondary.createdAt || Date.now(),
		),
	};
}

export function deduplicateChecklistEntries(
	entries: TTMLChecklistEntry[],
): TTMLChecklistEntry[] {
	const result: TTMLChecklistEntry[] = [];
	const cloudMap = new Map<string, number>();
	const spotifyMap = new Map<string, number>();
	const sourceMap = new Map<string, number>();
	const songKeyMap = new Map<string, number[]>();

	const registerEntry = (entry: TTMLChecklistEntry, index: number) => {
		if (entry.cloudDocId) {
			cloudMap.set(entry.cloudDocId, index);
		}
		const spotId =
			(entry.source === "spotify" && entry.sourceId ? String(entry.sourceId) : null) ||
			extractSpotifyTrackId(entry.sourceUrl);
		if (spotId) {
			spotifyMap.set(spotId, index);
		}
		if (entry.source && entry.sourceId !== undefined) {
			sourceMap.set(`${entry.source}:${entry.sourceId}`, index);
		}
		if (entry.song) {
			const norm = normalizeSongKey(entry.song);
			if (norm) {
				const list = songKeyMap.get(norm);
				if (list) {
					if (!list.includes(index)) list.push(index);
				} else {
					songKeyMap.set(norm, [index]);
				}
			}
			const base = getBaseSongTitle(entry.song);
			if (base && base !== norm) {
				const list = songKeyMap.get(base);
				if (list) {
					if (!list.includes(index)) list.push(index);
				} else {
					songKeyMap.set(base, [index]);
				}
			}
		}
	};

	for (const entry of entries) {
		let existingIndex = -1;

		// 1. Direct cloud document ID match
		if (entry.cloudDocId && cloudMap.has(entry.cloudDocId)) {
			existingIndex = cloudMap.get(entry.cloudDocId)!;
		}

		// 2. Direct Spotify ID match
		if (existingIndex === -1) {
			const spotId =
				(entry.source === "spotify" && entry.sourceId ? String(entry.sourceId) : null) ||
				extractSpotifyTrackId(entry.sourceUrl);
			if (spotId && spotifyMap.has(spotId)) {
				existingIndex = spotifyMap.get(spotId)!;
			}
		}

		// 3. Direct source + sourceId match
		if (existingIndex === -1 && entry.source && entry.sourceId !== undefined) {
			const srcKey = `${entry.source}:${entry.sourceId}`;
			if (sourceMap.has(srcKey)) {
				existingIndex = sourceMap.get(srcKey)!;
			}
		}

		// 4. Candidate lookup based on matching normalized/base song titles
		if (existingIndex === -1 && entry.song) {
			const candidates = new Set<number>();
			const norm = normalizeSongKey(entry.song);
			const base = getBaseSongTitle(entry.song);

			if (norm && songKeyMap.has(norm)) {
				for (const idx of songKeyMap.get(norm)!) {
					candidates.add(idx);
				}
			}
			if (base && songKeyMap.has(base)) {
				for (const idx of songKeyMap.get(base)!) {
					candidates.add(idx);
				}
			}

			for (const idx of candidates) {
				if (areChecklistEntriesDuplicate(result[idx], entry)) {
					existingIndex = idx;
					break;
				}
			}
		}

		// 5. Fallback scan only if entry had no song title (rare legacy edge case)
		if (existingIndex === -1 && !entry.song) {
			for (let i = 0; i < result.length; i++) {
				if (areChecklistEntriesDuplicate(result[i], entry)) {
					existingIndex = i;
					break;
				}
			}
		}

		if (existingIndex >= 0) {
			const merged = mergeChecklistEntries(result[existingIndex], entry);
			result[existingIndex] = merged;
			registerEntry(merged, existingIndex);
		} else {
			const newIdx = result.length;
			result.push(entry);
			registerEntry(entry, newIdx);
		}
	}
	return result;
}

export function normalizeChecklistEntries(
	value: unknown,
): TTMLChecklistEntry[] {
	if (!Array.isArray(value)) return [];

	const raw = value
		.map((item, index): TTMLChecklistEntry | null => {
			if (!isRecord(item) || typeof item.song !== "string") return null;
			const song = item.song.trim();
			if (!song) return null;
			const sourceVal =
				item.source === "genius" ||
				item.source === "lyrically" ||
				item.source === "lrclib" ||
				item.source === "spotify"
					? item.source
					: undefined;
			return {
				id:
					typeof item.id === "string" && item.id ? item.id : `legacy-${index}`,
				song,
				artist: typeof item.artist === "string" ? item.artist.trim() : "",
				album: typeof item.album === "string" ? item.album.trim() : undefined,
				coverArt:
					typeof item.coverArt === "string" ? item.coverArt.trim() : undefined,
				source: sourceVal,
				sourceId:
					typeof item.sourceId === "string" || typeof item.sourceId === "number"
						? item.sourceId
						: undefined,
				sourceUrl:
					typeof item.sourceUrl === "string"
						? item.sourceUrl.trim()
						: undefined,
				cloudDocId:
					typeof item.cloudDocId === "string" && item.cloudDocId.trim()
						? item.cloudDocId.trim()
						: undefined,
				cloudAudioUrl:
					typeof item.cloudAudioUrl === "string" && item.cloudAudioUrl.trim()
						? item.cloudAudioUrl.trim()
						: undefined,
				notes: typeof item.notes === "string" ? item.notes.trim() : "",
				completed: item.completed === true,
				status:
					item.status === "not-started" ||
					item.status === "in-progress" ||
					item.status === "completed"
						? item.status
						: undefined,
				...(item.uploadedToDatabase === true
					? { uploadedToDatabase: true }
					: {}),
				...(item.favorite === true ? { favorite: true } : {}),
				createdAt:
					typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
						? item.createdAt
						: 0,
			};
		})
		.filter((item): item is TTMLChecklistEntry => item !== null);

	const deduplicated = deduplicateChecklistEntries(raw);

	return deduplicated.sort((a, b) => {
		if (a.completed !== b.completed)
			return Number(a.completed) - Number(b.completed);
		return b.createdAt - a.createdAt;
	});
}

export function createChecklistEntry(
	input: TTMLChecklistEntryInput,
	createdAt = Date.now(),
	id = uid(),
): TTMLChecklistEntry {
	return {
		id,
		song: input.song.trim(),
		artist: input.artist?.trim() ?? "",
		album: input.album?.trim() || undefined,
		coverArt: input.coverArt?.trim() || undefined,
		source: input.source,
		sourceId: input.sourceId,
		sourceUrl: input.sourceUrl?.trim() || undefined,
		cloudDocId: input.cloudDocId?.trim() || undefined,
		cloudAudioUrl: input.cloudAudioUrl?.trim() || undefined,
		notes: input.notes?.trim() ?? "",
		completed: input.completed ?? (input.status === "completed"),
		status: input.status,
		...(input.uploadedToDatabase ? { uploadedToDatabase: true } : {}),
		...(input.favorite ? { favorite: true } : {}),
		createdAt,
	};
}

export function toggleChecklistEntryFavorite(
	entries: TTMLChecklistEntry[],
	id: string,
): TTMLChecklistEntry[] {
	return normalizeChecklistEntries(
		entries.map((entry) =>
			entry.id === id
				? { ...entry, favorite: !entry.favorite ? true : undefined }
				: entry,
		),
	);
}

export function toggleChecklistEntryComplete(
	entries: TTMLChecklistEntry[],
	id: string,
): TTMLChecklistEntry[] {
	return normalizeChecklistEntries(
		entries.map((entry) => {
			if (entry.id !== id) return entry;
			const nextCompleted = !entry.completed;
			return {
				...entry,
				completed: nextCompleted,
				status: nextCompleted ? "completed" : undefined,
			};
		}),
	);
}

export function addChecklistEntry(
	entries: TTMLChecklistEntry[],
	input: TTMLChecklistEntryInput,
	createdAt?: number,
	id?: string,
): TTMLChecklistEntry[] {
	const entry = createChecklistEntry(input, createdAt, id);
	if (!entry.song) return entries;
	const existingIndex = entries.findIndex((item) =>
		areChecklistEntriesDuplicate(item, entry),
	);
	if (existingIndex >= 0) {
		const updated = [...entries];
		updated[existingIndex] = mergeChecklistEntries(
			updated[existingIndex],
			entry,
		);
		return normalizeChecklistEntries(updated);
	}
	return normalizeChecklistEntries([...entries, entry]);
}

export function updateChecklistEntry(
	entries: TTMLChecklistEntry[],
	id: string,
	input: TTMLChecklistEntryInput,
): TTMLChecklistEntry[] {
	return normalizeChecklistEntries(
		entries.map((entry) =>
			entry.id === id
				? {
						...entry,
						song: input.song.trim(),
						artist: input.artist?.trim() ?? "",
						album: input.album?.trim() || undefined,
						coverArt: input.coverArt?.trim() || undefined,
						source: input.source ?? entry.source,
						sourceId: input.sourceId ?? entry.sourceId,
						sourceUrl: input.sourceUrl?.trim() || entry.sourceUrl,
						cloudDocId: input.cloudDocId ?? entry.cloudDocId,
						cloudAudioUrl: input.cloudAudioUrl ?? entry.cloudAudioUrl,
						notes: input.notes?.trim() ?? "",
						completed:
							input.completed !== undefined
								? input.completed
								: input.status === "completed"
									? true
									: entry.completed,
						status: input.status !== undefined ? input.status : entry.status,
						uploadedToDatabase:
							input.uploadedToDatabase !== undefined
								? input.uploadedToDatabase
								: entry.uploadedToDatabase,
					}
				: entry,
		),
	);
}

export function linkUploadedTTMLToChecklist(
	entries: TTMLChecklistEntry[],
	uploaded: {
		title: string;
		artist: string;
		album?: string;
		coverArt?: string | null;
		docId: string;
		rawTTML?: string;
		audioUrl?: string | null;
		isCompleted?: boolean;
	},
): { entries: TTMLChecklistEntry[]; added: boolean; updated: boolean } {
	const title = uploaded.title?.trim() || "Untitled";
	const artist = uploaded.artist?.trim() || "";
	const album = uploaded.album?.trim() || undefined;
	const coverArt = uploaded.coverArt?.trim() || undefined;
	const audioUrl = uploaded.audioUrl?.trim() || undefined;
	const docId = uploaded.docId;

	let isCompleted = uploaded.isCompleted ?? false;
	if (!isCompleted && uploaded.rawTTML) {
		try {
			const parsed = parseLyric(uploaded.rawTTML);
			isCompleted = isTTML100PercentCompleted(parsed);
		} catch {
			// ignore parse error
		}
	}

	let found = false;
	const nextEntries = entries.map((entry) => {
		const isMatch =
			(entry.cloudDocId && entry.cloudDocId === docId) ||
			areChecklistEntriesDuplicate(entry, {
				song: title,
				artist,
				cloudDocId: docId,
			});

		if (isMatch) {
			found = true;
			const shouldBeCompleted = isCompleted ? true : entry.completed;
			return {
				...entry,
				cloudDocId: docId,
				cloudAudioUrl: audioUrl || entry.cloudAudioUrl,
				album: album || entry.album,
				coverArt: coverArt || entry.coverArt,
				completed: shouldBeCompleted,
				status: shouldBeCompleted ? "completed" : entry.status,
			};
		}
		return entry;
	});

	if (found) {
		return {
			entries: normalizeChecklistEntries(nextEntries),
			added: false,
			updated: true,
		};
	}

	const newEntry: TTMLChecklistEntry = {
		id: uid(),
		song: title,
		artist,
		album,
		coverArt,
		cloudDocId: docId,
		cloudAudioUrl: audioUrl,
		notes: "Uploaded from Cloud",
		completed: isCompleted,
		status: isCompleted ? "completed" : "in-progress",
		createdAt: Date.now(),
	};

	return {
		entries: normalizeChecklistEntries([...nextEntries, newEntry]),
		added: true,
		updated: false,
	};
}

export interface UploadedTTMLPayload {
	title: string;
	artist: string;
	album?: string;
	coverArt?: string | null;
	docId: string;
	rawTTML?: string;
	audioUrl?: string | null;
	isCompleted?: boolean;
}

export function batchLinkUploadedTTMLsToChecklist(
	entries: TTMLChecklistEntry[],
	uploads: UploadedTTMLPayload[],
): { entries: TTMLChecklistEntry[]; importedCount: number } {
	if (uploads.length === 0) {
		return { entries, importedCount: 0 };
	}

	let currentEntries = [...entries];
	let importedCount = 0;

	for (const uploaded of uploads) {
		const title = uploaded.title?.trim() || "Untitled";
		const artist = uploaded.artist?.trim() || "";
		const album = uploaded.album?.trim() || undefined;
		const coverArt = uploaded.coverArt?.trim() || undefined;
		const audioUrl = uploaded.audioUrl?.trim() || undefined;
		const docId = uploaded.docId;

		let isCompleted = uploaded.isCompleted ?? false;
		if (!isCompleted && uploaded.rawTTML) {
			try {
				const parsed = parseLyric(uploaded.rawTTML);
				isCompleted = isTTML100PercentCompleted(parsed);
			} catch {
				// ignore parse error
			}
		}

		let matchedIndex = -1;
		for (let i = 0; i < currentEntries.length; i++) {
			const entry = currentEntries[i];
			if (
				(entry.cloudDocId && entry.cloudDocId === docId) ||
				areChecklistEntriesDuplicate(entry, {
					song: title,
					artist,
					cloudDocId: docId,
				})
			) {
				matchedIndex = i;
				break;
			}
		}

		if (matchedIndex >= 0) {
			const existing = currentEntries[matchedIndex];
			const shouldBeCompleted = isCompleted ? true : existing.completed;
			currentEntries[matchedIndex] = {
				...existing,
				cloudDocId: docId,
				cloudAudioUrl: audioUrl || existing.cloudAudioUrl,
				album: album || existing.album,
				coverArt: coverArt || existing.coverArt,
				completed: shouldBeCompleted,
				status: shouldBeCompleted ? "completed" : existing.status,
			};
		} else {
			const newEntry: TTMLChecklistEntry = {
				id: uid(),
				song: title,
				artist,
				album,
				coverArt,
				cloudDocId: docId,
				cloudAudioUrl: audioUrl,
				notes: "Uploaded from Cloud",
				completed: isCompleted,
				status: isCompleted ? "completed" : "in-progress",
				createdAt: Date.now(),
			};
			currentEntries.push(newEntry);
			importedCount++;
		}
	}

	return {
		entries: normalizeChecklistEntries(currentEntries),
		importedCount,
	};
}

export function setChecklistEntryCompleted(
	entries: TTMLChecklistEntry[],
	id: string,
	completed: boolean,
): TTMLChecklistEntry[] {
	return normalizeChecklistEntries(
		entries.map((entry) =>
			entry.id === id
				? {
						...entry,
						completed,
						status: completed ? "completed" : undefined,
				  }
				: entry,
		),
	);
}

export function setChecklistEntryUploadedToDb(
	entries: TTMLChecklistEntry[],
	id: string,
	uploadedToDatabase: boolean,
): TTMLChecklistEntry[] {
	return normalizeChecklistEntries(
		entries.map((entry) =>
			entry.id === id
				? {
						...entry,
						uploadedToDatabase: uploadedToDatabase ? true : undefined,
					}
				: entry,
		),
	);
}

export function toggleChecklistEntryUploadedToDb(
	entries: TTMLChecklistEntry[],
	id: string,
): TTMLChecklistEntry[] {
	return normalizeChecklistEntries(
		entries.map((entry) =>
			entry.id === id
				? {
						...entry,
						uploadedToDatabase: !entry.uploadedToDatabase ? true : undefined,
					}
				: entry,
		),
	);
}

export function deleteChecklistEntry(
	entries: TTMLChecklistEntry[],
	id: string,
): TTMLChecklistEntry[] {
	return entries.filter((entry) => entry.id !== id);
}
