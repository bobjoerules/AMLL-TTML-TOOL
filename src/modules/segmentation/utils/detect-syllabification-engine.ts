import { franc } from "franc-min";
import type { LyricLine } from "$/types/ttml";
import type { SegmentationEngineId } from "../types";

const engineForLanguage: Record<string, SegmentationEngineId> = {
	eng: "prosodic",
	spa: "silabas",
	fra: "syllabify-fr",
	deu: "hyphenation-de",
	ind: "hyphenation-id",
	ita: "hyphenation-it",
	pol: "hyphenation-pl",
	por: "hyphenation-pt",
	rus: "syllabify",
};

const extractLyricsText = (lyricLines: LyricLine[]) =>
	lyricLines
		.flatMap((line) => line.words.map(({ word }) => word))
		.join(" ")
		.trim();

/** Suggests the best available engine from raw text without changing the saved preference. */
export const detectSyllabificationEngineFromText = (text: string) => {
	const trimmed = text.trim();
	if (!trimmed) return undefined;

	// Strip section labels like [Verse 1], [Chorus: Artist], etc. before language detection
	const cleaned = trimmed
		.replace(/\[[^\]]*\]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	const textToAnalyze = cleaned.length >= 10 ? cleaned : trimmed;

	const kana =
		textToAnalyze.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length ??
		0;
	if (kana > 0) return "japanese" as const;

	const cyrillic =
		textToAnalyze.match(/\p{Script=Cyrillic}/gu)?.length ?? 0;
	if (cyrillic > 0) return "syllabify" as const;

	const han = textToAnalyze.match(/\p{Script=Han}/gu)?.length ?? 0;
	if (han > 0) return "basic" as const;

	const detectedLanguage = franc(textToAnalyze, { minLength: 15 });

	// Validate Portuguese: franc frequently misidentifies short/informal English lyrics as "por".
	// True Portuguese lyrics contain accented characters or standard Portuguese function words.
	const hasPortugueseChars =
		/[ãõáéíóúàâçê]/i.test(textToAnalyze) ||
		/\b(não|você|que|uma|para|pra|com|mais|meu|minha|sua|seu|como|mas|isso)\b/i.test(
			textToAnalyze,
		);

	if (detectedLanguage === "por" && !hasPortugueseChars) {
		return "prosodic" as const;
	}

	if (engineForLanguage[detectedLanguage]) {
		return engineForLanguage[detectedLanguage];
	}

	// Fallback to English (prosodic) for plain Latin ASCII lyrics where franc returned "und" or unsupported
	const latinMatch = textToAnalyze.match(/[a-zA-Z]/g)?.length ?? 0;
	if (latinMatch > 10 && !/[^\x00-\x7F]/.test(textToAnalyze)) {
		return "prosodic" as const;
	}

	return undefined;
};

/** Suggests the best available engine without changing the saved preference. */
export const detectSyllabificationEngine = (lyricLines: LyricLine[]) => {
	const text = extractLyricsText(lyricLines);
	return detectSyllabificationEngineFromText(text);
};

export const matchesSavedSyllabificationEngine = (
	lyricLines: LyricLine[],
	savedEngine: SegmentationEngineId,
) => detectSyllabificationEngine(lyricLines) === savedEngine;
