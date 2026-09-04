import { describe, expect, it, vi } from "vitest";
import {
	saveChecklistToCloud,
	loadChecklistFromCloud,
	parseChecklistJson,
	exportChecklistToFile,
} from "./cloudSync";

vi.mock("$/modules/cloud/firebase", () => ({
	getFirebaseFirestore: vi.fn(),
	isFirebaseConfigured: vi.fn().mockReturnValue(false),
}));

vi.mock("$/utils/fileSystem", () => ({
	saveFile: vi.fn().mockResolvedValue("ttml-checklist.json"),
}));

describe("TTML checklist cloud sync & file helpers", () => {
	it("gracefully returns failure when Firebase is not configured", async () => {
		const saved = await saveChecklistToCloud([], "user-123");
		expect(saved.success).toBe(false);

		const loaded = await loadChecklistFromCloud("user-123");
		expect(loaded.entries).toBeNull();
	});

	it("parses valid JSON array of checklist entries", () => {
		const json = JSON.stringify([
			{ id: "1", song: "Test Song", artist: "Test Artist", completed: false },
		]);
		const parsed = parseChecklistJson(json);
		expect(parsed).toHaveLength(1);
		expect(parsed[0].song).toBe("Test Song");
		expect(parsed[0].artist).toBe("Test Artist");
	});

	it("parses valid wrapped JSON with entries property", () => {
		const json = JSON.stringify({
			version: 1,
			entries: [
				{ id: "2", song: "Wrapped Song", artist: "Artist 2", completed: true },
			],
		});
		const parsed = parseChecklistJson(json);
		expect(parsed).toHaveLength(1);
		expect(parsed[0].song).toBe("Wrapped Song");
		expect(parsed[0].completed).toBe(true);
	});

	it("returns empty array for invalid JSON or empty string", () => {
		expect(parseChecklistJson("")).toEqual([]);
		expect(parseChecklistJson("{ invalid json }")).toEqual([]);
		expect(parseChecklistJson("123")).toEqual([]);
	});

	it("exports checklist to file without error", async () => {
		await expect(
			exportChecklistToFile([
				{
					id: "test",
					song: "Song A",
					artist: "Artist A",
					notes: "",
					completed: false,
					createdAt: 12345,
				},
			]),
		).resolves.not.toThrow();
	});

	it("gracefully handles syncFinishedCloudTTMLsToChecklist when Firebase is not configured", async () => {
		const { syncFinishedCloudTTMLsToChecklist } = await import("./cloudSync");
		const res = await syncFinishedCloudTTMLsToChecklist(
			[
				{
					id: "1",
					song: "S",
					artist: "A",
					notes: "",
					completed: false,
					createdAt: 1,
				},
			],
			"user-123",
		);
		expect(res.importedCount).toBe(0);
		expect(res.entries).toHaveLength(1);
	});
});
