import nlp from "compromise/tokenize";
import nlpSpeech from "compromise-speech";
import silabas from "silabas";
import syllabify from "syllabify";
import syllabifyFr from "syllabify-fr";
import { hyphenateSync as hyphenateEnUs } from "hyphen/en-us";
import prosodicDictionary from "../data/prosodic-dict.json";
import type { SegmentationEngineId } from "../types";

type DictionaryEntry = number | number[];

export interface SyllabificationEngine {
	id: SegmentationEngineId;
	name: string;
	description: string;
	split: (word: string) => string[];
}

const hyphenationLanguages = [
	["en-us", "English (US)", true],
	["de", "German", false],
	["fr", "French", true],
	["es", "Spanish", true],
	["id", "Indonesian", false],
	["it", "Italian", false],
	["pt", "Portuguese", false],
	["ru", "Russian", true],
	["pl", "Polish", false],
] as const;

export const getHyphenationLanguage = (engine: SegmentationEngineId) =>
	engine.startsWith("hyphenation-")
		? engine.slice("hyphenation-".length)
		: undefined;

const dictionary = new Map<string, DictionaryEntry>(
	Object.entries(prosodicDictionary as Record<string, DictionaryEntry>),
);
const nlpWithSpeech = nlp.extend(nlpSpeech as never);

const splitAtLengths = (word: string, lengths: number[]) => {
	const boundaries = lengths.reduce<number[]>((result, length) => {
		result.push((result[result.length - 1] ?? 0) + length);
		return result;
	}, []);
	const parts: string[] = [];
	let start = 0;
	for (const end of boundaries) {
		parts.push(word.slice(start, end));
		start = end;
	}
	parts.push(word.slice(start));
	return parts.filter(Boolean);
};

/**
 * Repairs syllable boundaries where a consonant cluster was split across syllables
 * with an onset that is phonotactically impossible in English.
 * E.g., "blin" + "dfold" -> "blind" + "fold", "hea" + "dlights" -> "head" + "lights".
 */
