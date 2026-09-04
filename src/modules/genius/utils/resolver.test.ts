import { afterEach, describe, expect, it, vi } from "vitest";
import {
	extractPageData,
	extractSongMetaFromHtml,
	GeniusResolver,
	isGeniusAlbumUrl,
	isGeniusSongUrl,
	isGeniusUrl,
	parseGeniusUrl,
} from "./resolver";

describe("GeniusResolver URL parsing & detection", () => {
	it("detects Genius album URLs correctly", () => {
		expect(
			isGeniusAlbumUrl("https://genius.com/albums/The-weeknd/After-hours"),
		).toBe(true);
		expect(
			isGeniusAlbumUrl(
				"http://genius.com/albums/Taylor-swift/1989-taylors-version",
			),
		).toBe(true);
		expect(isGeniusAlbumUrl("https://genius.com/albums/596700")).toBe(true);

		// Non-album URLs
		expect(
			isGeniusAlbumUrl("https://genius.com/The-weeknd-blinding-lights-lyrics"),
		).toBe(false);
		expect(isGeniusAlbumUrl("https://genius.com/artists/The-weeknd")).toBe(
			false,
		);
		expect(isGeniusAlbumUrl("https://open.spotify.com/album/12345")).toBe(
			false,
		);
		expect(isGeniusAlbumUrl("")).toBe(false);
	});

	it("detects Genius song URLs correctly", () => {
		expect(
			isGeniusSongUrl("https://genius.com/The-weeknd-blinding-lights-lyrics"),
		).toBe(true);
		expect(
			isGeniusSongUrl("http://genius.com/Coldplay-yellow-lyrics#about"),
		).toBe(true);
		expect(isGeniusSongUrl("https://genius.com/songs/5049949")).toBe(true);
		expect(isGeniusSongUrl("genius://songs/5049949")).toBe(true);

		// Non-song URLs
		expect(
			isGeniusSongUrl("https://genius.com/albums/The-weeknd/After-hours"),
		).toBe(false);
		expect(isGeniusSongUrl("https://genius.com/artists/The-weeknd")).toBe(
			false,
		);
		expect(isGeniusSongUrl("https://genius.com/tags/pop")).toBe(false);
		expect(isGeniusSongUrl("https://open.spotify.com/track/12345")).toBe(false);
		expect(isGeniusSongUrl("")).toBe(false);
	});

	it("identifies any Genius entity with isGeniusUrl", () => {
		expect(
			isGeniusUrl("https://genius.com/albums/The-weeknd/After-hours"),
		).toBe(true);
		expect(
			isGeniusUrl("https://genius.com/The-weeknd-blinding-lights-lyrics"),
		).toBe(true);
		expect(isGeniusUrl("https://open.spotify.com/track/123")).toBe(false);
	});

	it("parses Genius URLs into structured identifiers", () => {
		expect(
			parseGeniusUrl("https://genius.com/albums/The-weeknd/After-hours"),
		).toEqual({
			type: "album",
			artistSlug: "The-weeknd",
			titleSlug: "After-hours",
			url: "https://genius.com/albums/The-weeknd/After-hours",
		});

		expect(parseGeniusUrl("https://genius.com/albums/596700")).toEqual({
			type: "album",
			id: 596700,
			url: "https://genius.com/albums/596700",
		});

		expect(
			parseGeniusUrl("https://genius.com/The-weeknd-blinding-lights-lyrics"),
		).toEqual({
			type: "song",
			songSlug: "The-weeknd-blinding-lights-lyrics",
			url: "https://genius.com/The-weeknd-blinding-lights-lyrics",
		});

		expect(parseGeniusUrl("https://genius.com/songs/5049949")).toEqual({
			type: "song",
			id: 5049949,
			url: "https://genius.com/songs/5049949",
		});

		expect(parseGeniusUrl("genius://songs/5049949")).toEqual({
			type: "song",
			id: 5049949,
			url: "genius://songs/5049949",
		});
	});
});

