import { describe, expect, it, vi } from "vitest";
import { saveChecklistToCloud, loadChecklistFromCloud } from "./cloudSync";

vi.mock("$/modules/cloud/firebase", () => ({
	getFirebaseFirestore: vi.fn(),
	isFirebaseConfigured: vi.fn().mockReturnValue(false),
}));

describe("TTML checklist cloud sync", () => {
	it("gracefully returns false/null when Firebase is not configured", async () => {
		const saved = await saveChecklistToCloud([], "user-123");
		expect(saved).toBe(false);

		const loaded = await loadChecklistFromCloud("user-123");
		expect(loaded).toBeNull();
	});
});
