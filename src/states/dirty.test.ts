import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import {
	isDirtyAtom,
	lyricLinesAtom,
	markSavedAtom,
	newLyricLinesAtom,
} from "./main";
import type { TTMLLyric } from "$/types/ttml";

describe("isDirtyAtom unsaved changes tracking", () => {
	it("is not dirty initially when empty", () => {
		const store = createStore();
		expect(store.get(isDirtyAtom)).toBe(false);
	});

	it("becomes dirty when lyrics are modified", () => {
		const store = createStore();
		const sampleLyric: TTMLLyric = {
			lyricLines: [
				{
					id: "line-1",
					startTime: 1000,
					endTime: 3000,
					words: [
						{
							id: "word-1",
							word: "Hello",
							startTime: 1000,
							endTime: 3000,
							obscene: false,
						},
					],
					ignoreSync: false,
				},
			],
			metadata: [],
			marks: [],
			sections: [],
		};

		store.set(lyricLinesAtom, sampleLyric);
		expect(store.get(isDirtyAtom)).toBe(true);
	});

	it("becomes not dirty after markSavedAtom is dispatched", () => {
		const store = createStore();
		const sampleLyric: TTMLLyric = {
			lyricLines: [
				{
					id: "line-1",
					startTime: 1000,
					endTime: 3000,
					words: [],
					ignoreSync: false,
				},
			],
			metadata: [],
			marks: [],
			sections: [],
		};

		store.set(lyricLinesAtom, sampleLyric);
		expect(store.get(isDirtyAtom)).toBe(true);

		store.set(markSavedAtom);
		expect(store.get(isDirtyAtom)).toBe(false);

		// Further edit makes it dirty again
		store.set(lyricLinesAtom, {
			...sampleLyric,
			metadata: [{ key: "title", value: ["Song Title"] }],
		});
		expect(store.get(isDirtyAtom)).toBe(true);

		// Reverting to the saved state makes it not dirty
		store.set(lyricLinesAtom, sampleLyric);
		expect(store.get(isDirtyAtom)).toBe(false);
	});

	it("is not dirty immediately after newLyricLinesAtom loads a file", () => {
		const store = createStore();
		const loadedLyric: TTMLLyric = {
			lyricLines: [
				{
					id: "line-1",
					startTime: 0,
					endTime: 2000,
					words: [],
					ignoreSync: false,
				},
			],
			metadata: [{ key: "artist", value: ["Artist"] }],
			marks: [],
			sections: [],
		};

		store.set(newLyricLinesAtom, loadedLyric);
		expect(store.get(isDirtyAtom)).toBe(false);

		// Modifying loaded lyrics makes it dirty
		store.set(lyricLinesAtom, {
			...loadedLyric,
			lyricLines: [],
		});
		expect(store.get(isDirtyAtom)).toBe(true);
	});
});
