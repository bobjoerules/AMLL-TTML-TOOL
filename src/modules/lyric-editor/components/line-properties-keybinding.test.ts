import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import {
	cmdToggleBackground,
	cmdToggleDuet,
} from "$/modules/keyboard/commands";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	ToolMode,
} from "$/states/main";
import { newLyricLine, newLyricWord, type TTMLLyric } from "$/types/ttml";
import { toggleLinePropertyInStore } from "./line-properties-keybinding";

describe("LinePropertiesKeybinding commands and logic", () => {
	it("has KeyB and KeyD as default keybindings", () => {
		expect(cmdToggleBackground.defaultKeys).toEqual(["KeyB"]);
		expect(cmdToggleDuet.defaultKeys).toEqual(["KeyD"]);
	});

	it("toggles background (isBG) in Edit mode for selected lines", () => {
		const store = createStore();
		const line1 = { ...newLyricLine(), id: "line-1", isBG: false };
		const line2 = { ...newLyricLine(), id: "line-2", isBG: false };

		let state: TTMLLyric = {
			metadata: [],
			lyricLines: [line1, line2],
		};
		store.set(lyricLinesAtom, state);
		store.set(selectedLinesAtom, new Set(["line-1"]));

		const editLyricLines = (recipe: (draft: TTMLLyric) => void) => {
			const clone = JSON.parse(JSON.stringify(state));
			recipe(clone);
			state = clone;
			store.set(lyricLinesAtom, state);
		};

		// Turn on isBG
		const toggledOn = toggleLinePropertyInStore(
			store,
			editLyricLines,
			ToolMode.Edit,
			"isBG",
		);
		expect(toggledOn).toBe(true);
		expect(state.lyricLines[0].isBG).toBe(true);
		expect(state.lyricLines[1].isBG).toBe(false);

		// Turn off isBG
		const toggledOff = toggleLinePropertyInStore(
			store,
			editLyricLines,
			ToolMode.Edit,
			"isBG",
		);
		expect(toggledOff).toBe(true);
		expect(state.lyricLines[0].isBG).toBe(false);
	});

	it("toggles duet (isDuet) in Sync mode for selected lines", () => {
		const store = createStore();
		const line1 = { ...newLyricLine(), id: "line-1", isDuet: false };

		let state: TTMLLyric = {
			metadata: [],
			lyricLines: [line1],
		};
		store.set(lyricLinesAtom, state);
		store.set(selectedLinesAtom, new Set(["line-1"]));

		const editLyricLines = (recipe: (draft: TTMLLyric) => void) => {
			const clone = JSON.parse(JSON.stringify(state));
			recipe(clone);
			state = clone;
			store.set(lyricLinesAtom, state);
		};

		// Turn on isDuet
		toggleLinePropertyInStore(store, editLyricLines, ToolMode.Sync, "isDuet");
		expect(state.lyricLines[0].isDuet).toBe(true);

		// Turn off isDuet
		toggleLinePropertyInStore(store, editLyricLines, ToolMode.Sync, "isDuet");
		expect(state.lyricLines[0].isDuet).toBe(false);
	});

	it("infers lines from selected words when selectedLines is empty", () => {
		const store = createStore();
		const word1 = { ...newLyricWord(), id: "w-1", word: "Hello" };
		const line1 = {
			...newLyricLine(),
			id: "line-1",
			words: [word1],
			isDuet: false,
		};

		let state: TTMLLyric = {
			metadata: [],
			lyricLines: [line1],
		};
		store.set(lyricLinesAtom, state);
		store.set(selectedLinesAtom, new Set());
		store.set(selectedWordsAtom, new Set(["w-1"]));

		const editLyricLines = (recipe: (draft: TTMLLyric) => void) => {
			const clone = JSON.parse(JSON.stringify(state));
			recipe(clone);
			state = clone;
			store.set(lyricLinesAtom, state);
		};

		toggleLinePropertyInStore(store, editLyricLines, ToolMode.Edit, "isDuet");
		expect(state.lyricLines[0].isDuet).toBe(true);
	});

	it("does not toggle in Preview mode", () => {
		const store = createStore();
		const line1 = { ...newLyricLine(), id: "line-1", isBG: false };

		const state: TTMLLyric = {
			metadata: [],
			lyricLines: [line1],
		};
		store.set(lyricLinesAtom, state);
		store.set(selectedLinesAtom, new Set(["line-1"]));

		const result = toggleLinePropertyInStore(
			store,
			() => {},
			ToolMode.Preview,
			"isBG",
		);
		expect(result).toBe(false);
	});

	it("does not toggle duet in Sync mode when words are selected", () => {
		const store = createStore();
		const word1 = { ...newLyricWord(), id: "word-1" };
		const line1 = {
			...newLyricLine(),
			id: "line-1",
			words: [word1],
			isDuet: false,
		};

		const state: TTMLLyric = {
			metadata: [],
			lyricLines: [line1],
		};
		store.set(lyricLinesAtom, state);
		store.set(selectedLinesAtom, new Set(["line-1"]));
		store.set(selectedWordsAtom, new Set(["word-1"]));

		const result = toggleLinePropertyInStore(
			store,
			() => {},
			ToolMode.Sync,
			"isDuet",
		);
		expect(result).toBe(false);
	});
});
