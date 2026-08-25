import { atom } from "jotai";
import { lyricLinesAtom } from "$/states/main.ts";
import type { LyricLine, LyricWord } from "$/types/ttml";

export interface WordSegment extends LyricWord {
	type: "word";
	isRuby?: boolean;
	parentId?: string;
	rubyIndex?: number;
}

export interface GapSegment {
	type: "gap";
	id: string;
	startTime: number;
	endTime: number;
}

export type ProcessedSegment = WordSegment | GapSegment;

export interface ProcessedLyricLine extends Omit<LyricLine, "words"> {
	segments: ProcessedSegment[];
}

export function processSingleLine(line: LyricLine): ProcessedLyricLine {
	const segments: ProcessedSegment[] = [];

	const rawWordSegments: WordSegment[] = line.words.flatMap(
		(word): WordSegment[] => {
			if (word.ruby && word.ruby.length > 0) {
				return word.ruby.map((rubyWord, index) => ({
					type: "word" as const,
					id: `${word.id}-ruby-${index}`,
					word: rubyWord.word,
					startTime: rubyWord.startTime,
					endTime: rubyWord.endTime,
					obscene: word.obscene,
					emptyBeat: word.emptyBeat,
					romanWord: "",
					isRuby: true,
					parentId: word.id,
					rubyIndex: index,
				}));
			}
			return [
				{
					...word,
					type: "word" as const,
				},
			];
		},
	);

	const validWords = rawWordSegments
		.filter((w) => w.endTime > w.startTime)
		.sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime);

	const effectiveStart =
		line.startTime > 0
			? line.startTime
			: (validWords[0]?.startTime ?? line.startTime ?? 0);
	const effectiveEnd =
		line.endTime > effectiveStart
			? line.endTime
			: (validWords[validWords.length - 1]?.endTime ??
				(effectiveStart > 0 ? effectiveStart : line.endTime ?? 0));

	let cursor = effectiveStart;

	for (const word of validWords) {
		if (word.startTime > cursor) {
			segments.push({
				type: "gap",
				id: `${line.id}-gap-${cursor}`,
				startTime: cursor,
				endTime: word.startTime,
			});
		}

		segments.push({ ...word, type: "word" });

		cursor = Math.max(cursor, word.endTime);
	}

	if (effectiveEnd > cursor) {
		segments.push({
			type: "gap",
			id: `${line.id}-gap-end`,
			startTime: cursor,
			endTime: effectiveEnd,
		});
	}

	return {
		...line,
		startTime: effectiveStart,
		endTime: effectiveEnd,
		segments: segments,
	};
}

function createProcessedLyricLines(
	dirtyLines: LyricLine[],
): ProcessedLyricLine[] {
	return dirtyLines.map(processSingleLine);
}

export const processedLyricLinesAtom = atom<ProcessedLyricLine[]>((get) => {
	const { lyricLines } = get(lyricLinesAtom);
	if (!lyricLines) return [];
	return createProcessedLyricLines(lyricLines);
});
