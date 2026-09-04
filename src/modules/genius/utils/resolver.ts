/**
 * Genius Link Resolver
 * Resolves Genius album and song links to tracklists and song metadata,
 * bypassing CORS via Tauri desktop bridge or falling back to web fetch / API.
 */

export interface GeniusResolvedSong {
	type: "song";
	id: number;
	title: string;
	artist: string;
	album?: string;
	albumId?: number;
	cover?: string;
	releaseDate?: string;
	url: string;
}

export interface GeniusResolvedAlbumTrack {
	number: number;
	title: string;
	artist: string;
	album?: string;
	cover?: string;
	id: number;
}

export interface GeniusResolvedAlbum {
	type: "album";
	id: number;
	title: string;
	artist: string;
	cover?: string;
	tracks: GeniusResolvedAlbumTrack[];
	url: string;
}

export type GeniusResolvedEntity = GeniusResolvedSong | GeniusResolvedAlbum;

/**
 * Detects if the current environment is running inside Tauri (desktop)
 */
export const checkIsTauri = (): boolean => {
	return (
		typeof window !== "undefined" &&
		(!!(window as unknown as { __TAURI__?: unknown }).__TAURI__ ||
			!!(window as unknown as { __TAURI_INTERNALS__?: unknown })
				.__TAURI_INTERNALS__ ||
			!!(import.meta as any).env?.TAURI_ENV_PLATFORM)
	);
};

/**
 * Checks if a string is a Genius album URL
 */
