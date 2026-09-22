import {
	areArtistsCompatible,
	areSongTitlesDuplicate,
	extractArtistTokens,
	normalizeSongKey,
} from "$/modules/ttml-checklist/logic";
import type { CloudTTMLMetadata } from "./types";

export interface SongGroup {
	key: string;
	title: string;
	artist: string;
	album: string;
	coverArt?: string | null;
	latestUpdated: number;
	versions: CloudTTMLMetadata[];
	isPublic: boolean;
	isCompleted: boolean;
	durationMs: number;
	maxLines: number;
}

const GENERIC_TITLES = new Set([
	"untitled",
	"track",
	"audio",
	"voice",
	"demo",
	"song",
	"intro",
	"outro",
	"interlude",
	"instrumental",
	"newsong",
	"test",
]);

/**
 * Checks whether two artist strings represent compatible or collaborating artists
 * for the same song (e.g. "Noah Cyrus, Lil Xan" and "Noah Cyrus").
 */
export function areCloudArtistsCompatible(
	artistA?: string,
	artistB?: string,
): boolean {
	const a = (artistA || "").trim();
	const b = (artistB || "").trim();

	if (!a && !b) return true;
	if (!a || !b) return false;

	const normA = normalizeSongKey(a);
	const normB = normalizeSongKey(b);
	if (normA && normB && normA === normB) return true;

	const stripTheA = normA.replace(/^the/, "");
	const stripTheB = normB.replace(/^the/, "");
	if (stripTheA && stripTheB && stripTheA === stripTheB) return true;

	// Substring check for compound names (e.g. "noahcyrus" inside "noahcyruslilxan")
	if (
		(normA.length >= 4 && normB.includes(normA)) ||
		(normB.length >= 4 && normA.includes(normB)) ||
		(stripTheA.length >= 4 && stripTheB.includes(stripTheA)) ||
		(stripTheB.length >= 4 && stripTheA.includes(stripTheB))
	) {
		return true;
	}

	const tokensA = extractArtistTokens(a);
	const tokensB = extractArtistTokens(b);

	// 1. Primary artist matches
	if (
		tokensA.primary &&
		tokensB.primary &&
		(tokensA.primary === tokensB.primary ||
			tokensA.primary.replace(/^the/, "") ===
				tokensB.primary.replace(/^the/, ""))
	) {
		return true;
	}

	// 2. Primary artist of one appears among the collaborator tokens of the other
	// (e.g. "Lil Xan & Noah Cyrus" vs "Noah Cyrus")
	if (
		tokensA.primary &&
		tokensB.all.some(
			(t) =>
				t === tokensA.primary ||
				t.replace(/^the/, "") === tokensA.primary.replace(/^the/, ""),
		)
	) {
		return true;
	}
	if (
		tokensB.primary &&
		tokensA.all.some(
			(t) =>
				t === tokensB.primary ||
				t.replace(/^the/, "") === tokensB.primary.replace(/^the/, ""),
		)
	) {
		return true;
	}

	// Fallback to ttml-checklist areArtistsCompatible
	return areArtistsCompatible(a, b);
}

/**
 * Determines whether two cloud TTML metadata items are versions of the same song.
 */
