import type { LyricLine, LyricWord, TTMLLyric } from "$/types/ttml";

export type SearchScope = "all" | "lyrics" | "translations" | "romanizations";

export interface FindOptions {
	query: string;
	replacement?: string;
	matchCase?: boolean;
	wholeWord?: boolean;
	useRegex?: boolean;
	scope?: SearchScope;
}

export type MatchTarget = "word" | "translation" | "romanWord" | "romanLine";

export interface FindMatch {
	id: string;
	lineIndex: number;
	lineId: string;
	target: MatchTarget;
	wordIndex?: number;
	wordId?: string;
	start: number;
	end: number;
	matchText: string;
	preview: string;
}

export function escapeRegex(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildSearchRegex(options: {
	query: string;
	matchCase?: boolean;
	wholeWord?: boolean;
	useRegex?: boolean;
}): RegExp | null {
	const {
		query,
		matchCase = false,
		wholeWord = false,
		useRegex = false,
	} = options;
	if (!query) return null;

	let pattern = query;
	if (!useRegex) {
		pattern = escapeRegex(query);
	}

	if (wholeWord) {
		pattern = `(?<=^|[^\\p{L}\\p{N}_])(?:${pattern})(?=[^\\p{L}\\p{N}_]|$)`;
	}

	const flags = `gu${matchCase ? "" : "i"}`;

	try {
		return new RegExp(pattern, flags);
	} catch {
		return null;
	}
}

export function findMatches(
	lyrics: TTMLLyric,
	options: FindOptions,
): FindMatch[] {
	const regex = buildSearchRegex(options);
	if (!regex) return [];

	const scope = options.scope || "all";
	const matches: FindMatch[] = [];

	lyrics.lyricLines.forEach((line, lineIndex) => {
		// 1. Search in main lyric words
		if (scope === "all" || scope === "lyrics") {
			line.words.forEach((word, wordIndex) => {
				regex.lastIndex = 0;
				while (true) {
					const m = regex.exec(word.word);
					if (!m) break;
					if (m[0].length === 0) {
						regex.lastIndex++;
						continue;
					}
					matches.push({
						id: `${line.id}-w${wordIndex}-${m.index}`,
						lineIndex,
						lineId: line.id,
						target: "word",
						wordIndex,
						wordId: word.id,
						start: m.index,
						end: m.index + m[0].length,
						matchText: m[0],
						preview: word.word,
					});
				}
			});
		}

		// 2. Search in translated lyrics
		if ((scope === "all" || scope === "translations") && line.translatedLyric) {
			regex.lastIndex = 0;
			while (true) {
				const m = regex.exec(line.translatedLyric);
				if (!m) break;
				if (m[0].length === 0) {
					regex.lastIndex++;
					continue;
				}
				matches.push({
					id: `${line.id}-trans-${m.index}`,
					lineIndex,
					lineId: line.id,
					target: "translation",
					start: m.index,
					end: m.index + m[0].length,
					matchText: m[0],
					preview: line.translatedLyric,
				});
			}
		}

		// 3. Search in romanizations (both line-level romanLyric and word-level romanWord)
		if (scope === "all" || scope === "romanizations") {
			if (line.romanLyric) {
				regex.lastIndex = 0;
				while (true) {
					const m = regex.exec(line.romanLyric);
					if (!m) break;
					if (m[0].length === 0) {
						regex.lastIndex++;
						continue;
					}
					matches.push({
						id: `${line.id}-roman-${m.index}`,
						lineIndex,
						lineId: line.id,
						target: "romanLine",
						start: m.index,
						end: m.index + m[0].length,
						matchText: m[0],
						preview: line.romanLyric,
					});
				}
			}

			line.words.forEach((word, wordIndex) => {
				if (word.romanWord) {
					regex.lastIndex = 0;
					while (true) {
						const m = regex.exec(word.romanWord);
						if (!m) break;
						if (m[0].length === 0) {
							regex.lastIndex++;
							continue;
						}
						matches.push({
							id: `${line.id}-rw${wordIndex}-${m.index}`,
							lineIndex,
							lineId: line.id,
							target: "romanWord",
							wordIndex,
							wordId: word.id,
							start: m.index,
							end: m.index + m[0].length,
							matchText: m[0],
							preview: word.romanWord,
						});
					}
				}
			});
		}
	});

	return matches;
}

export function replaceCurrentMatch(
	lyrics: TTMLLyric,
	match: FindMatch,
	replacement: string,
): { nextLyrics: TTMLLyric; modified: boolean } {
	let modified = false;

	const nextLines: LyricLine[] = lyrics.lyricLines.map((line, lIdx) => {
		if (line.id !== match.lineId && lIdx !== match.lineIndex) {
			return line;
		}

		if (match.target === "word" && match.wordIndex !== undefined) {
			const nextWords: LyricWord[] = line.words.map((word, wIdx) => {
				if (word.id !== match.wordId && wIdx !== match.wordIndex) {
					return word;
				}
				const before = word.word.slice(0, match.start);
				const after = word.word.slice(match.end);
				const updated = before + replacement + after;
				modified = true;
				return {
					...word,
					word: updated,
				};
			});

			return {
				...line,
				words: nextWords,
			};
		}

		if (match.target === "translation" && line.translatedLyric) {
			const before = line.translatedLyric.slice(0, match.start);
			const after = line.translatedLyric.slice(match.end);
			modified = true;
			return {
				...line,
				translatedLyric: before + replacement + after,
			};
		}

		if (match.target === "romanLine" && line.romanLyric) {
			const before = line.romanLyric.slice(0, match.start);
			const after = line.romanLyric.slice(match.end);
			modified = true;
			return {
				...line,
				romanLyric: before + replacement + after,
			};
		}

		if (match.target === "romanWord" && match.wordIndex !== undefined) {
			const nextWords: LyricWord[] = line.words.map((word, wIdx) => {
				if (
					(word.id !== match.wordId && wIdx !== match.wordIndex) ||
					!word.romanWord
				) {
					return word;
				}
				const before = word.romanWord.slice(0, match.start);
				const after = word.romanWord.slice(match.end);
				modified = true;
				return {
					...word,
					romanWord: before + replacement + after,
				};
			});

			return {
				...line,
				words: nextWords,
			};
		}

		return line;
	});

	return {
		nextLyrics: modified
			? {
					...lyrics,
					lyricLines: nextLines,
				}
			: lyrics,
		modified,
	};
}

export function replaceAllMatches(
	lyrics: TTMLLyric,
	options: FindOptions,
): { nextLyrics: TTMLLyric; replacedCount: number; linesAffected: number } {
	const regex = buildSearchRegex(options);
	const replacement = options.replacement ?? "";
	if (!regex) {
		return { nextLyrics: lyrics, replacedCount: 0, linesAffected: 0 };
	}

	const scope = options.scope || "all";
	let totalReplaced = 0;
	let affectedLines = 0;

	const nextLines: LyricLine[] = lyrics.lyricLines.map((line) => {
		let lineModified = false;

		// 1. Replace in main words
		let nextWords: LyricWord[] = line.words;
		if (scope === "all" || scope === "lyrics") {
			nextWords = line.words.map((word) => {
				regex.lastIndex = 0;
				const matches = word.word.match(regex);
				if (matches && matches.length > 0) {
					regex.lastIndex = 0;
					const updated = word.word.replace(regex, replacement);
					totalReplaced += matches.length;
					lineModified = true;
					return {
						...word,
						word: updated,
					};
				}
				return word;
			});
		}

		// 2. Replace in translated lyrics
		let nextTranslation = line.translatedLyric;
		if ((scope === "all" || scope === "translations") && line.translatedLyric) {
			regex.lastIndex = 0;
			const matches = line.translatedLyric.match(regex);
			if (matches && matches.length > 0) {
				regex.lastIndex = 0;
				const updated = line.translatedLyric.replace(regex, replacement);
				totalReplaced += matches.length;
				lineModified = true;
				nextTranslation = updated;
			}
		}

		// 3. Replace in romanization
		let nextRomanLine = line.romanLyric;
		if (scope === "all" || scope === "romanizations") {
			if (line.romanLyric) {
				regex.lastIndex = 0;
				const matches = line.romanLyric.match(regex);
				if (matches && matches.length > 0) {
					regex.lastIndex = 0;
					const updated = line.romanLyric.replace(regex, replacement);
					totalReplaced += matches.length;
					lineModified = true;
					nextRomanLine = updated;
				}
			}

			nextWords = nextWords.map((word) => {
				if (!word.romanWord) return word;
				regex.lastIndex = 0;
				const matches = word.romanWord.match(regex);
				if (matches && matches.length > 0) {
					regex.lastIndex = 0;
					const updated = word.romanWord.replace(regex, replacement);
					totalReplaced += matches.length;
					lineModified = true;
					return {
						...word,
						romanWord: updated,
					};
				}
				return word;
			});
		}

		if (lineModified) {
			affectedLines++;
			return {
				...line,
				words: nextWords,
				translatedLyric: nextTranslation,
				romanLyric: nextRomanLine,
			};
		}

		return line;
	});

	return {
		nextLyrics:
			totalReplaced > 0
				? {
						...lyrics,
						lyricLines: nextLines,
					}
				: lyrics,
		replacedCount: totalReplaced,
		linesAffected: affectedLines,
	};
}
