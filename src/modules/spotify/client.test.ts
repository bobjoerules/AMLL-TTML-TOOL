import { describe, expect, it } from "vitest";
import {
	isSpotifyUrl,
	parseSpotifyUrl,
} from "./client";

describe("SpotifyResolver URL Parsing", () => {
	it("detects Spotify URLs correctly", () => {
		expect(
			isSpotifyUrl("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"),
		).toBe(true);
		expect(
			isSpotifyUrl("http://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3?si=123"),
		).toBe(true);
		expect(isSpotifyUrl("spotify:track:4cOdK2wGLETKBW3PvgPWqT")).toBe(true);
		expect(isSpotifyUrl("spotify:album:1DFixLWuPkv3KT3TnV35m3")).toBe(true);
		expect(isSpotifyUrl("https://genius.com/albums/test")).toBe(false);
		expect(isSpotifyUrl("hello world")).toBe(false);
	});

	it("extracts type and ID from track and album URLs", () => {
		expect(
			parseSpotifyUrl("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc"),
		).toEqual({
			type: "track",
			id: "4cOdK2wGLETKBW3PvgPWqT",
		});

		expect(
			parseSpotifyUrl("https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3"),
		).toEqual({
			type: "album",
			id: "1DFixLWuPkv3KT3TnV35m3",
		});

		expect(parseSpotifyUrl("spotify:track:123456")).toEqual({
			type: "track",
			id: "123456",
		});
	});
});
