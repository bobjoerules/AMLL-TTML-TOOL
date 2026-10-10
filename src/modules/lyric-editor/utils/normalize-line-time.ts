import type { LyricLine, LyricWord } from "$/types/ttml";

export function getWordEndTime(word: LyricWord): number {
	let maxEnd = word.endTime || 0;
	if (word.ruby && word.ruby.length > 0) {
		for (const r of word.ruby) {
			if (r.endTime > maxEnd) maxEnd = r.endTime;
		}
	}
	return maxEnd;
}

export function getWordStartTime(word: LyricWord): number {
	let minStart = word.startTime || 0;
	if (word.ruby && word.ruby.length > 0) {
		for (const r of word.ruby) {
			if (r.startTime > 0 && (minStart === 0 || r.startTime < minStart)) {
				minStart = r.startTime;
			}
		}
	}
	return minStart;
}

export function isWordSynced(word: LyricWord): boolean {
	const end = getWordEndTime(word);
	const start = getWordStartTime(word);
	return end > 0 && (start === 0 || end >= start);
}

/**
 * Normalizes line start and end times based on its child words:
 * - Line start time matches the first word with a valid start time (> 0).
 * - Line end time always matches the last synced word (word with valid end time >= start time).
 */
export function normalizeLineTime(line: LyricLine) {
	if (!line.words || line.words.length === 0) return;

	// Find the last synced word
	let lastSyncedEnd = 0;
	for (let i = line.words.length - 1; i >= 0; i--) {
		if (isWordSynced(line.words[i])) {
			lastSyncedEnd = getWordEndTime(line.words[i]);
			break;
		}
	}

	// Find the first word with a valid start time
	let firstSyncedStart = 0;
	for (let i = 0; i < line.words.length; i++) {
		const start = getWordStartTime(line.words[i]);
		if (start > 0) {
			firstSyncedStart = start;
			break;
		}
	}

	if (firstSyncedStart > 0) {
		line.startTime = firstSyncedStart;
	}
	if (lastSyncedEnd > 0) {
		line.endTime = lastSyncedEnd;
	}
}

