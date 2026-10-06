import { describe, expect, it } from "vitest";
import { binaryToBlob } from "./binaryBlob";

describe("binaryToBlob", () => {
	it("returns null for null or undefined input", () => {
		expect(binaryToBlob(null, "audio/mpeg")).toBeNull();
		expect(binaryToBlob(undefined, "audio/mpeg")).toBeNull();
	});

	it("converts ArrayBuffer to Blob with correct size and type", () => {
		const buffer = new ArrayBuffer(16);
		const blob = binaryToBlob(buffer, "audio/mpeg");
		expect(blob).not.toBeNull();
		expect(blob?.size).toBe(16);
		expect(blob?.type).toBe("audio/mpeg");
	});

	it("converts Uint8Array to Blob with correct size", () => {
		const u8 = new Uint8Array([1, 2, 3, 4]);
		const blob = binaryToBlob(u8, "audio/flac");
		expect(blob).not.toBeNull();
		expect(blob?.size).toBe(4);
		expect(blob?.type).toBe("audio/flac");
	});

	it("converts number array to Blob with correct size", () => {
		const arr = [10, 20, 30];
		const blob = binaryToBlob(arr, "audio/mp4");
		expect(blob).not.toBeNull();
		expect(blob?.size).toBe(3);
		expect(blob?.type).toBe("audio/mp4");
	});

	it("returns existing Blob as is", () => {
		const original = new Blob(["hello"], { type: "audio/mpeg" });
		const blob = binaryToBlob(original, "audio/mpeg");
		expect(blob).toBe(original);
	});
});
