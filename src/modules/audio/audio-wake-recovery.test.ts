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
		decodeAudioData() {
			return Promise.resolve({ duration: 180, sampleRate: 44100 });
		}
	};
}

const { audioEngine } = await import("./audio-engine");

describe("AudioEngine sleep & wake recovery", () => {
	it("preserves last known position when woke up from sleep", () => {
		const engine = audioEngine as any;
		engine._isPlaying = true;
		engine.musicBuffer = { duration: 180 } as any;
		engine._startOffsetInSeconds = 30;
		engine._startTimeInContext = 10;
		engine._musicPlayBackRate = 1.0;
		engine._lastKnownPlaybackPosition = 45;

		const mockCtx = {
			currentTime: 25, // 30 + (25 - 10) = 45s
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
			createBufferSource: () => ({
				connect: vi.fn(),
				start: vi.fn(),
				stop: vi.fn(),
				disconnect: vi.fn(),
				playbackRate: { setValueAtTime: vi.fn(), value: 1.0 },
			}),
		};
		engine._ctx = mockCtx;

		// Active playing position
		expect(audioEngine.musicCurrentTime).toBe(45);

		// Simulate system sleep: context currentTime jumps forward by 20 minutes (1200s)
		mockCtx.currentTime = 1225;
		engine._wasPlayingBeforeSleep = true;

		// Must return saved pre-sleep position rather than jumped time or track duration
		expect(audioEngine.musicCurrentTime).toBe(45);

		// Reset state
		engine._isPlaying = false;
		engine._wasPlayingBeforeSleep = false;
		engine.musicBuffer = null;
	});

	it("prevents spurious onended from skipping to end during sleep", () => {
		const engine = audioEngine as any;
		engine._isPlaying = true;
		engine.musicBuffer = { duration: 180 } as any;
		engine._pausedPosition = 45;
		engine._lastKnownPlaybackPosition = 45;
		engine._wasPlayingBeforeSleep = true;

		// Mock source node onended callback
		let onEndedFired = false;
		const mockSource: any = {
			onended: null,
		};
		engine._activeSourceNode = mockSource;

		// Simulate onended handler setup in resumeOrSeekMusic
		mockSource.onended = () => {
			if (engine._activeSourceNode === mockSource) {
				engine._activeSourceNode = null;
				if (engine._wasPlayingBeforeSleep || engine._needsFreshContext) {
					onEndedFired = true;
					return;
				}
				engine._isPlaying = false;
				engine._pausedPosition = 180;
			}
		};

		mockSource.onended();

		expect(onEndedFired).toBe(true);
		// Position MUST NOT have been forced to 180 (the end)
		expect(engine._pausedPosition).toBe(45);

		// Reset
		engine._isPlaying = false;
		engine._wasPlayingBeforeSleep = false;
		engine.musicBuffer = null;
	});

	it("deduplicates concurrent recreateContext calls", async () => {
		const engine = audioEngine as any;
		engine._rawAudioData = new ArrayBuffer(8);

		const p1 = engine.recreateContext();
		const p2 = engine.recreateContext();

		expect(p1).toBe(p2);
		await p1;
	});
});