export const isGeniusAlbumUrl = (text: string): boolean => {
	if (!text || typeof text !== "string") return false;
	const trimmed = text.trim();
	return (
		/https?:\/\/(?:[a-zA-Z0-9-]+\.)?genius\.com\/albums\/([^/?#]+)\/([^/?#]+)/i.test(
			trimmed,
		) ||
		/https?:\/\/(?:[a-zA-Z0-9-]+\.)?genius\.com\/albums\/(\d+)/i.test(trimmed)
	);
};

/**
 * Checks if a string is a Genius song / lyrics URL or URI
 */
export const isGeniusSongUrl = (text: string): boolean => {
	if (!text || typeof text !== "string") return false;
	const trimmed = text.trim();
	// Reject album, artist, tag, and root URLs
	if (
		/https?:\/\/(?:[a-zA-Z0-9-]+\.)?genius\.com\/(albums|artists|tags|about|static)\b/i.test(
			trimmed,
		)
	) {
		return false;
	}
	return (
		/genius:\/\/songs\/(\d+)/i.test(trimmed) ||
		/https?:\/\/(?:[a-zA-Z0-9-]+\.)?genius\.com\/songs\/(\d+)/i.test(trimmed) ||
		/https?:\/\/(?:[a-zA-Z0-9-]+\.)?genius\.com\/([a-zA-Z0-9-]+-lyrics)(?:[/?#]|$)/i.test(
			trimmed,
		)
	);
};

/**
 * Checks if a string is any supported Genius URL
 */
export const isGeniusUrl = (text: string): boolean => {
	return isGeniusAlbumUrl(text) || isGeniusSongUrl(text);
};

/**
 * Parses a Genius URL to extract entity type and identifiers
 */
export const parseGeniusUrl = (
	text: string,
): {
	type: "album" | "song";
	id?: number;
	artistSlug?: string;
	titleSlug?: string;
	songSlug?: string;
	url: string;
} | null => {
	if (!text || typeof text !== "string") return null;
	const trimmed = text.trim();

	// Check album URL
	const albumSlugMatch = trimmed.match(
		/https?:\/\/(?:[a-zA-Z0-9-]+\.)?genius\.com\/albums\/([^/?#]+)\/([^/?#]+)/i,
	);
	if (albumSlugMatch) {
		return {
			type: "album",
			artistSlug: albumSlugMatch[1],
			titleSlug: albumSlugMatch[2],
			url: trimmed,
		};
	}

	const albumIdMatch = trimmed.match(
		/https?:\/\/(?:[a-zA-Z0-9-]+\.)?genius\.com\/albums\/(\d+)/i,
	);
	if (albumIdMatch) {
		return {
			type: "album",
			id: Number.parseInt(albumIdMatch[1], 10),
			url: trimmed,
		};
	}

	// Check song URL / URI
	const songUriMatch = trimmed.match(/genius:\/\/songs\/(\d+)/i);
	if (songUriMatch) {
		return {
			type: "song",
			id: Number.parseInt(songUriMatch[1], 10),
			url: trimmed,
		};
	}

	const songIdMatch = trimmed.match(
		/https?:\/\/(?:[a-zA-Z0-9-]+\.)?genius\.com\/songs\/(\d+)/i,
	);
	if (songIdMatch) {
		return {
			type: "song",
			id: Number.parseInt(songIdMatch[1], 10),
			url: trimmed,
		};
	}

	const songSlugMatch = trimmed.match(
		/https?:\/\/(?:[a-zA-Z0-9-]+\.)?genius\.com\/([a-zA-Z0-9-]+-lyrics)(?:[/?#]|$)/i,
	);
	if (
		songSlugMatch &&
		!/^(albums|artists|tags|about|static)$/i.test(songSlugMatch[1])
	) {
		return {
			type: "song",
			songSlug: songSlugMatch[1],
			url: trimmed,
		};
	}

	return null;
};

/**
 * Safely fetches raw text/HTML from a URL using Tauri native command if available,
 * or browser fetch as a fallback.
 */
export async function fetchSafeText(url: string): Promise<string | null> {
	if (checkIsTauri()) {
		try {
			const { invoke } = await import("@tauri-apps/api/core");
			const res = await invoke<string>("fetch_url", { url });
			if (res) return res;
		} catch (err) {
			console.warn(
				"Tauri fetch_url failed, falling back to browser fetch:",
				err,
			);
		}
	}

	try {
		const res = await fetch(url, {
			headers: {
				Accept:
					"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
			},
		});
		if (res.ok) {
			return await res.text();
		}
	} catch (err) {
		console.warn("Browser fetch failed for", url, err);
	}

	return null;
}

/**
 * Extract Genius page_data JSON from meta tag
 */
export function extractPageData(html: string): any {
	const match =
		html.match(
			/<meta\b[^>]*\bitemprop=["']page_data["'][^>]*\bcontent=["']([\s\S]*?)["'][^>]*>/i,
		) ||
		html.match(
			/<meta\b[^>]*\bcontent=["']([\s\S]*?)["'][^>]*\bitemprop=["']page_data["'][^>]*>/i,
		);

	if (match && match[1]) {
		const raw = match[1];
		const decoded = raw
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&amp;/g, "&");
		try {
			return JSON.parse(decoded);
		} catch (e) {
			console.warn("Failed to parse page_data JSON from meta tag:", e);
		}
	}

	if (typeof DOMParser !== "undefined") {
		try {
			const doc = new DOMParser().parseFromString(html, "text/html");
			const meta = doc.querySelector('meta[itemprop="page_data"]');
			const content = meta?.getAttribute("content");
			if (content) {
				return JSON.parse(content);
			}
		} catch {
			// ignore DOMParser errors
		}
	}

	return null;
}

/**
 * Fallback metadata extraction from HTML <meta> tags
 */
export function extractSongMetaFromHtml(html: string): {
	id?: number;
	title?: string;
	artist?: string;
	cover?: string;
} {
	let id: number | undefined;
	let title: string | undefined;
	let artist: string | undefined;
	let cover: string | undefined;

	// Extract song ID from twitter or app url: e.g. genius://songs/5049949
	const idMatch =
		html.match(/genius:\/\/songs\/(\d+)/i) ||
		html.match(
			/<meta\b[^>]*\bproperty=["']twitter:app:url:iphone["'][^>]*\bcontent=["']genius:\/\/songs\/(\d+)["']/i,
		) ||
		html.match(
			/<meta\b[^>]*\bcontent=["']genius:\/\/songs\/(\d+)["'][^>]*\bproperty=["']twitter:app:url:iphone["']/i,
		);
	if (idMatch) {
		id = Number.parseInt(idMatch[1], 10);
	}

	// Extract og:image
	const imgMatch =
		html.match(
			/<meta\b[^>]*\bproperty=["']og:image["'][^>]*\bcontent=["']([^"']+)["']/i,
		) ||
		html.match(
			/<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\bproperty=["']og:image["']/i,
		);
	if (imgMatch) {
		cover = imgMatch[1];
	}

	// Extract og:title e.g. "The Weeknd&nbsp;– Blinding Lights" or "The Weeknd – Blinding Lights"
	const titleMatch =
		html.match(
			/<meta\b[^>]*\bproperty=["']og:title["'][^>]*\bcontent=["']([^"']+)["']/i,
		) ||
		html.match(
			/<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\bproperty=["']og:title["']/i,
		) ||
		html.match(/<title>([^<]+)<\/title>/i);

	if (titleMatch) {
		let raw = titleMatch[1]
			.replace(/&nbsp;|\u00a0/g, " ")
			.replace(/&amp;/g, "&")
			.trim();

		// Remove common suffixes like "Lyrics | Genius Lyrics" or "Lyrics"
		raw = raw.replace(/\s+Lyrics\s*\|\s*Genius\s*Lyrics.*$/i, "");
		raw = raw.replace(/\s+Lyrics$/i, "");

		// Split on dash or en-dash/em-dash
		const parts = raw.split(/\s*[\u2013\u2014-]\s*/);
		if (parts.length >= 2) {
			artist = parts[0].trim();
			title = parts.slice(1).join(" - ").trim();
		} else {
			title = raw.trim();
		}
	}

	return { id, title, artist, cover };
}

export const GeniusResolver = {
	checkIsTauri,
	isGeniusAlbumUrl,
	isGeniusSongUrl,
	isGeniusUrl,
	parseGeniusUrl,

	/**
	 * Resolves a Genius album link to a structured album object with its full tracklist.
	 */
	async resolveAlbum(
		urlOrQuery: string,
		apiKey?: string,
	): Promise<GeniusResolvedAlbum | null> {
		const parsed = parseGeniusUrl(urlOrQuery);
		if (!parsed || parsed.type !== "album") {
			// If not matching album URL regex, return null
			return null;
		}

		const targetUrl = parsed.url;
		const html = await fetchSafeText(targetUrl);

		if (html) {
			const pageData = extractPageData(html);
			if (pageData?.album) {
				const album = pageData.album;
				const albumAppearances = pageData.album_appearances || [];

				const tracks: GeniusResolvedAlbumTrack[] = albumAppearances
					.map((item: any, idx: number) => {
						const song = item.song || {};
						return {
							number: item.track_number || idx + 1,
							title: song.title || song.title_with_featured || "Unknown",
							artist:
								song.primary_artist?.name ||
								song.artist_names ||
								album.artist?.name ||
								album.primary_artist_names ||
								"Unknown",
							album: album.name || album.title,
							cover:
								song.song_art_image_url ||
								song.song_art_image_thumbnail_url ||
								album.cover_art_url ||
								album.cover_art_thumbnail_url,
							id: song.id,
						};
					})
					.filter((t: GeniusResolvedAlbumTrack) => t.id);

				return {
					type: "album",
					id: album.id,
					title: album.name || album.title,
					artist: album.artist?.name || album.primary_artist_names || "Unknown",
					cover: album.cover_art_url || album.cover_art_thumbnail_url,
					tracks,
					url: targetUrl,
				};
			}
		}

		// Fallback: If we have an album ID and an API key, fetch via GeniusApi
		if (parsed.id && apiKey) {
			try {
				const { GeniusApi } = await import("../api/client");
				const rawTracks = await GeniusApi.getAlbumTracks(parsed.id, apiKey);
				if (rawTracks.length > 0) {
					const first = rawTracks[0];
					const albumName = first.song.album?.name || "Album";
					const tracks: GeniusResolvedAlbumTrack[] = rawTracks.map(
						(item, idx) => ({
							number: item.number || idx + 1,
							title: item.song.title || item.song.title_with_featured,
							artist:
								item.song.primary_artist?.name ||
								item.song.artist_names ||
								"Unknown",
							album: albumName,
							cover:
								item.song.song_art_image_url ||
								item.song.song_art_image_thumbnail_url,
							id: item.song.id,
						}),
					);

					return {
						type: "album",
						id: parsed.id,
						title: albumName,
						artist: tracks[0]?.artist || "Unknown",
						cover: tracks[0]?.cover,
						tracks,
						url: targetUrl,
					};
				}
			} catch (err) {
				console.warn("Failed to fetch album tracks via API fallback:", err);
			}
		}

		return null;
	},

	/**
	 * Resolves a Genius song link or ID to a structured song object.
	 */
	async resolveSong(
		urlOrQuery: string,
		apiKey?: string,
	): Promise<GeniusResolvedSong | null> {
		const parsed = parseGeniusUrl(urlOrQuery);
		if (!parsed || parsed.type !== "song") {
			return null;
		}

		let songId = parsed.id;
		const targetUrl = parsed.url;
		let html: string | null = null;

		if (targetUrl.startsWith("http")) {
			html = await fetchSafeText(targetUrl);
		}

		if (html) {
			const pageData = extractPageData(html);
			if (pageData?.song) {
				const song = pageData.song;
				return {
					type: "song",
					id: song.id,
					title: song.title || song.title_with_featured,
					artist: song.primary_artist?.name || song.artist_names || "Unknown",
					album: song.album?.name,
					albumId: song.album?.id,
					cover: song.song_art_image_url || song.header_image_url,
					releaseDate: song.release_date,
					url: song.url || targetUrl,
				};
			}

			// Parse HTML tags fallback
			const meta = extractSongMetaFromHtml(html);
			if (!songId && meta.id) {
				songId = meta.id;
			}

			if (songId && meta.title && meta.artist) {
				return {
					type: "song",
					id: songId,
					title: meta.title,
					artist: meta.artist,
					cover: meta.cover,
					url: targetUrl,
				};
			}
		}

		// Fallback: If we have a song ID and an API key
		if (songId && apiKey) {
			try {
				const { GeniusApi } = await import("../api/client");
				const songRes = await GeniusApi.getSongById(songId, apiKey);
				const song = songRes.response.song;
				if (song) {
					return {
						type: "song",
						id: song.id,
						title: song.title || song.title_with_featured,
						artist: song.primary_artist?.name || song.artist_names || "Unknown",
						album: song.album?.name,
						albumId: song.album?.id,
						cover: song.song_art_image_url || song.header_image_url,
						releaseDate: song.release_date,
						url: song.url || targetUrl,
					};
				}
			} catch (err) {
				console.warn("Failed to fetch song by ID via API fallback:", err);
			}
		}

		return null;
	},
};
