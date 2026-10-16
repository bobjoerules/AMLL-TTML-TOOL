const isCJKChar = (char: string) =>
	/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
		char,
	);
const isAlphaNum = (char: string) => /[\p{L}\p{N}]/u.test(char);
const isLatinAlphaNum = (char: string) => /[\p{Script=Latin}\p{N}]/u.test(char);
const isComma = (char: string) => /[,，、]/u.test(char);

const normalize = (value: string) => {
	const chars = Array.from(value);
	let processed = "";
	for (let index = 0; index < chars.length; index++) {
		const char = chars[index];
		if (char !== "-") {
			processed += char;
			continue;
		}
		const nextChar = chars[index + 1];
		if (nextChar === " ") {
			processed += "— ";
			index++;
		} else if (nextChar === "-") {
			processed += "—";
			index++;
		} else if (
			nextChar &&
			index > 0 &&
			isAlphaNum(chars[index - 1]) &&
			isAlphaNum(nextChar)
		) {
			processed += "-\\";
		} else {
			processed += "—";
		}
	}

	const processedChars = Array.from(processed);
	let cjkProcessed = "";
	for (let index = 0; index < processedChars.length; index++) {
		const char = processedChars[index];
		const nextChar = processedChars[index + 1] ?? "";
		cjkProcessed += char;
		if (
			(isCJKChar(char) && (isCJKChar(nextChar) || isLatinAlphaNum(nextChar))) ||
			(isLatinAlphaNum(char) && isCJKChar(nextChar)) ||
			(isComma(char) && (isCJKChar(nextChar) || isLatinAlphaNum(nextChar)))
		) {
			cjkProcessed += "\\";
		}
	}
	return cjkProcessed
		.replace(/\s*,\s*/g, ", ")
		.replace(/\s+/g, " ")
		.replace(/\s+,/g, ",")
		.replace(/\s+(?=[,.;:!?])/g, "")
		.trim();
};

/**
 * Checks whether an English word is normally capitalized in standard grammar (e.g. "I", "I'm", "I've").
 * Capitalized words that are NOT in this list (e.g. "What", "Baby", "Yeah") represent independent vocal phrases in lyrics.
 */
export const isNormallyCapitalizedWord = (word: string): boolean => {
	const clean = word.replace(/[^\p{L}\p{N}'’]/u, "");
	return (
		/^(I|I['’]m|I['’]ll|I['’]d|I['’]ve)$/i.test(clean) && /^I/u.test(clean)
	);
};

/**
 * Splits a background vocal string when it contains semicolons (`;`)
 * or a comma followed by a capitalized word (that isn't normally capitalized like "I").
 * Removes the `,` or `;` at split points, trims each segment, and capitalizes the first character.
 */
export const splitBackgroundSegment = (content: string): string[] => {
	const trimmed = content.trim();
	if (!trimmed) return [];

	const segments: string[] = [];
	let current = "";
	let i = 0;

	while (i < trimmed.length) {
		const char = trimmed[i];

		if (char === ";") {
			// Semicolon is always a split boundary
			const seg = current.replace(/[,;]+$/, "").trim();
			if (seg) segments.push(seg);
			current = "";
			i++;
			while (i < trimmed.length && /\s/.test(trimmed[i])) i++;
			continue;
		}

		if (char === ",") {
			// Look ahead past whitespace to the next word
			let nextPos = i + 1;
			while (nextPos < trimmed.length && /\s/.test(trimmed[nextPos])) nextPos++;
			const remaining = trimmed.slice(nextPos);
			const wordMatch = remaining.match(/^([\p{L}\p{N}'’]+)/u);

			if (wordMatch) {
				const nextWord = wordMatch[1];
				const startsUpper = /^\p{Lu}/u.test(nextWord);
				if (startsUpper && !isNormallyCapitalizedWord(nextWord)) {
					// Comma before an ad-lib capital word: split here and remove comma
					const seg = current.replace(/[,;]+$/, "").trim();
					if (seg) segments.push(seg);
					current = "";
					i = nextPos;
					continue;
				}
			}
		}

		current += char;
		i++;
	}

	const lastSeg = current.replace(/[,;]+$/, "").trim();
	if (lastSeg) segments.push(lastSeg);

	return segments
		.map((s) => s.replace(/^[;,]+|[;,]+$/g, "").trim())
		.filter(Boolean)
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
};

/**
 * Splits a background line (starts with `<` or wrapped in `(...)`)
 * into multiple lines if it contains semicolons or comma-separated capital words.
 */
export const splitBackgroundLine = (line: string): string[] => {
	const trimmed = line.trim();
	if (!trimmed) return [];

	if (trimmed.startsWith("<")) {
		const inner = trimmed.slice(1);
		const parts = splitBackgroundSegment(inner);
		if (parts.length <= 1) return [trimmed];
		return parts.map((p) => `<${p}`);
	}

	if (
		(trimmed.startsWith("(") && trimmed.endsWith(")")) ||
		(trimmed.startsWith("（") && trimmed.endsWith("）"))
	) {
		const inner = trimmed.slice(1, -1);
		const parts = splitBackgroundSegment(inner);
		if (parts.length <= 1) return [trimmed];
		return parts.map((p) => `(${p})`);
	}

	return [trimmed];
};

/** Process one lyric line into the plain-text import representation. */
export const prepareLyricLine = (
	line: string,
	escapeSpaces = true,
	options?: { splitBackground?: boolean },
) => {
	const backgroundVocals: string[] = [];
	let mainLine = "";
	let currentParen = "";
	let inParen = false;

	for (const char of line.replace(/\[.*?\]/g, "").trim()) {
		if (["(", "（"].includes(char) && !inParen) {
			inParen = true;
			currentParen = "";
		} else if ([")", "）"].includes(char) && inParen) {
			inParen = false;
			backgroundVocals.push(currentParen.trim());
		} else if (inParen) {
			currentParen += char;
		} else {
			mainLine += char;
		}
	}

	const main = normalize(mainLine);
	const splitBg = options?.splitBackground ?? false;

	const bgParts: string[] = [];
	if (splitBg) {
		for (const bg of backgroundVocals) {
			const normalizedBg = normalize(bg);
			const pieces = splitBackgroundSegment(normalizedBg);
			bgParts.push(...pieces);
		}
	} else {
		const background = backgroundVocals.map(normalize).filter(Boolean).join(", ");
		if (background) {
			bgParts.push(background.charAt(0).toUpperCase() + background.slice(1));
		}
	}

	const bgLines = bgParts.map(
		(p) => `<${p.charAt(0).toUpperCase() + p.slice(1)}`,
	);

	let output = "";
	if (main && bgLines.length > 0) {
		output = [main, ...bgLines].join("\n");
	} else if (bgLines.length > 0) {
		output = bgLines.join("\n");
	} else {
		output = main;
	}

	if (!escapeSpaces) return output;
	return output
		.split("\n")
		.map((l) => l.replace(/ /g, "\\ \\"))
		.join("\n");
};

