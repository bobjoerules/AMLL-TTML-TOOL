import { convertFileSrc } from "@tauri-apps/api/core";
import {
	type AudioTaskType,
	audioBufferAtom,
	audioCoverArtAtom,
	audioErrorAtom,
	audioTaskStateAtom,
	auditionTimeAtom,
	EQ_FREQUENCIES,
	equalizerEnabledAtom,
	equalizerGainsAtom,
	loadedAudioAtom,
	loadedAudioFileNameAtom,
} from "$/modules/audio/states/index.ts";
import { AudioWorkerClient } from "$/modules/audio/workers/audio-worker-client";
import { globalStore } from "$/states/store.ts";
import { log } from "$/utils/logging";

// Magic, pending original dev's explanation
// Even don't know where should I put this after refactoring
// const DELAY = 0.05; // 50ms

let auditionRafId: number | null = null;

class AudioEngine extends EventTarget {
	public workerClient: AudioWorkerClient;
	private _audioObjUrl: string | null = null;

	private revokeAudioObjUrl() {
		if (this._audioObjUrl) {
			URL.revokeObjectURL(this._audioObjUrl);
			this._audioObjUrl = null;
		}
	}

	//#region Audio context basics
	private _ctx: AudioContext | null = null;

	private resetAudioGraph() {
		this._eqNodes = [];
		this.gainNode = null;
		this._analyserNode = null;
	}

	get ctx() {
		if (this._ctx && this._ctx.state !== "closed") return this._ctx;
		this.resetAudioGraph();
		this._ctx = new AudioContext({
			latencyHint: "interactive",
		});
		this._ctx.addEventListener("statechange", () => {
			log("AudioContext state changed to:", this._ctx?.state);
		});
		log(
			"AudioContext created with latency",
			this._ctx.baseLatency,
			this._ctx.outputLatency,
		);
		return this._ctx;
	}

	private _volume = 0.5;
	private gainNode: GainNode | null = null;
	private get gain() {
		if (this.gainNode) return this.gainNode;
		this.gainNode = this.ctx.createGain();
		this.gainNode.gain.value = this._volume;
		this.gainNode.connect(this.ctx.destination);
		return this.gainNode;
	}

	private _eqNodes: BiquadFilterNode[] = [];
	private get eqNodes() {
		if (this._eqNodes.length > 0) return this._eqNodes;

		const nodes: BiquadFilterNode[] = [];
		const gains = globalStore.get(equalizerGainsAtom);
		const enabled = globalStore.get(equalizerEnabledAtom);

		EQ_FREQUENCIES.forEach((freq, i) => {
			const node = this.ctx.createBiquadFilter();
			node.type =
				i === 0
					? "lowshelf"
					: i === EQ_FREQUENCIES.length - 1
						? "highshelf"
						: "peaking";
			node.frequency.value = freq;
			node.gain.value = enabled ? gains[i] : 0;
			node.Q.value = 1;
			nodes.push(node);
		});

		// Connect chain
		for (let i = 0; i < nodes.length - 1; i++) {
			nodes[i].connect(nodes[i + 1]);
		}

		// Final node connects to gain
		nodes[nodes.length - 1].connect(this.gain);

		this._eqNodes = nodes;
		return nodes;
	}

	public updateEqGains() {
		const gains = globalStore.get(equalizerGainsAtom);
		const enabled = globalStore.get(equalizerEnabledAtom);
		this.eqNodes.forEach((node, i) => {
			node.gain.setTargetAtTime(
				enabled ? gains[i] : 0,
				this.ctx.currentTime,
				0.05,
			);
		});
	}

	private _analyserNode: AnalyserNode | null = null;
	/** A read-only analysis tap for visualizers. It is connected in parallel and never changes playback output. */
	get analyserNode() {
		if (this._analyserNode) return this._analyserNode;
		const analyser = this.ctx.createAnalyser();
		analyser.fftSize = 512;
		analyser.smoothingTimeConstant = 0.78;
		this.eqNodes[this.eqNodes.length - 1].connect(analyser);
		this._analyserNode = analyser;
		return analyser;
	}

	public get eqEntryPoint() {
		return this.eqNodes[0];
	}
	//#endregion

