import { type Atom, useAtomValue, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { type FC, useCallback } from "react";
import {
	keyToggleBackgroundAtom,
	keyToggleDuetAtom,
} from "$/states/keybindings.ts";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main.ts";
import { getLineVoice, type TTMLLyric } from "$/types/ttml.ts";
import { useKeyBindingAtom } from "$/utils/keybindings.ts";

export type LineToggleProperty = "isBG" | "isDuet";

export function toggleLinePropertyInStore(
	store: {
		get: <T>(atom: Atom<T>) => T;
	},
	editLyricLines: (recipe: (draft: TTMLLyric) => void) => void,
	toolMode: ToolMode,
	property: LineToggleProperty,
): boolean {
	if (toolMode !== ToolMode.Edit && toolMode !== ToolMode.Sync) {
		return false;
	}

	const selectedLines = store.get(selectedLinesAtom);
	const selectedWords = store.get(selectedWordsAtom);
	const lyricLinesState = store.get(lyricLinesAtom);

	// In Sync mode when words are being timed/navigated, don't conflict with moveToNextWord
	if (
		toolMode === ToolMode.Sync &&
		selectedWords.size > 0 &&
		property === "isDuet"
	) {
		return false;
	}

	const targetLineIds = new Set<string>(selectedLines);

	// If no line is directly selected in selectedLinesAtom, check if words are selected
	if (targetLineIds.size === 0 && selectedWords.size > 0) {
		for (const line of lyricLinesState.lyricLines) {
			if (line.words.some((w) => selectedWords.has(w.id))) {
				targetLineIds.add(line.id);
			}
		}
	}

	if (targetLineIds.size === 0) {
		return false;
	}

	const targetLines = lyricLinesState.lyricLines.filter((l) =>
		targetLineIds.has(l.id),
	);

	if (property === "isDuet") {
		// Collect active voices in the song (always include v1 and v2)
		const voiceSet = new Set<string>(["v1", "v2"]);
		for (const l of lyricLinesState.lyricLines) {
			voiceSet.add(getLineVoice(l));
		}
		const sortedVoices = Array.from(voiceSet).sort((a, b) => {
			const numA = parseInt(a.replace(/\D/g, "") || "1", 10);
			const numB = parseInt(b.replace(/\D/g, "") || "1", 10);
			return numA - numB;
		});

		const firstLineVoice = getLineVoice(targetLines[0]);
		const allSameVoice = targetLines.every(
			(l) => getLineVoice(l) === firstLineVoice,
		);

		let nextVoice = "v2";
		if (allSameVoice) {
			const currIdx = sortedVoices.indexOf(firstLineVoice);
			if (currIdx !== -1) {
				nextVoice = sortedVoices[(currIdx + 1) % sortedVoices.length];
			}
		} else {
			const hasV1 = targetLines.some((l) => getLineVoice(l) === "v1");
			nextVoice = hasV1 ? "v2" : "v1";
		}

		const isNextDuet = nextVoice !== "v1";
		editLyricLines((draft) => {
			for (const line of draft.lyricLines) {
				if (targetLineIds.has(line.id)) {
					line.agent = nextVoice;
					line.isDuet = isNextDuet;
				}
			}
		});

		return true;
	}

	const allActive =
		targetLines.length > 0 && targetLines.every((l) => !!l.isBG);
	const targetValue = !allActive;

	editLyricLines((draft) => {
		for (const line of draft.lyricLines) {
			if (targetLineIds.has(line.id)) {
				line.isBG = targetValue;
			}
		}
	});

	return true;
}

export const LinePropertiesKeybinding: FC = () => {
	const store = useStore();
	const toolMode = useAtomValue(toolModeAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);

	const handleToggleProperty = useCallback(
		(property: LineToggleProperty) => {
			toggleLinePropertyInStore(store, editLyricLines, toolMode, property);
		},
		[store, editLyricLines, toolMode],
	);

	useKeyBindingAtom(keyToggleBackgroundAtom, () => {
		handleToggleProperty("isBG");
	}, [handleToggleProperty]);

	useKeyBindingAtom(keyToggleDuetAtom, () => {
		handleToggleProperty("isDuet");
	}, [handleToggleProperty]);

	return null;
};
