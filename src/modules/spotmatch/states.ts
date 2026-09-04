import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type {
	SpotMatchCandidate,
	SpotMatchPreset,
	SpotMatchSourceTrack,
} from "./engine";

export const spotMatchDialogAtom = atom<boolean>(false);
export const spotMatchInitialTrackIdAtom = atom<string | undefined>(undefined);

export const spotMatchPresetAtom = atomWithStorage<SpotMatchPreset>(
	"spotMatch_preset",
	"Balanced",
);
export const spotMatchMinScoreAtom = atomWithStorage<number>(
	"spotMatch_minScore",
	60,
);
export const spotMatchMaxDurationSecondsAtom = atomWithStorage<number>(
	"spotMatch_maxDurationSeconds",
	10,
);
export const spotMatchExactTitleAtom = atomWithStorage<boolean>(
	"spotMatch_exactTitle",
	false,
);

export const spotMatchSourceAtom = atom<SpotMatchSourceTrack | null>(null);
export const spotMatchCandidatesAtom = atom<SpotMatchCandidate[]>([]);
export const spotMatchSelectedIdsAtom = atom<Set<string>>(new Set<string>());
