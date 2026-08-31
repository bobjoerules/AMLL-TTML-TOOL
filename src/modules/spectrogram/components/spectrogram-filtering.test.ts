import { describe, expect, it } from "vitest";
import { ToolMode } from "$/states/main.ts";

describe("Spectrogram line filtering", () => {
	const lines = [
		{ id: "line-1", startTime: 1000, endTime: 3000, text: "Line 1" },
		{ id: "line-2", startTime: 4000, endTime: 6000, text: "Line 2" },
		{ id: "line-3", startTime: 7000, endTime: 9000, text: "Line 3" },
	];

	function filterLinesToRender({
		linesToRender,
		showUnselectedLines,
		spectrogramOnlyShowSyncLine,
		toolMode,
		selectedLines,
	}: {
		linesToRender: typeof lines;
		showUnselectedLines: boolean;
		spectrogramOnlyShowSyncLine: boolean;
		toolMode: ToolMode;
		selectedLines: Set<string>;
	}) {
		if (
			!showUnselectedLines ||
			(spectrogramOnlyShowSyncLine &&
				(toolMode === ToolMode.Sync || selectedLines.size > 0))
		) {
			return linesToRender.filter((line) => selectedLines.has(line.id));
		}
		return linesToRender;
	}

	it("shows all lines by default when showUnselectedLines is true and onlyShowSyncLine is false", () => {
		const result = filterLinesToRender({
			linesToRender: lines,
			showUnselectedLines: true,
			spectrogramOnlyShowSyncLine: false,
			toolMode: ToolMode.Sync,
			selectedLines: new Set(["line-2"]),
		});

		expect(result).toHaveLength(3);
	});

	it("only shows the line being time synced when spectrogramOnlyShowSyncLine is enabled in Sync mode", () => {
		const result = filterLinesToRender({
			linesToRender: lines,
			showUnselectedLines: true,
			spectrogramOnlyShowSyncLine: true,
			toolMode: ToolMode.Sync,
			selectedLines: new Set(["line-2"]),
		});

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("line-2");
	});

	it("only shows the active selected line when spectrogramOnlyShowSyncLine is enabled with a selected line", () => {
		const result = filterLinesToRender({
			linesToRender: lines,
			showUnselectedLines: true,
			spectrogramOnlyShowSyncLine: true,
			toolMode: ToolMode.Edit,
			selectedLines: new Set(["line-3"]),
		});

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("line-3");
	});

	it("filters unselected lines when showUnselectedLines is false", () => {
		const result = filterLinesToRender({
			linesToRender: lines,
			showUnselectedLines: false,
			spectrogramOnlyShowSyncLine: false,
			toolMode: ToolMode.Edit,
			selectedLines: new Set(["line-1"]),
		});

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("line-1");
	});
});

describe("Spectrogram Follow Playhead Centering", () => {
	function calculateFollowPlayheadScroll({
		currentTimeMs,
		zoom,
		containerWidth,
		audioDurationSec,
	}: {
		currentTimeMs: number;
		zoom: number;
		containerWidth: number;
		audioDurationSec: number;
	}) {
		const playheadX = (currentTimeMs / 1000) * zoom;
		const totalWidth = audioDurationSec * zoom;
		const maxScrollLeft = Math.max(0, totalWidth - containerWidth);
		const targetScroll = playheadX - containerWidth / 2;
		return Math.max(0, Math.min(targetScroll, maxScrollLeft));
	}

	it("keeps scroll at 0 when playhead is in the first half of the frame", () => {
		const scroll = calculateFollowPlayheadScroll({
			currentTimeMs: 1000, // 1s * 200 = 200px
			zoom: 200,
			containerWidth: 1000,
			audioDurationSec: 60,
		});
		expect(scroll).toBe(0);
	});

	it("centers playhead in the middle of frame once playhead passes half container", () => {
		const zoom = 200;
		const containerWidth = 1000;
		const currentTimeMs = 5000; // 5s * 200 = 1000px
		const scroll = calculateFollowPlayheadScroll({
			currentTimeMs,
			zoom,
			containerWidth,
			audioDurationSec: 60,
		});

		// targetScroll = 1000 - 500 = 500px
		expect(scroll).toBe(500);

		// visual X position on screen: playheadX - scroll = 1000 - 500 = 500px = containerWidth / 2
		const visualX = (currentTimeMs / 1000) * zoom - scroll;
		expect(visualX).toBe(containerWidth / 2);
	});

	it("clamps scroll to maxScrollLeft near the end of audio", () => {
		const zoom = 200;
		const containerWidth = 1000;
		const audioDurationSec = 10; // totalWidth = 2000px, maxScroll = 1000px
		const currentTimeMs = 9500; // 9.5s * 200 = 1900px, targetScroll = 1900 - 500 = 1400px
		const scroll = calculateFollowPlayheadScroll({
			currentTimeMs,
			zoom,
			containerWidth,
			audioDurationSec,
		});

		expect(scroll).toBe(1000);
	});
});
