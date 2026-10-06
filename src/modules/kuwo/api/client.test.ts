import { describe, expect, it } from "vitest";
import { KuwoApi } from "./client";

describe("KuwoApi", () => {
	it("returns empty array when query is empty or whitespace", async () => {
		const results = await KuwoApi.search("   ");
		expect(results).toEqual([]);
	});

	it("searchAndGetAudio returns null when given empty title and artist", async () => {
		const result = await KuwoApi.searchAndGetAudio("", "");
		expect(result).toBeNull();
	});
});