describe("HTML metadata extraction", () => {
	it("extracts page_data JSON from meta tags with HTML entity encoding", () => {
		const payload = {
			album: {
				id: 596700,
				name: "After Hours",
				cover_art_url: "https://images.genius.com/cover.jpg",
			},
			album_appearances: [
				{
					track_number: 1,
					song: {
						id: 5049949,
						title: "Alone Again",
						primary_artist: { name: "The Weeknd" },
					},
				},
			],
		};

		const encodedJson = JSON.stringify(payload)
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
		const html = `<html><head><meta content="${encodedJson}" itemprop="page_data"></head><body></body></html>`;

		const extracted = extractPageData(html);
		expect(extracted).toEqual(payload);
	});

	it("extracts song metadata from OpenGraph and Twitter meta tags as fallback", () => {
		const html = `
			<html>
				<head>
					<meta property="og:title" content="The Weeknd&nbsp;– Blinding Lights Lyrics | Genius Lyrics" />
					<meta property="og:image" content="https://images.genius.com/artwork.jpg" />
					<meta property="twitter:app:url:iphone" content="genius://songs/5049949" />
				</head>
			</html>
		`;

		const meta = extractSongMetaFromHtml(html);
		expect(meta.id).toBe(5049949);
		expect(meta.artist).toBe("The Weeknd");
		expect(meta.title).toBe("Blinding Lights");
		expect(meta.cover).toBe("https://images.genius.com/artwork.jpg");
	});
});

describe("GeniusResolver resolution", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("resolves album link into structured tracks using page_data", async () => {
		const albumData = {
			album: {
				id: 596700,
				name: "After Hours",
				cover_art_url: "https://images.genius.com/cover.jpg",
				artist: { name: "The Weeknd" },
			},
			album_appearances: [
				{
					track_number: 1,
					song: {
						id: 5049941,
						title: "Alone Again",
						primary_artist: { name: "The Weeknd" },
						song_art_image_url: "https://images.genius.com/song1.jpg",
					},
				},
				{
					track_number: 2,
					song: {
						id: 5049942,
						title: "Too Late",
						primary_artist: { name: "The Weeknd" },
						song_art_image_url: "https://images.genius.com/song2.jpg",
					},
				},
			],
		};

		const encoded = JSON.stringify(albumData).replace(/"/g, "&quot;");
		const fakeHtml = `<html><head><meta content="${encoded}" itemprop="page_data"></head></html>`;

		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(fakeHtml, {
				status: 200,
				headers: { "content-type": "text/html" },
			}),
		);

		const result = await GeniusResolver.resolveAlbum(
			"https://genius.com/albums/The-weeknd/After-hours",
		);

		expect(result).not.toBeNull();
		expect(result?.title).toBe("After Hours");
		expect(result?.artist).toBe("The Weeknd");
		expect(result?.tracks).toHaveLength(2);
		expect(result?.tracks[0]).toEqual({
			number: 1,
			title: "Alone Again",
			artist: "The Weeknd",
			album: "After Hours",
			cover: "https://images.genius.com/song1.jpg",
			id: 5049941,
		});
		expect(result?.tracks[1].title).toBe("Too Late");
	});

	it("resolves song link into song metadata using page_data", async () => {
		const songData = {
			song: {
				id: 5049949,
				title: "Blinding Lights",
				primary_artist: { name: "The Weeknd" },
				album: { id: 596700, name: "After Hours" },
				song_art_image_url: "https://images.genius.com/blinding.jpg",
				release_date: "2019-11-29",
				url: "https://genius.com/The-weeknd-blinding-lights-lyrics",
			},
		};

		const encoded = JSON.stringify(songData).replace(/"/g, "&quot;");
		const fakeHtml = `<html><head><meta content="${encoded}" itemprop="page_data"></head></html>`;

		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(fakeHtml, {
				status: 200,
				headers: { "content-type": "text/html" },
			}),
		);

		const result = await GeniusResolver.resolveSong(
			"https://genius.com/The-weeknd-blinding-lights-lyrics",
		);

		expect(result).not.toBeNull();
		expect(result?.id).toBe(5049949);
		expect(result?.title).toBe("Blinding Lights");
		expect(result?.artist).toBe("The Weeknd");
		expect(result?.album).toBe("After Hours");
		expect(result?.albumId).toBe(596700);
		expect(result?.cover).toBe("https://images.genius.com/blinding.jpg");
	});

	it("resolves song link using meta tags fallback if page_data is absent", async () => {
		const fakeHtml = `
			<html>
				<head>
					<meta property="og:title" content="The Weeknd – Blinding Lights" />
					<meta property="og:image" content="https://images.genius.com/blinding.jpg" />
					<meta property="twitter:app:url:iphone" content="genius://songs/5049949" />
				</head>
			</html>
		`;

		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(fakeHtml, {
				status: 200,
				headers: { "content-type": "text/html" },
			}),
		);

		const result = await GeniusResolver.resolveSong(
			"https://genius.com/The-weeknd-blinding-lights-lyrics",
		);

		expect(result).not.toBeNull();
		expect(result?.id).toBe(5049949);
		expect(result?.title).toBe("Blinding Lights");
		expect(result?.artist).toBe("The Weeknd");
		expect(result?.cover).toBe("https://images.genius.com/blinding.jpg");
	});
});
