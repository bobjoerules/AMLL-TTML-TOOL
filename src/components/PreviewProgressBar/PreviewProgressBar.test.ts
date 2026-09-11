import { describe, expect, it, vi } from "vitest";

vi.mock("$/modules/audio/audio-engine", () => ({
	audioEngine: {
		musicCurrentTime: 0,
		musicPlaying: false,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		resumeOrSeekMusic: vi.fn(),
	},
}));

import { formatTime } from "./index";

describe("PreviewProgressBar formatTime", () => {
	it("formats 0 ms as 0:00", () => {
		expect(formatTime(0)).toBe("0:00");
	});

	it("formats seconds correctly under a minute", () => {
		expect(formatTime(21000)).toBe("0:21");
		expect(formatTime(9000)).toBe("0:09");
	});

	it("formats minutes and seconds correctly", () => {
		expect(formatTime(225000)).toBe("3:45");
		expect(formatTime(60000)).toBe("1:00");
		expect(formatTime(605000)).toBe("10:05");
	});

	it("formats hours, minutes, and seconds for long audio", () => {
		expect(formatTime(3600000)).toBe("1:00:00");
		expect(formatTime(3661000)).toBe("1:01:01");
		expect(formatTime(7325000)).toBe("2:02:05");
	});

	it("handles negative numbers safely", () => {
		expect(formatTime(-1000)).toBe("0:00");
	});
});
