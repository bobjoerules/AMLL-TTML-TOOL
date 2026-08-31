import { describe, expect, it, vi } from "vitest";
import { toast } from "react-toastify";
import { newLyricLine, newLyricWord, type TTMLLyric } from "$/types/ttml";
import { notifySectionIssues } from "./notify-section-issues";

vi.mock("react-toastify", () => ({
	toast: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

describe("notifySectionIssues", () => {
	it("does not show toast when there are no issues", () => {
		const lyrics: TTMLLyric = {
			metadata: [],
			lyricLines: [],
			sections: [],
		};

		const issues = notifySectionIssues(lyrics);
		expect(issues).toEqual([]);
		expect(toast.info).not.toHaveBeenCalled();
		expect(toast.warn).not.toHaveBeenCalled();
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("shows toast with issue details when issues are found", () => {
		const line = {
			...newLyricLine(),
			sectionId: "missing-section",
			words: [
				{ ...newLyricWord(), word: "Test", startTime: 100, endTime: 200 },
			],
		};
		const lyrics: TTMLLyric = {
			metadata: [],
			lyricLines: [line],
			sections: [],
		};

		const issues = notifySectionIssues(lyrics);
		expect(issues.length).toBeGreaterThan(0);
		expect(toast.error).toHaveBeenCalled();
	});
});
