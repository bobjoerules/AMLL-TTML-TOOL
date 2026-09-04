import { afterEach, describe, expect, it, vi } from "vitest";
import { extractLyricsFromEmbed, GeniusApi } from "./client";

describe("extractLyricsFromEmbed", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

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
		let queried = "";
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

		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("", { status: 404 }),
		);

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

	it("search enriches hits with album data when missing", async () => {
		const searchPayload = {
			meta: { status: 200 },
			response: {
				hits: [
					{
						result: {
							id: 84851,
							title: "Never Gonna Give You Up",
							primary_artist: { name: "Rick Astley" },
							// album is undefined by default in Genius /search
						},
					},
				],
			},
		};

		const songDetailPayload = {
			meta: { status: 200 },
			response: {
				song: {
					id: 84851,
					title: "Never Gonna Give You Up",
					album: {
						id: 21147,
						name: "Whenever You Need Somebody",
						cover_art_url: "https://example.com/cover.jpg",
					},
				},
			},
		};

		vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
			const urlStr = String(url);
			if (urlStr.includes("/search?")) {
				return new Response(JSON.stringify(searchPayload), { status: 200 });
			}
			if (urlStr.includes("/songs/84851")) {
				return new Response(JSON.stringify(songDetailPayload), { status: 200 });
			}
			return new Response("", { status: 404 });
		});

		try {
			const res = await GeniusApi.search("Never Gonna Give You Up", "test-token");
			expect(res.response.hits).toHaveLength(1);
			const hit = res.response.hits[0];
			expect(hit.result.album).toBeDefined();
			expect(hit.result.album?.name).toBe("Whenever You Need Somebody");
			expect(hit.result.album?.id).toBe(21147);
		} finally {
			vi.restoreAllMocks();
		}
	});
});
