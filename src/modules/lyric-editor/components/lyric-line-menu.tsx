import { ContextMenu } from "@radix-ui/themes";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { lyricLinesAtom, selectedLinesAtom } from "$/states/main";
import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml";
import {
	globalEnableInsertAtom,
	timingCopyPlacementAtom,
} from "./lyric-line-view-states";
import { mergeLyricLines } from "../utils/merge-lines";
import { MergeLineDialog } from "../modals/MergeLineDialog";

const selectedLinesSizeAtom = atom((get) => get(selectedLinesAtom).size);

export const LyricLineMenu = ({ lineIndex }: { lineIndex: number }) => {
	const { t } = useTranslation();
	const setGlobalEnableInsert = useSetAtom(globalEnableInsertAtom);
	const setTimingCopyPlacement = useSetAtom(timingCopyPlacementAtom);

	const selectedLinesSize = useAtomValue(selectedLinesSizeAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);

	const lineObjs = useAtomValue(lyricLinesAtom);
	const totalLines = lineObjs.lyricLines.length;
	const selectedLineObjs = lineObjs.lyricLines.filter((line) =>
		selectedLines.has(line.id),
	);
	const [mergePickerOpen, setMergePickerOpen] = React.useState(false);

	const [Bgchecked, setBgChecked] = React.useState(() => {
		if (selectedLineObjs.every((line) => line.isBG)) return true;
		else if (selectedLineObjs.every((line) => !line.isBG)) return false;
		else return "indeterminate" as const;
	});
	const [DuetChecked, setDuetChecked] = React.useState(() => {
		if (selectedLineObjs.every((line) => line.isDuet)) return true;
		else if (selectedLineObjs.every((line) => !line.isDuet)) return false;
		else return "indeterminate" as const;
	});

	function bgOnCheck(checked: boolean) {
		setBgChecked(checked);
		editLyricLines((state) => {
			const lines = state.lyricLines.filter((line) =>
				selectedLines.has(line.id),
			);
			for (const line of lines) line.isBG = checked;
		});
	}

	function duetOnCheck(checked: boolean) {
		setDuetChecked(checked);
		editLyricLines((state) => {
			const lines = state.lyricLines.filter((line) =>
				selectedLines.has(line.id),
			);
			for (const line of lines) line.isDuet = checked;
		});
	}

	function mergeWithPrevious() {
		if (lineIndex <= 0) return;
		editLyricLines((state) => {
			const prevLine = state.lyricLines[lineIndex - 1];
			const curLine = state.lyricLines[lineIndex];
			if (!prevLine || !curLine) return;
			const merged = mergeLyricLines([prevLine, curLine]);
			if (!merged) return;
			state.lyricLines.splice(lineIndex, 1);
			state.lyricLines.splice(lineIndex - 1, 1, merged);
		});
	}

	function mergeWithNext() {
		if (lineIndex >= totalLines - 1) return;
		editLyricLines((state) => {
			const curLine = state.lyricLines[lineIndex];
			const nextLine = state.lyricLines[lineIndex + 1];
			if (!curLine || !nextLine) return;
			const merged = mergeLyricLines([curLine, nextLine]);
			if (!merged) return;
			state.lyricLines.splice(lineIndex + 1, 1);
			state.lyricLines.splice(lineIndex, 1, merged);
		});
	}

	function mergeSelectedLines() {
		if (selectedLinesSize < 2) return;
		editLyricLines((state) => {
			const selectedIdxs = state.lyricLines
				.map((line, idx) => (selectedLines.has(line.id) ? idx : -1))
				.filter((idx) => idx !== -1)
				.sort((a, b) => a - b);
			if (selectedIdxs.length < 2) return;

			const targetLines = selectedIdxs.map((idx) => state.lyricLines[idx]);
			const merged = mergeLyricLines(targetLines);
			if (!merged) return;

			const firstIdx = selectedIdxs[0];
			for (let i = selectedIdxs.length - 1; i >= 1; i--) {
				state.lyricLines.splice(selectedIdxs[i], 1);
			}
			state.lyricLines.splice(firstIdx, 1, merged);
		});
	}

	function copyLines() {
		editLyricLines((state) => {
			state.lyricLines = state.lyricLines.flatMap((line) => {
				if (!selectedLines.has(line.id)) return line;
				const newLine: LyricLine = {
					...line,
					id: newLyricLine().id,
					words: line.words.map((word) => ({
						...word,
						id: newLyricWord().id,
					})),
				};
				return [line, newLine];
			});
		});
	}

	return (
		<>
			<MergeLineDialog
				sourceLineIndex={lineIndex}
				open={mergePickerOpen}
				onOpenChange={setMergePickerOpen}
			/>
			<ContextMenu.CheckboxItem checked={Bgchecked} onCheckedChange={bgOnCheck}>
				{t("contextMenu.bgLyric", "背景歌词")}
			</ContextMenu.CheckboxItem>
			<ContextMenu.CheckboxItem
				checked={DuetChecked}
				onCheckedChange={duetOnCheck}
			>
				{t("contextMenu.duetLyric", "对唱歌词")}
			</ContextMenu.CheckboxItem>
			<ContextMenu.Separator />
			<ContextMenu.Item
				onSelect={() => {
					editLyricLines((state) => {
						state.lyricLines.splice(lineIndex, 0, newLyricLine());
					});
				}}
			>
				{t("contextMenu.insertLineBefore", "在前插入空行")}
			</ContextMenu.Item>
			<ContextMenu.Item
				onSelect={() => {
					editLyricLines((state) => {
						state.lyricLines.splice(lineIndex + 1, 0, newLyricLine());
					});
				}}
			>
				{t("contextMenu.insertLineAfter", "在后插入空行")}
			</ContextMenu.Item>
			<ContextMenu.Item onSelect={copyLines} disabled={selectedLinesSize === 0}>
				{t("contextMenu.copyLine", {
					count: selectedLinesSize,
					defaultValue: "复制行",
				})}
			</ContextMenu.Item>
			<ContextMenu.Item
				onSelect={() => {
					setTimingCopyPlacement(null);
					setGlobalEnableInsert(true);
				}}
				disabled={selectedLinesSize === 0}
			>
				{t("contextMenu.duplicateTo", "Duplicate to...")}
			</ContextMenu.Item>
			<ContextMenu.Separator />
			<ContextMenu.Sub>
				<ContextMenu.SubTrigger>
					{t("contextMenu.mergeLine", "Merge line")}
				</ContextMenu.SubTrigger>
				<ContextMenu.SubContent>
					<ContextMenu.Item
						onSelect={mergeWithPrevious}
						disabled={lineIndex <= 0}
					>
						{t("contextMenu.mergeWithPrevious", "Merge with previous line")}
					</ContextMenu.Item>
					<ContextMenu.Item
						onSelect={mergeWithNext}
						disabled={lineIndex >= totalLines - 1}
					>
						{t("contextMenu.mergeWithNext", "Merge with next line")}
					</ContextMenu.Item>
					<ContextMenu.Item
						onSelect={() => setMergePickerOpen(true)}
						disabled={totalLines <= 1}
					>
						{t("contextMenu.mergeWithAnother", "Merge with another line…")}
					</ContextMenu.Item>
					{selectedLinesSize >= 2 && (
						<ContextMenu.Item onSelect={mergeSelectedLines}>
							{t("contextMenu.mergeSelectedLines", {
								count: selectedLinesSize,
								defaultValue: `Merge ${selectedLinesSize} selected lines`,
							})}
						</ContextMenu.Item>
					)}
				</ContextMenu.SubContent>
			</ContextMenu.Sub>
			<ContextMenu.Separator />
			<ContextMenu.Item
				onSelect={() => {
					editLyricLines((state) => {
						if (selectedLinesSize === 0) {
							state.lyricLines.splice(lineIndex, 1);
						} else {
							state.lyricLines = state.lyricLines.filter(
								(line) => !selectedLines.has(line.id),
							);
						}
					});
				}}
			>
				{t("contextMenu.deleteLine", {
					count: selectedLinesSize,
					defaultValue: "删除行",
				})}
			</ContextMenu.Item>
		</>
	);
};
