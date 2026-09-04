/**
 * Spotify & Universal Music Link Resolver
 * Resolves Spotify track and album links to metadata without requiring user API credentials.
 */

export interface ResolvedTrack {
	type: "track";
	id: string;
	title: string;
	artist: string;
	album?: string;
	cover?: string;
	releaseDate?: string;
}

export interface ResolvedAlbumTrack {
	number: number;
	title: string;
	artist: string;
	album?: string;
	cover?: string;
}

export interface ResolvedAlbum {
	type: "album";
	id: string;
	title: string;
	artist: string;
	cover?: string;
	tracks: ResolvedAlbumTrack[];
}

export type ResolvedMusicEntity = ResolvedTrack | ResolvedAlbum;

/**
 * Checks if a string is a Spotify URL or URI
 */
export const isSpotifyUrl = (text: string): boolean => {
	if (!text || typeof text !== "string") return false;
	const trimmed = text.trim();
	return (
		/https?:\/\/open\.spotify\.com\/(track|album)\/([a-zA-Z0-9]+)/i.test(
			trimmed,
		) || /spotify:(track|album):([a-zA-Z0-9]+)/i.test(trimmed)
	);
};

/**
 * Parses Spotify track or album ID from URL or URI
 */
export const parseSpotifyUrl = (
	url: string,
): { type: "track" | "album"; id: string } | null => {
	if (!url || typeof url !== "string") return null;
	const trimmed = url.trim();

	const urlMatch = trimmed.match(
		/https?:\/\/open\.spotify\.com\/(track|album)\/([a-zA-Z0-9]+)/i,
	);
	if (urlMatch) {
		return {
			type: urlMatch[1].toLowerCase() as "track" | "album",
			id: urlMatch[2],
		};
	}

	const uriMatch = trimmed.match(/spotify:(track|album):([a-zA-Z0-9]+)/i);
	if (uriMatch) {
		return {
			type: uriMatch[1].toLowerCase() as "track" | "album",
			id: uriMatch[2],
		};
	}

	return null;
};

/**
 * Extract Next.js page state from Spotify Embed HTML
 */
const extractSpotifyEmbedData = (html: string): any => {
	const scriptMatch = html.match(
		/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
	);
	if (scriptMatch && scriptMatch[1]) {
		try {
			return JSON.parse(scriptMatch[1]);
		} catch (e) {
			console.warn("Failed to parse __NEXT_DATA__ from Spotify embed", e);
		}
	}

	// Fallback regex for state data
	const propsMatch = html.match(/\{"props":[\s\S]*?"pageProps":[\s\S]*?\}/);
	if (propsMatch) {
		try {
			return JSON.parse(propsMatch[0]);
		} catch (e) {
			console.warn("Failed to parse props match from Spotify embed", e);
		}
	}

	return null;
};

/**
 * Fetch Spotify Embed HTML (works natively in desktop/Tauri, or via proxy if available)
 */
async function fetchSpotifyEmbedHtml(
	type: "track" | "album",
	id: string,
): Promise<string | null> {
	try {
		const res = await fetch(`https://open.spotify.com/embed/${type}/${id}`, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
			},
		});
		if (res.ok) {
			return await res.text();
		}
	} catch (e) {
		// Browser CORS may reject direct embed fetch in web mode
		console.warn(`Direct embed fetch for Spotify ${type} blocked or failed:`, e);
	}
	return null;
}

/**
 * Fetch Spotify oEmbed (Public and CORS-enabled: access-control-allow-origin: *)
 */
async function fetchSpotifyOEmbed(spotifyUrl: string): Promise<{
	title: string;
	thumbnail_url?: string;
	html?: string;
} | null> {
	try {
		const res = await fetch(
			`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`,
		);
		if (res.ok) {
			return await res.json();
		}
	} catch (e) {
		console.warn("Spotify oEmbed request failed:", e);
	}
	return null;
}

/**
 * Query iTunes Search API to get rich artist and album metadata
 */
async function searchItunesMetadata(
	query: string,
	entity: "song" | "album" = "song",
): Promise<any | null> {
	try {
		const res = await fetch(
			`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=${entity}&limit=5`,
		);
		if (res.ok) {
			const data = await res.json();
			if (data.results && data.results.length > 0) {
				return data.results[0];
			}
		}
	} catch (e) {
		console.warn("iTunes search metadata failed:", e);
	}
	return null;
}

/**
 * Query iTunes album tracks
 */
async function lookupItunesAlbumTracks(collectionId: number): Promise<{
	album: string;
	artist: string;
	cover: string;
	tracks: ResolvedAlbumTrack[];
} | null> {
	try {
		const res = await fetch(
			`https://itunes.apple.com/lookup?id=${collectionId}&entity=song`,
		);
		if (res.ok) {
			const data = await res.json();
			const results: any[] = data.results || [];
			if (results.length > 0) {
				const albumItem =
					results.find((r) => r.wrapperType === "collection") || results[0];
				const trackItems = results.filter((r) => r.wrapperType === "track");

				return {
					album: albumItem.collectionName || albumItem.collectionCensoredName,
					artist: albumItem.artistName,
					cover: (
						albumItem.artworkUrl100 || albumItem.artworkUrl60 || ""
					).replace(/100x100bb\.jpg/i, "600x600bb.jpg"),
					tracks: trackItems.map((track, idx) => ({
						number: track.trackNumber || idx + 1,
						title: track.trackName || track.trackCensoredName,
						artist: track.artistName,
						album: track.collectionName,
						cover: (
							track.artworkUrl100 ||
							albumItem.artworkUrl100 ||
							""
						).replace(/100x100bb\.jpg/i, "600x600bb.jpg"),
					})),
				};
			}
		}
	} catch (e) {
		console.warn("iTunes album lookup failed:", e);
	}
	return null;
}

