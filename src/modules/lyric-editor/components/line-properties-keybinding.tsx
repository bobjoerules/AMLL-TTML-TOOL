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
import type { TTMLLyric } from "$/types/ttml.ts";
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
	const allActive =
		targetLines.length > 0 && targetLines.every((l) => !!l[property]);
	const targetValue = !allActive;

	editLyricLines((draft) => {
		for (const line of draft.lyricLines) {
			if (targetLineIds.has(line.id)) {
				line[property] = targetValue;
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