	constructor() {
		super();
		this.workerClient = new AudioWorkerClient({
			onTaskStart: (type: AudioTaskType) => {
				globalStore.set(audioTaskStateAtom, { type, progress: 0 });
			},
			onTaskProgress: (progress: number) => {
				const current = globalStore.get(audioTaskStateAtom);
				if (current) {
					globalStore.set(audioTaskStateAtom, { ...current, progress });
				}
			},
			onTaskEnd: () => {
				globalStore.set(audioTaskStateAtom, null);
			},
			onError: (errorMessage: string) => {
				console.error("[AudioEngine] Worker Error:", errorMessage);
				globalStore.set(audioTaskStateAtom, null);
				globalStore.set(audioErrorAtom, errorMessage);
			},
		});

		if (typeof window !== "undefined") {
			let lastHeartbeat = Date.now();

			const handleWakeOrInteraction = () => {
				const now = Date.now();
				const elapsed = now - lastHeartbeat;
				lastHeartbeat = now;
				const idleTime = now - this._lastAudioActivityTime;

				if (elapsed > 4000 || idleTime > 15000) {
					// Woke up from sleep or away/idle for more than 15s
					this._needsFreshContext = true;
				}
				if (this._ctx && (this._ctx.state === "suspended" || this._ctx.state === "interrupted")) {
					void this._ctx.resume().catch(() => {});
				}
			};

			window.addEventListener("focus", handleWakeOrInteraction);
			window.addEventListener("pointerdown", handleWakeOrInteraction, { passive: true });
			window.addEventListener("keydown", handleWakeOrInteraction, { passive: true });

			document.addEventListener("visibilitychange", () => {
				if (document.visibilityState === "visible") {
					handleWakeOrInteraction();
				}
			});

			navigator.mediaDevices?.addEventListener?.("devicechange", () => {
				this._needsFreshContext = true;
				if (this._ctx) {
					void this.recreateContext().catch(() => {});
				}
			});

			// Heartbeat timer to detect sleep gaps or idle periods while app was in background
			setInterval(() => {
				const now = Date.now();
				const elapsed = now - lastHeartbeat;
				lastHeartbeat = now;

				if (elapsed > 4000) {
					// System was asleep
					this._needsFreshContext = true;
				}
			}, 2000);
		}
	}

	private _rawAudioData: ArrayBuffer | null = null;
	private _needsFreshContext = false;
	private _lastAudioActivityTime = Date.now();

	public markNeedsFreshContext() {
		this._needsFreshContext = true;
	}

	public async recreateContext(): Promise<AudioContext> {
		const wasPlaying = this._isPlaying;
		const currentPos = this.musicCurrentTime;

		if (this._activeSourceNode) {
			try {
				this._activeSourceNode.onended = null;
				this._activeSourceNode.stop();
				this._activeSourceNode.disconnect();
			} catch {}
			this._activeSourceNode = null;
		}

		if (this._ctx) {
			try {
				if (this._ctx.state !== "closed") {
					await this._ctx.close();
				}
			} catch (e) {
				console.warn("[AudioEngine] Error closing old AudioContext:", e);
			}
			this._ctx = null;
		}
		this.resetAudioGraph();
		const newCtx = this.ctx;
		try {
			await newCtx.resume();
		} catch (e) {
			console.warn("[AudioEngine] Error resuming new AudioContext:", e);
		}

		this._lastAudioActivityTime = Date.now();

		// If musicBuffer is missing but raw data exists, decode it
		if (!this.musicBuffer && this._rawAudioData && this._rawAudioData.byteLength > 0) {
			try {
				this.musicBuffer = await newCtx.decodeAudioData(this._rawAudioData.slice(0));
				globalStore.set(audioBufferAtom, this.musicBuffer);
			} catch (e) {
				console.warn("[AudioEngine] Error re-decoding audio for new context:", e);
			}
		}

		if (wasPlaying && this.musicBuffer) {
			void this.resumeOrSeekMusic(currentPos);
		}
		return newCtx;
	}

	//#region Audio element
	// Since an element is required to sync with waveform.js,
	// all audio playback is done through this element
	private _audioEl: HTMLAudioElement | null = null;
	get audioEl() {
		if (this._audioEl) return this._audioEl;
		this._audioEl = document.createElement("audio");
		this._audioEl.crossOrigin = "anonymous";
		this._audioEl.volume = this._volume;
		this._audioEl.preload = "metadata";
		return this._audioEl;
	}

