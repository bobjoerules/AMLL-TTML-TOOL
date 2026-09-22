import { describe, expect, it } from "vitest";
import { newLyricWord, type LyricLine } from "$/types/ttml";
import { maybeAutoSegmentLine } from "./auto-segment-sync";

describe("maybeAutoSegmentLine", () => {
	const createSingleWordLine = (text: string, startTime = 1000, endTime = 3000): LyricLine => ({
		id: "line-1",
		startTime,
		endTime,
		words: [
			{
				...newLyricWord(),
				id: "word-1",
				word: text,
				startTime,
				endTime,
			},
		],
	});

	it("returns original line if enabled is false", () => {
		const line = createSingleWordLine("Never gonna give you up");
		const result = maybeAutoSegmentLine(line, { enabled: false, mode: "word" });
		expect(result).toBe(line);
		expect(result.words.length).toBe(1);
	});

	it("returns original line if line already has multiple words", () => {
		const line: LyricLine = {
			id: "line-1",
			startTime: 1000,
			endTime: 3000,
			words: [
				{ ...newLyricWord(), id: "w1", word: "Never", startTime: 1000, endTime: 2000 },
				{ ...newLyricWord(), id: "w2", word: "gonna", startTime: 2000, endTime: 3000 },
			],
		};
		const result = maybeAutoSegmentLine(line, { enabled: true, mode: "word" });
		expect(result).toBe(line);
		expect(result.words.length).toBe(2);
	});

	it("returns original line if word is not timed", () => {
		const line = createSingleWordLine("Never gonna give you up", 0, 0);
		const result = maybeAutoSegmentLine(line, { enabled: true, mode: "word" });
		expect(result).toBe(line);
	});

	it("auto-segments timed English line by word when mode is 'word'", () => {
		const line = createSingleWordLine("Never gonna give you up", 1000, 3500);
		const result = maybeAutoSegmentLine(line, { enabled: true, mode: "word" });

		expect(result.words.length).toBeGreaterThan(1);
		// Words should be separated and span the entire duration
		expect(result.words[0].startTime).toBe(1000);
		expect(result.words[result.words.length - 1].endTime).toBe(3500);
		// Check that text combines back to original line
		const combined = result.words.map((w) => w.word).join("");
		expect(combined.trim()).toBe("Never gonna give you up");
	});

	it("auto-segments timed English line by syllable when mode is 'syllable'", () => {
		const line = createSingleWordLine("Never gonna", 1000, 3000);
		const result = maybeAutoSegmentLine(line, { enabled: true, mode: "syllable" });

		expect(result.words.length).toBeGreaterThan(2); // "Never gonna" has at least 4 syllables
		expect(result.words[0].startTime).toBe(1000);
		expect(result.words[result.words.length - 1].endTime).toBe(3000);
	});

	it("auto-segments timed CJK line", () => {
		const line = createSingleWordLine("你好世界", 500, 2500);
		const result = maybeAutoSegmentLine(line, { enabled: true, mode: "word" });

		expect(result.words.length).toBe(4);
		expect(result.words[0].startTime).toBe(500);
		expect(result.words[3].endTime).toBe(2500);
		expect(result.words.map((w) => w.word)).toEqual(["你", "好", "世", "界"]);
	});
});
