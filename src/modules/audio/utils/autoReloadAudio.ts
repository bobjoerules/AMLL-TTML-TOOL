import i18n from "i18next";
import { toast } from "react-toastify";
import { audioEngine } from "$/modules/audio/audio-engine";
import { getAudioFromCache } from "$/modules/project/autosave/autosave";

const AUDIO_EXTENSIONS = [
	"mp3",
	"flac",
	"wav",
	"m4a",
	"ogg",
	"opus",
	"webm",
	"aac",
];

const getMimeType = (ext: string) => {
	switch (ext.toLowerCase()) {
		case "mp3":
			return "audio/mpeg";
		case "wav":
			return "audio/wav";
		case "flac":
			return "audio/flac";
		case "ogg":
			return "audio/ogg";
		case "m4a":
			return "audio/mp4";
		case "opus":
			return "audio/opus";
		case "webm":
			return "audio/webm";
		case "aac":
			return "audio/aac";
		default:
			return "application/octet-stream";
	}
};

export interface AutoReloadAudioOptions {
	projectId?: string;
	audioPath?: string | null;
	audioFileName?: string | null;
	title?: string | null;
	artist?: string | null;
	silent?: boolean;
}

/**
 * Attempts to automatically reload the audio corresponding to a restored project or cloud-synced TTML from the local computer.
 *
 * Checks:
 * 1. If in Tauri desktop app:
 *    a. Explicit audioPath if it still exists on disk
 *    b. Common system directories (Music, Downloads, Desktop, Documents) for matching candidate filenames
 *    c. Directory listing scan for matching file stems
 * 2. If not found on filesystem or if running in web browser:
 *    a. Local IndexedDB audio_cache store by projectId or audioFileName
 */
