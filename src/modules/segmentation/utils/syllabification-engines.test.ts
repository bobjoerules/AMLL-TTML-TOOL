import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import type { SegmentationConfig } from "../types";
import { loadHyphenator } from "./hyphen-loader";
import {
	recombineSplitWords,
	segmentLyricLines,
	segmentWord,
} from "./segmentation";
import {
	getSyllabificationEngine,
	splitJapaneseText,
} from "./syllabification-engines";

const prosodicConfig: SegmentationConfig = {
	engine: "prosodic",
	splitCJK: true,
	splitEnglish: true,
	punctuationWeight: 0.2,
	punctuationMode: "merge",
	removeEmptySegments: true,
	ignoreList: new Set(),
	customRules: new Map(),
	learnedRules: new Map(),
};

describe("syllabification engines", () => {
	it("uses Prosodic dictionary entries before its speech fallback", () => {
		const parts = getSyllabificationEngine("prosodic").split("everything");
		expect(parts.join("")).toBe("everything");
		expect(parts.length).toBeGreaterThan(1);
	});

	it("handles dropped-g lyric spellings", () => {
		const parts = getSyllabificationEngine("prosodic").split("singin");
		expect(parts.join("")).toBe("singin");
		expect(parts.length).toBeGreaterThan(1);
	});

	it("keeps contractions with typographic apostrophes together", () => {
		for (const contraction of ["we’re", "you’ve", "they’re"]) {
			const word = { ...newLyricWord(), word: contraction };
			expect(
				segmentWord(word, prosodicConfig).map((part) => part.word),
			).toEqual([contraction]);
		}
	});

	it("never splits 'oh' or similar interjections", () => {
		for (const interjection of ["oh", "Oh", "OH", "ooh", "whoa", "yeah"]) {
			const word = { ...newLyricWord(), word: interjection };
			expect(
				segmentWord(word, prosodicConfig).map((part) => part.word),
			).toEqual([interjection]);
			expect(getSyllabificationEngine("prosodic").split(interjection)).toEqual([
				interjection,
			]);
		}
	});

	it("keeps basic and none engines unsplit", () => {
		expect(getSyllabificationEngine("basic").split("beautiful")).toEqual([
			"beautiful",
		]);
		expect(getSyllabificationEngine("none").split("beautiful")).toEqual([
			"beautiful",
		]);
	});

	it("keeps Japanese modifiers and punctuation with their mora", () => {
		expect(splitJapaneseText("キャット。")).toEqual(["キャ", "ッ", "ト。"]);
	});

	it.each([
		["silabas", "corazón"],
		["syllabify-fr", "bonjour"],
		["syllabify", "привет"],
	] as const)("preserves text with the %s engine", (engine, word) => {
		const parts = getSyllabificationEngine(engine).split(word);
		expect(parts.join("")).toBe(word);
	});

	it("splits compound words with consonant codas correctly with the enhanced engine", () => {
		const engine = getSyllabificationEngine("enhanced");
		expect(engine.split("blindfold")).toEqual(["blind", "fold"]);
		expect(engine.split("blindfolded")).toEqual(["blind", "fold", "ed"]);
		expect(engine.split("headlights")).toEqual(["head", "lights"]);
		expect(engine.split("headlight")).toEqual(["head", "light"]);
		expect(engine.split("headline")).toEqual(["head", "line"]);
		expect(engine.split("soundtrack")).toEqual(["sound", "track"]);
		expect(engine.split("landlord")).toEqual(["land", "lord"]);
		expect(engine.split("windmill")).toEqual(["wind", "mill"]);
		expect(engine.split("goldfish")).toEqual(["gold", "fish"]);

		const wordBlindfold = { ...newLyricWord(), word: "blindfold" };
		expect(
			segmentWord(wordBlindfold, {
				...prosodicConfig,
				engine: "enhanced",
			}).map((part) => part.word),
		).toEqual(["blind", "fold"]);
	});

	it("splits singing syllables accurately using the spicy-lyrics (TTML Review) engine", () => {
		const engine = getSyllabificationEngine("spicy-lyrics");
		expect(engine.split("never")).toEqual(["ne", "ver"]);
		expect(engine.split("running")).toEqual(["run", "ning"]);
		expect(engine.split("singing")).toEqual(["sing", "ing"]);
		expect(engine.split("doctor")).toEqual(["doc", "tor"]);
		expect(engine.split("monster")).toEqual(["mon", "ster"]);
		expect(engine.split("candle")).toEqual(["can", "dle"]);
		expect(engine.split("water")).toEqual(["wa", "ter"]);
		expect(engine.split("music")).toEqual(["mu", "sic"]);
		expect(engine.split("baby")).toEqual(["ba", "by"]);
		expect(engine.split("fire")).toEqual(["fire"]);
		expect(engine.split("diamond")).toEqual(["di", "a", "mond"]);
		expect(engine.split("radio")).toEqual(["ra", "di", "o"]);
		expect(engine.split("together")).toEqual(["to", "ge", "ther"]);
	});

	it("restores prosodic engine to pre-v3.2.0 dictionary and speech fallback behavior", () => {
		const engine = getSyllabificationEngine("prosodic");
		expect(engine.split("never")).toEqual(["ne", "ver"]);
		expect(engine.split("water")).toEqual(["wa", "ter"]);
		expect(engine.split("baby")).toEqual(["ba", "by"]);
		expect(engine.split("running")).toEqual(["run", "ning"]);
		expect(engine.split("together")).toEqual(["to", "ge", "ther"]);
	});

	it("loads Polish hyphenation patterns", async () => {
		const hyphenate = await loadHyphenator("pl");
		expect(hyphenate?.("przepraszam").split("\u00ad")).toEqual([
			"prze",
			"pra",
			"szam",
		]);
	});

	it("accurately splits common lyric words with the enhanced engine", () => {
		const engine = getSyllabificationEngine("enhanced");
		expect(engine.split("forever")).toEqual(["for", "ev", "er"]);
		expect(engine.split("water")).toEqual(["wa", "ter"]);
		expect(engine.split("river")).toEqual(["riv", "er"]);
		expect(engine.split("maybe")).toEqual(["may", "be"]);
		expect(engine.split("baby")).toEqual(["ba", "by"]);
		expect(engine.split("crazy")).toEqual(["cra", "zy"]);
		expect(engine.split("music")).toEqual(["mu", "sic"]);
		expect(engine.split("brother")).toEqual(["broth", "er"]);
		expect(engine.split("mother")).toEqual(["moth", "er"]);
		expect(engine.split("father")).toEqual(["fa", "ther"]);
		expect(engine.split("sister")).toEqual(["sis", "ter"]);
		expect(engine.split("different")).toEqual(["dif", "fer", "ent"]);

		// Gerunds & participles
		expect(engine.split("saying")).toEqual(["say", "ing"]);
		expect(engine.split("crying")).toEqual(["cry", "ing"]);
		expect(engine.split("trying")).toEqual(["try", "ing"]);
		expect(engine.split("flying")).toEqual(["fly", "ing"]);
		expect(engine.split("playing")).toEqual(["play", "ing"]);
		expect(engine.split("praying")).toEqual(["pray", "ing"]);
		expect(engine.split("falling")).toEqual(["fall", "ing"]);
		expect(engine.split("singing")).toEqual(["sing", "ing"]);
		expect(engine.split("screaming")).toEqual(["scream", "ing"]);
		expect(engine.split("breathing")).toEqual(["breath", "ing"]);
		expect(engine.split("laughing")).toEqual(["laugh", "ing"]);

		// Compound words & morphemes
		expect(engine.split("takeoff")).toEqual(["take", "off"]);
		expect(engine.split("without")).toEqual(["with", "out"]);
		expect(engine.split("within")).toEqual(["with", "in"]);
		expect(engine.split("fireproof")).toEqual(["fire", "proof"]);
		expect(engine.split("someone")).toEqual(["some", "one"]);
		expect(engine.split("everyone")).toEqual(["eve", "ry", "one"]);
		expect(engine.split("everybody")).toEqual(["eve", "ry", "bod", "y"]);

		// Slang & monosyllables
		expect(engine.split("gonna")).toEqual(["gon", "na"]);
		expect(engine.split("wanna")).toEqual(["wan", "na"]);
		expect(engine.split("gotta")).toEqual(["got", "ta"]);
		expect(engine.split("cause")).toEqual(["cause"]);
		expect(engine.split("bout")).toEqual(["bout"]);
		expect(engine.split("til")).toEqual(["til"]);
	});

	it("recombines already split syllables into full words", () => {
		const splitWords = [
			{ ...newLyricWord(), word: "Nev", startTime: 1000, endTime: 1250 },
			{ ...newLyricWord(), word: "er ", startTime: 1250, endTime: 1600 },
			{ ...newLyricWord(), word: "gon", startTime: 1600, endTime: 1800 },
			{ ...newLyricWord(), word: "na ", startTime: 1800, endTime: 2100 },
			{ ...newLyricWord(), word: "give ", startTime: 2100, endTime: 2500 },
		];

		const recombined = recombineSplitWords(splitWords);
		expect(recombined).toHaveLength(3);
		expect(recombined[0].word).toBe("Never ");
		expect(recombined[0].startTime).toBe(1000);
		expect(recombined[0].endTime).toBe(1600);
		expect(recombined[1].word).toBe("gonna ");
		expect(recombined[1].startTime).toBe(1600);
		expect(recombined[1].endTime).toBe(2100);
		expect(recombined[2].word).toBe("give ");
	});

	it("does not recombine CJK characters", () => {
		const cjkWords = [
			{ ...newLyricWord(), word: "我", startTime: 1000, endTime: 1250 },
			{ ...newLyricWord(), word: "们", startTime: 1250, endTime: 1600 },
		];
		const recombined = recombineSplitWords(cjkWords);
		expect(recombined).toHaveLength(2);
		expect(recombined[0].word).toBe("我");
		expect(recombined[1].word).toBe("们");
	});

	it("re-splits already split words when resplitWords is true", () => {
		const line = {
			...newLyricLine(),
			words: [
				// A word previously split typographically as "Nev" + "er "
				{ ...newLyricWord(), word: "Nev", startTime: 1000, endTime: 1300 },
				{ ...newLyricWord(), word: "er ", startTime: 1300, endTime: 1800 },
			],
		};

		// With spicy-lyrics engine, "Never" is split as "Ne" + "ver "
		const resplitLines = segmentLyricLines(
			[line],
			{
				...prosodicConfig,
				engine: "spicy-lyrics",
				resplitWords: true,
			},
			true,
		);

		expect(resplitLines[0].words).toHaveLength(2);
		expect(resplitLines[0].words[0].word).toBe("Ne");
		expect(resplitLines[0].words[1].word).toBe("ver ");
		expect(resplitLines[0].words[0].startTime).toBe(1000);
		expect(resplitLines[0].words[1].endTime).toBe(1800);

		// When resplitWords is false, already split words are kept intact
		const untouchedLines = segmentLyricLines(
			[line],
			{
				...prosodicConfig,
				engine: "spicy-lyrics",
				resplitWords: false,
			},
			true,
		);
		expect(untouchedLines[0].words).toHaveLength(2);
		expect(untouchedLines[0].words[0].word).toBe("Nev");
		expect(untouchedLines[0].words[1].word).toBe("er ");
	});
});
