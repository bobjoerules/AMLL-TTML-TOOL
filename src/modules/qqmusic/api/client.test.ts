import { describe, expect, it } from "vitest";
import { QqMusicApi } from "./client";

describe("QqMusicApi", () => {
	it("returns empty array when query is empty or whitespace", async () => {
		const results = await QqMusicApi.search("   ");
		expect(results).toEqual([]);
	});

	it("searchAndGetAudio returns null when given empty title and artist", async () => {
		const result = await QqMusicApi.searchAndGetAudio("", "");
		expect(result).toBeNull();
	});
});
