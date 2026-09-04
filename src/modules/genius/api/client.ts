import type {
	GeniusArtistResponse,
	GeniusSearchResponse,
	GeniusSongResponse,
} from "../types";
import {
	GeniusResolver,
	isGeniusAlbumUrl,
	isGeniusSongUrl,
	isGeniusUrl,
} from "../utils/resolver";

export { GeniusResolver, isGeniusAlbumUrl, isGeniusSongUrl, isGeniusUrl };
export type {
	GeniusResolvedAlbum,
	GeniusResolvedAlbumTrack,
	GeniusResolvedEntity,
	GeniusResolvedSong,
} from "../utils/resolver";

const BASE_URL = "https://api.genius.com";

/**
 * The Genius page itself is not CORS-enabled. Its public embed endpoint is,
 * and returns the lyrics as an escaped HTML string inside `document.write`.
 */
export const extractLyricsFromEmbed = (embedScript: string): string => {
	const match = embedScript.match(
		/document\.write\(JSON\.parse\('((?:\\.|[^'])*)'\)\)/s,
	);

	if (!match) {
		throw new Error("Lyrics were not present in the Genius embed response.");
	}

	try {
		// Decode the JavaScript single-quoted string enough to restore the JSON
		// string passed to JSON.parse. Do not evaluate the remote script.
		let jsonString = "";
		for (let i = 0; i < match[1].length; i++) {
			const character = match[1][i];
			if (character === "\\" && i + 1 < match[1].length) {
				const escaped = match[1][++i];
				jsonString +=
					escaped === "n"
						? "\n"
						: escaped === "r"
							? "\r"
							: escaped === "t"
								? "\t"
								: escaped;
			} else {
				jsonString += character;
			}
		}
		const html = JSON.parse(jsonString) as string;
		const bodyMatch = html.match(
			/<div\b[^>]*class=["'][^"']*\brg_embed_body\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
		);
		if (!bodyMatch) {
			throw new Error("Lyrics were empty in the Genius embed response.");
		}

		let lyrics: string | undefined;
		if (typeof DOMParser !== "undefined") {
			const document = new DOMParser().parseFromString(
				bodyMatch[1],
				"text/html",
			);
			for (const breakElement of document.querySelectorAll("br")) {
				breakElement.replaceWith("\n");
			}
			lyrics = document.body.textContent?.trim();
		} else {
			lyrics = bodyMatch[1]
				.replace(/<br\s*\/?>/gi, "\n")
				.replace(/<[^>]+>/g, "")
				.trim();
		}

		if (!lyrics) {
			throw new Error("Lyrics were empty in the Genius embed response.");
		}

		// The embed markup commonly puts a source newline after every <br>.
		// `textContent` retains both, which otherwise creates a blank line after
		// each lyric line.
		return lyrics.replace(/\n[\t ]*\n/g, "\n");
	} catch (error) {
		if (error instanceof Error) throw error;
		throw new Error("Could not parse the Genius embed response.");
	}
};

const songDetailCache = new Map<number, GeniusSongResponse>();

