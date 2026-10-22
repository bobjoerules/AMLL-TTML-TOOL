import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { CompletedTTMLRecord } from "./types";

export const currentProjectTimeSecondsAtom = atom<number>(0);
export const isTimerInactiveAtom = atom<boolean>(false);

export const fastestTTMLRecordAtom =
	atomWithStorage<CompletedTTMLRecord | null>("amll_ttml_fastest_record", null);

export const averageTTMLTimeSecondsAtom = atomWithStorage<number | null>(
	"amll_ttml_average_time_seconds",
	null,
);

export const totalActiveSecondsAtom = atomWithStorage<number>(
	"amll_ttml_total_active_seconds",
	0,
);
