import { isSpotifyUrl, parseSpotifyUrl } from "$/modules/spotify/client";

export interface AppleTtmlSong {
	id: string;
	name: string;
	artist: string;
	album: string;
	artwork?: string;
	duration?: number;
	isrc?: string;
	releaseDate?: string;
	hasLyrics?: boolean;
	hasTimeSyncedLyrics?: boolean;
	hasDuetLyrics?: boolean;
	ttml?: string | null;
	ttmlTiming?: "Word" | "Line" | string;
	syncedLyrics?: string | null;
	lyrics?: string | null;
	lineLyrics?: string | null;
	errors?: Array<{
		id?: string;
		title?: string;
		detail?: string;
		status?: string;
		code?: string;
	}>;
}

export interface AppleTtmlSearchResult {
	id: string;
	name: string;
	artist: string;
	artistNames?: string;
	album: string;
	artwork?: string;
	duration?: number;
	url?: string;
}

export function extractSpotifyTrackId(input: string): string {
	if (!input || typeof input !== "string") return "";
	const trimmed = input.trim();

	// Match Spotify Track URL or URI
	if (isSpotifyUrl(trimmed)) {
		const parsed = parseSpotifyUrl(trimmed);
		if (parsed && parsed.type === "track") {
			return parsed.id;
		}
	}

	// Regex check for Spotify track url/uri if not caught by parseSpotifyUrl
	const urlMatch = trimmed.match(
		/(?:https?:\/\/)?open\.spotify\.com\/track\/([a-zA-Z0-9]+)/i,
	);
	if (urlMatch) {
		return urlMatch[1];
	}

	const uriMatch = trimmed.match(/spotify:track:([a-zA-Z0-9]+)/i);
	if (uriMatch) {
		return uriMatch[1];
	}

	const trackPrefixMatch = trimmed.match(/^track\/([a-zA-Z0-9]+)/i);
	if (trackPrefixMatch) {
		return trackPrefixMatch[1];
	}

	// Remove quotes, query params, hashes, trailing slashes if user pasted something raw
	const clean = trimmed
		.replace(/^["']|["']$/g, "")
		.split("?")[0]
		.split("#")[0]
		.replace(/\/+$/, "")
		.trim();

	// Check if clean string is an alphanumeric ID
	if (/^[a-zA-Z0-9]+$/.test(clean)) {
		return clean;
	}

	return "";
}

/**
 * Checks whether an input string looks like a Spotify track ID or Spotify track URL/URI.
 */
export function isSpotifyTrackId(input: string): boolean {
	if (!input || typeof input !== "string") return false;
	const id = extractSpotifyTrackId(input);
	// Spotify IDs are Base62 strings between 18 and 25 characters (typically 22)
	return /^[a-zA-Z0-9]{18,25}$/.test(id);
}

const BASE_URL = "https://lyrics.rmmreviv.al";

async function fetchAppleJson<T>(endpoint: string): Promise<T> {
	const url = `${BASE_URL}${endpoint}`;
	const isTauri =
		typeof window !== "undefined" &&
		(!!(window as unknown as { __TAURI__?: unknown }).__TAURI__ ||
			!!(window as unknown as { __TAURI_INTERNALS__?: unknown })
				.__TAURI_INTERNALS__ ||
			!!import.meta.env.TAURI_ENV_PLATFORM);

	if (isTauri) {
		try {
			const { invoke } = await import("@tauri-apps/api/core");
			const raw = await invoke<string>("fetch_apple_ttml", { url });
			return JSON.parse(raw) as T;
		} catch (tauriErr) {
			const msg = (tauriErr as Error)?.message || String(tauriErr || "");
			if (msg.includes("Track or lyrics not found")) {
				throw new Error("Track or lyrics not found for this Spotify ID.");
			}
			console.warn(
				"Tauri fetch_apple_ttml failed, falling back to fetch:",
				tauriErr,
			);
		}
	}

	// Browser / Web fallback
	try {
		const res = await fetch(url);
		if (!res.ok) {
			if (res.status === 404) {
				throw new Error("Track or lyrics not found for this Spotify ID.");
			}
			throw new Error(
				`Failed to fetch lyrics (${res.status} ${res.statusText})`,
			);
		}
		return (await res.json()) as T;
	} catch (webErr) {
		// Attempt CORS proxy in web mode if direct fetch failed
		const encoded = encodeURIComponent(url);
		const corsProxies = [
			`https://proxy.bobjoerules.com/?url=${encoded}`,
			`https://corsproxy.io/?url=${encoded}`,
			`https://api.allorigins.win/raw?url=${encoded}`,
		];

		for (const proxyUrl of corsProxies) {
			try {
				const proxyRes = await fetch(proxyUrl);
				if (proxyRes.ok) {
					return (await proxyRes.json()) as T;
				}
			} catch {
				// try next proxy
			}
		}

		throw webErr;
	}
}

export const AppleTtmlApi = {
	/**
	 * Extracts Spotify track ID from input (URL, URI, or ID) and fetches Apple Music lyrics/TTML.
	 */
	async getLyrics(idOrUrl: string): Promise<AppleTtmlSong> {
		const trackId = extractSpotifyTrackId(idOrUrl);
		if (!trackId) {
			throw new Error("Invalid Spotify Track ID or URL.");
		}

		const data = await fetchAppleJson<AppleTtmlSong>(
			`/lyrics?id=${encodeURIComponent(trackId)}`,
		);

		if (data.errors && data.errors.length > 0) {
			const detail =
				data.errors[0].detail || data.errors[0].title || "Unknown error";
			throw new Error(`Error fetching lyrics: ${detail}`);
		}

		if (!data || (!data.name && !data.artist)) {
			throw new Error("No song found for this Spotify ID.");
		}

		return data;
	},

	/**
	 * Searches Spotify tracks to find track IDs for Apple Music TTML retrieval.
	 */
	async search(query: string): Promise<AppleTtmlSearchResult[]> {
		const trimmed = query.trim();
		if (!trimmed) return [];

		const data = await fetchAppleJson<{ results?: AppleTtmlSearchResult[] }>(
			`/search?q=${encodeURIComponent(trimmed)}`,
		);

		return Array.isArray(data.results) ? data.results : [];
	},
};
