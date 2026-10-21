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

export const prosodicSplit = (word: string): string[] => {
	const trimmed = word.trim();
	if (!trimmed) return [word];

	const key = trimmed.toLowerCase();
	if (NEVER_SPLIT_WORDS.has(key)) {
		return [word];
	}

	const entry =
		dictionary.get(key) ??
		(key.endsWith("in") ? dictionary.get(`${key}g`) : undefined);
	if (entry !== undefined) {
		const parts = splitAtLengths(
			trimmed,
			typeof entry === "number" ? [entry] : entry,
		);
		return applySplitsToWord(word, parts);
	}

	const compromiseParts = mergeContractionSuffix(compromiseSplit(trimmed));
	return applySplitsToWord(word, compromiseParts);
};

const SPLIT_VOWELS = new Set("aeiouyàáâäåèéêëìíîïòóôöøùúûü".split(""));
const SPLIT_DIGRAPHS = ["th", "ch", "sh", "ph", "wh", "gh", "ck", "qu"];
const HIATUS = new Set(["ia", "io", "iu", "eo", "ua", "uo", "ii"]);
const isLetter = (c: string | undefined): boolean =>
	c !== undefined && /\p{L}/u.test(c);

const vowelAt = (lw: string, i: number): boolean => {
	const c = lw[i];
	if (!SPLIT_VOWELS.has(c)) return false;
	if (c === "u" && i > 0 && lw[i - 1] === "q") return false;
	if (
		c === "y" &&
		(i === 0 || !isLetter(lw[i - 1])) &&
		i + 1 < lw.length &&
		SPLIT_VOWELS.has(lw[i + 1])
	) {
		return false; // yes, you, year
	}
	return true;
};

export const splitShape = (body: string) => {
	const lw = body.toLowerCase();
	const n = lw.length;
	const groups: [number, number][] = [];
	let i = 0;
	while (i < n) {
		if (vowelAt(lw, i)) {
			let j = i;
			while (j + 1 < n && vowelAt(lw, j + 1)) j++;
			groups.push([i, j]);
			i = j + 1;
		} else {
			i++;
		}
	}
	const finalLe =
		n >= 4 && lw.endsWith("le") && !vowelAt(lw, n - 3) && isLetter(lw[n - 3]);
	const led =
		n >= 5 && lw.endsWith("led") && !vowelAt(lw, n - 4) && isLetter(lw[n - 4]);
	const les =
		n >= 5 && lw.endsWith("les") && !vowelAt(lw, n - 4) && isLetter(lw[n - 4]);
	let silent = false;
	let alt: [number, number][] | null = null;
	if (groups.length > 1 && !finalLe && !led && !les) {
		const last = groups[groups.length - 1];
		if (lw.endsWith("e") && last[0] === n - 1 && last[1] === n - 1) {
			silent = true;
		} else if (
			lw.endsWith("ed") &&
			n > 3 &&
			!"td".includes(lw[n - 3]) &&
			last[0] === n - 2 &&
			last[1] === n - 2
		) {
			silent = true;
		} else if (
			lw.endsWith("es") &&
			n > 3 &&
			!"sxzcg".includes(lw[n - 3]) &&
			!["ch", "sh"].includes(lw.slice(n - 4, n - 2)) &&
			last[0] === n - 2 &&
			last[1] === n - 2
		) {
			silent = true;
		}
		if (silent) {
			if (!lw.endsWith("e")) alt = groups.map((g) => [g[0], g[1]]);
			groups.pop();
		}
	}
	return { lw, groups, silent, alt };
};

export const spicyLyricsSplit = (body: string): string[] => {
	const trimmed = body.trim();
	if (!trimmed) return [body];
	const key = trimmed.toLowerCase();
	if (NEVER_SPLIT_WORDS.has(key)) return [body];

	const { lw, groups } = splitShape(trimmed);
	const cuts: number[] = [];
	for (let k = 0; k < groups.length - 1; k++) {
		const a = groups[k][1] + 1;
		const b = groups[k + 1][0];
		const units: number[] = [];
		let i = a;
		while (i < b) {
			const pair = lw.slice(i, i + 2);
			const step =
				i + 2 <= b &&
				SPLIT_DIGRAPHS.includes(pair) &&
				!(pair === "gh" && i >= 1 && lw[i - 1] === "n")
					? 2
					: 1;
			units.push(i);
			i += step;
		}
		if (!units.length || lw.slice(a, b) === "ng") {
			cuts.push(b);
		} else if (units.length === 1) {
			cuts.push(units[0]);
		} else {
			cuts.push(units[Math.floor(units.length / 2)]);
		}
	}

	for (const [s, e] of groups) {
		for (let pos = s + 1; pos <= e; pos++) {
			if (HIATUS.has(lw.slice(pos - 1, pos + 1))) {
				cuts.push(pos);
			}
		}
	}
	cuts.sort((a, b) => a - b);

	const parts: string[] = [];
	let prev = 0;
	for (const c of cuts) {
		if (c > prev) {
			parts.push(trimmed.slice(prev, c));
			prev = c;
		}
	}
	parts.push(trimmed.slice(prev));

	return applySplitsToWord(body, parts.filter(Boolean));
};

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
		name: "English (Prosodic)",
		description:
			"Dictionary-backed English syllable boundaries with a speech fallback (pre-v3.2.0 default).",
		split: prosodicSplit,
	},
	{
		id: "spicy-lyrics",
		name: "English (Spicy Lyrics / TTML Review)",
		description:
			"Singing syllable heuristics from TTML Review & Spicy Lyrics rules (open syllables, digraph-safe).",
		split: spicyLyricsSplit,
	},
	{
		id: "enhanced",
		name: "English (Enhanced / TeX)",
		description:
			"TeX pattern hyphenation with repair rules for compound words and lyric exceptions.",
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
