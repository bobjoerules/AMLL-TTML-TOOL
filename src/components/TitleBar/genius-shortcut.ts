import type { TTMLMetadata } from "$/types/ttml";

export interface SongLoadCheckParams {
	metadata: TTMLMetadata[];
	lyricLinesCount: number;
	loadedAudioFileName?: string | null;
	saveFileName?: string | null;
}

export interface GeniusTargetResolutionParams {
	metadata: TTMLMetadata[];
	loadedAudioFileName?: string | null;
	saveFileName?: string | null;
}

/**
 * Checks if a string is a valid Genius song page or album page URL,
 * explicitly excluding cover artwork images, static assets, and dev portals.
 */
export function isGeniusSongPageUrl(val: string): boolean {
	if (!val || typeof val !== "string") return false;
	const trimmed = val.trim();

	// Explicitly reject image domains, CDN assets, and image file extensions
	if (
		/images\.genius\.com/i.test(trimmed) ||
		/assets\.genius\.com/i.test(trimmed) ||
		/\.(jpg|jpeg|png|webp|gif|svg|avif)(\?.*)?$/i.test(trimmed)
	) {
		return false;
	}

	// Reject non-song paths like api-clients, tags, about, static
	if (
		/https?:\/\/(?:[a-zA-Z0-9-]+\.)?genius\.com\/(api-clients|tags|about|static)\b/i.test(
			trimmed,
		)
	) {
		return false;
	}

	// Must be on genius.com domain or genius:// protocol
	if (
		!/^(https?:\/\/)?([a-zA-Z0-9-]+\.)?genius\.com\//i.test(trimmed) &&
		!/^genius:\/\//i.test(trimmed)
	) {
		return false;
	}

	return true;
}

/**
 * Searches metadata for a direct song or album page URL on Genius,
 * ignoring cover art, thumbnail, and image metadata entries.
 */
export function findDirectGeniusPageUrl(
	metadata?: TTMLMetadata[],
): string | null {
	if (!metadata || !Array.isArray(metadata)) return null;

	for (const m of metadata) {
		const key = m.key?.toLowerCase();
		// Skip cover art / image metadata
		if (
			key === "cover_art" ||
			key === "cover" ||
			key === "artwork" ||
			key === "image" ||
			key === "album_art"
		) {
			continue;
		}

		if (Array.isArray(m.value)) {
			for (const v of m.value) {
				if (typeof v === "string" && isGeniusSongPageUrl(v)) {
					let url = v.trim();
					if (!/^https?:\/\//i.test(url)) {
						url = `https://${url}`;
					}
					return url;
				}
			}
		}
	}

	return null;
}

export function getIsSongLoaded(params: SongLoadCheckParams): boolean {
	if (params.lyricLinesCount > 0) return true;
	if (params.loadedAudioFileName) return true;

	const hasTitle = !!params.metadata?.find((m) => {
		const key = m.key?.toLowerCase();
		return key === "musicname" || key === "title" || key === "trackname";
	})?.value?.[0]?.trim();

	const hasArtist = !!params.metadata?.find((m) => {
		const key = m.key?.toLowerCase();
		return key === "artists" || key === "artist" || key === "author";
	})?.value?.[0]?.trim();

	if (hasTitle || hasArtist) return true;

	const hasGeniusSongUrl = !!findDirectGeniusPageUrl(params.metadata);
	if (hasGeniusSongUrl) return true;

	if (
		params.saveFileName &&
		params.saveFileName !== "lyric.ttml" &&
		params.saveFileName !== "untitled.ttml"
	) {
		return true;
	}

	return false;
}

export function resolveGeniusTargetUrl(
	params: GeniusTargetResolutionParams,
): string {
	const directUrl = findDirectGeniusPageUrl(params.metadata);
	if (directUrl) {
		return directUrl;
	}

	const titleMeta = params.metadata?.find((m) => {
		const key = m.key?.toLowerCase();
		return key === "musicname" || key === "title" || key === "trackname";
	});
	const artistMeta = params.metadata?.find((m) => {
		const key = m.key?.toLowerCase();
		return key === "artists" || key === "artist" || key === "author";
	});

	let title = titleMeta?.value?.[0]?.trim() || "";
	let artist = artistMeta?.value?.[0]?.trim() || "";

	if (!title && !artist) {
		const candidateFileName =
			params.saveFileName &&
			params.saveFileName !== "lyric.ttml" &&
			params.saveFileName !== "untitled.ttml"
				? params.saveFileName
				: params.loadedAudioFileName || "";

		const baseFileName = candidateFileName
			.replace(/\.(ttml|lrc|txt|mp3|flac|wav|m4a|ogg|opus|aac)$/i, "")
			.trim();

		if (baseFileName) {
			if (baseFileName.includes(" - ")) {
				const parts = baseFileName.split(" - ");
				artist = parts[0]?.trim() || "";
				title = parts.slice(1).join(" - ")?.trim() || "";
			} else {
				title = baseFileName;
			}
		}
	}

	if (title || artist) {
		const query = artist && title ? `${artist} ${title}` : title || artist;
		return `https://genius.com/search?q=${encodeURIComponent(query)}`;
	}

	return "https://genius.com";
}
