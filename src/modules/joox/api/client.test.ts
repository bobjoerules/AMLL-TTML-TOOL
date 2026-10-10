import { describe, expect, it, vi } from "vitest";
import { JooxApi } from "./client";

describe("JooxApi", () => {
	it("returns empty array for empty search queries", async () => {
		const results = await JooxApi.search("   ");
		expect(results).toEqual([]);
	});

	it("selects correct audio stream based on quality preference", () => {
		const links = {
			无损FLAC: "https://example.com/audio.flac",
			"MP3 320": "https://example.com/audio-320.mp3",
			"MP3 128": "https://example.com/audio-128.mp3",
			"AAC 192": "https://example.com/audio-192.m4a",
		};

		const defaultBest = JooxApi.getBestAudioUrl(links, "320");
		expect(defaultBest).toEqual({
			url: "https://example.com/audio-320.mp3",
			ext: "mp3",
			qualityName: "MP3 320k",
		});

		const flacBest = JooxApi.getBestAudioUrl(links, "flac");
		expect(flacBest).toEqual({
			url: "https://example.com/audio.flac",
			ext: "flac",
			qualityName: "FLAC",
		});

		const lqBest = JooxApi.getBestAudioUrl(links, "128");
		expect(lqBest).toEqual({
			url: "https://example.com/audio-128.mp3",
			ext: "mp3",
			qualityName: "MP3 128k",
		});
	});

	it("falls back properly when preferred format is not available", () => {
		const linksOnlyFlac = {
			无损FLAC: "https://example.com/audio.flac",
		};

		const result = JooxApi.getBestAudioUrl(linksOnlyFlac, "320");
		expect(result).toEqual({
			url: "https://example.com/audio.flac",
			ext: "flac",
			qualityName: "FLAC",
		});
	});

	it("parses search response properly without fake broken image URLs", async () => {
		global.fetch = vi.fn().mockImplementation((url: string) => {
			if (typeof url === "string" && url.includes("itunes.apple.com")) {
				return Promise.resolve({
					ok: true,
					json: async () => ({ results: [] }),
				});
			}
			return Promise.resolve({
				ok: true,
				json: async () => ({
					code: 200,
					data: {
						count: 1,
						songs: [
							{
								序号: 1,
								歌曲名称: "Test Song",
								歌手: "Test Artist",
								专辑: "Test Album",
								时长: "03:00",
								歌曲ID: "12345",
								songmid: "Z12345",
							},
						],
					},
				}),
			});
		}) as any;

		const tracks = await JooxApi.search("Test");
		expect(tracks).toHaveLength(1);
		expect(tracks[0].name).toBe("Test Song");
		expect(tracks[0].artist).toBe("Test Artist");
		expect(tracks[0].source).toBe("JOOX");
		expect(tracks[0].cover).toBeUndefined();
	});

	it("enriches tracks with iTunes album art when matched", async () => {
		global.fetch = vi.fn().mockImplementation((url: string) => {
			if (typeof url === "string" && url.includes("itunes.apple.com")) {
				return Promise.resolve({
					ok: true,
					json: async () => ({
						results: [
							{
								trackName: "Cruel Summer",
								artistName: "Taylor Swift",
								artworkUrl100:
									"https://is1-ssl.mzstatic.com/image/100x100bb.jpg",
							},
						],
					}),
				});
			}
			return Promise.resolve({
				ok: true,
				json: async () => ({
					code: 200,
					data: {
						count: 1,
						songs: [
							{
								序号: 1,
								歌曲名称: "Cruel Summer",
								歌手: "Taylor Swift",
								专辑: "Lover",
								时长: "02:58",
								歌曲ID: "402214824",
								songmid: "Z6F1BFC08826B2",
							},
						],
					},
				}),
			});
		}) as any;

		const tracks = await JooxApi.search("Cruel Summer");
		expect(tracks).toHaveLength(1);
		expect(tracks[0].cover).toBe(
			"https://is1-ssl.mzstatic.com/image/300x300bb.jpg",
		);
	});

	it("scores a song named 'Paul' higher than a song with an artist named 'Paul'", async () => {
		const { scoreCandidateTrack } = await import("./client");
		const songPaul = {
			id: "1",
			index: 1,
			name: "Paul",
			artist: "Big Thief",
			source: "JOOX",
		};
		const seanPaulSong = {
			id: "2",
			index: 2,
			name: "No Lie",
			artist: "Sean Paul",
			source: "JOOX",
		};

		// When target title is "Paul" and artist is "Big Thief"
		const score1 = scoreCandidateTrack(songPaul, "Paul", "Big Thief");
		const score2 = scoreCandidateTrack(seanPaulSong, "Paul", "Big Thief");
		expect(score1).toBeGreaterThan(score2);
		expect(score1).toBe(200); // 100 title + 100 artist
		expect(score2).toBeLessThan(0); // penalized because title didn't match and expected title was in artist

		// When target title is "Paul" without artist specified
		const scorePaulSolo = scoreCandidateTrack(songPaul, "Paul", "");
		const scoreSeanPaulSolo = scoreCandidateTrack(seanPaulSong, "Paul", "");
		expect(scorePaulSolo).toBeGreaterThan(scoreSeanPaulSolo);
		expect(scorePaulSolo).toBe(100);
		expect(scoreSeanPaulSolo).toBeLessThan(0);
	});

	it("rejects candidate when artist is specified but track artist does not match", async () => {
		const { scoreCandidateTrack } = await import("./client");
		const wrongArtistSong = {
			id: "3",
			index: 3,
			name: "Paul",
			artist: "Sad Bastards Loose Standards",
			source: "JOOX",
		};
		// Expected artist is "Big Thief", so even though track name is "Paul", it must return -1
		const score = scoreCandidateTrack(wrongArtistSong, "Paul", "Big Thief");
		expect(score).toBe(-1);
	});

	it("searchAndGetAudio immediately returns null if no candidates match both title and artist", async () => {
		const searchSpy = vi.spyOn(JooxApi, "search").mockResolvedValue([
			{
				id: "10",
				index: 1,
				name: "Go Down Deh (feat. Sean Paul)",
				artist: "Spice, Sean Paul",
				source: "JOOX",
			},
			{
				id: "11",
				index: 2,
				name: "Paul",
				artist: "Sad Bastards Loose Standards",
				source: "JOOX",
			},
		]);
		const getDetailSpy = vi.spyOn(JooxApi, "getDetail");

		const result = await JooxApi.searchAndGetAudio("Paul", "Big Thief");
		expect(result).toBeNull();
		// Should not have attempted to fetch audio detail for mismatched tracks
		expect(getDetailSpy).not.toHaveBeenCalled();

		searchSpy.mockRestore();
		getDetailSpy.mockRestore();
	});
});