export function areCloudTTMLsSameSong(
	a: CloudTTMLMetadata,
	b: CloudTTMLMetadata,
): boolean {
	if (a.id && b.id && a.id === b.id) return true;

	// 1. Matching audio reference
	if (
		a.audioStoragePath &&
		b.audioStoragePath &&
		a.audioStoragePath === b.audioStoragePath
	) {
		return true;
	}
	if (a.audioUrl && b.audioUrl && a.audioUrl === b.audioUrl) {
		return true;
	}
	if (
		a.audioFileName &&
		b.audioFileName &&
		a.audioFileName === b.audioFileName &&
		a.audioSize &&
		b.audioSize &&
		a.audioSize === b.audioSize
	) {
		return true;
	}

	const titleA = a.title || "Untitled";
	const titleB = b.title || "Untitled";

	// 2. Check title match
	if (!areSongTitlesDuplicate(titleA, titleB)) {
		return false;
	}

	// 3. Artist check
	const artistA = (a.artist || "").trim();
	const artistB = (b.artist || "").trim();

	if (artistA && artistB) {
		return areCloudArtistsCompatible(artistA, artistB);
	}

	// If one or both artists are missing:
	// If album is non-empty and matches, consider same song
	const albumA = (a.album || "").trim();
	const albumB = (b.album || "").trim();
	if (
		albumA &&
		albumB &&
		normalizeSongKey(albumA) === normalizeSongKey(albumB)
	) {
		return true;
	}

	// Check generic titles
	const normTitle = normalizeSongKey(titleA);
	if (GENERIC_TITLES.has(normTitle) || normTitle.length < 3) {
		return false;
	}

	// Non-generic title (e.g. "Live or Die") in user's library:
	// If both have durations, verify they are within reasonable proximity
	if (a.durationMs > 0 && b.durationMs > 0) {
		const diff = Math.abs(a.durationMs - b.durationMs);
		if (diff > 15000) return false;
	}

	return true;
}

/**
 * Groups cloud TTML metadata items by song, consolidating versions under single SongGroup objects.
 */
export function groupCloudTTMLs(cloudList: CloudTTMLMetadata[]): SongGroup[] {
	if (!cloudList || cloudList.length === 0) return [];

	const n = cloudList.length;
	const parent = new Array<number>(n);
	for (let i = 0; i < n; i++) parent[i] = i;

	function find(i: number): number {
		let root = i;
		while (root !== parent[root]) {
			root = parent[root];
		}
		let curr = i;
		while (curr !== root) {
			const next = parent[curr];
			parent[curr] = root;
			curr = next;
		}
		return root;
	}

	function union(i: number, j: number) {
		const rootI = find(i);
		const rootJ = find(j);
		if (rootI !== rootJ) {
			parent[rootI] = rootJ;
		}
	}

	// Compare pairs to merge versions of the same song
	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			if (areCloudTTMLsSameSong(cloudList[i], cloudList[j])) {
				union(i, j);
			}
		}
	}

	// Group items by root
	const groupMap = new Map<number, CloudTTMLMetadata[]>();
	for (let i = 0; i < n; i++) {
		const root = find(i);
		const list = groupMap.get(root);
		if (list) {
			list.push(cloudList[i]);
		} else {
			groupMap.set(root, [cloudList[i]]);
		}
	}

	const groups: SongGroup[] = [];
	for (const versions of groupMap.values()) {
		// Sort latest first
		versions.sort(
			(a, b) =>
				(b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0),
		);
		const latest = versions[0];
		const isPublic = versions.some((v) => v.publishedToCommunity);
		const isCompleted = versions.some((v) => v.finished || v.publishedToCommunity);
		const coverArt =
			versions.find((v) => v.coverArt)?.coverArt || latest.coverArt;
		const maxLines = Math.max(...versions.map((v) => v.lineCount || 0));

		const artist =
			latest.artist || versions.find((v) => v.artist)?.artist || "";
		const album = latest.album || versions.find((v) => v.album)?.album || "";

		const key = `${normalizeSongKey(latest.title)}:::${extractArtistTokens(artist).primary || "unknown"}:::${latest.id}`;

		groups.push({
			key,
			title: latest.title || "Untitled",
			artist,
			album,
			coverArt,
			latestUpdated: latest.updatedAt || latest.createdAt || 0,
			versions,
			isPublic,
			isCompleted,
			durationMs:
				latest.durationMs ||
				versions.find((v) => v.durationMs)?.durationMs ||
				0,
			maxLines,
		});
	}

	// Sort groups by latest updated descending
	groups.sort((a, b) => b.latestUpdated - a.latestUpdated);

	return groups;
}
