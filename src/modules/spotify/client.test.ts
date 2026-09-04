import { afterEach, describe, expect, it, vi } from "vitest";
import {
	extractSpotifyEmbedData,
	extractSpotifyHtmlFallback,
	isSpotifyUrl,
	parseSpotifyUrl,
	SpotifyResolver,
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

describe("Spotify Embed Data Extraction", () => {
	it("extracts entity data from __NEXT_DATA__ script tag", () => {
		const html = `
			<html>
				<head>
					<script id="__NEXT_DATA__" type="application/json">
						{
							"props": {
								"pageProps": {
									"state": {
										"data": {
											"entity": {
												"name": "Stay",
												"title": "Stay",
												"artists": [{ "name": "Post Malone" }],
												"album": { "name": "Beerbongs & Bentleys" }
											}
										}
									}
								}
							}
						}
					</script>
				</head>
			</html>
		`;

		const data = extractSpotifyEmbedData(html);
		expect(data?.props?.pageProps?.state?.data?.entity?.name).toBe("Stay");
		expect(
			data?.props?.pageProps?.state?.data?.entity?.artists?.[0]?.name,
		).toBe("Post Malone");
	});

	it("falls back to regex matching if script tag isn't closed strictly", () => {
		const html = `<div>{"props":{"pageProps":{"state":{"data":{"entity":{"name":"Hello","artists":[{"name":"Martin Solveig"}]}}}}}}</div>`;
		const data = extractSpotifyEmbedData(html);
		expect(data?.props?.pageProps?.state?.data?.entity?.name).toBe("Hello");
	});
});

describe("Spotify HTML Fallback Extraction", () => {
	it("extracts title and artist from <title> tag for tracks", () => {
		const html = `<title>Never Gonna Give You Up - song and lyrics by Rick Astley | Spotify</title>`;
		const meta = extractSpotifyHtmlFallback(html);
		expect(meta.title).toBe("Never Gonna Give You Up");
		expect(meta.artist).toBe("Rick Astley");
	});

	it("extracts title and artist from <title> tag for albums", () => {
		const html = `<title>Emotion (Deluxe) - Album by Carly Rae Jepsen | Spotify</title>`;
		const meta = extractSpotifyHtmlFallback(html);
		expect(meta.title).toBe("Emotion (Deluxe)");
		expect(meta.artist).toBe("Carly Rae Jepsen");
	});

	it("extracts artist and title from data-testid elements in embed HTML", () => {
		const html = `
			<h1 data-testid="entity-title"><a>Stay</a></h1>
			<h2 data-testid="subtitle"><span><a href="#">The Kid LAROI & Justin Bieber</a></span></h2>
		`;
		const meta = extractSpotifyHtmlFallback(html);
		expect(meta.title).toBe("Stay");
		expect(meta.artist).toBe("The Kid LAROI & Justin Bieber");
	});

	it("extracts artist and album from og:description", () => {
		const html = `
			<meta property="og:title" content="Stay" />
			<meta property="og:description" content="Post Malone · Beerbongs & Bentleys · Song · 2018" />
		`;
		const meta = extractSpotifyHtmlFallback(html);
		expect(meta.title).toBe("Stay");
		expect(meta.artist).toBe("Post Malone");
		expect(meta.album).toBe("Beerbongs & Bentleys");
	});
});

describe("SpotifyResolver Track and Album Resolution", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("resolves track with correct artist from embed HTML", async () => {
		const mockHtml = `
			<script id="__NEXT_DATA__" type="application/json">
				{
					"props": {
						"pageProps": {
							"state": {
								"data": {
									"entity": {
										"title": "Stay",
										"artists": [{ "name": "Post Malone" }],
										"album": { "name": "Beerbongs & Bentleys" },
										"visual": { "url": "https://example.com/stay.jpg" }
									}
								}
							}
						}
					}
				}
			</script>
		`;

		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(mockHtml, { status: 200 }),
		);

		const result = await SpotifyResolver.resolveTrack(
			"https://open.spotify.com/track/4H7WNRErSbONkM06blBoGc",
		);

		expect(result).not.toBeNull();
		expect(result?.title).toBe("Stay");
		expect(result?.artist).toBe("Post Malone");
		expect(result?.album).toBe("Beerbongs & Bentleys");
		expect(result?.cover).toBe("https://example.com/stay.jpg");
	});

	it("does not fabricate a different artist for songs with common titles if only oEmbed succeeds", async () => {
		const oembedJson = {
			title: "Stay",
			thumbnail_url: "https://example.com/thumb.jpg",
		};

		// 1. Embed fetch fails
		// 2. RMM lyrics fetch fails
		// 3. oEmbed succeeds
		// 4. RMM search fails / no match
		vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
			const urlStr = String(url);
			if (urlStr.includes("embed/track")) {
				return new Response("", { status: 404 });
			}
			if (urlStr.includes("lyrics.rmmreviv.al/lyrics")) {
				return new Response("", { status: 404 });
			}
			if (urlStr.includes("open.spotify.com/oembed")) {
				return new Response(JSON.stringify(oembedJson), { status: 200 });
			}
			if (urlStr.includes("lyrics.rmmreviv.al/search")) {
				return new Response(JSON.stringify({ results: [] }), { status: 200 });
			}
			return new Response("", { status: 404 });
		});

		const result = await SpotifyResolver.resolveTrack(
			"https://open.spotify.com/track/unknownTrackId12345",
		);

		expect(result).not.toBeNull();
		expect(result?.title).toBe("Stay");
		// Crucially, it must NOT pick a random artist like "Rihanna" for "Stay"!
		expect(result?.artist).toBe("");
	});

	it("resolves album and tracks with artwork from visualIdentity", async () => {
		const mockAlbumHtml = `
			<script id="__NEXT_DATA__" type="application/json">
				{
					"props": {
						"pageProps": {
							"state": {
								"data": {
									"entity": {
										"title": "beerbongs & bentleys",
										"subtitle": "Post Malone",
										"visualIdentity": {
											"image": [
												{ "url": "https://example.com/300.jpg", "width": 300, "height": 300 },
												{ "url": "https://example.com/64.jpg", "width": 64, "height": 64 },
												{ "url": "https://example.com/640.jpg", "width": 640, "height": 640 }
											]
										},
										"trackList": [
											{ "title": "Paranoid", "subtitle": "Post Malone" },
											{ "title": "Spoil My Night", "subtitle": "Post Malone feat. Swae Lee" }
										]
									}
								}
							}
						}
					}
				}
			</script>
		`;

		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(mockAlbumHtml, { status: 200 }),
		);

		const result = await SpotifyResolver.resolveAlbum(
			"https://open.spotify.com/album/6trNtQUgC8btVUIOZY50F4",
		);

		expect(result).not.toBeNull();
		expect(result?.title).toBe("beerbongs & bentleys");
		expect(result?.artist).toBe("Post Malone");
		expect(result?.cover).toBe("https://example.com/640.jpg");
		expect(result?.tracks.length).toBe(2);
		expect(result?.tracks[0].cover).toBe("https://example.com/640.jpg");
		expect(result?.tracks[1].cover).toBe("https://example.com/640.jpg");
	});
});
