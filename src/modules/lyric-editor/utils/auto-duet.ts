import type { LyricLine, LyricSection, TTMLLyric } from "$/types/ttml";
import { normalizeSectionHeader } from "./section-system";

/**
 * When a section or vocalist field contains multiple singers (e.g. "Raveena & JPEGMAFIA"),
 * extracts the first vocalist for auto-duet singer assignment.
 */
export function extractFirstSinger(singer?: string): string | undefined {
	if (!singer) return undefined;
	const trimmed = singer.trim();
	if (!trimmed) return undefined;

	// Remove parenthetical featuring/with expressions:
	// e.g. "Raveena (feat. JPEGMAFIA)" -> "Raveena"
	const withoutParenFeat = trimmed
		.replace(/\s*\((?:feat\.?|ft\.?|with)\s+[^)]+\)/gi, "")
		.trim();

	// Split by separators: &, +, "and", "with", "feat.", "ft.", comma, or slash with surrounding spaces
	const parts = withoutParenFeat.split(
		/\s*(?:&|\+)\s*|\s+(?:and|with|feat\.?|ft\.?)\s+|\s*,\s*|\s+\/\s*/i,
	);

	const first = parts[0]?.trim();
	return first || withoutParenFeat || trimmed;
}

/**
 * Resolves the effective singer name for a lyric line based on section vocalist
 * (or section label / agent), extracting the first person if multiple singers are listed.
 */
export function getLineSinger(
	line: LyricLine,
	sectionMap: Map<string, LyricSection>,
): string | undefined {
	let rawSinger: string | undefined;
	if (line.sectionId && sectionMap.has(line.sectionId)) {
		const section = sectionMap.get(line.sectionId)!;
		rawSinger = section.vocalist?.trim();
		if (!rawSinger && section.label) {
			const parsed = normalizeSectionHeader(section.label);
			rawSinger = parsed?.vocalist?.trim();
		}
	}
	if (!rawSinger && line.agent) {
		rawSinger = line.agent.trim();
	}
	return extractFirstSinger(rawSinger);
}

export type AutoDuetResult =
	| {
			modifiedCount: number;
			singersCount: number;
	  }
	| {
			error: "not_enough_singers";
	  };

/**
 * Applies auto-duet assignment to the lyrics draft.
 * Vocalists are resolved per line using the first singer if multiple singers are listed.
 * The primary singer (first encountered in the song) gets isDuet = false,
 * and secondary/guest singers get isDuet = true.
 */
export function applyAutoDuetBySinger(draft: TTMLLyric): AutoDuetResult {
	const sectionMap = new Map((draft.sections ?? []).map((s) => [s.id, s]));

	const singers: string[] = [];
	const lineSingers: (string | undefined)[] = [];

	for (const line of draft.lyricLines) {
		const singer = getLineSinger(line, sectionMap);
		lineSingers.push(singer);
		if (
			singer &&
			!singers.some((s) => s.toLowerCase() === singer.toLowerCase())
		) {
			singers.push(singer);
		}
	}

	if (singers.length < 2) {
		return { error: "not_enough_singers" };
	}

	const primarySinger = singers[0].toLowerCase();
	let modifiedCount = 0;

	for (let i = 0; i < draft.lyricLines.length; i++) {
		const singer = lineSingers[i];
		if (!singer) continue;
		const isSecondary = singer.toLowerCase() !== primarySinger;
		if (draft.lyricLines[i].isDuet !== isSecondary) {
			draft.lyricLines[i].isDuet = isSecondary;
			modifiedCount++;
		}
	}

	return { modifiedCount, singersCount: singers.length };
}
