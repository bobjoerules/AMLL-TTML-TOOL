import type { LyricLine, LyricWord } from "$/types/ttml";

/**
 * Merges two or more LyricLines into a single LyricLine while keeping all word timings intact.
 * - Words from all source lines are concatenated in order.
 * - Every word keeps its own exact startTime, endTime, word, romanWord, etc.
 * - The merged line's startTime becomes the minimum start time (or earliest word start time).
 * - The merged line's endTime becomes the maximum end time (or latest word end time).
 * - Translations and romanizations are combined cleanly.
 * - Background/duet flags are preserved if set in any line.
 */
export function mergeLyricLines(lines: LyricLine[]): LyricLine | null {
	if (!lines || lines.length === 0) return null;
	if (lines.length === 1) return { ...lines[0], words: [...lines[0].words] };

	const firstLine = lines[0];
	const allWords: LyricWord[] = lines.flatMap((line) =>
		line.words.map((w) => ({ ...w })),
	);

	// Calculate start time
	const lineStartTimes = lines.map((l) => l.startTime).filter((t) => t > 0);
	const wordStartTimes = allWords.map((w) => w.startTime).filter((t) => t > 0);
	let startTime = firstLine.startTime;
	if (lineStartTimes.length > 0) {
		startTime = Math.min(...lineStartTimes);
	}
	if (wordStartTimes.length > 0) {
		startTime =
			startTime > 0
				? Math.min(startTime, ...wordStartTimes)
				: Math.min(...wordStartTimes);
	}

	// Calculate end time
	const lineEndTimes = lines.map((l) => l.endTime).filter((t) => t > 0);
	const wordEndTimes = allWords.map((w) => w.endTime).filter((t) => t > 0);
	let endTime = lines[lines.length - 1].endTime;
	if (lineEndTimes.length > 0) {
		endTime = Math.max(...lineEndTimes);
	}
	if (wordEndTimes.length > 0) {
		endTime = Math.max(endTime, ...wordEndTimes);
	}

	// Combine translations and romanizations if present
	const translatedLyrics = lines
		.map((l) => l.translatedLyric?.trim())
		.filter(Boolean);
	const romanLyrics = lines.map((l) => l.romanLyric?.trim()).filter(Boolean);

	return {
		...firstLine,
		words: allWords,
		startTime: startTime || 0,
		endTime: endTime || 0,
		translatedLyric: translatedLyrics.join(" "),
		romanLyric: romanLyrics.join(" "),
		isBG: lines.some((l) => l.isBG),
		isDuet: lines.some((l) => l.isDuet),
		ignoreSync: lines.every((l) => l.ignoreSync),
	};
}
