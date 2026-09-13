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
		const trimmedAgent = line.agent.trim();
		if (!/^v?\d+$/i.test(trimmedAgent)) {
			rawSinger = trimmedAgent;
		}
	}
	return extractFirstSinger(rawSinger);
}

export type AutoDuetResult =
	| {
			modifiedCount: number;
			singersCount: number;
			singerMap: Record<string, string>;
	  }
	| {
			error: "not_enough_singers";
	  };

/**
 * Applies auto-duet assignment to the lyrics draft.
 * Vocalists are resolved per line using the first singer if multiple singers are listed.
 * Vocalists are assigned sequential voices (v1, v2, v3, ... v1000) in order of appearance:
 * - 1st singer -> v1 (isDuet = false)
 * - 2nd singer -> v2 (isDuet = true)
 * - 3rd singer -> v3 (isDuet = true)
 * - ... up to v1000.
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

	// Create singer to voice mapping (v1, v2, v3, ... v1000)
	const singerMap: Record<string, string> = {};
	singers.forEach((singer, idx) => {
		const voiceNum = Math.min(1000, idx + 1);
		singerMap[singer] = `v${voiceNum}`;
	});

	let modifiedCount = 0;

	for (let i = 0; i < draft.lyricLines.length; i++) {
		const singer = lineSingers[i];
		if (!singer) continue;
		const singerKey = singers.find(
			(s) => s.toLowerCase() === singer.toLowerCase(),
		);
		if (!singerKey) continue;
		const assignedVoice = singerMap[singerKey] || "v1";
		const isDuet = assignedVoice !== "v1";

		let changed = false;
		if (draft.lyricLines[i].agent !== assignedVoice) {
			draft.lyricLines[i].agent = assignedVoice;
			changed = true;
		}
		if (draft.lyricLines[i].isDuet !== isDuet) {
			draft.lyricLines[i].isDuet = isDuet;
			changed = true;
		}
		if (changed) {
			modifiedCount++;
		}
	}

	return { modifiedCount, singersCount: singers.length, singerMap };
}
