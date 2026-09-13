import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord, type TTMLLyric } from "$/types/ttml";
import {
	buildSearchRegex,
	escapeRegex,
	findMatches,
	replaceAllMatches,
	replaceCurrentMatch,
} from "./find-replace";

const createMockLyrics = (): TTMLLyric => ({
	metadata: [],
	sections: [],
	marks: [],
	lyricLines: [
		{
			...newLyricLine(),
			id: "line-1",
			translatedLyric: "Hello World in French",
			romanLyric: "Ni Hao World",
			words: [
				{
					...newLyricWord(),
					id: "w1",
					word: "Hello ",
					startTime: 1000,
					endTime: 1500,
					romanWord: "Ni ",
				},
				{
					...newLyricWord(),
					id: "w2",
					word: "world!",
					startTime: 1500,
					endTime: 2000,
					romanWord: "Hao!",
				},
			],
		},
		{
			...newLyricLine(),
			id: "line-2",
			translatedLyric: "Another day",
			words: [
				{
					...newLyricWord(),
					id: "w3",
					word: "hello",
					startTime: 2500,
					endTime: 3000,
				},
				{
					...newLyricWord(),
					id: "w4",
					word: "again",
					startTime: 3000,
					endTime: 3500,
				},
			],
		},
	],
});

describe("find-replace utility engine", () => {
	it("escapes regex characters properly", () => {
		expect(escapeRegex("Hello (World) [123] * ? . ^ $")).toBe(
			"Hello \\(World\\) \\[123\\] \\* \\? \\. \\^ \\$",
		);
	});

	it("builds valid search regex with case sensitivity and whole word flags", () => {
		const insensitive = buildSearchRegex({ query: "test", matchCase: false });
		expect(insensitive?.test("TEST")).toBe(true);

		const sensitive = buildSearchRegex({ query: "test", matchCase: true });
		expect(sensitive?.test("TEST")).toBe(false);
		expect(sensitive?.test("test")).toBe(true);

		const wholeWord1 = buildSearchRegex({ query: "cat", wholeWord: true });
		expect(wholeWord1?.test("caterpillar")).toBe(false);
		const wholeWord2 = buildSearchRegex({ query: "cat", wholeWord: true });
		expect(wholeWord2?.test("the cat sat")).toBe(true);
		const wholeWord3 = buildSearchRegex({ query: "cat", wholeWord: true });
		expect(wholeWord3?.test("cat,")).toBe(true);

		const invalidRegex = buildSearchRegex({
			query: "[unclosed",
			useRegex: true,
		});
		expect(invalidRegex).toBeNull();
	});

	it("finds matches across words and lines", () => {
		const lyrics = createMockLyrics();
		const matches = findMatches(lyrics, { query: "hello", matchCase: false });

		expect(matches.length).toBe(3); // w1 ("Hello "), line-1 translation ("Hello World"), w3 ("hello")
		expect(matches[0].wordId).toBe("w1");
		expect(matches[0].lineIndex).toBe(0);
		expect(matches[0].target).toBe("word");

		expect(matches[1].target).toBe("translation");
		expect(matches[2].wordId).toBe("w3");
		expect(matches[2].lineIndex).toBe(1);
	});

	it("filters searches by scope", () => {
		const lyrics = createMockLyrics();

		const lyricOnly = findMatches(lyrics, {
			query: "hello",
			matchCase: false,
			scope: "lyrics",
		});
		expect(lyricOnly.every((m) => m.target === "word")).toBe(true);
		expect(lyricOnly.length).toBe(2);

		const transOnly = findMatches(lyrics, {
			query: "hello",
			matchCase: false,
			scope: "translations",
		});
		expect(transOnly.every((m) => m.target === "translation")).toBe(true);
		expect(transOnly.length).toBe(1);

		const romanOnly = findMatches(lyrics, {
			query: "world",
			matchCase: false,
			scope: "romanizations",
		});
		expect(romanOnly.length).toBe(1);
		expect(romanOnly[0].target).toBe("romanLine");
	});

	it("replaces a single match while preserving timing and other words", () => {
		const lyrics = createMockLyrics();
		const matches = findMatches(lyrics, { query: "hello", matchCase: false });
		expect(matches.length).toBeGreaterThan(0);

		const firstMatch = matches[0];
		const { nextLyrics, modified } = replaceCurrentMatch(
			lyrics,
			firstMatch,
			"Hi",
		);

		expect(modified).toBe(true);
		expect(nextLyrics.lyricLines[0].words[0].word).toBe("Hi ");
		expect(nextLyrics.lyricLines[0].words[0].startTime).toBe(1000);
		expect(nextLyrics.lyricLines[0].words[0].endTime).toBe(1500);
		// second word untouched
		expect(nextLyrics.lyricLines[0].words[1].word).toBe("world!");
		// other lines untouched
		expect(nextLyrics.lyricLines[1].words[0].word).toBe("hello");
	});

	it("replaces all occurrences accurately across scopes", () => {
		const lyrics = createMockLyrics();
		const { nextLyrics, replacedCount, linesAffected } = replaceAllMatches(
			lyrics,
			{
				query: "hello",
				replacement: "Greetings",
				matchCase: false,
				scope: "all",
			},
		);

		expect(replacedCount).toBe(3);
		expect(linesAffected).toBe(2);
		expect(nextLyrics.lyricLines[0].words[0].word).toBe("Greetings ");
		expect(nextLyrics.lyricLines[0].translatedLyric).toBe(
			"Greetings World in French",
		);
		expect(nextLyrics.lyricLines[1].words[0].word).toBe("Greetings");
	});

	it("supports regex replacement with capture groups", () => {
		const lyrics = createMockLyrics();
		const { nextLyrics, replacedCount } = replaceAllMatches(lyrics, {
			query: "(world)!",
			replacement: "$1?",
			useRegex: true,
			scope: "lyrics",
		});

		expect(replacedCount).toBe(1);
		expect(nextLyrics.lyricLines[0].words[1].word).toBe("world?");
	});
});
