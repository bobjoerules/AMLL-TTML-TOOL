import { describe, expect, it } from "vitest";
import {
	addChecklistEntry,
	deleteChecklistEntry,
	isTTML100PercentCompleted,
	linkUploadedTTMLToChecklist,
	normalizeChecklistEntries,
	setChecklistEntryCompleted,
	updateChecklistEntry,
} from "./logic";

describe("TTML checklist", () => {
	it("adds newest active entries first", () => {
		const first = addChecklistEntry(
			[],
			{ song: "First", artist: "", notes: "" },
			1,
			"one",
		);
		const entries = addChecklistEntry(
			first,
			{ song: "Second", artist: "Artist", notes: "Idea" },
			2,
			"two",
		);
		expect(entries.map((entry) => entry.id)).toEqual(["two", "one"]);
	});

	it("edits, completes, and deletes entries", () => {
		const initial = addChecklistEntry(
			[],
			{ song: "Song", artist: "", notes: "" },
			1,
			"one",
		);
		const edited = updateChecklistEntry(initial, "one", {
			song: " Song 2 ",
			artist: "Artist",
			notes: "Note",
		});
		expect(edited[0]).toMatchObject({
			song: "Song 2",
			artist: "Artist",
			notes: "Note",
		});
		const completed = setChecklistEntryCompleted(edited, "one", true);
		expect(completed[0]?.completed).toBe(true);
		expect(deleteChecklistEntry(completed, "one")).toEqual([]);
	});

	it("normalizes persisted data and ignores malformed entries", () => {
		const entries = normalizeChecklistEntries([
			{ id: "valid", song: "  Song ", artist: 3, notes: null, completed: true },
			{ song: "Legacy" },
			{ id: "bad", song: "" },
			null,
		]);
		expect(entries).toEqual([
			{
				id: "legacy-1",
				song: "Legacy",
				artist: "",
				notes: "",
				completed: false,
				createdAt: 0,
			},
			{
				id: "valid",
				song: "Song",
				artist: "",
				notes: "",
				completed: true,
				createdAt: 0,
			},
		]);
	});

	it("correctly identifies 100% completed TTML projects", () => {
		expect(isTTML100PercentCompleted({ lyricLines: [] })).toBe(false);

		const incomplete = {
			lyricLines: [
				{
					startTime: 1000,
					endTime: 2000,
					words: [{ word: "Hello", startTime: 1000, endTime: 2000 }],
				},
				{
					startTime: 0,
					endTime: 0,
					words: [{ word: "Unsynced", startTime: 0, endTime: 0 }],
				},
			],
		};
		expect(isTTML100PercentCompleted(incomplete as any)).toBe(false);

		const complete = {
			lyricLines: [
				{
					startTime: 1000,
					endTime: 2000,
					words: [{ word: "Hello", startTime: 1000, endTime: 2000 }],
				},
				{
					startTime: 2500,
					endTime: 4000,
					words: [{ word: "World", startTime: 2500, endTime: 4000 }],
				},
			],
		};
		expect(isTTML100PercentCompleted(complete as any)).toBe(true);
	});

	it("links uploaded TTML with existing checklist entry and sets completion", () => {
		const existing = [
			{
				id: "item-1",
				song: "Blinding Lights",
				artist: "The Weeknd",
				notes: "To do",
				completed: false,
				createdAt: 100,
			},
		];

		const res = linkUploadedTTMLToChecklist(existing, {
			title: "Blinding Lights",
			artist: "The Weeknd",
			album: "After Hours",
			coverArt: "https://example.com/cover.jpg",
			docId: "doc-999",
			isCompleted: true,
		});

		expect(res.added).toBe(false);
		expect(res.updated).toBe(true);
		expect(res.entries[0]).toMatchObject({
			id: "item-1",
			cloudDocId: "doc-999",
			completed: true,
			album: "After Hours",
			coverArt: "https://example.com/cover.jpg",
		});
	});

	it("adds new checklist entry when uploaded TTML does not exist", () => {
		const existing: any[] = [];
		const res = linkUploadedTTMLToChecklist(existing, {
			title: "New Track",
			artist: "New Artist",
			docId: "doc-123",
			isCompleted: false,
		});

		expect(res.added).toBe(true);
		expect(res.entries).toHaveLength(1);
		expect(res.entries[0].song).toBe("New Track");
		expect(res.entries[0].cloudDocId).toBe("doc-123");
		expect(res.entries[0].completed).toBe(false);
	});
});
