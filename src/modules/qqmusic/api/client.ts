import { scoreCandidateTrack } from "$/modules/joox/api/client";
import type { JooxTrack } from "$/modules/joox/types";
import { binaryToBlob } from "$/utils/binaryBlob";
import type { QqMusicSearchItem, QqMusicSongDetail } from "../types";

const isTauriEnv = () =>
	typeof window !== "undefined" &&
	(!!(window as unknown as { __TAURI__?: unknown }).__TAURI__ ||
		!!(window as unknown as { __TAURI_INTERNALS__?: unknown })
			.__TAURI_INTERNALS__ ||
		!!import.meta.env.TAURI_ENV_PLATFORM);

async function fetchQqJson<T = any>(url: string): Promise<T> {
	// tang.api.s01s.cn sends Access-Control-Allow-Origin: *
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
		if (res.ok) {
			return (await res.json()) as T;
		}
	} catch (err) {
		console.warn(
			"Direct fetch to QQ Music open API failed, trying fallback:",
			err,
		);
	}

	if (isTauriEnv()) {
		try {
			const { invoke } = await import("@tauri-apps/api/core");
			const raw = await invoke<string>("fetch_url", { url });
			return JSON.parse(raw);
		} catch (tauriErr) {
			console.warn("Tauri fetch_url failed for QQ Music API:", tauriErr);
		}
	}

	// Browser proxy fallback with short timeout
	const encoded = encodeURIComponent(url);
	const proxies = [
		`https://api.allorigins.win/raw?url=${encoded}`,
		`https://corsproxy.io/?${encoded}`,
	];
	for (const proxy of proxies) {
		try {
			const proxyRes = await fetch(proxy, {
				signal: AbortSignal.timeout(2500),
			});
			if (proxyRes.ok) return (await proxyRes.json()) as T;
		} catch {
			// continue
		}
	}

	throw new Error("Failed to connect to QQ Music open API");
}

export const QqMusicApi = {
	/**
	 * Search for songs on QQ Music via open API.
	 */
	async search(query: string): Promise<JooxTrack[]> {
		const cleanQuery = query.trim();
		if (!cleanQuery) return [];

		const url = `https://tang.api.s01s.cn/music_open_api.php?msg=${encodeURIComponent(cleanQuery)}&type=json`;

		try {
			const json = await fetchQqJson<QqMusicSearchItem[] | { error?: string }>(
				url,
			);
			if (!Array.isArray(json)) return [];

			return json
				.filter((item) => item && item.song_mid)
				.map((item, idx) => ({
					id: item.song_mid,
					index: idx,
					name: item.song_title || "Unknown",
					artist: item.singer_name || "Unknown",
					songmid: item.song_mid,
					source: "QQ Music",
				}));
		} catch (err) {
			console.warn("QQ Music search failed:", err);
			return [];
		}
	},

	/**
	 * Fetch full song detail including audio stream URLs and metadata.
	 */
	async getDetail(mid: string): Promise<QqMusicSongDetail> {
		const cleanMid = mid.trim();
		if (!cleanMid) throw new Error("Missing song_mid for QQ Music");

		const url = `https://tang.api.s01s.cn/music_open_api.php?mid=${encodeURIComponent(cleanMid)}&type=json`;
		const detail = await fetchQqJson<QqMusicSongDetail>(url);

		if (
			!detail ||
			(!detail.song_play_url &&
				!detail.song_play_url_sq &&
				!detail.song_play_url_hq)
		) {
			throw new Error("No playable audio found for this QQ Music track");
		}

		return detail;
	},

	/**
	 * Download audio binary as a Blob reliably.
	 */
	async downloadAudioBlob(url: string): Promise<Blob> {
		const mime = url.includes(".flac")
			? "audio/flac"
			: url.includes(".m4a")
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
				console.warn("Tauri fetch_binary failed:", tauriErr);
			}
		}

		// 2. Direct fetch (for web)
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
			console.warn("Direct fetch failed for QQ audio stream:", err);
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

		throw new Error("Failed to download audio stream from QQ Music");
	},

	/**
	 * Find and download audio from QQ Music automatically.
	 */
	async searchAndGetAudio(
		title: string,
		artist: string,
		preferredQuality = "320",
		onProgress?: (percent: number) => void,
	): Promise<{
		audioBlob: Blob;
		fileName: string;
		qualityName: string;
	} | null> {
		const cleanTitle = title.trim();
		const cleanArtist = artist.trim();
		if (!cleanTitle && !cleanArtist) return null;

		// Try queries in order: "Artist Title" then "Artist" then "Title"
		const queriesToTry: string[] = [];
		if (cleanArtist && cleanTitle) {
			queriesToTry.push(`${cleanArtist} ${cleanTitle}`);
		}
		if (cleanTitle) {
			queriesToTry.push(cleanTitle);
		}
		if (cleanArtist && !queriesToTry.includes(cleanArtist)) {
			queriesToTry.push(cleanArtist);
		}

		let candidates: JooxTrack[] = [];
		for (const q of queriesToTry) {
			candidates = await this.search(q);
			if (candidates.length > 0) break;
		}

		if (candidates.length === 0) return null;

		// Score candidates in memory
		const scored = candidates
			.map((track) => ({
				track,
				score: scoreCandidateTrack(track, cleanTitle, cleanArtist),
			}))
			.filter((c) => c.score > 0)
			.sort((a, b) => b.score - a.score);

		if (scored.length === 0) return null;

		// Try up to top 3 candidates
		for (const { track } of scored.slice(0, 3)) {
			try {
				const detail = await this.getDetail(track.songmid || track.id);
				let audioUrl: string | undefined;
				let qualityName = "MP3 / M4A";
				let ext = "m4a";

				if (preferredQuality === "flac" && detail.song_play_url_sq) {
					audioUrl = detail.song_play_url_sq;
					qualityName = "FLAC";
					ext = "flac";
				} else if (detail.song_play_url_hq) {
					audioUrl = detail.song_play_url_hq;
					qualityName = "HQ (192k)";
					ext = "m4a";
				} else if (detail.song_play_url) {
					audioUrl = detail.song_play_url;
					qualityName = "Standard";
					ext = "m4a";
				} else if (detail.song_play_url_standard) {
					audioUrl = detail.song_play_url_standard;
					qualityName = "Standard";
					ext = "m4a";
				} else if (detail.song_play_url_sq) {
					audioUrl = detail.song_play_url_sq;
					qualityName = "FLAC";
					ext = "flac";
				}

				if (!audioUrl) continue;

				const audioBlob = await this.downloadAudioBlob(audioUrl);
				(audioBlob as any).isAutoDownloaded = true;
				const outArtist =
					cleanArtist || detail.singer_name || track.artist || "";
				const outTitle =
					cleanTitle || detail.song_name || track.name || "audio";
				const fileName = (outArtist ? `${outArtist} - ${outTitle}` : outTitle)
					? `${outArtist ? `${outArtist} - ` : ""}${outTitle}.${ext}`
							.replace(/[/\\?%*:|"<>]/g, "-")
							.trim()
					: `audio.${ext}`;

				return {
					audioBlob,
					fileName,
					qualityName,
				};
			} catch {
				// try next candidate
			}
		}

		return null;
	},
};
