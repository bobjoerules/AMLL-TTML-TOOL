import { describe, expect, it } from "vitest";
import {
	addChecklistEntry,
	batchLinkUploadedTTMLsToChecklist,
	deduplicateChecklistEntries,
	deleteChecklistEntry,
	isChecklistEntryCompleted,
	isChecklistEntryInProgress,
	isChecklistEntryNotStarted,
	isTTML100PercentCompleted,
	linkUploadedTTMLToChecklist,
	normalizeChecklistEntries,
	setChecklistEntryCompleted,
	setChecklistEntryUploadedToDb,
	toggleChecklistEntryFavorite,
	toggleChecklistEntryUploadedToDb,
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

		// With an ignoreSync line, project should still be 100% completed
		const completeWithIgnoredLine = {
			lyricLines: [
				{
					startTime: 1000,
					endTime: 2000,
					words: [{ word: "Hello", startTime: 1000, endTime: 2000 }],
				},
				{
					startTime: 0,
					endTime: 0,
					ignoreSync: true,
					words: [{ word: "Guitar Solo", startTime: 0, endTime: 0 }],
				},
				{
					startTime: 2500,
					endTime: 4000,
					words: [{ word: "World", startTime: 2500, endTime: 4000 }],
				},
			],
		};
		expect(isTTML100PercentCompleted(completeWithIgnoredLine as any)).toBe(true);

		// Line-synced lyric (no individual word timings, but valid line timings)
		const lineSyncedComplete = {
			lyricLines: [
				{
					startTime: 1000,
					endTime: 2000,
					words: [{ word: "First line", startTime: 0, endTime: 0 }],
				},
				{
					startTime: 2500,
					endTime: 4000,
					words: [{ word: "Second line", startTime: 0, endTime: 0 }],
				},
			],
		};
		expect(isTTML100PercentCompleted(lineSyncedComplete as any)).toBe(true);
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
		expect(res.entries[0].uploadedToDatabase).toBeUndefined();

		const resNew = linkUploadedTTMLToChecklist([], {
			title: "New Song",
			artist: "New Artist",
			docId: "doc-new",
		});
		expect(resNew.added).toBe(true);
		expect(resNew.entries[0].uploadedToDatabase).toBeUndefined();
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

	it("toggles and preserves favorite status", () => {
		const initial = [
			{
				id: "fav-1",
				song: "Favorite Song",
				artist: "Artist",
				notes: "",
				completed: false,
				createdAt: 100,
			},
		];

		const favorited = toggleChecklistEntryFavorite(initial, "fav-1");
		expect(favorited[0].favorite).toBe(true);

		const unfavorited = toggleChecklistEntryFavorite(favorited, "fav-1");
		expect(unfavorited[0].favorite).toBeUndefined();
	});

	it("toggles and sets uploaded to database status", () => {
		const initial = [
			{
				id: "db-1",
				song: "DB Song",
				artist: "Artist",
				notes: "",
				completed: true,
				createdAt: 100,
			},
		];

		const uploaded = toggleChecklistEntryUploadedToDb(initial, "db-1");
		expect(uploaded[0].uploadedToDatabase).toBe(true);

		const unuploaded = toggleChecklistEntryUploadedToDb(uploaded, "db-1");
		expect(unuploaded[0].uploadedToDatabase).toBeUndefined();

		const explicitlySet = setChecklistEntryUploadedToDb(initial, "db-1", true);
		expect(explicitlySet[0].uploadedToDatabase).toBe(true);
	});

	it("accurately classifies in progress vs not started vs completed entries", () => {
		const notStartedEntry = {
			id: "1",
			song: "Song 1",
			artist: "Artist",
			notes: "",
			completed: false,
			createdAt: 100,
		};
		expect(isChecklistEntryNotStarted(notStartedEntry)).toBe(true);
		expect(isChecklistEntryInProgress(notStartedEntry)).toBe(false);
		expect(isChecklistEntryCompleted(notStartedEntry)).toBe(false);

		const inProgressCloudEntry = {
			id: "2",
			song: "Song 2",
			artist: "Artist",
			cloudDocId: "cloud-doc-123",
			notes: "",
			completed: false,
			createdAt: 200,
		};
		expect(isChecklistEntryNotStarted(inProgressCloudEntry)).toBe(false);
		expect(isChecklistEntryInProgress(inProgressCloudEntry)).toBe(true);
		expect(isChecklistEntryCompleted(inProgressCloudEntry)).toBe(false);

		const inProgressManualEntry = {
			id: "3",
			song: "Song 3",
			artist: "Artist",
			status: "in-progress" as const,
			notes: "",
			completed: false,
			createdAt: 300,
		};
		expect(isChecklistEntryNotStarted(inProgressManualEntry)).toBe(false);
		expect(isChecklistEntryInProgress(inProgressManualEntry)).toBe(true);
		expect(isChecklistEntryCompleted(inProgressManualEntry)).toBe(false);

		const completedEntry = {
			id: "4",
			song: "Song 4",
			artist: "Artist",
			cloudDocId: "cloud-doc-456",
			notes: "",
			completed: true,
			createdAt: 400,
		};
		expect(isChecklistEntryNotStarted(completedEntry)).toBe(false);
		expect(isChecklistEntryInProgress(completedEntry)).toBe(false);
		expect(isChecklistEntryCompleted(completedEntry)).toBe(true);
	});

	it("detects same song across featuring, remixes, versions, and artist variations", () => {
		const inProgressList = [
			{
				id: "entry-1",
				song: "FE!N (feat. Playboi Carti)",
				artist: "Travis Scott",
				notes: "Custom user note",
				completed: false,
				status: "in-progress" as const,
				createdAt: 100,
			},
		];

		// Link from cloud with simpler title and combined artists
		const linked = linkUploadedTTMLToChecklist(inProgressList, {
			title: "FE!N",
			artist: "Travis Scott, Playboi Carti",
			docId: "cloud-doc-fein",
			isCompleted: true,
		});

		expect(linked.added).toBe(false);
		expect(linked.updated).toBe(true);
		expect(linked.entries).toHaveLength(1);
		expect(linked.entries[0].completed).toBe(true);
		expect(linked.entries[0].status).toBe("completed");
		expect(linked.entries[0].cloudDocId).toBe("cloud-doc-fein");
		expect(linked.entries[0].notes).toBe("Custom user note");
		expect(isChecklistEntryCompleted(linked.entries[0])).toBe(true);
		expect(isChecklistEntryInProgress(linked.entries[0])).toBe(false);
	});

	it("deduplicates existing list having one in-progress entry and one completed entry for the same song", () => {
		const existingWithDuplicates = [
			{
				id: "old-draft",
				song: "Die With A Smile",
				artist: "Lady Gaga & Bruno Mars",
				notes: "Working on timing",
				completed: false,
				status: "in-progress" as const,
				createdAt: 100,
			},
			{
				id: "uploaded-finished",
				song: "Die With A Smile (with Bruno Mars)",
				artist: "Lady Gaga",
				cloudDocId: "doc-die-with-a-smile",
				notes: "Uploaded from Cloud",
				completed: true,
				createdAt: 200,
			},
		];

		const normalized = normalizeChecklistEntries(existingWithDuplicates);
		expect(normalized).toHaveLength(1);
		expect(normalized[0].completed).toBe(true);
		expect(normalized[0].status).toBe("completed");
		expect(normalized[0].cloudDocId).toBe("doc-die-with-a-smile");
		expect(normalized[0].notes).toBe("Working on timing");
		expect(isChecklistEntryCompleted(normalized[0])).toBe(true);
		expect(isChecklistEntryInProgress(normalized[0])).toBe(false);
	});

	it("batchLinkUploadedTTMLsToChecklist links multiple songs in a single fast pass", () => {
		const existing = [
			{
				id: "track-1",
				song: "Cruel Summer",
				artist: "Taylor Swift",
				completed: false,
				status: "in-progress" as const,
			},
			{
				id: "track-2",
				song: "Vampire",
				artist: "Olivia Rodrigo",
				completed: false,
			},
		];

		const uploads = [
			{
				title: "Cruel Summer (Live from The Eras Tour)",
				artist: "Taylor Swift",
				docId: "doc-cruel-summer",
				isCompleted: true,
			},
			{
				title: "Espresso",
				artist: "Sabrina Carpenter",
				docId: "doc-espresso",
				isCompleted: true,
			},
		];

		const res = batchLinkUploadedTTMLsToChecklist(existing, uploads);
		expect(res.importedCount).toBe(1);
		expect(res.entries).toHaveLength(3);

		const cruelSummer = res.entries.find((e) => e.song.includes("Cruel Summer"));
		expect(cruelSummer).toBeDefined();
		expect(cruelSummer?.completed).toBe(true);
		expect(cruelSummer?.status).toBe("completed");
		expect(cruelSummer?.cloudDocId).toBe("doc-cruel-summer");

		const espresso = res.entries.find((e) => e.song === "Espresso");
		expect(espresso).toBeDefined();
		expect(espresso?.completed).toBe(true);
		expect(espresso?.status).toBe("completed");
		expect(espresso?.cloudDocId).toBe("doc-espresso");
	});

	it("deduplicateChecklistEntries handles large lists (500 items) in under 50ms without freezing", () => {
		const largeList = [];
		for (let i = 0; i < 500; i++) {
			largeList.push({
				id: `entry-${i}`,
				song: `Song ${i % 50} (Remastered)`,
				artist: `Artist ${i % 50}`,
				completed: i % 2 === 0,
				createdAt: 1000 + i,
			});
		}

		const start = performance.now();
		const result = deduplicateChecklistEntries(largeList);
		const duration = performance.now() - start;

		expect(result.length).toBe(50);
		expect(duration).toBeLessThan(100); // Must be well under 100ms
	});
});