export const SpotifyResolver = {
	isSpotifyUrl,
	parseSpotifyUrl,

	/**
	 * Resolves a Spotify track URL into song title, artist, album, and artwork
	 */
	async resolveTrack(url: string): Promise<ResolvedTrack | null> {
		const parsed = parseSpotifyUrl(url);
		if (!parsed || parsed.type !== "track") return null;
		const trackId = parsed.id;

		// 1. Try direct Spotify embed fetch (works on desktop / Tauri)
		const html = await fetchSpotifyEmbedHtml("track", trackId);
		if (html) {
			const data = extractSpotifyEmbedData(html);
			const entity = data?.props?.pageProps?.state?.data?.entity;
			if (entity) {
				const title = entity.title || entity.name;
				const artist =
					entity.artists?.map((a: any) => a.name).join(", ") ||
					entity.subtitle ||
					"";
				const cover =
					entity.visual?.url ||
					entity.coverArt?.sources?.[0]?.url ||
					entity.images?.[0]?.url;

				if (title) {
					return {
						type: "track",
						id: trackId,
						title,
						artist,
						album: entity.album?.name,
						cover,
						releaseDate: entity.releaseDate?.isoString,
					};
				}
			}
		}

		// 2. Fallback: Spotify oEmbed + iTunes Search
		const oembed = await fetchSpotifyOEmbed(
			`https://open.spotify.com/track/${trackId}`,
		);
		if (oembed?.title) {
			// Query iTunes to discover accurate artist name
			const itunesMatch = await searchItunesMetadata(oembed.title, "song");
			const artist = itunesMatch?.artistName || "";
			const cover =
				itunesMatch?.artworkUrl100?.replace(
					/100x100bb\.jpg/i,
					"600x600bb.jpg",
				) || oembed.thumbnail_url;

			return {
				type: "track",
				id: trackId,
				title: itunesMatch?.trackName || oembed.title,
				artist: artist || "Unknown Artist",
				album: itunesMatch?.collectionName,
				cover,
			};
		}

		return null;
	},

	/**
	 * Resolves a Spotify album URL into album title, artist, and full tracklist
	 */
	async resolveAlbum(url: string): Promise<ResolvedAlbum | null> {
		const parsed = parseSpotifyUrl(url);
		if (!parsed || parsed.type !== "album") return null;
		const albumId = parsed.id;

		// 1. Try direct Spotify embed fetch
		const html = await fetchSpotifyEmbedHtml("album", albumId);
		if (html) {
			const data = extractSpotifyEmbedData(html);
			const entity = data?.props?.pageProps?.state?.data?.entity;
			if (entity) {
				const title = entity.title || entity.name;
				const artist =
					entity.subtitle ||
					entity.artists?.map((a: any) => a.name).join(", ") ||
					"Various Artists";
				const cover =
					entity.visual?.url ||
					entity.coverArt?.sources?.[0]?.url ||
					entity.images?.[0]?.url;

				const rawTrackList: any[] = entity.trackList || [];
				const tracks: ResolvedAlbumTrack[] = rawTrackList.map((t, idx) => ({
					number: idx + 1,
					title: t.title || t.name,
					artist: t.subtitle || artist,
					album: title,
					cover,
				}));

				if (title && tracks.length > 0) {
					return {
						type: "album",
						id: albumId,
						title,
						artist,
						cover,
						tracks,
					};
				}
			}
		}

		// 2. Fallback: Spotify oEmbed + iTunes Album Lookup
		const oembed = await fetchSpotifyOEmbed(
			`https://open.spotify.com/album/${albumId}`,
		);
		if (oembed?.title) {
			const itunesAlbum = await searchItunesMetadata(oembed.title, "album");
			if (itunesAlbum?.collectionId) {
				const fullAlbum = await lookupItunesAlbumTracks(
					itunesAlbum.collectionId,
				);
				if (fullAlbum && fullAlbum.tracks.length > 0) {
					return {
						type: "album",
						id: albumId,
						title: fullAlbum.album || oembed.title,
						artist: fullAlbum.artist || "Unknown Artist",
						cover: fullAlbum.cover || oembed.thumbnail_url,
						tracks: fullAlbum.tracks,
					};
				}
			}

			// If iTunes didn't have tracklist, at least return a single entry or empty tracks
			return {
				type: "album",
				id: albumId,
				title: oembed.title,
				artist: "Unknown Artist",
				cover: oembed.thumbnail_url,
				tracks: [],
			};
		}

		return null;
	},

	/**
	 * General resolver for any Spotify link (track or album)
	 */
	async resolve(url: string): Promise<ResolvedMusicEntity | null> {
		const parsed = parseSpotifyUrl(url);
		if (!parsed) return null;
		if (parsed.type === "track") {
			return this.resolveTrack(url);
		}
		return this.resolveAlbum(url);
	},
};
