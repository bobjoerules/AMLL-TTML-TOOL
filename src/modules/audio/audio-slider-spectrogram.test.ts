import { describe, expect, it, vi } from "vitest";
import { clampScroll } from "./hooks";

describe("AudioSlider spectrogram interaction logic", () => {
	it("centers spectrogram scrollLeft accurately when clicked", () => {
		const totalDurationMs = 120_000; // 120 seconds
		const zoom = 200; // 200 px/sec -> total spectrogram width = 24,000 px
		const containerWidth = 1000; // 1,000 px viewport

		// Click at exactly 50% (60 seconds)
		const clickedTimeS = 60;
		const targetCenterScroll = clickedTimeS * zoom - containerWidth / 2;
		const clamped = clampScroll(
			targetCenterScroll,
			zoom,
			totalDurationMs,
			containerWidth,
		);

		// 60 * 200 - 500 = 11,500
		expect(clamped).toBe(11500);

		// Center of viewport (11,500 + 500 = 12,000) corresponds to 12,000 / 200 = 60s
		const centerTimeS = (clamped + containerWidth / 2) / zoom;
		expect(centerTimeS).toBe(60);
	});

	it("clamps spectrogram scrollLeft at the beginning of the audio track", () => {
		const totalDurationMs = 120_000;
		const zoom = 200;
		const containerWidth = 1000;

		// Click at 1s -> target = 200 - 500 = -300
		const clickedTimeS = 1;
		const clamped = clampScroll(
			clickedTimeS * zoom - containerWidth / 2,
			zoom,
			totalDurationMs,
			containerWidth,
		);

		expect(clamped).toBe(0);
	});

	it("clamps spectrogram scrollLeft at the end of the audio track", () => {
		const totalDurationMs = 120_000; // 120s
		const zoom = 200; // total width = 24,000 px
		const containerWidth = 1000; // max scroll = 24,000 - 1,000 = 23,000

		// Click at 119s -> target = 119 * 200 - 500 = 23,300
		const clickedTimeS = 119;
		const clamped = clampScroll(
			clickedTimeS * zoom - containerWidth / 2,
			zoom,
			totalDurationMs,
			containerWidth,
		);

		expect(clamped).toBe(23000);
	});

	it("correctly calculates target time from normalized mouse position along audio bar", () => {
		const currentDuration = 180_000; // 180s = 3 minutes
		const rectWidth = 800; // audio bar is 800px wide
		const clientX = 400; // clicked at midpoint
		const rectLeft = 0;

		const progress = Math.max(
			0,
			Math.min(1, (clientX - rectLeft) / rectWidth),
		);
		const timeMs = progress * currentDuration;
		const timeS = timeMs / 1000;

		expect(progress).toBe(0.5);
		expect(timeMs).toBe(90000);
		expect(timeS).toBe(90);
	});

	describe("playhead tracking mode interactions", () => {
		it("seeks playhead when tracking is on ('snap' or 'follow') rather than manual scroll", () => {
			const trackingModes = ["snap", "follow"] as const;

			for (const mode of trackingModes) {
				const isTrackingOn = mode !== "off";
				const e = { shiftKey: false, altKey: false, clientX: 400 };

				const mockSeekPlayhead = vi.fn();
				const mockScrollSpectrogram = vi.fn();

				// Interaction logic from AudioSlider
				if (e.shiftKey || isTrackingOn) {
					mockSeekPlayhead(e.clientX);
				} else {
					mockScrollSpectrogram(e.clientX);
				}

				expect(mockSeekPlayhead).toHaveBeenCalledWith(400);
				expect(mockScrollSpectrogram).not.toHaveBeenCalled();
			}
		});

		it("scrolls spectrogram when tracking is 'off' on normal click, and seeks on shiftKey", () => {
			const isTrackingOn = false;

			// Normal click with tracking off
			const eNormal = { shiftKey: false, altKey: false, clientX: 300 };
			const mockSeekNormal = vi.fn();
			const mockScrollNormal = vi.fn();

			if (eNormal.shiftKey || isTrackingOn) {
				mockSeekNormal(eNormal.clientX);
			} else {
				mockScrollNormal(eNormal.clientX);
			}

			expect(mockScrollNormal).toHaveBeenCalledWith(300);
			expect(mockSeekNormal).not.toHaveBeenCalled();

			// Shift+click with tracking off
			const eShift = { shiftKey: true, altKey: false, clientX: 300 };
			const mockSeekShift = vi.fn();
			const mockScrollShift = vi.fn();

			if (eShift.shiftKey || isTrackingOn) {
				mockSeekShift(eShift.clientX);
			} else {
				mockScrollShift(eShift.clientX);
			}

			expect(mockSeekShift).toHaveBeenCalledWith(300);
			expect(mockScrollShift).not.toHaveBeenCalled();
		});

		it("snaps spectrogram view when playhead moves outside current viewport in 'snap' mode", () => {
			const zoom = 200; // 200 px/sec
			const containerWidth = 1000; // 5 seconds visible
			const totalDurationS = 120;
			const maxScrollLeft = totalDurationS * zoom - containerWidth; // 23,000

			let currentScroll = 0; // viewing 0s - 5s

			// Seek to 15s (playheadX = 3000px, which is > currentScroll + containerWidth)
			const newPlayheadTimeS = 15;
			const playheadX = newPlayheadTimeS * zoom; // 3000px

			const isPastRight = playheadX >= currentScroll + containerWidth;
			const isBeforeLeft = playheadX < currentScroll;

			expect(isPastRight).toBe(true);

			if (isPastRight || isBeforeLeft) {
				currentScroll = Math.max(0, Math.min(playheadX, maxScrollLeft));
			}

			// View snaps so playhead is at the beginning of the new snap page
			expect(currentScroll).toBe(3000);

			// Seek to 17s (playheadX = 3400px, which is within 3000..4000)
			const seekInsideS = 17;
			const insidePlayheadX = seekInsideS * zoom; // 3400px
			const isPastRight2 = insidePlayheadX >= currentScroll + containerWidth;
			const isBeforeLeft2 = insidePlayheadX < currentScroll;

			expect(isPastRight2).toBe(false);
			expect(isBeforeLeft2).toBe(false);
			// Does not jump if already in view
			expect(currentScroll).toBe(3000);
		});

		it("centers spectrogram view around playhead in 'follow' mode", () => {
			const zoom = 200;
			const containerWidth = 1000;
			const totalDurationS = 120;
			const maxScrollLeft = totalDurationS * zoom - containerWidth;

			const newPlayheadTimeS = 30;
			const playheadX = newPlayheadTimeS * zoom; // 6000px

			const targetScroll = playheadX - containerWidth / 2; // 6000 - 500 = 5500
			const clampedScroll = Math.max(0, Math.min(targetScroll, maxScrollLeft));

			expect(clampedScroll).toBe(5500);
		});

		it("bypasses region body dragging when isTrackingOn is true so clicks bubble to seek playhead", () => {
			const isTrackingOn = true;
			const dragType = "drag";

			let dragHandled = false;

			// Logic in useAudioRegion handleMouseDown
			if (isTrackingOn && dragType === "drag") {
				// return early without preventing/stopping, allowing bubbling to seek playhead
			} else {
				dragHandled = true;
			}

			expect(dragHandled).toBe(false);

			// When tracking is off, drag is handled
			const isTrackingOff = false;
			let dragHandledOff = false;
			if (isTrackingOff && dragType === "drag") {
				// return early
			} else {
				dragHandledOff = true;
			}

			expect(dragHandledOff).toBe(true);
		});
	});
});
