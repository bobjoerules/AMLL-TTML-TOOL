import { describe, expect, it } from "vitest";
import { newLyricWord, type LyricLine } from "$/types/ttml";
import { findOccupiedUnit } from "./lyric-states";

describe("findOccupiedUnit", () => {
	const createLine = (
		id: string,
		words: Array<{ word: string; start: number; end: number }>,
		ignoreSync = false,
	): LyricLine => ({
		id,
		startTime: words[0]?.start ?? 0,
		endTime: words[words.length - 1]?.end ?? 0,
		ignoreSync,
		words: words.map((w, idx) => ({
			...newLyricWord(),
			id: `${id}-w${idx}`,
			word: w.word,
			startTime: w.start,
			endTime: w.end,
		})),
	});

	it("finds the word unit occupying current playhead time", () => {
		const line = createLine("line-1", [
			{ word: "Hello", start: 1000, end: 2000 },
			{ word: "world", start: 2000, end: 3500 },
			{ word: "again", start: 3500, end: 5000 },
		]);
		const lines = [line];

		const occ = findOccupiedUnit(lines, 0, 2500);
		expect(occ).toBeDefined();
		expect(occ?.lineIndex).toBe(0);
		expect(occ?.wordIndex).toBe(1);
		expect(occ?.unit.word.word).toBe("world");
	});

	it("finds the word when playhead is at the exact end boundary", () => {
		const line = createLine("line-1", [
			{ word: "Hello", start: 1000, end: 2000 },
			{ word: "world", start: 2000, end: 3500 },
		]);
		const lines = [line];

		const occ = findOccupiedUnit(lines, 0, 2000);
		expect(occ).toBeDefined();
		expect(occ?.unit.word.word).toBe("Hello");
	});

	it("returns undefined when playhead is in an untimed gap or outside", () => {
		const line = createLine("line-1", [
			{ word: "Hello", start: 1000, end: 2000 },
			{ word: "world", start: 3000, end: 4000 },
		]);
		const lines = [line];

		expect(findOccupiedUnit(lines, 0, 500)).toBeUndefined();
		expect(findOccupiedUnit(lines, 0, 2500)).toBeUndefined();
		expect(findOccupiedUnit(lines, 0, 4500)).toBeUndefined();
	});

	it("prioritizes preferred line but falls back to other lines", () => {
		const line1 = createLine("line-1", [
			{ word: "First", start: 1000, end: 2000 },
		]);
		const line2 = createLine("line-2", [
			{ word: "Second", start: 3000, end: 4000 },
		]);
		const lines = [line1, line2];

		// Playhead is in line 2, but preferred is line 0
		const occ = findOccupiedUnit(lines, 0, 3500);
		expect(occ).toBeDefined();
		expect(occ?.lineIndex).toBe(1);
		expect(occ?.unit.word.word).toBe("Second");
	});

	it("skips lines with ignoreSync set to true", () => {
		const line1 = createLine(
			"line-1",
			[{ word: "Ignored", start: 1000, end: 2000 }],
			true,
		);
		const lines = [line1];

		expect(findOccupiedUnit(lines, 0, 1500)).toBeUndefined();
	});

	it("handles ruby words correctly", () => {
		const line: LyricLine = {
			id: "line-ruby",
			startTime: 1000,
			endTime: 3000,
			ignoreSync: false,
			words: [
				{
					...newLyricWord(),
					id: "w-ruby",
					word: "Kanji",
					startTime: 1000,
					endTime: 3000,
					ruby: [
						{ word: "Kan", startTime: 1000, endTime: 2000 },
						{ word: "ji", startTime: 2000, endTime: 3000 },
					],
				},
			],
		};
		const lines = [line];

		const occ1 = findOccupiedUnit(lines, 0, 1500);
		expect(occ1).toBeDefined();
		expect(occ1?.rubyIndex).toBe(0);
		expect(occ1?.unit.rubyWord?.word).toBe("Kan");

		const occ2 = findOccupiedUnit(lines, 0, 2500);
		expect(occ2).toBeDefined();
		expect(occ2?.rubyIndex).toBe(1);
		expect(occ2?.unit.rubyWord?.word).toBe("ji");
	});
});
