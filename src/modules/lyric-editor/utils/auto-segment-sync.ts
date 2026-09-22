import type { LyricLine } from "$/types/ttml";
import type { AutoSegmentSyncMode } from "$/modules/settings/states/sync";
import type { SegmentationConfig } from "$/modules/segmentation/types";
import { segmentLyricLines } from "$/modules/segmentation/utils/segmentation";

export interface AutoSegmentSyncOptions {
	enabled: boolean;
	mode: AutoSegmentSyncMode;
	segmentationConfig?: Partial<SegmentationConfig>;
}

/**
 * Checks if a lyric line consists of a single word box that has been timed out,
 * and if enabled, splits it into words or syllables with distributed timestamps.
 */
export function maybeAutoSegmentLine(
	line: LyricLine,
	options: AutoSegmentSyncOptions,
): LyricLine {
	if (!options.enabled) return line;
	if (line.words.length !== 1) return line;

	const word = line.words[0];
	if (!word || !word.word || word.word.trim().length === 0) return line;

	// Must be timed (positive duration or non-zero timestamps)
	if (word.endTime <= word.startTime && word.startTime === 0) {
		return line;
	}

	const config: SegmentationConfig = {
		engine: options.segmentationConfig?.engine ?? "prosodic",
		splitCJK: options.segmentationConfig?.splitCJK ?? true,
		splitEnglish: options.mode === "syllable",
		punctuationMode: options.segmentationConfig?.punctuationMode ?? "merge",
		punctuationWeight: options.segmentationConfig?.punctuationWeight ?? 0.2,
		removeEmptySegments:
			options.segmentationConfig?.removeEmptySegments ?? true,
		ignoreList: options.segmentationConfig?.ignoreList ?? new Set(),
		customRules: options.segmentationConfig?.customRules ?? new Map(),
		learnedRules: options.segmentationConfig?.learnedRules ?? new Map(),
		hyphenator: options.segmentationConfig?.hyphenator,
	};

	const [segmentedLine] = segmentLyricLines([line], config);
	if (segmentedLine && segmentedLine.words.length > 1) {
		return segmentedLine;
	}

	return line;
}