	private _activeSourceNode: AudioBufferSourceNode | null = null;
	private _isPlaying = false;
	private _startTimeInContext = 0;
	private _startOffsetInSeconds = 0;
	private _pausedPosition = 0;

	private connectAudioToContext() {
		// Playback is driven directly via Web Audio AudioBufferSourceNode connected to eqEntryPoint.
	}

	/** Handle browser autoplay policy, macOS sleep, device changes and interruption */
	public async resumeContext() {
		const now = Date.now();
		const idleTime = now - this._lastAudioActivityTime;
		this._lastAudioActivityTime = now;

		if (
			this._needsFreshContext ||
			!this._ctx ||
			this._ctx.state === "closed" ||
			this._ctx.state === "interrupted" ||
			(!this._isPlaying && idleTime > 15000)
		) {
			this._needsFreshContext = false;
			await this.recreateContext();
			return;
		}

		const ctx = this.ctx;
		if (ctx.state !== "running") {
			try {
				await ctx.resume();
				log("AudioContext resumed, state is now:", ctx.state);
			} catch (e) {
				console.warn("Failed to resume AudioContext, recreating fresh context:", e);
			}
		}

		if (ctx.state !== "running") {
			await this.recreateContext();
		}
	}

	private _listenersSetup = false;

	/** Link audio element events into engine events */
	private setupAudioListeners() {
		if (this._listenersSetup) return;
		const audioEl = this._audioEl;
		if (!audioEl) return;

		this._listenersSetup = true;

		audioEl.addEventListener("ratechange", () => {
			this.musicPlayBackRate = audioEl.playbackRate;
		});
		audioEl.addEventListener("volumechange", () => {
			this.volume = audioEl.volume;
		});
	}
	//#endregion

	//#region Playback
	private auditionSourceNode: AudioBufferSourceNode | null = null;

	get musicLoaded() {
		return !!this.musicBuffer;
	}

	get musicPlaying() {
		if (this.musicBuffer) return this._isPlaying;
		if (!this._audioEl) return false;
		return !this._audioEl.paused && !this._audioEl.ended;
	}

	get musicCurrentTime() {
		if (this.musicBuffer) {
			if (!this._isPlaying) return this._pausedPosition;
			const elapsed =
				(this.ctx.currentTime - this._startTimeInContext) *
				this._musicPlayBackRate;
			const pos = this._startOffsetInSeconds + elapsed;
			return Math.min(this.musicDuration, Math.max(0, pos));
		}
		return this._audioEl?.currentTime ?? 0;
	}

	get interpolatedCurrentTime() {
		return this.musicCurrentTime;
	}

	get musicDuration() {
		if (this.musicBuffer) return this.musicBuffer.duration;
		return this._audioEl?.duration ?? 0;
	}

	private _musicPlayBackRate = 1;
	get musicPlayBackRate() {
		return this._musicPlayBackRate;
	}
	set musicPlayBackRate(v: number) {
		if (this._musicPlayBackRate === v) return;
		if (this._isPlaying && this.musicBuffer) {
			const currentPos = this.musicCurrentTime;
			this._musicPlayBackRate = v;
			if (this._activeSourceNode) {
				this._activeSourceNode.playbackRate.value = v;
			}
			this._startTimeInContext = this.ctx.currentTime;
			this._startOffsetInSeconds = currentPos;
		} else {
			this._musicPlayBackRate = v;
		}
		if (this._audioEl) {
			this._audioEl.playbackRate = v;
		}
		this.dispatchEvent(new Event("music-playback-rate-change"));
	}

	get volume() {
		return this._volume;
	}
	set volume(v: number) {
		if (this._volume === v) return;
		this._volume = v;
		this.gain.gain.value = v;
		if (this._audioEl) {
			this._audioEl.volume = v;
		}
		this.dispatchEvent(new Event("volume-change"));
	}

	get preservesPitch() {
		return this.audioEl.preservesPitch;
	}
	set preservesPitch(v: boolean) {
		this.audioEl.preservesPitch = v;
		this.dispatchEvent(new Event("music-preserves-pitch-change"));
	}

	get ctxCurrentTime() {
		return this.ctx.currentTime;
	}
	get ctxBaseLatency() {
		return this.ctx.baseLatency;
	}
	get ctxOutputLatency() {
		return this.ctx.outputLatency;
	}

