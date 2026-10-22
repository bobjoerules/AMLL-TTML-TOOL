import { beforeEach, describe, expect, it } from "vitest";

// Mock localStorage for node environment
const storageMap = new Map<string, string>();
const mockLocalStorage = {
	getItem: (k: string) => storageMap.get(k) ?? null,
	setItem: (k: string, v: string) => storageMap.set(k, String(v)),
	removeItem: (k: string) => storageMap.delete(k),
	clear: () => storageMap.clear(),
	get length() {
		return storageMap.size;
	},
	key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
};

if (typeof globalThis.localStorage === "undefined") {
	Object.defineProperty(globalThis, "localStorage", {
		value: mockLocalStorage,
		writable: true,
	});
}

import {
	AVERAGE_TIME_KEY,
	formatTimerClock,
	formatTimerDuration,
	getAverageTTMLTime,
	getFastestRecord,
	getProjectActiveTime,
	getStoredCompletedRecords,
	getStoredProjectTimes,
	recordTTMLCompletion,
	setProjectActiveTime,
} from "./project-timer";

describe("project-timer unit tests", () => {
	beforeEach(() => {
		globalThis.localStorage.clear();
	});

	describe("formatTimerDuration", () => {
		it("formats seconds correctly", () => {
			expect(formatTimerDuration(0)).toBe("0s");
			expect(formatTimerDuration(45)).toBe("45s");
			expect(formatTimerDuration(60)).toBe("1m 00s");
			expect(formatTimerDuration(125)).toBe("2m 05s");
			expect(formatTimerDuration(3665)).toBe("1h 1m");
		});
	});

	describe("formatTimerClock", () => {
		it("formats clock string correctly", () => {
			expect(formatTimerClock(0)).toBe("00:00");
			expect(formatTimerClock(59)).toBe("00:59");
			expect(formatTimerClock(65)).toBe("01:05");
			expect(formatTimerClock(3605)).toBe("1:00:05");
		});
	});

	describe("active project time storage", () => {
		it("returns 0 for non-existent project", () => {
			expect(getProjectActiveTime("non-existent")).toBe(0);
		});

		it("stores and retrieves active project time", () => {
			setProjectActiveTime("proj-123", 42);
			expect(getProjectActiveTime("proj-123")).toBe(42);

			setProjectActiveTime("proj-123", 100);
			expect(getProjectActiveTime("proj-123")).toBe(100);

			const times = getStoredProjectTimes();
			expect(times["proj-123"]).toBe(100);
		});
	});

	describe("recordTTMLCompletion", () => {
		it("ignores recordings with timeSpent < 5 or lineCount < 1", async () => {
			const res1 = await recordTTMLCompletion({
				projectId: "test-short",
				title: "Song",
				artist: "Artist",
				lineCount: 10,
				explicitTimeSpent: 2,
			});
			expect(res1).toBeNull();

			const res2 = await recordTTMLCompletion({
				projectId: "test-empty",
				title: "Song",
				artist: "Artist",
				lineCount: 0,
				explicitTimeSpent: 60,
			});
			expect(res2).toBeNull();
		});

		it("records completion and sets initial fastest record", async () => {
			const res = await recordTTMLCompletion({
				projectId: "song-1",
				title: "Test Song",
				artist: "Test Artist",
				lineCount: 20,
				explicitTimeSpent: 120,
			});

			expect(res).not.toBeNull();
			expect(res?.timeSpentSeconds).toBe(120);

			const records = getStoredCompletedRecords();
			expect(records.length).toBe(1);
			expect(records[0].title).toBe("Test Song");

			const fastest = getFastestRecord();
			expect(fastest?.timeSpentSeconds).toBe(120);
			expect(fastest?.title).toBe("Test Song");
		});

		it("updates fastest record when a faster TTML completion is recorded", async () => {
			await recordTTMLCompletion({
				projectId: "song-slow",
				title: "Slow Song",
				artist: "Artist",
				lineCount: 15,
				explicitTimeSpent: 300,
			});

			let fastest = getFastestRecord();
			expect(fastest?.timeSpentSeconds).toBe(300);

			await recordTTMLCompletion({
				projectId: "song-fast",
				title: "Fast Song",
				artist: "Artist",
				lineCount: 15,
				explicitTimeSpent: 75,
			});

			fastest = getFastestRecord();
			expect(fastest?.timeSpentSeconds).toBe(75);
			expect(fastest?.title).toBe("Fast Song");

			// Recording a slower song should not displace the fastest record
			await recordTTMLCompletion({
				projectId: "song-medium",
				title: "Medium Song",
				artist: "Artist",
				lineCount: 15,
				explicitTimeSpent: 150,
			});

			fastest = getFastestRecord();
			expect(fastest?.timeSpentSeconds).toBe(75);
		});

		it("updates average time when completions are recorded", async () => {
			expect(getAverageTTMLTime()).toBeNull();

			await recordTTMLCompletion({
				projectId: "song-1",
				title: "Song 1",
				artist: "Artist",
				lineCount: 10,
				explicitTimeSpent: 100,
			});

			expect(getAverageTTMLTime()).toBe(100);
			expect(localStorage.getItem(AVERAGE_TIME_KEY)).toBe("100");

			await recordTTMLCompletion({
				projectId: "song-2",
				title: "Song 2",
				artist: "Artist",
				lineCount: 10,
				explicitTimeSpent: 200,
			});

			// Average of 100 and 200 is 150
			expect(getAverageTTMLTime()).toBe(150);

			await recordTTMLCompletion({
				projectId: "song-3",
				title: "Song 3",
				artist: "Artist",
				lineCount: 10,
				explicitTimeSpent: 300,
			});

			// Average of 100, 200, and 300 is 200
			expect(getAverageTTMLTime()).toBe(200);
		});
	});
});
