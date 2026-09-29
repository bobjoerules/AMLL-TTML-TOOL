import { describe, expect, it } from "vitest";
import type { SpectrogramPlayheadTrackingMode } from "$/modules/spectrogram/states";

function calculateSpectrogramScroll({
	currentTime,
	zoom,
	duration,
	containerWidth,
	currentScroll,
	mode = "off",
	followPlayhead,
	snapPlayheadToStart,
}: {
	currentTime: number;
	zoom: number;
	duration: number;
	containerWidth: number;
	currentScroll: number;
	mode?: SpectrogramPlayheadTrackingMode;
	followPlayhead?: boolean;
	snapPlayheadToStart?: boolean;
}): number | null {
	if (containerWidth <= 0 || duration <= 0) return null;

	const effectiveMode: SpectrogramPlayheadTrackingMode =
		mode !== "off"
			? mode
			: followPlayhead
				? "follow"
				: snapPlayheadToStart
					? "snap"
					: "off";

	const playheadX = (currentTime / 1000) * zoom;
	const totalWidth = duration * zoom;
	const maxScrollLeft = Math.max(0, totalWidth - containerWidth);

	if (effectiveMode === "follow") {
		const targetScroll = playheadX - containerWidth / 2;
		return Math.max(0, Math.min(targetScroll, maxScrollLeft));
	}

	if (effectiveMode === "snap") {
		const isPastRight = playheadX >= currentScroll + containerWidth;
		const isBeforeLeft = playheadX < currentScroll;

		if (isPastRight || isBeforeLeft) {
			return Math.max(0, Math.min(playheadX, maxScrollLeft));
		}
	}

	return null; // No scroll update needed
}

describe("Spectrogram Paging / Snap Playhead to Start", () => {
	const zoom = 100; // 100px per second
	const duration = 60; // 60s total duration => 6000px
	const containerWidth = 1000; // 1000px visible window => 10s per screen

	it("does not scroll when playhead is inside visible area", () => {
		// Visible area: 0px to 1000px (0s to 10s)
		// Current time: 5s (5000ms) => playheadX = 500px
		const scroll = calculateSpectrogramScroll({
			currentTime: 5000,
			zoom,
			duration,
			containerWidth,
			currentScroll: 0,
			followPlayhead: false,
			snapPlayheadToStart: true,
		});

		expect(scroll).toBeNull();
	});

	it("snaps playhead to start when playhead moves past the right edge", () => {
		// Visible area: 0px to 1000px (0s to 10s)
		// Current time: 10s (10000ms) => playheadX = 1000px (reaches right edge)
		const scroll = calculateSpectrogramScroll({
			currentTime: 10000,
			zoom,
			duration,
			containerWidth,
			currentScroll: 0,
			followPlayhead: false,
			snapPlayheadToStart: true,
		});

		// Snaps to playheadX (1000px), so playhead is now at the start of the visible window
		expect(scroll).toBe(1000);
	});

	it("snaps playhead to start when seeking backwards past left edge", () => {
		// Visible area: 2000px to 3000px
		// Current time: 15s (15000ms) => playheadX = 1500px (before left edge)
		const scroll = calculateSpectrogramScroll({
			currentTime: 15000,
			zoom,
			duration,
			containerWidth,
			currentScroll: 2000,
			followPlayhead: false,
			snapPlayheadToStart: true,
		});

		expect(scroll).toBe(1500);
	});

	it("clamps to maxScrollLeft near the end of audio", () => {
		// Total width = 6000px, containerWidth = 1000px, maxScrollLeft = 5000px
		// Current time: 55s => playheadX = 5500px
		const scroll = calculateSpectrogramScroll({
			currentTime: 55000,
			zoom,
			duration,
			containerWidth,
			currentScroll: 4000,
			followPlayhead: false,
			snapPlayheadToStart: true,
		});

		expect(scroll).toBe(5000);
	});

	it("centers playhead continuously when followPlayhead is true", () => {
		// Current time: 5s => playheadX = 500px. Centered in 1000px container = 0px
		const scrollStart = calculateSpectrogramScroll({
			currentTime: 5000,
			zoom,
			duration,
			containerWidth,
			currentScroll: 0,
			followPlayhead: true,
			snapPlayheadToStart: false,
		});
		expect(scrollStart).toBe(0);

		// Current time: 20s => playheadX = 2000px. Centered = 2000 - 500 = 1500px
		const scrollMid = calculateSpectrogramScroll({
			currentTime: 20000,
			zoom,
			duration,
			containerWidth,
			currentScroll: 0,
			followPlayhead: true,
			snapPlayheadToStart: false,
		});
		expect(scrollMid).toBe(1500);
	});

	it("respects 3-state tracking mode (off, snap, follow)", () => {
		// Off mode does not scroll even if playhead leaves visible frame
		const offScroll = calculateSpectrogramScroll({
			currentTime: 15000,
			zoom,
			duration,
			containerWidth,
			currentScroll: 0,
			mode: "off",
		});
		expect(offScroll).toBeNull();

		// Snap mode snaps when playhead leaves visible frame
		const snapScroll = calculateSpectrogramScroll({
			currentTime: 10000,
			zoom,
			duration,
			containerWidth,
			currentScroll: 0,
			mode: "snap",
		});
		expect(snapScroll).toBe(1000);

		// Follow mode centers continuously
		const followScroll = calculateSpectrogramScroll({
			currentTime: 20000,
			zoom,
			duration,
			containerWidth,
			currentScroll: 0,
			mode: "follow",
		});
		expect(followScroll).toBe(1500);
	});
});
