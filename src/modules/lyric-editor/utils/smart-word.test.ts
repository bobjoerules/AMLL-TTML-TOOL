import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import {
	smartWordAnywhereAtom,
	splitOccupiedWordAtPlayheadAtom,
} from "$/modules/settings/states";
import { smartWordActiveIdAtom } from "$/modules/settings/states/sync";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main.ts";
import { type LyricLine, newLyricWord, type TTMLLyric } from "$/types/ttml";
import { getCurrentLocation } from "./lyric-states";

describe("smartWordAnywhere logic", () => {
	const createSampleLyrics = (): TTMLLyric => {
		const line: LyricLine = {
			id: "line-1",
			startTime: 0,
			endTime: 0,
			ignoreSync: false,
			words: [
				{
					...newLyricWord(),
					id: "w-0",
					word: "First",
					startTime: 0,
					endTime: 0,
				},
				{
					...newLyricWord(),
					id: "w-1",
					word: "Second",
					startTime: 0,
					endTime: 0,
				},
				{
					...newLyricWord(),
					id: "w-2",
					word: "Third",
					startTime: 0,
					endTime: 0,
				},
			],
		};
		return {
			metadata: [],
			lyricLines: [line],
		};
	};

	it("defaults to false", () => {
		const store = createStore();
		expect(store.get(smartWordAnywhereAtom)).toBe(false);
		expect(store.get(splitOccupiedWordAtPlayheadAtom)).toBe(false);
	});

	it("detects no start time on untimed words in any position", () => {
		const store = createStore();
		const lyrics = createSampleLyrics();
		store.set(lyricLinesAtom, lyrics);
		store.set(selectedLinesAtom, new Set(["line-1"]));

		// Select word 1 (in the middle)
		store.set(selectedWordsAtom, new Set(["w-1"]));

		const location = getCurrentLocation(store);
		expect(location).toBeDefined();
		expect(location?.word.id).toBe("w-1");
		expect(location?.isFirstWord).toBe(false);

		const currentTime = 3000;
		const unitStartTime = location?.word.startTime;
		const unitEndTime = location?.word.endTime ?? 0;
		const activeSmartWordId = store.get(smartWordActiveIdAtom);
		const isAlreadyActive =
			activeSmartWordId === location?.syncId ||
			activeSmartWordId === location?.word.id;

		const hasNoStartTime =
			!isAlreadyActive &&
			(unitStartTime === undefined ||
				unitStartTime === null ||
				Number.isNaN(unitStartTime) ||
				(unitStartTime <= 0 && (unitEndTime <= 0 || currentTime > 0)));

		expect(hasNoStartTime).toBe(true);
	});

	it("recognizes word as having a start time once start time is set", () => {
		const store = createStore();
		const lyrics = createSampleLyrics();
		lyrics.lyricLines[0].words[1].startTime = 3000; // set by F or G-as-F
		store.set(lyricLinesAtom, lyrics);
		store.set(selectedLinesAtom, new Set(["line-1"]));
		store.set(selectedWordsAtom, new Set(["w-1"]));

		const location = getCurrentLocation(store);
		expect(location).toBeDefined();

		const currentTime = 3500;
		const unitStartTime = location?.word.startTime ?? 0;
		const unitEndTime = location?.word.endTime ?? 0;
		const activeSmartWordId = store.get(smartWordActiveIdAtom);
		const isAlreadyActive =
			activeSmartWordId === location?.syncId ||
			activeSmartWordId === location?.word.id;

		const hasNoStartTime =
			!isAlreadyActive &&
			(unitStartTime === undefined ||
				unitStartTime === null ||
				Number.isNaN(unitStartTime) ||
				(unitStartTime <= 0 && (unitEndTime <= 0 || currentTime > 0)));

		expect(hasNoStartTime).toBe(false);
	});

	it("recognizes word as active if smartWordActiveId matches", () => {
		const store = createStore();
		const lyrics = createSampleLyrics();
		store.set(lyricLinesAtom, lyrics);
		store.set(selectedLinesAtom, new Set(["line-1"]));
		store.set(selectedWordsAtom, new Set(["w-1"]));
		store.set(smartWordActiveIdAtom, "w-1");

		const location = getCurrentLocation(store);
		const activeSmartWordId = store.get(smartWordActiveIdAtom);
		const isAlreadyActive =
			activeSmartWordId === location?.syncId ||
			activeSmartWordId === location?.word.id;

		expect(isAlreadyActive).toBe(true);
	});

	it("identifies prior word when syncing an untimed word in the middle of a line", () => {
		const store = createStore();
		const lyrics = createSampleLyrics();
		// First word was started at 1000
		lyrics.lyricLines[0].words[0].startTime = 1000;
		store.set(lyricLinesAtom, lyrics);
		store.set(selectedLinesAtom, new Set(["line-1"]));
		// User is on second word
		store.set(selectedWordsAtom, new Set(["w-1"]));

		const location = getCurrentLocation(store);
		expect(location).toBeDefined();
		expect(location?.syncIndex).toBe(1);

		// Prior word is syncIndex - 1
		const lineUnits = lyrics.lyricLines[0].words;
		const prevUnit = lineUnits[location!.syncIndex - 1];
		expect(prevUnit.id).toBe("w-0");
		expect(prevUnit.word).toBe("First");
	});
});