	seekMusic(offset: number) {
		const duration = this.musicDuration;
		const clampedOffset = Math.min(duration, Math.max(0, offset));
		this._pausedPosition = clampedOffset;

		if (this._isPlaying && this.musicBuffer) {
			this.resumeOrSeekMusic(clampedOffset);
		} else {
			this.dispatchEvent(new Event("music-seeked"));
		}
	}

	async resumeOrSeekMusic(offset = this.musicCurrentTime) {
		if (!this.musicBuffer) {
			if (this._audioEl) {
				await this.resumeContext();
				this._audioEl.currentTime = offset;
				this._audioEl.play();
				this.dispatchEvent(new Event("music-resume"));
			}
			return;
		}

		await this.resumeContext();

		const duration = this.musicDuration;
		let clampedOffset = Math.min(duration, Math.max(0, offset));
		if (duration > 0 && clampedOffset >= duration - 0.05) {
			clampedOffset = 0;
		}

		if (this._activeSourceNode) {
			try {
				this._activeSourceNode.onended = null;
				this._activeSourceNode.stop();
				this._activeSourceNode.disconnect();
			} catch {
				// Already stopped
			}
			this._activeSourceNode = null;
		}

		try {
			const source = this.ctx.createBufferSource();
			source.buffer = this.musicBuffer;
			source.playbackRate.value = this._musicPlayBackRate;
			source.connect(this.eqEntryPoint);

			this._activeSourceNode = source;
			this._startTimeInContext = this.ctx.currentTime;
			this._startOffsetInSeconds = clampedOffset;
			this._pausedPosition = clampedOffset;
			this._isPlaying = true;

			source.onended = () => {
				if (this._activeSourceNode === source) {
					this._activeSourceNode = null;
					this._isPlaying = false;
					this._pausedPosition = this.musicDuration;
					this.dispatchEvent(new Event("music-pause"));
					this.dispatchEvent(new Event("music-seeked"));
				}
			};

			source.start(0, clampedOffset);
			this.dispatchEvent(new Event("music-resume"));
		} catch (err) {
			console.warn("[AudioEngine] Playback start failed, recreating context...", err);
			await this.recreateContext();
			const source = this.ctx.createBufferSource();
			source.buffer = this.musicBuffer;
			source.playbackRate.value = this._musicPlayBackRate;
			source.connect(this.eqEntryPoint);

			this._activeSourceNode = source;
			this._startTimeInContext = this.ctx.currentTime;
			this._startOffsetInSeconds = clampedOffset;
			this._pausedPosition = clampedOffset;
			this._isPlaying = true;

			source.onended = () => {
				if (this._activeSourceNode === source) {
					this._activeSourceNode = null;
					this._isPlaying = false;
					this._pausedPosition = this.musicDuration;
					this.dispatchEvent(new Event("music-pause"));
					this.dispatchEvent(new Event("music-seeked"));
				}
			};

			source.start(0, clampedOffset);
			this.dispatchEvent(new Event("music-resume"));
		}
	}

	pauseMusic() {
		if (!this._isPlaying) {
			if (this._audioEl && !this._audioEl.paused) {
				this._audioEl.pause();
				this.dispatchEvent(new Event("music-pause"));
			}
			return;
		}
		this._pausedPosition = this.musicCurrentTime;
		this._isPlaying = false;

		if (this._activeSourceNode) {
			try {
				this._activeSourceNode.onended = null;
				this._activeSourceNode.stop();
				this._activeSourceNode.disconnect();
			} catch {
				// Already stopped
			}
			this._activeSourceNode = null;
		}

		if (this._audioEl) {
			this._audioEl.currentTime = this._pausedPosition;
		}

		this.dispatchEvent(new Event("music-pause"));
	}

