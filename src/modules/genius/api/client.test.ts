import { describe, expect, it } from "vitest";
import { extractLyricsFromEmbed } from "./client";

describe("extractLyricsFromEmbed", () => {
	it("extracts lyrics from Genius's escaped embed payload without evaluating it", () => {
		const embedScript = String.raw`document.write(JSON.parse('\"<div class=\\\"rg_embed_body\\\">First line<br>\\nSecond line\\nI\'m here<\\/div>\"'))`;

		expect(extractLyricsFromEmbed(embedScript)).toBe(
			"First line\nSecond line\nI'm here",
		);
	});

	it("rejects embed responses that do not contain lyrics", () => {
		expect(() => extractLyricsFromEmbed("document.write('nope')")).toThrow(
			"Lyrics were not present",
		);
	});

	it("searchAlbums parses Genius album slug correctly", async () => {
		const { GeniusApi } = await import("./client");
		let queried = "";
		// mock search
		const originalSearch = GeniusApi.search;
		GeniusApi.search = async (q: string) => {
			queried = q;
			return {
				meta: { status: 200 },
				response: {
					hits: [
						{
							result: {
								id: 1,
								title: "Blinding Lights",
								primary_artist: { name: "The Weeknd", id: 100 } as any,
								album: {
									id: 593452,
									name: "After Hours",
									cover_art_url: "https://cover.jpg",
								},
							} as any,
							highlights: [],
							index: "song",
							type: "song",
						},
					],
				},
			};
		};

		try {
			const albums = await GeniusApi.searchAlbums(
				"https://genius.com/albums/The-weeknd/After-hours",
				"fake-key",
			);
			expect(queried).toBe("The weeknd After hours");
			expect(albums).toHaveLength(1);
			expect(albums[0]).toEqual({
				id: 593452,
				name: "After Hours",
				artist: "The Weeknd",
				cover_art_url: "https://cover.jpg",
			});
		} finally {
			GeniusApi.search = originalSearch;
		}
	});
});
