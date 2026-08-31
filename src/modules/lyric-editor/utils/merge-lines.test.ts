import { describe, expect, it } from "vitest";
import { mergeLyricLines } from "./merge-lines";
import type { LyricLine } from "$/types/ttml";

describe("mergeLyricLines", () => {
	it("returns null for empty array", () => {
		expect(mergeLyricLines([])).toBeNull();
	});

	it("returns identical copy for single line", () => {
		const line: LyricLine = {
			id: "line1",
			startTime: 1000,
			endTime: 2000,
			words: [
				{
					id: "w1",
					startTime: 1000,
					endTime: 2000,
					word: "hello",
					obscene: false,
					emptyBeat: 0,
					romanWord: "",
				},
			],
			translatedLyric: "你好",
			romanLyric: "nihao",
			isBG: false,
			isDuet: false,
			ignoreSync: false,
		};
		const result = mergeLyricLines([line]);
		expect(result).not.toBeNull();
		expect(result?.words).toHaveLength(1);
		expect(result?.words[0].word).toBe("hello");
	});

	it("merges multiple lines preserving individual word timings and spanning line boundaries", () => {
		const line1: LyricLine = {
			id: "line1",
			startTime: 1000,
			endTime: 2500,
			words: [
				{
					id: "w1",
					startTime: 1000,
					endTime: 1500,
					word: "Never",
					obscene: false,
					emptyBeat: 0,
					romanWord: "",
				},
				{
					id: "w2",
					startTime: 1600,
					endTime: 2500,
					word: "gonna",
					obscene: false,
					emptyBeat: 0,
					romanWord: "",
				},
			],
			translatedLyric: "绝不",
			romanLyric: "",
			isBG: false,
			isDuet: false,
			ignoreSync: false,
		};

		const line2: LyricLine = {
			id: "line2",
			startTime: 2800,
			endTime: 4000,
			words: [
				{
					id: "w3",
					startTime: 2800,
					endTime: 3400,
					word: "give",
					obscene: false,
					emptyBeat: 0,
					romanWord: "",
				},
				{
					id: "w4",
					startTime: 3500,
					endTime: 4000,
					word: "up",
					obscene: false,
					emptyBeat: 0,
					romanWord: "",
				},
			],
			translatedLyric: "放弃",
			romanLyric: "",
			isBG: true,
			isDuet: false,
			ignoreSync: false,
		};

		const merged = mergeLyricLines([line1, line2]);
		expect(merged).not.toBeNull();
		expect(merged?.startTime).toBe(1000);
		expect(merged?.endTime).toBe(4000);
		expect(merged?.words).toHaveLength(4);
		expect(merged?.words[0].word).toBe("Never");
		expect(merged?.words[0].startTime).toBe(1000);
		expect(merged?.words[1].word).toBe("gonna");
		expect(merged?.words[1].startTime).toBe(1600);
		expect(merged?.words[2].word).toBe("give");
		expect(merged?.words[2].startTime).toBe(2800);
		expect(merged?.words[3].word).toBe("up");
		expect(merged?.words[3].endTime).toBe(4000);
		expect(merged?.translatedLyric).toBe("绝不 放弃");
		expect(merged?.isBG).toBe(true);
	});
});
