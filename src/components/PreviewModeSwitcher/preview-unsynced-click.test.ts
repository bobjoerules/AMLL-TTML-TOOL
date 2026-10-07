import { describe, expect, it, vi } from "vitest";

describe("Preview unsynced lines and words click handling", () => {
	const isWordTimed = (word: any) =>
		Boolean(
			word &&
				word.endTime > word.startTime &&
				(word.startTime > 0 || word.endTime > 0),
		);

	const isLineTimed = (line: any) =>
		Boolean(
			line &&
				(line.startTime > 0 ||
					line.endTime > 0 ||
					(line.words && line.words.some((w: any) => isWordTimed(w)))),
		);

	describe("Timing validation helper", () => {
		it("detects untimed words accurately", () => {
			expect(isWordTimed({ startTime: 0, endTime: 0, word: "Hello" })).toBe(false);
			expect(isWordTimed({ startTime: 100, endTime: 100, word: "Hello" })).toBe(false);
			expect(isWordTimed({ startTime: 200, endTime: 100, word: "Hello" })).toBe(false);
			expect(isWordTimed(null)).toBe(false);
			expect(isWordTimed(undefined)).toBe(false);
		});

		it("detects timed words accurately", () => {
			expect(isWordTimed({ startTime: 0, endTime: 500, word: "First" })).toBe(true);
			expect(isWordTimed({ startTime: 1000, endTime: 1500, word: "Second" })).toBe(true);
		});

		it("detects untimed lines accurately", () => {
			const unsyncedLine = {
				id: "line-1",
				startTime: 0,
				endTime: 0,
				words: [
					{ startTime: 0, endTime: 0, word: "Hello" },
					{ startTime: 0, endTime: 0, word: "world" },
				],
			};
			expect(isLineTimed(unsyncedLine)).toBe(false);
		});

		it("detects timed lines accurately", () => {
			const timedLine = {
				id: "line-2",
				startTime: 2000,
				endTime: 4000,
				words: [],
			};
			expect(isLineTimed(timedLine)).toBe(true);

			const lineTimedByWords = {
				id: "line-3",
				startTime: 0,
				endTime: 0,
				words: [
					{ startTime: 1000, endTime: 1500, word: "SyncedWord" },
				],
			};
			expect(isLineTimed(lineTimedByWords)).toBe(true);
		});
	});

	describe("Click interaction guards", () => {
		it("does not change playhead or seek music when an unsynced line is clicked", () => {
			const mockSetCurrentTime = vi.fn();
			const mockResumeOrSeekMusic = vi.fn();

			const handleLineClick = (line: any) => {
				if (!isLineTimed(line)) return;
				mockSetCurrentTime(line.startTime);
				mockResumeOrSeekMusic(line.startTime / 1000);
			};

			const unsyncedLine = {
				id: "unsynced-1",
				startTime: 0,
				endTime: 0,
				words: [{ startTime: 0, endTime: 0, word: "Test" }],
			};

			handleLineClick(unsyncedLine);

			expect(mockSetCurrentTime).not.toHaveBeenCalled();
			expect(mockResumeOrSeekMusic).not.toHaveBeenCalled();
		});

		it("changes playhead and seeks music when a synced line is clicked", () => {
			const mockSetCurrentTime = vi.fn();
			const mockResumeOrSeekMusic = vi.fn();

			const handleLineClick = (line: any) => {
				if (!isLineTimed(line)) return;
				mockSetCurrentTime(line.startTime);
				mockResumeOrSeekMusic(line.startTime / 1000);
			};

			const syncedLine = {
				id: "synced-1",
				startTime: 5000,
				endTime: 7000,
				words: [],
			};

			handleLineClick(syncedLine);

			expect(mockSetCurrentTime).toHaveBeenCalledWith(5000);
			expect(mockResumeOrSeekMusic).toHaveBeenCalledWith(5);
		});

		it("stops event propagation and does not seek when an unsynced word is clicked", () => {
			const mockOnWordClick = vi.fn();
			const mockStopPropagation = vi.fn();

			const word = { startTime: 0, endTime: 0, word: "UnsyncedWord" };
			const timed = isWordTimed(word);

			const onSpanClick = (e: { stopPropagation: () => void }) => {
				e.stopPropagation();
				if (!timed) return;
				mockOnWordClick(word.startTime);
			};

			onSpanClick({ stopPropagation: mockStopPropagation });

			expect(mockStopPropagation).toHaveBeenCalled();
			expect(mockOnWordClick).not.toHaveBeenCalled();
		});

		it("seeks when a synced word is clicked", () => {
			const mockOnWordClick = vi.fn();
			const mockStopPropagation = vi.fn();

			const word = { startTime: 3200, endTime: 3600, word: "SyncedWord" };
			const timed = isWordTimed(word);

			const onSpanClick = (e: { stopPropagation: () => void }) => {
				e.stopPropagation();
				if (!timed) return;
				mockOnWordClick(word.startTime);
			};

			onSpanClick({ stopPropagation: mockStopPropagation });

			expect(mockStopPropagation).toHaveBeenCalled();
			expect(mockOnWordClick).toHaveBeenCalledWith(3200);
		});

		it("stops propagation when clicking an unsynced word in a static line to prevent line seeking", () => {
			const mockLineClick = vi.fn();
			const mockStopPropagation = vi.fn();

			const unsyncedWord = { startTime: 0, endTime: 0, word: "Untimed" };
			const timed = isWordTimed(unsyncedWord);

			const onStaticWordClick = (e: { stopPropagation: () => void }) => {
				if (!timed) {
					e.stopPropagation();
				}
			};

			onStaticWordClick({ stopPropagation: mockStopPropagation });

			expect(mockStopPropagation).toHaveBeenCalled();
			expect(mockLineClick).not.toHaveBeenCalled();
		});
	});
});
