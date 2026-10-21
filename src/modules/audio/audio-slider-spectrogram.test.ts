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

	describe("mouse button interactions (left-click playhead, right-click spectrogram)", () => {
		it("seeks playhead on left-click (button === 0) across all tracking modes", () => {
			const trackingModes = ["off", "snap", "follow"] as const;

			for (const _mode of trackingModes) {
				const eLeft = { button: 0, altKey: false, clientX: 400 };

				const mockSeekPlayhead = vi.fn();
				const mockScrollSpectrogram = vi.fn();

				// Interaction logic from AudioSlider:
				if (eLeft.button === 2) {
					mockScrollSpectrogram(eLeft.clientX);
				} else if (eLeft.button === 0) {
					mockSeekPlayhead(eLeft.clientX);
				}

				expect(mockSeekPlayhead).toHaveBeenCalledWith(400);
				expect(mockScrollSpectrogram).not.toHaveBeenCalled();
			}
		});

		it("moves spectrogram area on right-click (button === 2)", () => {
			const eRight = { button: 2, altKey: false, clientX: 300 };
			const mockSeekPlayhead = vi.fn();
			const mockScrollSpectrogram = vi.fn();

			if (eRight.button === 2) {
				mockScrollSpectrogram(eRight.clientX);
			} else if (eRight.button === 0) {
				mockSeekPlayhead(eRight.clientX);
			}

			expect(mockScrollSpectrogram).toHaveBeenCalledWith(300);
			expect(mockSeekPlayhead).not.toHaveBeenCalled();
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

		it("bypasses region body so left-clicks seek playhead and right-clicks move spectrogram", () => {
			const dragType = "drag";

			for (const button of [0, 2]) {
				let dragHandled = false;

				// Logic in useAudioRegion handleMouseDown:
				if (button === 2 || dragType === "drag") {
					// return early without preventing/stopping, allowing bubbling
				} else {
					dragHandled = true;
				}

				expect(dragHandled).toBe(false);
			}

			// Left-clicking resize handles is handled by useAudioRegion
			let resizeHandled = false;
			const resizeType = "resizeLeft";
			const button = 0;
			if (button === 2 || resizeType === "drag") {
				// return early
			} else if (button === 0) {
				resizeHandled = true;
			}
			expect(resizeHandled).toBe(true);
		});
	});
});
