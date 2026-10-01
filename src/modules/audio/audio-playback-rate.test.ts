import { describe, expect, it, vi } from "vitest";

// Mock browser globals for node test environment
if (typeof (globalThis as any).Worker === "undefined") {
	(globalThis as any).Worker = class {
		postMessage() {}
		onmessage() {}
		terminate() {}
		addEventListener() {}
		removeEventListener() {}
	};
}
if (typeof (globalThis as any).AudioContext === "undefined") {
	(globalThis as any).AudioContext = class {
		currentTime = 0;
		sampleRate = 44100;
		state = "running";
		addEventListener() {}
		removeEventListener() {}
		close() {
			return Promise.resolve();
		}
		createGain() {
			return {
				gain: { value: 1 },
				connect: vi.fn(),
				disconnect: vi.fn(),
			};
		}
		createBiquadFilter() {
			return {
				frequency: { value: 0 },
				Q: { value: 0 },
				gain: { value: 0 },
				connect: vi.fn(),
				disconnect: vi.fn(),
			};
		}
		createBufferSource() {
			return {
				connect: vi.fn(),
				start: vi.fn(),
				stop: vi.fn(),
				disconnect: vi.fn(),
				playbackRate: { setValueAtTime: vi.fn(), value: 1.0 },
			};
		}
		createScriptProcessor() {
			return {
				connect: vi.fn(),
				disconnect: vi.fn(),
				onaudioprocess: null,
			};
		}
		resume() {
			return Promise.resolve();
		}
		suspend() {
			return Promise.resolve();
		}
	};
}

const { audioEngine } = await import("./audio-engine");

describe("AudioEngine playback rate", () => {
	it("updates playback rate without altering paused position", () => {
		const initialPos = audioEngine.musicCurrentTime;
		audioEngine.musicPlayBackRate = 1.25;
		expect(audioEngine.musicPlayBackRate).toBe(1.25);
		expect(audioEngine.musicCurrentTime).toBe(initialPos);

		audioEngine.musicPlayBackRate = 0.75;
		expect(audioEngine.musicPlayBackRate).toBe(0.75);
		expect(audioEngine.musicCurrentTime).toBe(initialPos);

		audioEngine.musicPlayBackRate = 1;
		expect(audioEngine.musicPlayBackRate).toBe(1);
	});

	it("preserves continuous current time when changing playback rate while playing", () => {
		// Mock playing state on audioEngine
		const engine = audioEngine as any;
		engine._isPlaying = true;
		engine.musicBuffer = { duration: 100 } as any;
		engine._startOffsetInSeconds = 10;
		engine._startTimeInContext = 5;
		engine._musicPlayBackRate = 1.0;

		// Mock ctx
		const mockCtx = {
			currentTime: 15, // 10 context seconds elapsed => at 1.0x, pos = 10 + 10 = 20s
			sampleRate: 44100,
			state: "running",
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			close: vi.fn().mockResolvedValue(undefined),
			resume: vi.fn().mockResolvedValue(undefined),
			createGain: () => ({
				gain: { value: 1 },
				connect: vi.fn(),
				disconnect: vi.fn(),
			}),
			createBiquadFilter: () => ({
				frequency: { value: 0 },
				Q: { value: 0 },
				gain: { value: 0 },
				connect: vi.fn(),
				disconnect: vi.fn(),
			}),
			createScriptProcessor: () => ({
				connect: vi.fn(),
				disconnect: vi.fn(),
				onaudioprocess: null,
			}),
			createBufferSource: () => ({
				connect: vi.fn(),
				start: vi.fn(),
				stop: vi.fn(),
				disconnect: vi.fn(),
				playbackRate: { setValueAtTime: vi.fn(), value: 1.0 },
			}),
		};
		engine._ctx = mockCtx;

		// Before rate change: time is 10 + (15 - 5) * 1.0 = 20s
		expect(audioEngine.musicCurrentTime).toBe(20);

		// Speed up to 1.25x (equivalent to pressing ']')
		audioEngine.musicPlayBackRate = 1.25;

		// Immediately after rate change at same context time, position MUST still be 20s, NOT jump to 22.5s
		expect(audioEngine.musicCurrentTime).toBe(20);

		// Advance context time by 4 seconds (4s * 1.25 = 5 song seconds)
		mockCtx.currentTime = 19;
		expect(audioEngine.musicCurrentTime).toBe(25);

		// Slow down to 0.75x (equivalent to pressing '[')
		audioEngine.musicPlayBackRate = 0.75;

		// Immediately after rate change, position MUST still be 25s, NOT jump backward
		expect(audioEngine.musicCurrentTime).toBe(25);

		// Advance context time by 4 seconds (4s * 0.75 = 3 song seconds)
		mockCtx.currentTime = 23;
		expect(audioEngine.musicCurrentTime).toBe(28);

		// Reset state
		engine._isPlaying = false;
		engine.musicBuffer = null;
		audioEngine.musicPlayBackRate = 1;
	});
});