export const repairEnglishSyllables = (syllables: string[]): string[] => {
	if (syllables.length <= 1) return syllables;
	const result = [...syllables];

	for (let i = 1; i < result.length; i++) {
		const prev = result[i - 1];
		const curr = result[i];
		if (!prev || !curr) continue;

		// Move leading consonant cluster 'ht' (e.g. nig-htclub -> night-club)
		if (/^ht/i.test(curr)) {
			result[i - 1] = prev + curr.slice(0, 2);
			result[i] = curr.slice(2);
			continue;
		}

		// Move leading consonant cluster 'ld' (e.g. wor-ldview -> world-view)
		if (/^ld/i.test(curr)) {
			result[i - 1] = prev + curr.slice(0, 2);
			result[i] = curr.slice(2);
			continue;
		}

		// Move 'd' if followed by an impossible English onset:
		// e.g. df (blindfold -> blin-dfold), dl (headlights -> hea-dlights),
		// dm, dn, db, dc, dg, dp, dt, dv, ds, dw (headwind, headway).
		// Exclude syllabic -dle/-dles/-dled (needle, candle, cradled),
		// contractions like didn't / couldn't, and affricate dg before e/i/y (gadget, budget).
		if (
			/^d[bcfjklmnpqtvxz]/i.test(curr) ||
			/^ds/i.test(curr) ||
			/^dw/i.test(curr) ||
			/^dg[^eiy]/i.test(curr)
		) {
			if (!/^dle[sd]?$/i.test(curr) && !/^dn['’]?t?$/i.test(curr)) {
				result[i - 1] = prev + curr[0];
				result[i] = curr.slice(1);
				continue;
			}
		}

		// Move 't' if followed by an impossible English onset:
		// e.g. tm (postman -> pos-tman), tp (dustpan -> dus-tpan), tb, tc, tf, tg, tk, tl, etc.
		// Exclude tr, tw, th, syllabic -tle/-tles/-tled (bottle, little, entitled),
		// and contractions (e.g. shouldn't).
		if (/^t[bcfgjklmnpqstvxz]/i.test(curr)) {
			if (!/^tle[sd]?$/i.test(curr) && !/^tn['’]?t?$/i.test(curr)) {
				result[i - 1] = prev + curr[0];
				result[i] = curr.slice(1);
				continue;
			}
		}
	}

	return result.filter(Boolean);
};

const compromiseSplit = (word: string) => {
	const rawSyllables = (nlpWithSpeech(word).syllables() as string[][]).flat();
	const syllables = repairEnglishSyllables(rawSyllables);
	if (syllables.length <= 1) return [word];

	let offset = 0;
	const intervals = syllables.map((syllable) => {
		const remaining = word.slice(offset);
		const match = remaining.toLowerCase().indexOf(syllable.toLowerCase());
		const end = offset + (match < 0 ? 0 : match) + syllable.length;
		const begin = offset;
		offset = end;
		return { begin, end };
	});

	for (let index = 0; index < intervals.length; index++) {
		const interval = intervals[index];
		if (index === intervals.length - 1) {
			interval.end = word.length;
			continue;
		}
		const next = intervals[index + 1];
		interval.end = next.begin;
		if (/[’']/.test(word.charAt(interval.end - 1))) {
			interval.end--;
			next.begin--;
		}
	}
	return intervals
		.map(({ begin, end }) => word.slice(begin, end))
		.filter(Boolean);
};

const mergeContractionSuffix = (parts: string[]) => {
	const result: string[] = [];
	for (const part of parts) {
		if (/^[’'](?:s|re|ve|ll|d|m|t)$/i.test(part) && result.length > 0) {
			result[result.length - 1] += part;
		} else {
			result.push(part);
		}
	}
	return result;
};

const NEVER_SPLIT_WORDS = new Set([
	"oh",
	"ooh",
	"ah",
	"ahh",
	"ha",
	"eh",
	"uh",
	"um",
	"woah",
	"whoa",
	"yeah",
	"aye",
	"shh",
	"psst",
	"hmm",
]);

/**
 * Curated exceptions and music/lyric morpheme boundaries that standard dictionaries
 * or speech tokenizers often get wrong (e.g. compound words, gerunds, music slang).
 */
const LYRIC_EXCEPTIONS = new Map<string, string[]>(
	Object.entries({
		// Music slang and contractions
		gonna: ["gon", "na"],
		wanna: ["wan", "na"],
		gotta: ["got", "ta"],
		kinda: ["kin", "da"],
		sorta: ["sor", "ta"],
		lemme: ["lem", "me"],
		gimme: ["gim", "me"],
		coulda: ["could", "a"],
		shoulda: ["should", "a"],
		woulda: ["would", "a"],
		cause: ["cause"],
		bout: ["bout"],
		til: ["til"],

		// Common lyric words often left unsplit or awkward
		forever: ["for", "ev", "er"],
		forevermore: ["for", "ev", "er", "more"],
		water: ["wa", "ter"],
		river: ["riv", "er"],
		maybe: ["may", "be"],
		over: ["o", "ver"],
		into: ["in", "to"],
		onto: ["on", "to"],
		upon: ["u", "pon"],

		// Gerunds & participles
		saying: ["say", "ing"],
		praying: ["pray", "ing"],
		crying: ["cry", "ing"],
		trying: ["try", "ing"],
		flying: ["fly", "ing"],
		playing: ["play", "ing"],
		staying: ["stay", "ing"],
		dying: ["dy", "ing"],
		falling: ["fall", "ing"],
		calling: ["call", "ing"],
		singing: ["sing", "ing"],
		screaming: ["scream", "ing"],
		breathing: ["breath", "ing"],
		laughing: ["laugh", "ing"],

		// Short 2-syllable -y words
		baby: ["ba", "by"],
		crazy: ["cra", "zy"],
		lady: ["la", "dy"],
		tiny: ["ti", "ny"],
		duty: ["du", "ty"],
		easy: ["ea", "sy"],
		busy: ["bus", "y"],
		city: ["cit", "y"],
		body: ["bod", "y"],
		holy: ["ho", "ly"],
		army: ["ar", "my"],

		// Family
		brother: ["broth", "er"],
		mother: ["moth", "er"],
		father: ["fa", "ther"],
		sister: ["sis", "ter"],

		// Compound words
		takeoff: ["take", "off"],
		without: ["with", "out"],
		within: ["with", "in"],
		fireproof: ["fire", "proof"],
		bulletproof: ["bul", "let", "proof"],
		heartbreak: ["heart", "break"],
		heartbeat: ["heart", "beat"],
		sunshine: ["sun", "shine"],
		moonlight: ["moon", "light"],
		starlight: ["star", "light"],
		firefly: ["fire", "fly"],
		butterfly: ["but", "ter", "fly"],
		waterfall: ["wa", "ter", "fall"],
		rainfall: ["rain", "fall"],
		sunflower: ["sun", "flow", "er"],

		// Indefinite pronouns
		someone: ["some", "one"],
		everyone: ["eve", "ry", "one"],
		everybody: ["eve", "ry", "bod", "y"],
		everything: ["eve", "ry", "thing"],
		anything: ["an", "y", "thing"],
		anybody: ["an", "y", "bod", "y"],
		anyone: ["an", "y", "one"],
		anymore: ["an", "y", "more"],
		nowhere: ["no", "where"],
		somewhere: ["some", "where"],
		anywhere: ["an", "y", "where"],

		// Miscellany
		different: ["dif", "fer", "ent"],
		flower: ["flow", "er"],
		power: ["pow", "er"],
		tower: ["tow", "er"],
		shower: ["show", "er"],
	}),
);

const applySplitsToWord = (word: string, parts: string[]): string[] => {
	let idx = 0;
	const result: string[] = [];
	for (const p of parts) {
		result.push(word.slice(idx, idx + p.length));
		idx += p.length;
	}
	if (idx < word.length) {
		result[result.length - 1] += word.slice(idx);
	}
	return result.filter(Boolean);
};

export const enhancedEnglishSplit = (word: string): string[] => {
	const trimmed = word.trim();
	if (!trimmed) return [word];

	const key = trimmed.toLowerCase();
	if (NEVER_SPLIT_WORDS.has(key)) {
		return [word];
	}

	// Preserve standard single-word contractions
	if (/^[\w]+[’'][a-z]+$/i.test(trimmed)) {
		if (
			/^(?:we|you|they|who|what|where|there)[’'](?:re|ve|ll|d)$/i.test(trimmed) ||
			/^(?:i)[’'](?:m|ve|ll|d)$/i.test(trimmed) ||
			/^(?:it|he|she)[’'](?:s|ll|d)$/i.test(trimmed) ||
			/^(?:can|don|won|ain|isn|aren|wasn|weren|hasn|haven|hadn|doesn)[’']t$/i.test(trimmed)
		) {
			return [word];
		}
	}

	// 1. Check curated lyric exceptions & morpheme boundaries
	const lyricException = LYRIC_EXCEPTIONS.get(key);
	if (lyricException) {
		return applySplitsToWord(word, lyricException);
	}

	// 2. High-precision TeX Hyphenation (minWordLength: 3)
	try {
		const hyphenated = hyphenateEnUs(trimmed, { minWordLength: 3 });
		const texParts = hyphenated.split("\u00AD").filter(Boolean);
		if (texParts.length > 1) {
			const repaired = repairEnglishSyllables(texParts);
			return applySplitsToWord(word, repaired);
		}
	} catch {
		// fallback to dictionary/prosodic
	}

	// 3. Prosodic Dictionary
	const entry =
		dictionary.get(key) ??
		(key.endsWith("in") ? dictionary.get(`${key}g`) : undefined);
	if (entry !== undefined) {
		const parts = splitAtLengths(
			trimmed,
			typeof entry === "number" ? [entry] : entry,
		);
		const repaired = repairEnglishSyllables(parts);
		return applySplitsToWord(word, repaired);
	}

	// 4. Speech/compromise fallback + contraction merging
	const compromiseParts = repairEnglishSyllables(
		mergeContractionSuffix(compromiseSplit(trimmed)),
	);
	if (compromiseParts.length > 1) {
		return applySplitsToWord(word, compromiseParts);
	}

	// 5. Morphological gerund fallback (-ing)
	if (trimmed.length > 4 && /ing$/i.test(trimmed)) {
		const stem = trimmed.slice(0, -3);
		if (/[aeiouy]/i.test(stem)) {
			return [word.slice(0, stem.length), word.slice(stem.length)];
		}
	}

	return [word];
};

const prosodicSplit = enhancedEnglishSplit;

const isJapaneseCharacter = (char: string | undefined) =>
	!!char &&
	/[々\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(char);
const isJapanesePunctuation = (char: string | undefined) =>
	!!char && /[\p{P}\p{S}]/u.test(char);
const isJapaneseModifier = (char: string | undefined) =>
	!!char && "ャュョゃゅょンッっ".includes(char);

/** Adapted from amll-dev/amll-editor's Japanese basic engine. */
export const splitJapaneseText = (text: string) => {
	if (!text.trim()) return [text];
	const chars = Array.from(text);
	const tokens: string[] = [];
	while (chars.length > 0) {
		const token: string[] = [];
		if (isJapaneseCharacter(chars[0])) {
			token.push(chars.shift() ?? "");
			if (isJapaneseModifier(chars[0])) token.push(chars.shift() ?? "");
			while (isJapanesePunctuation(chars[0])) token.push(chars.shift() ?? "");
			tokens.push(token.join(""));
			continue;
		}
		while (
			chars.length > 0 &&
			!isJapaneseCharacter(chars[0]) &&
			!isJapanesePunctuation(chars[0]) &&
			!/^\s$/u.test(chars[0] ?? "")
		) {
			token.push(chars.shift() ?? "");
		}
		while (isJapanesePunctuation(chars[0])) token.push(chars.shift() ?? "");
		if (token.length > 0) tokens.push(token.join(""));
		if (chars.length > 0 && /^\s$/u.test(chars[0] ?? "")) {
			tokens.push(chars.shift() ?? "");
		}
	}
	return tokens;
};

export const SYLLABIFICATION_ENGINES: SyllabificationEngine[] = [
	{
		id: "prosodic",
		name: "English (Enhanced / Lyrics)",
		description:
			"High-accuracy lyric hyphenation combining TeX patterns, lyric morphology, and dictionary boundaries.",
		split: enhancedEnglishSplit,
	},
	{
		id: "basic",
		name: "Basic",
		description:
			"Keep Latin words whole and split CJK text using the existing rules.",
		split: (word) => [word],
	},
	{
		id: "japanese",
		name: "Japanese (Basic)",
		description:
			"Use the existing CJK character splitting rules for Japanese text.",
		split: (word) => [word],
	},
	{
		id: "silabas",
		name: "Spanish (Silabas)",
		description: "Spanish orthographic syllable splitting.",
		split: (word) => {
			try {
				return silabas(word).syllables();
			} catch {
				return [word];
			}
		},
	},
	{
		id: "syllabify-fr",
		name: "French (Syllabify-fr)",
		description: "French orthographic syllable splitting.",
		split: (word) => syllabifyFr(word).syllabes,
	},
	{
		id: "syllabify",
		name: "Russian (Syllabify)",
		description: "Russian orthographic syllable splitting.",
		split: (word) => {
			try {
				return syllabify(word);
			} catch {
				return [word];
			}
		},
	},
	...hyphenationLanguages.map(([language, name, hasBetterEngine]) => ({
		id: `hyphenation-${language}` as SegmentationEngineId,
		name: `${name}${hasBetterEngine ? " (legacy)" : ""}`,
		description: `Use the existing ${name} hyphenation patterns.`,
		split: (word: string) => {
			if (language === "en-us") {
				return enhancedEnglishSplit(word);
			}
			return [word];
		},
	})),
	{
		id: "none",
		name: "None",
		description: "Do not split words automatically.",
		split: (word) => [word],
	},
].sort((left, right) => left.name.localeCompare(right.name));

export const getSyllabificationEngine = (id: SegmentationEngineId) =>
	SYLLABIFICATION_ENGINES.find((engine) => engine.id === id) ??
	SYLLABIFICATION_ENGINES[0];
