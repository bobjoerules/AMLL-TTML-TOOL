import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { audioBufferAtom } from "$/modules/audio/states/index.ts";
import {
	type ColorStop,
	generateLutFromStops,
	generatePalette,
	getGrayscaleColor,
	getGreenColor,
	getIcyBlueColor,
} from "$/modules/spectrogram/utils/colors";

export const spectrogramGainAtom = atomWithStorage(
	"settings_spectrogramGain",
	3.0,
);
export const spectrogramZoomAtom = atomWithStorage(
	"settings_spectrogramZoom",
	200,
);
export const spectrogramHeightAtom = atomWithStorage(
	"settings_spectrogramHeight",
	256,
);
export const spectrogramScrollLeftAtom = atom(0);
export const spectrogramContainerWidthAtom = atom(0);
export const spectrogramFftSizeAtom = atomWithStorage<number>(
	"settings_spectrogramFftSize",
	1024,
);
export const spectrogramOnlyShowSyncLineAtom = atomWithStorage(
	"settings_spectrogramOnlyShowSyncLine",
	false,
);
export type SpectrogramPlayheadTrackingMode = "off" | "snap" | "follow";

const getInitialTrackingMode = (): SpectrogramPlayheadTrackingMode => {
	try {
		const saved = localStorage.getItem(
			"settings_spectrogramPlayheadTrackingMode",
		);
		if (saved) {
			const parsed = JSON.parse(saved);
			if (parsed === "off" || parsed === "snap" || parsed === "follow") {
				return parsed;
			}
		}
		if (localStorage.getItem("settings_spectrogramFollowPlayhead") === "true") {
			return "follow";
		}
		if (
			localStorage.getItem("settings_spectrogramSnapPlayheadToStart") === "true"
		) {
			return "snap";
		}
	} catch {
		// ignore
	}
	return "off";
};

export const spectrogramPlayheadTrackingModeAtom =
	atomWithStorage<SpectrogramPlayheadTrackingMode>(
		"settings_spectrogramPlayheadTrackingMode",
		getInitialTrackingMode(),
	);

export const spectrogramFollowPlayheadAtom = atom(
	(get) => get(spectrogramPlayheadTrackingModeAtom) === "follow",
	(get, set, update: boolean | ((prev: boolean) => boolean)) => {
		const current = get(spectrogramPlayheadTrackingModeAtom) === "follow";
		const next = typeof update === "function" ? update(current) : update;
		set(spectrogramPlayheadTrackingModeAtom, next ? "follow" : "off");
	},
);

export const spectrogramSnapPlayheadToStartAtom = atom(
	(get) => get(spectrogramPlayheadTrackingModeAtom) === "snap",
	(get, set, update: boolean | ((prev: boolean) => boolean)) => {
		const current = get(spectrogramPlayheadTrackingModeAtom) === "snap";
		const next = typeof update === "function" ? update(current) : update;
		set(spectrogramPlayheadTrackingModeAtom, next ? "snap" : "off");
	},
);

const icyBluePalette = {
	id: "icy_blue",
	name: "Icy Blue",
	data: generatePalette(getIcyBlueColor),
};

const grayscalePalette = {
	id: "grayscale",
	name: "Gray Scale",
	data: generatePalette(getGrayscaleColor),
};

const aegisubGreenPalette = {
	id: "aegisub_green",
	name: "Green",
	data: generatePalette(getGreenColor),
};

export const predefinedPalettes = [
	icyBluePalette,
	aegisubGreenPalette,
	grayscalePalette,
];

export const selectedPaletteIdAtom = atomWithStorage<string>(
	"settings_selectedPaletteId",
	"icy_blue",
);

export const customPaletteStopsAtom = atomWithStorage<ColorStop[]>(
	"settings_customPaletteStops",
	[
		{ id: crypto.randomUUID(), pos: 0.0, color: "#000000" },
		{ id: crypto.randomUUID(), pos: 0.5, color: "#ff0000" },
		{ id: crypto.randomUUID(), pos: 1.0, color: "#ffff00" },
	],
);

export const currentPaletteAtom = atom((get) => {
	const selectedId = get(selectedPaletteIdAtom);

	if (selectedId === "custom") {
		const stops = get(customPaletteStopsAtom);

		const paletteId =
			"custom_" +
			stops.map((s) => `${s.pos.toFixed(2)}-${s.color.substring(1)}`).join("-");

		const paletteData = generateLutFromStops(stops);

		return { id: paletteId, name: "custom", data: paletteData };
	}

	const predefined = predefinedPalettes.find((p) => p.id === selectedId);
	if (predefined) {
		return predefined;
	}

	return icyBluePalette;
});

export const spectrogramHoverPxAtom = atom(0);
export const spectrogramHoverPyAtom = atom(0);

export const spectrogramHoverTimeMsAtom = atom((get) => {
	const hoverPx = get(spectrogramHoverPxAtom);
	const scrollLeft = get(spectrogramScrollLeftAtom);
	const zoom = get(spectrogramZoomAtom);
	const containerWidth = get(spectrogramContainerWidthAtom);

	if (zoom <= 0) return 0;

	const clampedMouseX = Math.max(0, Math.min(hoverPx, containerWidth));
	const hoverX = scrollLeft + clampedMouseX;
	const hoverTimeS = hoverX / zoom;

	return hoverTimeS * 1000;
});

export const spectrogramHoverFrequencyAtom = atom((get) => {
	const hoverPy = get(spectrogramHoverPyAtom);
	const height = get(spectrogramHeightAtom);
	const audioBuffer = get(audioBufferAtom);

	if (!audioBuffer || height <= 0) return 0;

	const nyquist = audioBuffer.sampleRate / 2;
	const ratio = 1 - Math.max(0, Math.min(hoverPy, height)) / height;
	return ratio * nyquist;
});

export const spectrogramSelectionAtom = atom<{
	start: number;
	end: number;
} | null>(null);

export const spectrogramFullWidthAtom = atomWithStorage<boolean>(
	"settings_spectrogramFullWidth",
	false,
);

export const spectrogramSplitBgMainAtom = atomWithStorage<boolean>(
	"settings_spectrogramSplitBgMain",
	false,
);
