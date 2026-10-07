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
		spectrogramOnlyShowSyncLine,
		toolMode,
		selectedLines,
	}: {
		linesToRender: typeof lines;
		spectrogramOnlyShowSyncLine: boolean;
		toolMode: ToolMode;
		selectedLines: Set<string>;
	}) {
		if (
			spectrogramOnlyShowSyncLine &&
			(toolMode === ToolMode.Sync || selectedLines.size > 0)
		) {
			return linesToRender.filter((line) => selectedLines.has(line.id));
		}
		return linesToRender;
	}

	it("shows all lines by default when onlyShowSyncLine is false", () => {
		const result = filterLinesToRender({
			linesToRender: lines,
			spectrogramOnlyShowSyncLine: false,
			toolMode: ToolMode.Sync,
			selectedLines: new Set(["line-2"]),
		});

		expect(result).toHaveLength(3);
	});

	it("only shows the line being time synced when spectrogramOnlyShowSyncLine is enabled in Sync mode", () => {
		const result = filterLinesToRender({
			linesToRender: lines,
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
			spectrogramOnlyShowSyncLine: true,
			toolMode: ToolMode.Edit,
			selectedLines: new Set(["line-3"]),
		});

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("line-3");
	});

	it("shows all lines when spectrogramOnlyShowSyncLine is false in Edit mode", () => {
		const result = filterLinesToRender({
			linesToRender: lines,
			spectrogramOnlyShowSyncLine: false,
			toolMode: ToolMode.Edit,
			selectedLines: new Set(["line-1"]),
		});

		expect(result).toHaveLength(3);
	});

	it("hides background vocal lines on spectrogram when bgLyricIgnoreSync is true", () => {
		const mixedLines = [
			{ id: "line-main", isBG: false, ignoreSync: false },
			{ id: "line-bg", isBG: true, ignoreSync: false },
		];

		const isLineIgnored = (
			line: (typeof mixedLines)[0],
			mainIgnore: boolean,
			bgIgnore: boolean,
		) => {
			if (line.ignoreSync) return true;
			if (mainIgnore && !line.isBG) return true;
			if (bgIgnore && line.isBG) return true;
			return false;
		};

		const filtered = mixedLines.filter((l) => !isLineIgnored(l, false, true));
		expect(filtered).toHaveLength(1);
		expect(filtered[0].id).toBe("line-main");
	});

	it("hides main vocal lines on spectrogram when mainLyricIgnoreSync is true", () => {
		const mixedLines = [
			{ id: "line-main", isBG: false, ignoreSync: false },
			{ id: "line-bg", isBG: true, ignoreSync: false },
		];

		const isLineIgnored = (
			line: (typeof mixedLines)[0],
			mainIgnore: boolean,
			bgIgnore: boolean,
		) => {
			if (line.ignoreSync) return true;
			if (mainIgnore && !line.isBG) return true;
			if (bgIgnore && line.isBG) return true;
			return false;
		};

		const filtered = mixedLines.filter((l) => !isLineIgnored(l, true, false));
		expect(filtered).toHaveLength(1);
		expect(filtered[0].id).toBe("line-bg");
	});

	it("hides lines with individual ignoreSync flag on spectrogram", () => {
		const mixedLines = [
			{ id: "line-1", isBG: false, ignoreSync: false },
			{ id: "line-2", isBG: false, ignoreSync: true },
		];

		const isLineIgnored = (
			line: (typeof mixedLines)[0],
			mainIgnore: boolean,
			bgIgnore: boolean,
		) => {
			if (line.ignoreSync) return true;
			if (mainIgnore && !line.isBG) return true;
			if (bgIgnore && line.isBG) return true;
			return false;
		};

		const filtered = mixedLines.filter((l) => !isLineIgnored(l, false, false));
		expect(filtered).toHaveLength(1);
		expect(filtered[0].id).toBe("line-1");
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

describe("Spectrogram Split Background and Main Vocals Layout", () => {
	function getLineSegmentPosition({
		isBG,
		splitBgMain,
	}: {
		isBG?: boolean;
		splitBgMain: boolean;
	}) {
		if (splitBgMain) {
			return {
				top: isBG ? "50%" : "0%",
				height: "50%",
			};
		}
		return {
			top: "0%",
			height: "100%",
		};
	}

	it("positions both main and background vocals at full height when splitBgMain is false", () => {
		const mainPos = getLineSegmentPosition({ isBG: false, splitBgMain: false });
		const bgPos = getLineSegmentPosition({ isBG: true, splitBgMain: false });

		expect(mainPos).toEqual({ top: "0%", height: "100%" });
		expect(bgPos).toEqual({ top: "0%", height: "100%" });
	});

	it("positions main vocals on top half and background vocals on bottom half when splitBgMain is true", () => {
		const mainPos = getLineSegmentPosition({ isBG: false, splitBgMain: true });
		const bgPos = getLineSegmentPosition({ isBG: true, splitBgMain: true });

		expect(mainPos).toEqual({ top: "0%", height: "50%" });
		expect(bgPos).toEqual({ top: "50%", height: "50%" });
	});

	it("scopes touching start/end boundaries per track when splitBgMain is active", () => {
		const lines = [
			{ id: "main-1", startTime: 1000, endTime: 3000, isBG: false },
			{ id: "bg-1", startTime: 3000, endTime: 5000, isBG: true },
			{ id: "main-2", startTime: 3000, endTime: 6000, isBG: false },
		];

		const lineStartTimes = new Set(lines.map((l) => l.startTime));
		const lineEndTimes = new Set(lines.map((l) => l.endTime));

		const mainStartTimes = new Set(
			lines.filter((l) => !l.isBG).map((l) => l.startTime),
		);
		const mainEndTimes = new Set(
			lines.filter((l) => !l.isBG).map((l) => l.endTime),
		);
		const bgStartTimes = new Set(
			lines.filter((l) => l.isBG).map((l) => l.startTime),
		);
		const bgEndTimes = new Set(
			lines.filter((l) => l.isBG).map((l) => l.endTime),
		);

		// When splitBgMain is false, bg-1 starts where main-1 ends (time 3000) so they touch in the same track
		const bg1TouchesStartCombined = lineEndTimes.has(3000);
		expect(bg1TouchesStartCombined).toBe(true);

		// When splitBgMain is true, bg-1 does not touch main-1 because bg-1 checks bgEndTimes
		const bg1TouchesStartSplit = bgEndTimes.has(3000);
		expect(bg1TouchesStartSplit).toBe(false);

		// But main-2 does touch main-1 at time 3000 in split mode
		const main2TouchesStartSplit = mainEndTimes.has(3000);
		expect(main2TouchesStartSplit).toBe(true);
	});

	it("shows overlapping background lines when main line is selected and both onlyShowSyncLine and splitBgMain are true", () => {
		const songLines = [
			{ id: "main-1", startTime: 1000, endTime: 5000, isBG: false },
			{ id: "bg-1", startTime: 2000, endTime: 4000, isBG: true },
			{ id: "bg-2", startTime: 6000, endTime: 8000, isBG: true },
			{ id: "main-2", startTime: 6000, endTime: 9000, isBG: false },
		];

		const selectedLines = new Set(["main-1"]);
		const selectedLineObjs = songLines.filter((l) => selectedLines.has(l.id));

		const filtered = songLines.filter((line) => {
			if (selectedLines.has(line.id)) return true;
			if (line.startTime == null || line.endTime == null) return false;

			return selectedLineObjs.some((sel) => {
				if (sel.startTime == null || sel.endTime == null) return false;
				if (Boolean(sel.isBG) === Boolean(line.isBG)) return false;
				return line.startTime < sel.endTime && line.endTime > sel.startTime;
			});
		});

		expect(filtered.map((l) => l.id)).toEqual(["main-1", "bg-1"]);
	});

	it("shows overlapping main lines when background line is selected and both onlyShowSyncLine and splitBgMain are true", () => {
		const songLines = [
			{ id: "main-1", startTime: 1000, endTime: 5000, isBG: false },
			{ id: "bg-1", startTime: 2000, endTime: 4000, isBG: true },
			{ id: "bg-2", startTime: 6000, endTime: 8000, isBG: true },
			{ id: "main-2", startTime: 6000, endTime: 9000, isBG: false },
		];

		const selectedLines = new Set(["bg-1"]);
		const selectedLineObjs = songLines.filter((l) => selectedLines.has(l.id));

		const filtered = songLines.filter((line) => {
			if (selectedLines.has(line.id)) return true;
			if (line.startTime == null || line.endTime == null) return false;

			return selectedLineObjs.some((sel) => {
				if (sel.startTime == null || sel.endTime == null) return false;
				if (Boolean(sel.isBG) === Boolean(line.isBG)) return false;
				return line.startTime < sel.endTime && line.endTime > sel.startTime;
			});
		});

		expect(filtered.map((l) => l.id)).toEqual(["main-1", "bg-1"]);
	});
});
