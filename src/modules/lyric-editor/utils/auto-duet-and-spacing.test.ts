import { describe, expect, it } from "vitest";
import { splitTrailingSpace } from "../components/lyric-word-view";
import {
	type LyricLine,
	type TTMLLyric,
	newLyricLine,
	newLyricWord,
} from "$/types/ttml";

describe("splitTrailingSpace", () => {
	it("splits trailing single space into baseWord and spaceWord", () => {
		const result = splitTrailingSpace("hello ");
		expect(result).toEqual({
			baseWord: "hello",
			spaceWord: " ",
		});
	});

	it("splits trailing multiple spaces into baseWord and spaceWord", () => {
		const result = splitTrailingSpace("world   ");
		expect(result).toEqual({
			baseWord: "world",
			spaceWord: "   ",
		});
	});

	it("returns unchanged for word without trailing space", () => {
		const result = splitTrailingSpace("hello");
		expect(result).toEqual({
			baseWord: "hello",
			spaceWord: undefined,
		});
	});

	it("does not split if word is only spaces", () => {
		const result = splitTrailingSpace("   ");
		expect(result).toEqual({
			baseWord: "   ",
			spaceWord: undefined,
		});
	});
});

describe("Auto duet vocalist assignment logic", () => {
	it("identifies primary singer and secondary duet singers correctly", () => {
		const lyrics: TTMLLyric = {
			metadata: [],
			sections: [
				{
					id: "sec-1",
					label: "[Verse 1: Alice]",
					category: "verse",
					vocalist: "Alice",
				},
				{
					id: "sec-2",
					label: "[Chorus: Bob]",
					category: "chorus",
					vocalist: "Bob",
				},
			],
			lyricLines: [
				{
					...newLyricLine(),
					id: "line-1",
					sectionId: "sec-1",
					words: [{ ...newLyricWord(), word: "Hi" }],
				},
				{
					...newLyricLine(),
					id: "line-2",
					sectionId: "sec-2",
					words: [{ ...newLyricWord(), word: "Hello" }],
				},
			],
		};

		const sectionMap = new Map((lyrics.sections ?? []).map((s) => [s.id, s]));
		const singers: string[] = [];
		const lineSingers: (string | undefined)[] = [];

		for (const line of lyrics.lyricLines) {
			let singer: string | undefined;
			if (line.sectionId && sectionMap.has(line.sectionId)) {
				singer = sectionMap.get(line.sectionId)!.vocalist?.trim();
			}
			if (!singer && line.agent) {
				singer = line.agent.trim();
			}
			lineSingers.push(singer);
			if (
				singer &&
				!singers.some((s) => s.toLowerCase() === singer.toLowerCase())
			) {
				singers.push(singer);
			}
		}

		expect(singers).toEqual(["Alice", "Bob"]);

		const primarySinger = singers[0].toLowerCase();
		for (let i = 0; i < lyrics.lyricLines.length; i++) {
			const singer = lineSingers[i];
			if (!singer) continue;
			lyrics.lyricLines[i].isDuet = singer.toLowerCase() !== primarySinger;
		}

		expect(lyrics.lyricLines[0].isDuet).toBe(false); // Alice (primary)
		expect(lyrics.lyricLines[1].isDuet).toBe(true); // Bob (duet)
	});
});

describe("Section boundaries and line insertion continuity", () => {
	function computeBounds(lines: LyricLine[], lineIndex: number) {
		const cur = lines[lineIndex];
		if (!cur || !cur.sectionId) return { isStart: false, isEnd: false };
		const prev = lineIndex > 0 ? lines[lineIndex - 1] : undefined;
		const next =
			lineIndex < lines.length - 1 ? lines[lineIndex + 1] : undefined;
		const isStart = lineIndex === 0 || prev?.sectionId !== cur.sectionId;
		const isEnd =
			lineIndex === lines.length - 1 || next?.sectionId !== cur.sectionId;
		return { isStart, isEnd };
	}

	it("dynamically updates section start and end when a line is inserted into a section", () => {
		const line1 = { ...newLyricLine(), id: "l1", sectionId: "sec-verse" };
		const line2 = { ...newLyricLine(), id: "l2", sectionId: "sec-verse" };
		const lines = [line1, line2];

		// Before insertion: line 0 is start, line 1 is end
		expect(computeBounds(lines, 0)).toEqual({ isStart: true, isEnd: false });
		expect(computeBounds(lines, 1)).toEqual({ isStart: false, isEnd: true });

		// Insert a line between line 0 and line 1 inheriting sectionId
		const newLine = {
			...newLyricLine(),
			id: "l-new",
			sectionId: line1.sectionId,
			geniusHeader: line1.geniusHeader,
		};
		lines.splice(1, 0, newLine);

		// Now: 3 lines in section
		// Line 0: start, not end
		expect(computeBounds(lines, 0)).toEqual({ isStart: true, isEnd: false });
		// Line 1 (new line): not start, not end (connected seamlessly in middle)
		expect(computeBounds(lines, 1)).toEqual({ isStart: false, isEnd: false });
		// Line 2 (was line 1): not start, is end
		expect(computeBounds(lines, 2)).toEqual({ isStart: false, isEnd: true });
	});

	it("dynamically connects when appending a new line to the end of a section", () => {
		const line1 = { ...newLyricLine(), id: "l1", sectionId: "sec-verse" };
		const line2 = { ...newLyricLine(), id: "l2", sectionId: "sec-verse" };
		const nextSectionLine = {
			...newLyricLine(),
			id: "l3",
			sectionId: "sec-chorus",
		};
		const lines = [line1, line2, nextSectionLine];

		// Line 1 was the end of sec-verse
		expect(computeBounds(lines, 1)).toEqual({ isStart: false, isEnd: true });

		// Insert a new line after line 1 inheriting sec-verse
		const newLine = {
			...newLyricLine(),
			id: "l-new",
			sectionId: line2.sectionId,
			geniusHeader: line2.geniusHeader,
		};
		lines.splice(2, 0, newLine);

		// Line 1 is NO LONGER the end of sec-verse
		expect(computeBounds(lines, 1)).toEqual({ isStart: false, isEnd: false });
		// The new line is now the end of sec-verse
		expect(computeBounds(lines, 2)).toEqual({ isStart: false, isEnd: true });
		// Next section is unaffected
		expect(computeBounds(lines, 3)).toEqual({ isStart: true, isEnd: true });
	});
});
