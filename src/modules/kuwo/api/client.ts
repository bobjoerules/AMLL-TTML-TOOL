import { scoreCandidateTrack } from "$/modules/joox/api/client";
import type { JooxTrack } from "$/modules/joox/types";
import { binaryToBlob } from "$/utils/binaryBlob";
import type { KuwoSearchItem, KuwoSongDetail } from "../types";

const isTauriEnv = () =>
	typeof window !== "undefined" &&
	(!!(window as unknown as { __TAURI__?: unknown }).__TAURI__ ||
		!!(window as unknown as { __TAURI_INTERNALS__?: unknown })
			.__TAURI_INTERNALS__ ||
		!!import.meta.env.TAURI_ENV_PLATFORM);

function formatSeconds(secStr: string): string {
	const total = parseInt(secStr, 10);
	if (isNaN(total) || total <= 0) return "";
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

async function fetchKuwoJson<T = any>(url: string): Promise<T> {
	if (isTauriEnv()) {
		try {
			const { invoke } = await import("@tauri-apps/api/core");
			const raw = await invoke<string>("fetch_url", { url });
			return JSON.parse(raw);
		} catch (tauriErr) {
			console.warn("Tauri fetch_url failed for Kuwo API, falling back:", tauriErr);
		}
	}

	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
		if (res.ok) {
			return (await res.json()) as T;
		}
	} catch (err) {
		console.warn("Direct fetch to Kuwo open API failed, trying fallback:", err);
	}

	const encoded = encodeURIComponent(url);
	const proxies = [
		`https://api.allorigins.win/raw?url=${encoded}`,
		`https://corsproxy.io/?${encoded}`,
	];
	for (const proxy of proxies) {
		try {
			const proxyRes = await fetch(proxy, {
				signal: AbortSignal.timeout(8000),
			});
			if (proxyRes.ok) return (await proxyRes.json()) as T;
		} catch {
			// continue
		}
	}

	throw new Error("Failed to connect to Kuwo Music API");
}

