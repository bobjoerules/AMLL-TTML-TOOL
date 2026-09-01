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

	it("deduplicates entries with different apostrophes and merges rich fields", () => {
		const entries = normalizeChecklistEntries([
			{
				id: "item-1",
				song: "wanna grow old (i won't let go)",
				artist: "XXXTENTACION",
				cloudDocId: "cloud-123",
				completed: false,
				createdAt: 100,
			},
			{
				id: "item-2",
				song: "wanna grow old (i won’t let go)",
				artist: "XXXTENTACION",
				source: "genius",
				completed: true,
				createdAt: 200,
			},
		]);

		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			song: "wanna grow old (i won't let go)",
			artist: "XXXTENTACION",
			cloudDocId: "cloud-123",
			source: "genius",
			completed: true,
		});
	});

	it("prevents duplicate entry when adding existing song", () => {
		const initial = [
			{
				id: "existing-1",
				song: "Together on the Sand",
				artist: "NOFX",
				notes: "Original",
				completed: true,
				createdAt: 100,
			},
		];

		const result = addChecklistEntry(initial, {
			song: "together on the sand",
			artist: "NOFX",
			notes: "New Note",
		});

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("existing-1");
		expect(result[0].completed).toBe(true);
		expect(result[0].notes).toContain("Original");
	});
});
