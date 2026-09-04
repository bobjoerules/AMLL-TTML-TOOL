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
 * Detects if the current environment is running inside Tauri (desktop)
 */
export const checkIsTauri = (): boolean => {
	return (
		typeof window !== "undefined" &&
		(!!(window as unknown as { __TAURI__?: unknown }).__TAURI__ ||
			!!(window as unknown as { __TAURI_INTERNALS__?: unknown })
				.__TAURI_INTERNALS__ ||
			!!import.meta.env.TAURI_ENV_PLATFORM)
	);
};

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
export const extractSpotifyEmbedData = (html: string): any => {
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

	// Fallback: extract balanced JSON object starting at {"props":
	const propsIdx = html.indexOf(`{"props":`);
	if (propsIdx !== -1) {
		let depth = 0;
		let inString = false;
		let escape = false;
		for (let i = propsIdx; i < html.length; i++) {
			const c = html[i];
			if (escape) {
				escape = false;
				continue;
			}
			if (c === "\\") {
				escape = true;
				continue;
			}
			if (c === '"') {
				inString = !inString;
				continue;
			}
			if (!inString) {
				if (c === "{") depth++;
				else if (c === "}") {
					depth--;
					if (depth === 0) {
						try {
							return JSON.parse(html.slice(propsIdx, i + 1));
						} catch (e) {
							console.warn("Failed to parse props match from Spotify embed", e);
						}
						break;
					}
				}
			}
		}
	}

	return null;
};

export interface ExtractedHtmlMetadata {
	title?: string;
	artist?: string;
	album?: string;
	cover?: string;
}

/**
 * Fallback parser that inspects HTML tags, data-testid attributes, and meta tags
 * when __NEXT_DATA__ is missing or altered.
 */
export const extractSpotifyHtmlFallback = (
	html: string,
): ExtractedHtmlMetadata => {
	let title: string | undefined;
	let artist: string | undefined;
	let album: string | undefined;
	let cover: string | undefined;

	// 1. <title> pattern:
	// e.g. "Stay - song and lyrics by Post Malone | Spotify"
	// e.g. "Never Gonna Give You Up - song by Rick Astley | Spotify"
	// e.g. "Emotion (Deluxe) - Album by Carly Rae Jepsen | Spotify"
	const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
	if (titleMatch) {
		const rawTitle = titleMatch[1].trim();
		const trackMatch = rawTitle.match(
			/^(.*?)\s*-\s*(?:song and lyrics|song)\s+by\s+(.*?)\s*\|\s*Spotify$/i,
		);
		const albumMatch = rawTitle.match(
			/^(.*?)\s*-\s*(?:album|single|ep)\s+by\s+(.*?)\s*\|\s*Spotify$/i,
		);
		if (trackMatch) {
			title = trackMatch[1].trim();
			artist = trackMatch[2].trim();
		} else if (albumMatch) {
			title = albumMatch[1].trim();
			artist = albumMatch[2].trim();
		}
	}

	// 2. data-testid attributes from embed HTML
	const subMatch = html.match(/data-testid="subtitle"[^>]*>([\s\S]*?)<\/h2>/i);
	if (subMatch && !artist) {
		const text = subMatch[1].replace(/<[^>]+>/g, " ").trim();
		if (text) artist = text;
	}

	const entityTitleMatch = html.match(
		/data-testid="entity-title"[^>]*>([\s\S]*?)<\/h1>/i,
	);
	if (entityTitleMatch && !title) {
		const text = entityTitleMatch[1].replace(/<[^>]+>/g, " ").trim();
		if (text) title = text;
	}

	// 3. OpenGraph / meta tags
	// og:description format: "<Artist> · <Album> · Song · <Year>" or "<Artist> · Album · <Year>"
	const ogDescMatch =
		html.match(
			/<meta\s+(?:property|name)="og:description"\s+content="([^"]+)"/i,
		) || html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
	if (ogDescMatch) {
		const parts = ogDescMatch[1].split(" · ").map((s) => s.trim());
		if (parts.length >= 2) {
			if (!artist && parts[0]) artist = parts[0];
			if (
				!album &&
				parts[1] &&
				parts[1].toLowerCase() !== "album" &&
				parts[1].toLowerCase() !== "single"
			) {
				album = parts[1];
			}
		}
	}

	const ogTitleMatch = html.match(
		/<meta\s+(?:property|name)="og:title"\s+content="([^"]+)"/i,
	);
	if (ogTitleMatch && !title) {
		const rawOg = ogTitleMatch[1].trim();
		const parsedOg = rawOg.match(
			/^(.*?)\s*-\s*(?:song and lyrics|song|album|single|ep)\s+by\s+(.*?)\s*\|\s*Spotify$/i,
		);
		if (parsedOg) {
			title = parsedOg[1].trim();
			if (!artist) artist = parsedOg[2].trim();
		} else {
			title = rawOg;
		}
	}

	const ogImgMatch = html.match(
		/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i,
	);
	if (ogImgMatch) {
		cover = ogImgMatch[1];
	}

	return { title, artist, album, cover };
};

