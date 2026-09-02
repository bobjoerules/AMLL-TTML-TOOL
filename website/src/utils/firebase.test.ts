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

describe("Website Moderator and Permissions", () => {
	it("recognizes the designated moderator user ID", async () => {
		const { isUserModerator } = await import("./firebase");
		expect(isUserModerator("s41Sey8PJUSYHQUsS6aLLb7lsf02")).toBe(true);
		expect(isUserModerator("someOtherUser123")).toBe(false);
		expect(isUserModerator(null)).toBe(false);
		expect(isUserModerator(undefined)).toBe(false);
	});

	it("authorizes deletion only for authors and moderators", async () => {
		const { isUserModerator } = await import("./firebase");
		const song: FinishedTTML = {
			id: "song-1",
			title: "Test Song",
			artist: "Test Artist",
			authorUid: "author-123",
		};

		const canAuthorDelete =
			Boolean(song.authorUid && song.authorUid === "author-123") ||
			isUserModerator("author-123");
		expect(canAuthorDelete).toBe(true);

		const canStrangerDelete =
			Boolean(song.authorUid && song.authorUid === "stranger-999") ||
			isUserModerator("stranger-999");
		expect(canStrangerDelete).toBe(false);

		const canModDelete =
			Boolean(
				song.authorUid && song.authorUid === "s41Sey8PJUSYHQUsS6aLLb7lsf02",
			) || isUserModerator("s41Sey8PJUSYHQUsS6aLLb7lsf02");
		expect(canModDelete).toBe(true);
	});
});