export async function tryReloadAudioFromComputer(
	options: AutoReloadAudioOptions,
): Promise<boolean> {
	const isTauri =
		typeof window !== "undefined" &&
		(!!(window as unknown as { __TAURI__?: unknown }).__TAURI__ ||
			!!import.meta.env.TAURI_ENV_PLATFORM);

	// 1. If in Tauri desktop app, search filesystem on the computer
	if (isTauri) {
		try {
			const { readFile, exists, readDir } = await import(
				"@tauri-apps/plugin-fs"
			);
			const { audioDir, downloadDir, desktopDir, documentDir, join } =
				await import("@tauri-apps/api/path");

			// Check explicit audioPath first
			if (options.audioPath) {
				try {
					if (await exists(options.audioPath)) {
						const data = await readFile(options.audioPath);
						const fileName =
							options.audioPath.split(/[/\\]/).pop() ||
							options.audioFileName ||
							"audio";
						const ext = fileName.split(".").pop()?.toLowerCase() || "mp3";
						const file = new File([data], fileName, { type: getMimeType(ext) });
						(file as any).path = options.audioPath;
						await audioEngine.loadMusic(file);
						if (!options.silent) {
							toast.info(
								i18n.t(
									"audio.autoReloaded",
									'Automatically loaded audio "{name}" from computer',
									{ name: fileName },
								),
							);
						}
						return true;
					}
				} catch (e) {
					console.warn("Failed to read audio from audioPath:", e);
				}
			}

			// Build list of candidate file names
			const candidateNames = new Set<string>();
			if (options.audioFileName) {
				candidateNames.add(options.audioFileName);
			}

			const cleanTitle = options.title?.replace(/[/\\?%*:|"<>]/g, "").trim();
			const cleanArtist = options.artist?.replace(/[/\\?%*:|"<>]/g, "").trim();

			if (cleanTitle) {
				for (const ext of AUDIO_EXTENSIONS) {
					candidateNames.add(`${cleanTitle}.${ext}`);
					if (cleanArtist) {
						candidateNames.add(`${cleanArtist} - ${cleanTitle}.${ext}`);
						candidateNames.add(`${cleanTitle} - ${cleanArtist}.${ext}`);
					}
				}
			}

			// Build list of search directories
			const searchDirs: string[] = [];
			const addDir = async (fn: () => Promise<string>) => {
				try {
					const d = await fn();
					if (d && !searchDirs.includes(d)) searchDirs.push(d);
				} catch {}
			};
			await addDir(audioDir);
			await addDir(downloadDir);
			await addDir(desktopDir);
			await addDir(documentDir);

			// Fast direct path check for candidate filenames across search dirs
			for (const dir of searchDirs) {
				for (const name of candidateNames) {
					try {
						const candidatePath = await join(dir, name);
						if (await exists(candidatePath)) {
							const data = await readFile(candidatePath);
							const ext = name.split(".").pop()?.toLowerCase() || "mp3";
							const file = new File([data], name, { type: getMimeType(ext) });
							(file as any).path = candidatePath;
							await audioEngine.loadMusic(file);
							if (!options.silent) {
								toast.info(
									i18n.t(
										"audio.autoReloaded",
										'Automatically loaded audio "{name}" from computer',
										{ name },
									),
								);
							}
							return true;
						}
					} catch {}
				}
			}

			// Limited fuzzy search in Music and Downloads directories only (up to 150 items each)
			const fuzzyDirs: string[] = [];
			try {
				const aDir = await audioDir();
				if (aDir) fuzzyDirs.push(aDir);
				const dlDir = await downloadDir();
				if (dlDir && !fuzzyDirs.includes(dlDir)) fuzzyDirs.push(dlDir);
			} catch {}

			for (const dir of fuzzyDirs) {
				try {
					const entries = await readDir(dir);
					let checkedCount = 0;
					for (const entry of entries) {
						if (++checkedCount > 150) break;
						if (!entry.name) continue;
						const entryNameLower = entry.name.toLowerCase();
						const ext = entry.name.split(".").pop()?.toLowerCase() || "";
						if (!AUDIO_EXTENSIONS.includes(ext)) continue;

						let matches = false;
						if (
							options.audioFileName &&
							entryNameLower === options.audioFileName.toLowerCase()
						) {
							matches = true;
						} else if (
							cleanTitle &&
							entryNameLower.includes(cleanTitle.toLowerCase())
						) {
							if (
								!cleanArtist ||
								entryNameLower.includes(cleanArtist.toLowerCase())
							) {
								matches = true;
							}
						}

						if (matches) {
							const matchedPath = await join(dir, entry.name);
							const data = await readFile(matchedPath);
							const file = new File([data], entry.name, {
								type: getMimeType(ext),
							});
							(file as any).path = matchedPath;
							await audioEngine.loadMusic(file);
							if (!options.silent) {
								toast.info(
									i18n.t(
										"audio.autoReloaded",
										'Automatically loaded audio "{name}" from computer',
										{ name: entry.name },
									),
								);
							}
							return true;
						}
					}
				} catch {}
			}
		} catch (tauriErr) {
			console.warn("Tauri audio search error:", tauriErr);
		}
	}

	// 2. Search local IndexedDB audio cache (works in both Web and Tauri)
	try {
		const cached = await getAudioFromCache(
			options.projectId,
			options.audioFileName || undefined,
		);
		if (cached?.blob && cached.blob.size > 0) {
			const fileName = cached.fileName || options.audioFileName || "audio";
			const ext = fileName.split(".").pop()?.toLowerCase() || "mp3";
			const file = new File([cached.blob], fileName, {
				type: cached.blob.type || getMimeType(ext),
			});
			if (cached.path) {
				(file as unknown as { path?: string }).path = cached.path;
			}
			if (cached.isAutoDownloaded) {
				(file as any).isAutoDownloaded = true;
			}
			await audioEngine.loadMusic(file, false, cached.isAutoDownloaded);
			if (!options.silent) {
				toast.info(
					i18n.t(
						"audio.autoReloaded",
						'Automatically loaded audio "{name}" from computer',
						{ name: fileName },
					),
				);
			}
			return true;
		}
	} catch (cacheErr) {
		console.warn("IndexedDB audio cache lookup error:", cacheErr);
	}

	return false;
}