/**
 * Fetches arbitrary URL via Tauri native HTTP client (to bypass CORS) or browser fetch
 */
async function fetchUrlViaTauriOrWeb(url: string): Promise<string | null> {
	if (checkIsTauri()) {
		try {
			const { invoke } = await import("@tauri-apps/api/core");
			try {
				return await invoke<string>("fetch_url", { url });
			} catch {
				return await invoke<string>("fetch_apple_ttml", { url });
			}
		} catch (tauriErr) {
			console.warn("Tauri native fetch failed for:", url, tauriErr);
		}
	}

	// Browser / Web fallback (never set forbidden headers like User-Agent)
	try {
		const res = await fetch(url);
		if (res.ok) {
			return await res.text();
		}
	} catch (webErr) {
		// CORS might block in browser mode
	}
	return null;
}

/**
 * Fetch Spotify Embed HTML (uses native Tauri backend on desktop to bypass CORS)
 */
async function fetchSpotifyEmbedHtml(
	type: "track" | "album",
	id: string,
): Promise<string | null> {
	// Try embed URL first
	const embedHtml = await fetchUrlViaTauriOrWeb(
		`https://open.spotify.com/embed/${type}/${id}`,
	);
	if (embedHtml) return embedHtml;

	// In desktop Tauri, if embed failed, also try the standard web page
	if (checkIsTauri()) {
		const pageHtml = await fetchUrlViaTauriOrWeb(
			`https://open.spotify.com/${type}/${id}`,
		);
		if (pageHtml) return pageHtml;
	}

	return null;
}

/**
 * Query RMM Revival API which directly maps Spotify track ID to track and artist metadata
 */
