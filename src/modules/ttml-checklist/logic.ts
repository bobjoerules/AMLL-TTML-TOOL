import { uid } from "uid";
import { readTTMLText } from "$/modules/project/logic/ttml-parser";

export interface TTMLChecklistEntry {
	id: string;
	song: string;
	artist: string;
	album?: string;
	coverArt?: string;
	source?: "genius" | "lyrically" | "lrclib";
	sourceId?: string | number;
	sourceUrl?: string;
	cloudDocId?: string;
	cloudAudioUrl?: string;
	notes: string;
	completed: boolean;
	createdAt: number;
}

export type TTMLChecklistEntryInput = {
	song: string;
	artist?: string;
	album?: string;
	coverArt?: string;
	source?: "genius" | "lyrically" | "lrclib";
	sourceId?: string | number;
	sourceUrl?: string;
	cloudDocId?: string;
	cloudAudioUrl?: string;
	notes?: string;
};

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
		const text =
			l.words
				?.map((w: any) => w.word)
				.join("")
				.trim() || "";
		return text.length > 0;
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
				return validWords.every(
					(w: any) =>
						typeof w.endTime === "number" &&
						typeof w.startTime === "number" &&
						w.endTime >= w.startTime &&
						w.endTime > 0,
				);
			}
		}
		return true;
	});
}

export function normalizeChecklistEntries(
	value: unknown,
): TTMLChecklistEntry[] {
	if (!Array.isArray(value)) return [];

	return value
		.map((item, index): TTMLChecklistEntry | null => {
			if (!isRecord(item) || typeof item.song !== "string") return null;
			const song = item.song.trim();
			if (!song) return null;
			const sourceVal =
				item.source === "genius" ||
				item.source === "lyrically" ||
				item.source === "lrclib"
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
				createdAt:
					typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
						? item.createdAt
						: 0,
			};
		})
		.filter((item): item is TTMLChecklistEntry => item !== null)
		.sort((a, b) => {
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
		completed: false,
		createdAt,
	};
}

export function addChecklistEntry(
	entries: TTMLChecklistEntry[],
	input: TTMLChecklistEntryInput,
	createdAt?: number,
	id?: string,
): TTMLChecklistEntry[] {
	const entry = createChecklistEntry(input, createdAt, id);
	if (!entry.song) return entries;
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
			const parsed = readTTMLText(uploaded.rawTTML);
			isCompleted = isTTML100PercentCompleted(parsed);
		} catch {
			// ignore parse error
		}
	}

	const norm = (s: string) =>
		s
			.toLowerCase()
			.replace(/[\s\-_.,/\\'"]/g, "")
			.trim();
	const normTitle = norm(title);
	const normArtist = norm(artist);

	let found = false;
	const nextEntries = entries.map((entry) => {
		const entryNormTitle = norm(entry.song);
		const entryNormArtist = norm(entry.artist);

		const isMatch =
			(entry.cloudDocId && entry.cloudDocId === docId) ||
			(entryNormTitle === normTitle &&
				(!normArtist || !entryNormArtist || entryNormArtist === normArtist));

		if (isMatch) {
			found = true;
			return {
				...entry,
				cloudDocId: docId,
				cloudAudioUrl: audioUrl || entry.cloudAudioUrl,
				album: album || entry.album,
				coverArt: coverArt || entry.coverArt,
				completed: isCompleted ? true : entry.completed,
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
		createdAt: Date.now(),
	};

	return {
		entries: normalizeChecklistEntries([...nextEntries, newEntry]),
		added: true,
		updated: false,
	};
}

export function setChecklistEntryCompleted(
	entries: TTMLChecklistEntry[],
	id: string,
	completed: boolean,
): TTMLChecklistEntry[] {
	return normalizeChecklistEntries(
		entries.map((entry) => (entry.id === id ? { ...entry, completed } : entry)),
	);
}

export function deleteChecklistEntry(
	entries: TTMLChecklistEntry[],
	id: string,
): TTMLChecklistEntry[] {
	return entries.filter((entry) => entry.id !== id);
}