	/**
	 * 试听一个音频片段
	 *
	 * @param startTimeInSeconds 音频片段的开始时间
	 * @param endTimeInSeconds 音频片段的结束时间
	 * @returns
	 */
	async auditionRange(startTimeInSeconds: number, endTimeInSeconds: number) {
		if (!this.musicBuffer) {
			console.warn("musicBuffer 为 null, 无法预览音频");
			return;
		}

		if (this.auditionSourceNode) {
			try {
				this.auditionSourceNode.stop(0);
				this.auditionSourceNode.disconnect();
			} catch (e) {
				console.error("停止 AudioNode 失败:", e);
			}
			this.auditionSourceNode = null;
		}

		if (auditionRafId) {
			cancelAnimationFrame(auditionRafId);
			auditionRafId = null;
		}

		globalStore.set(auditionTimeAtom, null);

		const durationInSeconds = endTimeInSeconds - startTimeInSeconds;

		if (durationInSeconds <= 0) {
			return;
		}

		await this.resumeContext();

		try {
			const audioCtxStartTime = this.ctx.currentTime;
			const mediaStartTime = startTimeInSeconds;

			const source = this.ctx.createBufferSource();
			source.buffer = this.musicBuffer;
			source.connect(this.eqEntryPoint);
			this.auditionSourceNode = source;

			const progressLoop = () => {
				const elapsedTime = this.ctx.currentTime - audioCtxStartTime;
				const currentAuditionTime = mediaStartTime + elapsedTime;

				if (currentAuditionTime >= endTimeInSeconds) {
					globalStore.set(auditionTimeAtom, null);
					auditionRafId = null;
				} else {
					globalStore.set(auditionTimeAtom, currentAuditionTime);
					auditionRafId = requestAnimationFrame(progressLoop);
				}
			};

			source.addEventListener("ended", () => {
				if (this.auditionSourceNode === source) {
					if (auditionRafId) {
						cancelAnimationFrame(auditionRafId);
						auditionRafId = null;
					}
					globalStore.set(auditionTimeAtom, null);
					this.auditionSourceNode = null;
				}
				source.disconnect();
			});

			source.start(0, mediaStartTime, durationInSeconds);
			auditionRafId = requestAnimationFrame(progressLoop);
		} catch (err) {
			console.warn("[AudioEngine] Audition start failed, recreating context...", err);
			await this.recreateContext();
			const audioCtxStartTime = this.ctx.currentTime;
			const mediaStartTime = startTimeInSeconds;

			const source = this.ctx.createBufferSource();
			source.buffer = this.musicBuffer;
			source.connect(this.eqEntryPoint);
			this.auditionSourceNode = source;

			const progressLoop = () => {
				const elapsedTime = this.ctx.currentTime - audioCtxStartTime;
				const currentAuditionTime = mediaStartTime + elapsedTime;

				if (currentAuditionTime >= endTimeInSeconds) {
					globalStore.set(auditionTimeAtom, null);
					auditionRafId = null;
				} else {
					globalStore.set(auditionTimeAtom, currentAuditionTime);
					auditionRafId = requestAnimationFrame(progressLoop);
				}
			};

			source.addEventListener("ended", () => {
				if (this.auditionSourceNode === source) {
					if (auditionRafId) {
						cancelAnimationFrame(auditionRafId);
						auditionRafId = null;
					}
					globalStore.set(auditionTimeAtom, null);
					this.auditionSourceNode = null;
				}
				source.disconnect();
			});

			source.start(0, mediaStartTime, durationInSeconds);
			auditionRafId = requestAnimationFrame(progressLoop);
		}
	}

	//#endregion

	//#region Load sound
	private musicBuffer: AudioBuffer | null = null;
	private coverArtRequest = 0;

	private setEmbeddedCoverArt(coverUrl: string | null) {
		const previous = globalStore.get(audioCoverArtAtom);
		if (previous && previous !== coverUrl) URL.revokeObjectURL(previous);
		globalStore.set(audioCoverArtAtom, coverUrl);
	}