async function fetchRmmRevivalLyrics(
	trackId: string,
): Promise<{
	title?: string;
	artist?: string;
	album?: string;
	cover?: string;
} | null> {
	const url = `https://lyrics.rmmreviv.al/lyrics?id=${encodeURIComponent(trackId)}`;
	let rawJson: string | null = null;

	if (checkIsTauri()) {
		try {
			const { invoke } = await import("@tauri-apps/api/core");
			try {
				rawJson = await invoke<string>("fetch_url", { url });
			} catch {
				rawJson = await invoke<string>("fetch_apple_ttml", { url });
			}
		} catch {
			// fall through to web fetch
		}
	}

	if (!rawJson) {
		try {
			const res = await fetch(url);
			if (res.ok) {
				rawJson = await res.text();
			}
		} catch {
			// ignore
		}
	}

	if (rawJson) {
		try {
			const data = JSON.parse(rawJson);
			if (data && data.name && data.artist) {
				return {
					title: data.name,
					artist: data.artist,
					album: data.album,
					cover: data.artwork,
				};
			}
		} catch {
			// ignore parse error
		}
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
 * Query iTunes Search API using verified artist and title to enrich artwork and album
 */
async function searchItunesMetadata(
	query: string,
	entity: "song" | "album" = "song",
): Promise<any | null> {
	try {
		const res = await fetch(
			`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=${entity}&limit=3`,
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
}

/**
 * Look up full album tracklist and artwork from iTunes collection ID
 */
async function lookupItunesAlbumTracks(collectionId: number | string): Promise<{
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
				const cover = (
					albumItem.artworkUrl100 ||
					albumItem.artworkUrl60 ||
					""
				).replace(/100x100bb\.jpg/i, "600x600bb.jpg");

				return {
					album: albumItem.collectionName || albumItem.collectionCensoredName,
					artist: albumItem.artistName,
					cover,
					tracks: trackItems.map((track, idx) => ({
						number: track.trackNumber || idx + 1,
						title: track.trackName || track.trackCensoredName,
						artist: track.artistName,
						album: track.collectionName,
						cover: (
							track.artworkUrl100 ||
							albumItem.artworkUrl100 ||
							cover
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

		// 1. Try direct Spotify embed fetch (works natively in desktop / Tauri)
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
				let cover =
					entity.visualIdentity?.image?.[2]?.url ||
					entity.visualIdentity?.image?.[0]?.url ||
					entity.visual?.url ||
					entity.coverArt?.sources?.[0]?.url ||
					entity.images?.[0]?.url;
				let album = entity.album?.name;

				// If album or cover wasn't in the minimal embed JSON, safely enrich using verified artist + title
				if ((!album || !cover) && title && artist) {
					try {
						const itunes = await searchItunesMetadata(
							`${artist} ${title}`,
							"song",
						);
						if (!album && itunes?.collectionName) {
							album = itunes.collectionName;
						}
						if (!cover && itunes?.artworkUrl100) {
							cover = itunes.artworkUrl100.replace(
								/100x100bb\.jpg/i,
								"600x600bb.jpg",
							);
						}
					} catch {
						// ignore enrichment error
					}
				}

				if (title) {
					return {
						type: "track",
						id: trackId,
						title,
						artist,
						album,
						cover,
						releaseDate: entity.releaseDate?.isoString,
					};
				}
			}

			// Fallback: parse HTML tags if __NEXT_DATA__ was absent or changed format
			const meta = extractSpotifyHtmlFallback(html);
			if (meta.title && meta.artist) {
				let album = meta.album;
				let cover = meta.cover;
				if (!album || !cover) {
					try {
						const itunes = await searchItunesMetadata(
							`${meta.artist} ${meta.title}`,
							"song",
						);
						if (!album && itunes?.collectionName) album = itunes.collectionName;
						if (!cover && itunes?.artworkUrl100) {
							cover = itunes.artworkUrl100.replace(
								/100x100bb\.jpg/i,
								"600x600bb.jpg",
							);
						}
					} catch {
						// ignore
					}
				}
				return {
					type: "track",
					id: trackId,
					title: meta.title,
					artist: meta.artist,
					album,
					cover,
				};
			}
		}

		// 2. Try RMM Revival API (indexed directly by Spotify track ID)
		const rmm = await fetchRmmRevivalLyrics(trackId);
		if (rmm && rmm.title && rmm.artist) {
			let album = rmm.album;
			let cover = rmm.cover;
			if (!album || !cover) {
				try {
					const itunes = await searchItunesMetadata(
						`${rmm.artist} ${rmm.title}`,
						"song",
					);
					if (!album && itunes?.collectionName) album = itunes.collectionName;
					if (!cover && itunes?.artworkUrl100) {
						cover = itunes.artworkUrl100.replace(
							/100x100bb\.jpg/i,
							"600x600bb.jpg",
						);
					}
				} catch {
					// ignore
				}
			}
			return {
				type: "track",
				id: trackId,
				title: rmm.title,
				artist: rmm.artist,
				album,
				cover,
			};
		}

		// 3. Fallback: Spotify oEmbed + exact Spotify ID search matching
		const oembed = await fetchSpotifyOEmbed(
			`https://open.spotify.com/track/${trackId}`,
		);
		if (oembed?.title) {
			// Attempt to find exact track match by Spotify ID using search
			try {
				const searchRes = await fetch(
					`https://lyrics.rmmreviv.al/search?q=${encodeURIComponent(oembed.title)}`,
				);
				if (searchRes.ok) {
					const searchData = await searchRes.json();
					const match = searchData.results?.find((r: any) => r.id === trackId);
					if (match && match.artist) {
						let album = match.album;
						let cover = match.artwork || oembed.thumbnail_url;
						if (!album) {
							try {
								const itunes = await searchItunesMetadata(
									`${match.artist} ${match.name || oembed.title}`,
									"song",
								);
								if (itunes?.collectionName) album = itunes.collectionName;
								if (!cover && itunes?.artworkUrl100) {
									cover = itunes.artworkUrl100.replace(
										/100x100bb\.jpg/i,
										"600x600bb.jpg",
									);
								}
							} catch {
								// ignore
							}
						}
						return {
							type: "track",
							id: trackId,
							title: match.name || oembed.title,
							artist: match.artist,
							album,
							cover,
						};
					}
				}
			} catch {
				// ignore search error
			}

			// Safe Fallback: DO NOT guess a random artist with the same title from iTunes!
			// Return exact track title with empty artist so we never substitute a different artist.
			return {
				type: "track",
				id: trackId,
				title: oembed.title,
				artist: "",
				cover: oembed.thumbnail_url,
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

		// 1. Try direct Spotify embed fetch (works natively in desktop / Tauri)
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
				let cover =
					entity.visualIdentity?.image?.[2]?.url ||
					entity.visualIdentity?.image?.[0]?.url ||
					entity.visual?.url ||
					entity.coverArt?.sources?.[0]?.url ||
					entity.images?.[0]?.url;

				if (!cover && title && artist) {
					try {
						const itunes = await searchItunesMetadata(
							`${artist} ${title}`,
							"album",
						);
						if (itunes?.artworkUrl100) {
							cover = itunes.artworkUrl100.replace(
								/100x100bb\.jpg/i,
								"600x600bb.jpg",
							);
						}
					} catch {
						// ignore
					}
				}

				const rawTrackList: any[] = entity.trackList || [];
				const tracks: ResolvedAlbumTrack[] = rawTrackList.map((t, idx) => ({
					number: idx + 1,
					title: t.title || t.name,
					artist: t.subtitle || artist,
					album: title,
					cover: t.cover || cover,
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

			// Fallback: parse HTML tags
			const meta = extractSpotifyHtmlFallback(html);
			if (meta.title) {
				let cover = meta.cover;
				if (!cover && meta.artist) {
					try {
						const itunes = await searchItunesMetadata(
							`${meta.artist} ${meta.title}`,
							"album",
						);
						if (itunes?.artworkUrl100) {
							cover = itunes.artworkUrl100.replace(
								/100x100bb\.jpg/i,
								"600x600bb.jpg",
							);
						}
					} catch {
						// ignore
					}
				}

				// Also try iTunes album lookup if tracks could not be extracted from HTML
				try {
					const itunesAlbum = await searchItunesMetadata(
						`${meta.artist || ""} ${meta.title}`,
						"album",
					);
					if (itunesAlbum?.collectionId) {
						const fullAlbum = await lookupItunesAlbumTracks(
							itunesAlbum.collectionId,
						);
						if (fullAlbum && fullAlbum.tracks.length > 0) {
							return {
								type: "album",
								id: albumId,
								title: fullAlbum.album || meta.title,
								artist: fullAlbum.artist || meta.artist || "Unknown Artist",
								cover: fullAlbum.cover || cover,
								tracks: fullAlbum.tracks,
							};
						}
					}
				} catch {
					// ignore
				}

				return {
					type: "album",
					id: albumId,
					title: meta.title,
					artist: meta.artist || "Unknown Artist",
					cover,
					tracks: [],
				};
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
