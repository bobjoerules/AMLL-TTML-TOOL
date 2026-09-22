import { describe, expect, it } from "vitest";
import { extractSpotifyTrackId, isSpotifyTrackId } from "./client";

describe("AppleTtmlApi ID extraction", () => {
	it("extracts Spotify track ID from various URL and string formats", () => {
		expect(
			extractSpotifyTrackId(
				"https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
			),
		).toBe("4cOdK2wGLETKBW3PvgPWqT");

		expect(
			extractSpotifyTrackId(
				"https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=d12345&context=spotify%3Aalbum",
			),
		).toBe("4cOdK2wGLETKBW3PvgPWqT");

		expect(
			extractSpotifyTrackId("open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"),
		).toBe("4cOdK2wGLETKBW3PvgPWqT");

		expect(extractSpotifyTrackId("spotify:track:4cOdK2wGLETKBW3PvgPWqT")).toBe(
			"4cOdK2wGLETKBW3PvgPWqT",
		);

		expect(
			extractSpotifyTrackId("spotify:track:4cOdK2wGLETKBW3PvgPWqT?si=12345"),
		).toBe("4cOdK2wGLETKBW3PvgPWqT");

		expect(extractSpotifyTrackId("4cOdK2wGLETKBW3PvgPWqT")).toBe(
			"4cOdK2wGLETKBW3PvgPWqT",
		);

		expect(extractSpotifyTrackId("  4cOdK2wGLETKBW3PvgPWqT?si=abc  ")).toBe(
			"4cOdK2wGLETKBW3PvgPWqT",
		);

		expect(extractSpotifyTrackId("4cOdK2wGLETKBW3PvgPWqT/")).toBe(
			"4cOdK2wGLETKBW3PvgPWqT",
		);

		// Non-ID queries return empty
		expect(extractSpotifyTrackId("")).toBe("");
		expect(extractSpotifyTrackId("Rick Astley - Never Gonna Give You Up")).toBe(
			"",
		);
	});

	it("identifies valid Spotify track IDs and URLs correctly", () => {
		expect(isSpotifyTrackId("4cOdK2wGLETKBW3PvgPWqT")).toBe(true);
		expect(isSpotifyTrackId("  4cOdK2wGLETKBW3PvgPWqT?si=abc  ")).toBe(true);
		expect(
			isSpotifyTrackId("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"),
		).toBe(true);
		expect(isSpotifyTrackId("open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT")).toBe(
			true,
		);
		expect(isSpotifyTrackId("spotify:track:4cOdK2wGLETKBW3PvgPWqT")).toBe(true);

		// 21 and 23 char IDs
		expect(isSpotifyTrackId("123456789012345678901")).toBe(true);
		expect(isSpotifyTrackId("12345678901234567890123")).toBe(true);

		// General search queries
		expect(isSpotifyTrackId("hello world")).toBe(false);
		expect(isSpotifyTrackId("Rick Astley")).toBe(false);
		expect(isSpotifyTrackId("")).toBe(false);
	});

	it("throws error when track does not exist (null name and artist)", async () => {
		const { AppleTtmlApi } = await import("./client");
		// Mock global fetch to return a stub response like https://lyrics.rmmreviv.al/lyrics?id=3kZk3M80kQTJus45lgRKyv
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async () =>
			({
				ok: true,
				status: 200,
				json: async () => ({
					id: "3kZk3M80kQTJus45lgRKyv",
					name: null,
					artist: null,
					album: null,
					ttml: null,
				}),
			}) as Response;

		try {
			await expect(
				AppleTtmlApi.getLyrics("3kZk3M80kQTJus45lgRKyv"),
			).rejects.toThrow("No song found for this Spotify ID.");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
