import { describe, expect, it } from "vitest";
import { extractSpotifyTrackId } from "./client";

describe("AppleTtmlApi ID extraction", () => {
	it("extracts Spotify track ID from various URL and string formats", () => {
		expect(
			extractSpotifyTrackId("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"),
		).toBe("4cOdK2wGLETKBW3PvgPWqT");

		expect(
			extractSpotifyTrackId(
				"https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=d12345&context=spotify%3Aalbum",
			),
		).toBe("4cOdK2wGLETKBW3PvgPWqT");

		expect(
			extractSpotifyTrackId("spotify:track:4cOdK2wGLETKBW3PvgPWqT"),
		).toBe("4cOdK2wGLETKBW3PvgPWqT");

		expect(extractSpotifyTrackId("4cOdK2wGLETKBW3PvgPWqT")).toBe(
			"4cOdK2wGLETKBW3PvgPWqT",
		);

		expect(extractSpotifyTrackId("  4cOdK2wGLETKBW3PvgPWqT?si=abc  ")).toBe(
			"4cOdK2wGLETKBW3PvgPWqT",
		);

		expect(extractSpotifyTrackId("")).toBe("");
	});
});
