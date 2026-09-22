import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import type { CloudTTMLMetadata } from "./types";
import {
	areCloudArtistsCompatible,
	areCloudTTMLsSameSong,
	groupCloudTTMLs,
} from "./songGrouping";
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
		const groups = groupCloudTTMLs(sampleList);

		expect(groups).toHaveLength(2);

		const blindingLights = groups.find((g) => g.title === "Blinding Lights")!;
		expect(blindingLights).toBeDefined();
		expect(blindingLights.versions).toHaveLength(2);
		expect(blindingLights.versions[0].id).toBe("doc-2");
		expect(blindingLights.versions[1].id).toBe("doc-1");
		expect(blindingLights.isPublic).toBe(true);
	});

	it("counts each unique song only once for public and private totals", () => {
		const groups = groupCloudTTMLs(sampleList);

		const uniqueSongsCount = groups.length;
		const publicCount = groups.filter((g) => g.isPublic).length;
		const privateCount = uniqueSongsCount - publicCount;

		expect(uniqueSongsCount).toBe(2);
		expect(publicCount).toBe(1); // Blinding Lights is public because v2 was published
		expect(privateCount).toBe(1); // Starboy is private
		expect(publicCount + privateCount).toBe(uniqueSongsCount);
	});

	it("groups songs with collaborator differences like 'Noah Cyrus, Lil Xan' and 'Noah Cyrus'", () => {
		const listWithDups: CloudTTMLMetadata[] = [
			{
				id: "doc-public",
				title: "Live or Die",
				artist: "Noah Cyrus, Lil Xan",
				album: "Be Safe",
				lineCount: 30,
				durationMs: 166000,
				createdAt: 2000,
				updatedAt: 2000,
				authorUid: "user-1",
				publishedToCommunity: true,
			},
			{
				id: "doc-v3",
				title: "Live or Die",
				artist: "Noah Cyrus",
				album: "Be Safe",
				lineCount: 28,
				durationMs: 166000,
				createdAt: 1000,
				updatedAt: 1000,
				authorUid: "user-1",
				publishedToCommunity: false,
			},
			{
				id: "doc-v2",
				title: "Live or Die",
				artist: "Noah Cyrus",
				album: "Be Safe",
				lineCount: 25,
				durationMs: 166000,
				createdAt: 800,
				updatedAt: 800,
				authorUid: "user-1",
				publishedToCommunity: false,
			},
			{
				id: "doc-v1",
				title: "Live or Die",
				artist: "Noah Cyrus",
				album: "Be Safe",
				lineCount: 20,
				durationMs: 166000,
				createdAt: 500,
				updatedAt: 500,
				authorUid: "user-1",
				publishedToCommunity: false,
			},
		];

		const groups = groupCloudTTMLs(listWithDups);
		expect(groups).toHaveLength(1);
		expect(groups[0].title).toBe("Live or Die");
		expect(groups[0].versions).toHaveLength(4);
		// Latest (doc-public) should be first
		expect(groups[0].versions[0].id).toBe("doc-public");
		expect(groups[0].isPublic).toBe(true);
	});

	it("groups title variations with feat, remaster, and acoustic descriptions", () => {
		const variations: CloudTTMLMetadata[] = [
			{
				id: "var-1",
				title: "Live or Die (feat. Lil Xan)",
				artist: "Noah Cyrus",
				album: "",
				lineCount: 20,
				durationMs: 166000,
				createdAt: 1000,
				updatedAt: 1000,
				authorUid: "user-1",
			},
			{
				id: "var-2",
				title: "Live or Die - Single Version",
				artist: "Noah Cyrus, Lil Xan",
				album: "",
				lineCount: 20,
				durationMs: 166000,
				createdAt: 2000,
				updatedAt: 2000,
				authorUid: "user-1",
			},
		];

		const groups = groupCloudTTMLs(variations);
		expect(groups).toHaveLength(1);
		expect(groups[0].versions).toHaveLength(2);
	});

	it("does not group songs with different primary artists", () => {
		const diffArtists: CloudTTMLMetadata[] = [
			{
				id: "song-1",
				title: "Live or Die",
				artist: "Noah Cyrus",
				album: "",
				lineCount: 20,
				durationMs: 166000,
				createdAt: 1000,
				updatedAt: 1000,
				authorUid: "user-1",
			},
			{
				id: "song-2",
				title: "Live or Die",
				artist: "Apocalyptica",
				album: "",
				lineCount: 20,
				durationMs: 240000,
				createdAt: 2000,
				updatedAt: 2000,
				authorUid: "user-1",
			},
		];

		const groups = groupCloudTTMLs(diffArtists);
		expect(groups).toHaveLength(2);
	});

	it("groups songs with identical audio storage path", () => {
		const sameAudio: CloudTTMLMetadata[] = [
			{
				id: "audio-1",
				title: "Custom Cut Track",
				artist: "Artist",
				album: "",
				lineCount: 10,
				durationMs: 100000,
				createdAt: 1000,
				updatedAt: 1000,
				authorUid: "user-1",
				audioStoragePath: "users/user-1/audio/track_123.mp3",
			},
			{
				id: "audio-2",
				title: "Custom Cut Track (Edited)",
				artist: "Artist",
				album: "",
				lineCount: 12,
				durationMs: 100000,
				createdAt: 2000,
				updatedAt: 2000,
				authorUid: "user-1",
				audioStoragePath: "users/user-1/audio/track_123.mp3",
			},
		];

		const groups = groupCloudTTMLs(sameAudio);
		expect(groups).toHaveLength(1);
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
