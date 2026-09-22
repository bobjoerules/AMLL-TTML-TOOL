import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import type { CloudTTMLMetadata } from "./types";
import {
	backgroundModeAtom,
	selectedGradientAtom,
	useCustomGradientAtom,
} from "$/modules/settings/states";
import {
	customBackgroundImageAtom,
	hasCustomBackgroundAtom,
} from "$/modules/settings/modals/customBackground";

describe("Cloud song grouping & stats calculation", () => {
	const sampleList: CloudTTMLMetadata[] = [
		{
			id: "doc-1",
			title: "Blinding Lights",
			artist: "The Weeknd",
			album: "After Hours",
			lineCount: 40,
			durationMs: 200000,
			createdAt: 1000,
			updatedAt: 1000,
			authorUid: "user-1",
			publishedToCommunity: false,
		},
		{
			id: "doc-2",
			title: "Blinding Lights",
			artist: "The Weeknd",
			album: "After Hours",
			lineCount: 45,
			durationMs: 200000,
			createdAt: 2000,
			updatedAt: 2000,
			authorUid: "user-1",
			publishedToCommunity: true,
		},
		{
			id: "doc-3",
			title: "Starboy",
			artist: "The Weeknd",
			album: "Starboy",
			lineCount: 50,
			durationMs: 230000,
			createdAt: 1500,
			updatedAt: 1500,
			authorUid: "user-1",
			publishedToCommunity: false,
		},
	];

	it("groups multiple versions of the same song together and sorts latest first", () => {
		const map = new Map<string, CloudTTMLMetadata[]>();
		for (const item of sampleList) {
			const key = `${(item.title || "Untitled").trim().toLowerCase()}:::${(item.artist || "").trim().toLowerCase()}`;
			const existing = map.get(key);
			if (existing) {
				existing.push(item);
			} else {
				map.set(key, [item]);
			}
		}

		expect(map.size).toBe(2);

		const blindingLightsVersions = map.get("blinding lights:::the weeknd")!;
		expect(blindingLightsVersions).toHaveLength(2);
		blindingLightsVersions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
		expect(blindingLightsVersions[0].id).toBe("doc-2");
		expect(blindingLightsVersions[1].id).toBe("doc-1");
	});

	it("counts each unique song only once for public and private totals", () => {
		const map = new Map<string, CloudTTMLMetadata[]>();
		for (const item of sampleList) {
			const key = `${(item.title || "Untitled").trim().toLowerCase()}:::${(item.artist || "").trim().toLowerCase()}`;
			const existing = map.get(key);
			if (existing) {
				existing.push(item);
			} else {
				map.set(key, [item]);
			}
		}

		const groups = Array.from(map.values()).map((versions) => ({
			isPublic: versions.some((v) => v.publishedToCommunity),
		}));

		const uniqueSongsCount = groups.length;
		const publicCount = groups.filter((g) => g.isPublic).length;
		const privateCount = uniqueSongsCount - publicCount;

		expect(uniqueSongsCount).toBe(2);
		expect(publicCount).toBe(1); // Blinding Lights is public because v2 was published
		expect(privateCount).toBe(1); // Starboy is private
		expect(publicCount + privateCount).toBe(uniqueSongsCount);
	});
});

describe("hasCustomBackgroundAtom", () => {
	it("evaluates correctly for none, gradient, and image modes", async () => {
		const store = createStore();

		// Initially none
		expect(store.get(hasCustomBackgroundAtom)).toBe(false);

		// Gradient mode
		store.set(backgroundModeAtom, "gradient");
		store.set(selectedGradientAtom, "sunset");
		expect(store.get(hasCustomBackgroundAtom)).toBe(true);

		// Custom gradient mode
		store.set(selectedGradientAtom, "");
		store.set(useCustomGradientAtom, true);
		expect(store.get(hasCustomBackgroundAtom)).toBe(true);

		// Image mode without image
		store.set(backgroundModeAtom, "image");
		expect(store.get(hasCustomBackgroundAtom)).toBe(false);

		// Image mode with image
		const mockBlob = new Blob(["dummy"], { type: "image/png" });
		await store.set(customBackgroundImageAtom, mockBlob);
		expect(store.get(hasCustomBackgroundAtom)).toBe(true);

		// Clear image
		await store.set(customBackgroundImageAtom, null);
		expect(store.get(hasCustomBackgroundAtom)).toBe(false);
	});
});