export const KuwoApi = {
	/**
	 * Search for songs on Kuwo Music.
	 */
	async search(query: string): Promise<JooxTrack[]> {
		const cleanQuery = query.trim();
		if (!cleanQuery) return [];

		const url = `https://oiapi.net/api/Kuwo?msg=${encodeURIComponent(cleanQuery)}&page=1&limit=20`;

		try {
			const json = await fetchKuwoJson<{
				code: number;
				data?: KuwoSearchItem[];
			}>(url);

			if (json.code !== 1 || !Array.isArray(json.data)) {
				return [];
			}

			return json.data
				.filter((item) => item && item.song)
				.map((item, idx) => ({
					id: item.rid || `kuwo_${idx}`,
					index: idx,
					name: item.song,
					artist: item.singer,
					album: item.album,
					duration: formatSeconds(item.time),
					cover: item.picture,
					source: "Kuwo",
				}));
		} catch (err) {
			console.warn("Kuwo search failed:", err);
			return [];
		}
	},

	/**
	 * Fetch playable audio detail for a song at a specific search result index (1-based for the API).
	 */
	async getDetail(
		query: string,
		index: number,
		quality = "320",
	): Promise<KuwoSongDetail> {
		const cleanQuery = query.trim();
		if (!cleanQuery) throw new Error("Missing search query for Kuwo track");

		const n = index + 1;
		const brParam = quality === "flac" ? "&br=flac" : quality === "128" ? "&br=128" : "&br=320";
		const url = `https://oiapi.net/api/Kuwo?msg=${encodeURIComponent(cleanQuery)}&n=${n}${brParam}`;

		const json = await fetchKuwoJson<{
			code: number;
			data?: KuwoSongDetail;
			message?: string;
		}>(url);

		if (json.code !== 1 || !json.data || !json.data.url) {
			throw new Error(json.message || "No playable audio found for this Kuwo track");
		}

		return json.data;
	},

	/**
	 * Download audio binary as a Blob reliably.
	 */
	async downloadAudioBlob(url: string): Promise<Blob> {
		const mime = url.includes(".flac")
			? "audio/flac"
			: url.includes(".m4a") || url.includes(".aac")
				? "audio/mp4"
				: url.includes(".ogg")
					? "audio/ogg"
					: "audio/mpeg";

		// 1. Native Tauri fetch_binary first on desktop (zero CORS & COEP)
		if (isTauriEnv()) {
			try {
				const { invoke } = await import("@tauri-apps/api/core");
				const raw = await invoke<unknown>("fetch_binary", { url });
				const blob = binaryToBlob(raw, mime);
				if (blob && blob.size > 0) {
					return blob;
				}
			} catch (tauriErr) {
				console.warn(
					"Tauri fetch_binary failed for Kuwo, trying web fetch:",
					tauriErr,
				);
			}
		}

		// 2. Direct web fetch
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
			if (res.ok) {
				const blob = await res.blob();
				if (blob.size > 0) {
					return blob.type && blob.type.startsWith("audio/")
						? blob
						: new Blob([blob], { type: mime });
				}
			}
		} catch (err) {
			console.warn("Direct fetch failed for Kuwo audio stream:", err);
		}

		// 3. Web proxy fallback
		const encoded = encodeURIComponent(url);
		const corsProxies = [
			`https://api.allorigins.win/raw?url=${encoded}`,
			`https://corsproxy.io/?${encoded}`,
		];
		for (const proxy of corsProxies) {
			try {
				const proxyRes = await fetch(proxy, { signal: AbortSignal.timeout(45000) });
				if (proxyRes.ok) {
					const blob = await proxyRes.blob();
					if (blob.size > 0) {
						return new Blob([blob], { type: mime });
					}
				}
			} catch {
				// continue
			}
		}

		throw new Error("Failed to download audio stream from Kuwo Music");
	},

	/**
	 * Automatically search Kuwo and retrieve audio blob for a song.
	 */
	async searchAndGetAudio(
		title: string,
		artist: string,
		preferredQuality = "320",
	): Promise<{
		audioBlob: Blob;
		fileName: string;
		qualityName: string;
	} | null> {
		const cleanTitle = title.trim();
		const cleanArtist = artist.trim();
		if (!cleanTitle && !cleanArtist) return null;

		const activeQuery =
			cleanArtist && cleanTitle
				? `${cleanArtist} ${cleanTitle}`
				: cleanTitle || cleanArtist;

		let candidates: JooxTrack[] = [];
		try {
			candidates = await this.search(activeQuery);
		} catch {
			return null;
		}

		if (candidates.length === 0 && cleanTitle) {
			try {
				candidates = await this.search(cleanTitle);
			} catch {
				return null;
			}
		}

		if (candidates.length === 0) return null;

		const scored = candidates
			.map((track) => ({
				track,
				score: scoreCandidateTrack(track, cleanTitle, cleanArtist),
			}))
			.filter((c) => c.score > 0)
			.sort((a, b) => b.score - a.score);

		if (scored.length === 0) return null;

		for (const { track } of scored.slice(0, 3)) {
			try {
				const queryToUse =
					track.name && track.artist
						? `${track.name} ${track.artist}`
						: activeQuery;
				const detail = await this.getDetail(
					queryToUse,
					track.index,
					preferredQuality,
				);
				if (!detail.url) continue;

				const audioBlob = await this.downloadAudioBlob(detail.url);
				(audioBlob as any).isAutoDownloaded = true;
				const ext = detail.format || (preferredQuality === "flac" ? "flac" : "mp3");
				const outArtist = cleanArtist || detail.singer || track.artist || "";
				const outTitle = cleanTitle || detail.song || track.name || "audio";
				const fileName = (outArtist ? `${outArtist} - ${outTitle}` : outTitle)
					? `${outArtist ? `${outArtist} - ` : ""}${outTitle}.${ext}`
							.replace(/[/\\?%*:|"<>]/g, "-")
							.trim()
					: `audio.${ext}`;

				return {
					audioBlob,
					fileName,
					qualityName: detail.format ? detail.format.toUpperCase() : "MP3 320k",
				};
			} catch {
				// try next candidate
			}
		}

		return null;
	},
};
