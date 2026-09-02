import { describe, it, expect } from "vitest";
import { normalizeSongKey, getSongKey, type FinishedTTML } from "./firebase";

describe("Website Finished TTML Deduplication", () => {
	it("normalizes song keys correctly across typography and punctuation", () => {
		expect(normalizeSongKey("wanna grow old (i won't let go)")).toBe(
			"wannagrowoldiwontletgo",
		);
		expect(normalizeSongKey("wanna grow old (i won’t let go)")).toBe(
			"wannagrowoldiwontletgo",
		);
		expect(
			getSongKey("wanna grow old (i won't let go)", "Lady Gaga & Bruno Mars"),
		).toBe("wannagrowoldiwontletgo:::ladygagaandbrunomars");
		expect(
			getSongKey("wanna grow old (i won’t let go)", "Lady Gaga & Bruno Mars"),
		).toBe("wannagrowoldiwontletgo:::ladygagaandbrunomars");
	});

	it("keeps only the newest version of an uploaded song", () => {
		const uploads: FinishedTTML[] = [
			{
				id: "upload-1",
				title: "wanna grow old (i won't let go)",
				artist: "Lady Gaga & Bruno Mars",
				createdAt: 1000,
				updatedAt: 1000,
				lineCount: 20,
			},
			{
				id: "upload-2",
				title: "wanna grow old (i won’t let go)",
				artist: "Lady Gaga & Bruno Mars",
				createdAt: 1000,
				updatedAt: 5000, // newer version
				lineCount: 25,
			},
			{
				id: "upload-3",
				title: "Blinding Lights",
				artist: "The Weeknd",
				createdAt: 3000,
				updatedAt: 3000,
				lineCount: 40,
			},
		];

		const latestBySong = new Map<string, FinishedTTML>();
		for (const item of uploads) {
			const key = getSongKey(item.title, item.artist);
			const existing = latestBySong.get(key);
			if (!existing) {
				latestBySong.set(key, item);
				continue;
			}
			const itemTime = item.updatedAt || item.createdAt || 0;
			const existingTime = existing.updatedAt || existing.createdAt || 0;
			if (itemTime > existingTime) {
				latestBySong.set(key, item);
			}
		}

		const results = Array.from(latestBySong.values());
		expect(results).toHaveLength(2);

		const wannaGrowOld = results.find((r) => r.id === "upload-2");
		expect(wannaGrowOld).toBeDefined();
		expect(wannaGrowOld?.lineCount).toBe(25);
		expect(wannaGrowOld?.updatedAt).toBe(5000);
	});
});