	async loadMusic(src: Blob, isRetry = false): Promise<HTMLAudioElement> {
		const audioEl = this.audioEl;

		if (!isRetry) {
			const request = ++this.coverArtRequest;
			this.setEmbeddedCoverArt(null);
			void this.workerClient
				.readMetadata(src)
				.then((metadata) => {
					if (request !== this.coverArtRequest) {
						if (metadata.coverUrl) URL.revokeObjectURL(metadata.coverUrl);
						return;
					}
					this.setEmbeddedCoverArt(metadata.coverUrl ?? null);
				})
				.catch(() => {
					// Audio playback is still valid when a format has no readable tags.
				});
			if (this.musicBuffer) {
				this.pauseMusic();
				this.musicBuffer = null;
				globalStore.set(audioBufferAtom, null);
				globalStore.set(loadedAudioAtom, new Blob([]));
				globalStore.set(loadedAudioFileNameAtom, null);
				this.revokeAudioObjUrl();
				audioEl.removeAttribute("src");
				audioEl.load();
				this.dispatchEvent(new Event("music-unload"));
			}
			this.dispatchEvent(new Event("music-loading"));
		}

		return new Promise((resolve, reject) => {
			audioEl.onloadedmetadata = null;
			audioEl.onerror = null;

			const handleError = (errorMsg: string, errorCode?: number) => {
				console.warn(
					`[AudioEngine] Load error. Retry: ${isRetry}. Code: ${errorCode}. Msg: ${errorMsg}`,
				);

				const canRetry =
					!isRetry &&
					(errorCode === MediaError.MEDIA_ERR_DECODE ||
						errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED);

				if (canRetry) {
					this.performTranscodeFallback(src, resolve, reject);
				} else {
					this.dispatchEvent(new Event("music-load-error"));
					reject(new Error(`Audio load error: ${errorMsg}`));
				}
			};

			audioEl.onerror = (e: Event | string) => {
				const error = audioEl.error;
				const msg = error?.message || e.toString();
				handleError(msg, error?.code);
			};

			audioEl.onloadedmetadata = async () => {
				try {
					const audioData = await src.arrayBuffer();
					this._rawAudioData = audioData;
					this.musicBuffer = await this.ctx.decodeAudioData(audioData.slice(0));
					globalStore.set(audioBufferAtom, this.musicBuffer);
					globalStore.set(loadedAudioAtom, src);
					globalStore.set(
						loadedAudioFileNameAtom,
						(src as any).name || null,
					);

					this.connectAudioToContext();
					this.setupAudioListeners();

					audioEl.onloadedmetadata = null;
					audioEl.onerror = null;

					audioEl.playbackRate = this._musicPlayBackRate;

					this.dispatchEvent(new Event("music-load"));
					resolve(audioEl);
				} catch (err) {
					console.warn("[AudioEngine] decodeAudioData failed:", err);

					if (!isRetry) {
						this.performTranscodeFallback(src, resolve, reject);
					} else {
						reject(err);
					}
				}
			};

			this.revokeAudioObjUrl();
			if (
				(src as any).path &&
				import.meta.env.TAURI_ENV_PLATFORM &&
				import.meta.env.TAURI_ENV_PLATFORM !== "darwin"
			) {
				audioEl.src = convertFileSrc((src as any).path);
			} else {
				this._audioObjUrl = URL.createObjectURL(src);
				audioEl.src = this._audioObjUrl;
			}
		});
	}

	private async performTranscodeFallback(
		src: Blob,
		resolve: (value: HTMLAudioElement | PromiseLike<HTMLAudioElement>) => void,
		reject: (reason?: Error) => void,
	) {
		console.log("[AudioEngine] Attempting transcoding fallback...");
		try {
			const wavBlob = await this.workerClient.transcodeToWav(src);

			const el = await this.loadMusic(wavBlob, true);
			resolve(el);
		} catch (error) {
			console.error("[AudioEngine] Transcoding fallback failed:", error);
			reject(error as Error);
		}
	}

	playSound(
		audioBuffer: AudioBuffer,
		when?: number,
		offset?: number,
		duration?: number,
	) {
		if (!this.ctx) return;
		const source = this.ctx.createBufferSource();
		source.buffer = audioBuffer;
		source.connect(this.eqEntryPoint);
		source.start(when, offset, duration);
		source.addEventListener("ended", () => {
			source.disconnect();
		});
	}

	playNode(node: AudioScheduledSourceNode, when?: number, stop?: number) {
		node.connect(this.eqEntryPoint);
		node.start(when);
		node.addEventListener("ended", () => {
			node.disconnect();
		});
		if (stop) node.stop(stop);
	}
	//#endregion

	//#region Misc
	decodeAudioData(
		audioData: ArrayBuffer,
		successCallback?: DecodeSuccessCallback | null,
		errorCallback?: DecodeErrorCallback | null,
	): Promise<AudioBuffer> {
		return this.ctx.decodeAudioData(audioData, successCallback, errorCallback);
	}
	//#endregion
}

export const audioEngine = new AudioEngine();
