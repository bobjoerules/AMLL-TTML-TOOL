declare module "soundtouchjs" {
	export class PitchShifter {
		constructor(
			context: AudioContext,
			buffer: AudioBuffer,
			bufferSize: number,
			onEnd?: () => void,
		);
		tempo: number;
		pitch: number;
		rate: number;
		duration: number;
		sampleRate: number;
		timePlayed: number;
		percentagePlayed: number;
		node: AudioNode;
		_filter: {
			sourcePosition: number;
			source: {
				buffer: AudioBuffer;
			};
		};
		connect(toNode: AudioNode): void;
		disconnect(): void;
		on(eventName: string, cb: (detail: unknown) => void): void;
		off(eventName?: string | null): void;
	}
}