export const GeniusApi = {
	/**
	 * Search for a song on Genius
	 * @param query The search query (e.g. "Artist - Song")
	 * @param apiKey The Genius API key
	 * @param options Optional parameters (e.g. enrichAlbums)
	 * @returns A list of search hits
	 */
	async search(
		query: string,
		apiKey: string,
		options: { enrichAlbums?: boolean } = { enrichAlbums: true },
	): Promise<GeniusSearchResponse> {
		if (!query.trim()) {
			return { meta: { status: 200 }, response: { hits: [] } };
		}

		try {
			const response = await fetch(
				`${BASE_URL}/search?q=${encodeURIComponent(query)}&access_token=${apiKey}`,
			);

			if (!response.ok) {
				throw new Error(
					`Genius Search failed: ${response.status} ${response.statusText}`,
				);
			}

			const data = (await response.json()) as GeniusSearchResponse;
			const hits = data.response?.hits || [];

			// Genius /search does not return album metadata on search hits anymore.
			// Enrich search hits in parallel using the song detail endpoint.
			if (options.enrichAlbums !== false && hits.length > 0 && apiKey) {
				await Promise.allSettled(
					hits.map(async (hit) => {
						if (hit.result && !hit.result.album) {
							try {
								const songDetail = await this.getSongById(
									hit.result.id,
									apiKey,
								);
								if (songDetail.response?.song?.album) {
									hit.result.album = {
										id: songDetail.response.song.album.id,
										name: songDetail.response.song.album.name,
										cover_art_url:
											songDetail.response.song.album.cover_art_url || "",
									};
								}
							} catch {
								// non-fatal
							}
						}
					}),
				);
			}

			return data;
		} catch (error) {
			console.error("Genius API Error (Search):", error);
			throw error;
		}
	},

	/**
	 * Get detailed information about a song by ID
	 * @param id The Genius song ID
	 * @param apiKey The Genius API key
	 * @returns The song detail response
	 */
	async getSongById(id: number, apiKey: string): Promise<GeniusSongResponse> {
		if (songDetailCache.has(id)) {
			return songDetailCache.get(id)!;
		}

		try {
			const response = await fetch(
				`${BASE_URL}/songs/${id}?access_token=${apiKey}`,
			);

			if (!response.ok) {
				throw new Error(
					`Genius Get Song failed: ${response.status} ${response.statusText}`,
				);
			}

			const data = (await response.json()) as GeniusSongResponse;
			songDetailCache.set(id, data);
			return data;
		} catch (error) {
			console.error("Genius API Error (GetById):", error);
			throw error;
		}
	},

	/**
	 * Get detailed information about an artist by ID
	 * @param id The Genius artist ID
	 * @param apiKey The Genius API key
	 * @returns The artist detail response
	 */
	async getArtistById(
		id: number,
		apiKey: string,
	): Promise<GeniusArtistResponse> {
		try {
			const response = await fetch(
				`${BASE_URL}/artists/${id}?access_token=${apiKey}&text_format=plain`,
			);

			if (!response.ok) {
				throw new Error(
					`Genius Get Artist failed: ${response.status} ${response.statusText}`,
				);
			}

			return (await response.json()) as GeniusArtistResponse;
		} catch (error) {
			console.error("Genius API Error (GetArtistById):", error);
			throw error;
		}
	},

	/**
	 * Fetch plain lyrics from Genius's CORS-enabled public embed endpoint.
	 * @param songId The Genius song ID returned by search.
	 * @returns Plain-text lyrics string
	 */
	async getLyrics(songId: number): Promise<string> {
		try {
			const response = await fetch(
				`https://genius.com/songs/${songId}/embed.js`,
			);
			if (!response.ok) {
				throw new Error(
					`Genius lyrics request failed: ${response.status} ${response.statusText}`,
				);
			}

			return extractLyricsFromEmbed(await response.text());
		} catch (error) {
			console.error("Genius Scraper Error:", error);
			throw error;
		}
	},

	/**
	 * Get detailed information about an album by ID
	 * @param id The Genius album ID
	 * @param apiKey The Genius API key
	 * @returns The album detail response
	 */
	async getAlbumById(
		id: number,
		apiKey: string,
	): Promise<import("../types").GeniusAlbumResponse> {
		try {
			const response = await fetch(
				`${BASE_URL}/albums/${id}?access_token=${apiKey}`,
			);
			if (!response.ok) {
				throw new Error(
					`Genius Get Album failed: ${response.status} ${response.statusText}`,
				);
			}
			return (await response.json()) as import("../types").GeniusAlbumResponse;
		} catch (error) {
			console.error("Genius API Error (GetAlbumById):", error);
			throw error;
		}
	},

	/**
	 * Get all tracks for a Genius album by ID
	 * @param id The Genius album ID
	 * @param apiKey The Genius API key
	 * @returns An array of tracks in the album
	 */
	async getAlbumTracks(
		id: number,
		apiKey: string,
	): Promise<import("../types").GeniusAlbumTrack[]> {
		const allTracks: import("../types").GeniusAlbumTrack[] = [];
		let page = 1;
		const maxPages = 5; // Safety bound (up to 250 tracks)

		try {
			while (page <= maxPages) {
				const response = await fetch(
					`${BASE_URL}/albums/${id}/tracks?page=${page}&per_page=50&access_token=${apiKey}`,
				);
				if (!response.ok) {
					throw new Error(
						`Genius Get Album Tracks failed: ${response.status} ${response.statusText}`,
					);
				}
				const data =
					(await response.json()) as import("../types").GeniusAlbumTracksResponse;
				const tracks = data.response.tracks || [];
				allTracks.push(...tracks);

				if (!data.response.next_page || tracks.length === 0) {
					break;
				}
				page = data.response.next_page;
			}
			return allTracks;
		} catch (error) {
			console.error("Genius API Error (GetAlbumTracks):", error);
			throw error;
		}
	},

	/**
	 * Search for albums on Genius by querying songs and aggregating distinct albums
	 * @param query Album search query
	 * @param apiKey The Genius API key
	 * @returns A list of unique albums
	 */
	async searchAlbums(
		query: string,
		apiKey: string,
	): Promise<import("../types").GeniusAlbumSummary[]> {
		if (!query.trim()) return [];

		// Check if the query is a direct Genius album URL
		if (isGeniusAlbumUrl(query)) {
			try {
				const resolved = await GeniusResolver.resolveAlbum(query, apiKey);
				if (resolved) {
					return [
						{
							id: resolved.id,
							name: resolved.title,
							artist: resolved.artist,
							cover_art_url: resolved.cover || "",
						},
					];
				}
			} catch (err) {
				console.warn("Failed to directly resolve Genius album url:", err);
			}
		}

		const albumUrlMatch = query.match(
			/genius\.com\/albums\/([^/]+)\/([^/?#]+)/i,
		);
		if (albumUrlMatch) {
			// Search the slug parts to locate matching album
			const cleanSlug = `${albumUrlMatch[1]} ${albumUrlMatch[2]}`.replace(
				/-/g,
				" ",
			);
			query = cleanSlug;
		}

		const albumsMap = new Map<number, import("../types").GeniusAlbumSummary>();

		// 1. Try public/multi search endpoint which has a dedicated "album" section
		try {
			const multiRes = await fetch(
				`https://genius.com/api/search/multi?q=${encodeURIComponent(query)}`,
			);
			if (multiRes.ok) {
				const multiData = await multiRes.json();
				const albumSections = (multiData.response?.sections || []).filter(
					(s: any) => s.type === "album" || s.type === "top_hit",
				);
				for (const section of albumSections) {
					for (const hit of section.hits || []) {
						const album = hit.result;
						if (
							album &&
							(album._type === "album" || hit.type === "album") &&
							album.id &&
							!albumsMap.has(album.id)
						) {
							albumsMap.set(album.id, {
								id: album.id,
								name: album.name || album.title,
								artist:
									album.artist?.name || album.primary_artist_names || "Unknown",
								cover_art_url:
									album.cover_art_url || album.cover_art_thumbnail_url || "",
							});
						}
					}
				}
			}
		} catch {
			// ignore multi search failure
		}

		// 2. Also search songs and extract unique albums from enriched hits
		const searchRes = await this.search(query, apiKey, { enrichAlbums: true });
		const hits = searchRes.response.hits || [];

		for (const hit of hits) {
			const song = hit.result;
			if (song.album && song.album.id && !albumsMap.has(song.album.id)) {
				albumsMap.set(song.album.id, {
					id: song.album.id,
					name: song.album.name,
					artist: song.primary_artist?.name || song.artist_names || "Unknown",
					cover_art_url:
						song.album.cover_art_url ||
						song.song_art_image_url ||
						song.header_image_url ||
						"",
				});
			}
		}

		return Array.from(albumsMap.values());
	},
};
