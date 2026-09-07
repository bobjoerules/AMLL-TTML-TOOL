/*
 * Copyright 2023-2026 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/bobjoerules/AMLL-TTML-TOOL/blob/main/LICENSE
 */

import { DeleteRegular } from "@fluentui/react-icons";
import { ContextMenu } from "@radix-ui/themes";
import { useAtomValue, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useTranslation } from "react-i18next";
import { geniusCategorizationEnabledAtom } from "$/modules/settings/states/index.ts";
import { lyricLinesAtom, ToolMode, toolModeAtom } from "$/states/main.ts";
import { LineTimingMenuItems } from "./line-timing-menu.tsx";
import { LyricLineMenu } from "./lyric-line-menu.tsx";
import { LyricWordMenu } from "./lyric-word-menu.tsx";
import {
	CategorizeSelectionContextMenuItem,
	SectionContextMenuItems,
	SectionContextMenuSub,
	UnassignedSectionContextMenuItems,
} from "./SectionActions";

export type ContextMenuTarget =
	| {
			type: "word";
			lineIndex: number;
			wordIndex: number;
			wordId: string;
			lineId: string;
	  }
	| { type: "space"; lineIndex: number; wordIndex: number; lineId: string }
	| { type: "line"; lineIndex: number; lineId: string };

interface LyricEditorContextMenuContentProps {
	target: ContextMenuTarget;
}

export function LyricEditorContextMenuContent({
	target,
}: LyricEditorContextMenuContentProps) {
	const { t } = useTranslation();
	const store = useStore();
	const toolMode = useAtomValue(toolModeAtom);
	const geniusCategorizationEnabled = useAtomValue(
		geniusCategorizationEnabledAtom,
	);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);

	if (target.type === "space") {
		return (
			<ContextMenu.Content>
				<ContextMenu.Item
					color="red"
					onClick={() => {
						editLyricLines((state) => {
							state.lyricLines[target.lineIndex]?.words.splice(
								target.wordIndex,
								1,
							);
						});
					}}
				>
					<DeleteRegular />
					{t("lyricWordView.deleteSpace", "Delete Space")}
				</ContextMenu.Item>
				<ContextMenu.Separator />
				<LyricLineMenu lineIndex={target.lineIndex} />
			</ContextMenu.Content>
		);
	}

	if (target.type === "word") {
		return (
			<ContextMenu.Content>
				<LyricWordMenu
					wordIndex={target.wordIndex}
					lineIndex={target.lineIndex}
				/>
				<ContextMenu.Separator />
				<LyricLineMenu lineIndex={target.lineIndex} />
			</ContextMenu.Content>
		);
	}

	// Target is a line
	const { lyricLines, sections } = store.get(lyricLinesAtom);
	const currentLine = lyricLines[target.lineIndex];
	const activeSection = currentLine
		? sections?.find((s) => s.id === currentLine.sectionId)
		: undefined;
	const sectionActionsEnabled = geniusCategorizationEnabled && !!activeSection;
	const manualCategorizationEnabled =
		geniusCategorizationEnabled && !activeSection;

	return (
		<ContextMenu.Content>
			<LineTimingMenuItems />
			{(toolMode === ToolMode.Edit ||
				sectionActionsEnabled ||
				manualCategorizationEnabled) && <ContextMenu.Separator />}
			{manualCategorizationEnabled &&
				(toolMode === ToolMode.Edit || toolMode === ToolMode.Sync) && (
					<CategorizeSelectionContextMenuItem />
				)}
			{manualCategorizationEnabled && toolMode === ToolMode.Edit && (
				<ContextMenu.Separator />
			)}
			{sectionActionsEnabled && activeSection && toolMode === ToolMode.Sync && (
				<SectionContextMenuItems
					section={activeSection}
					lineIndex={target.lineIndex}
				/>
			)}
			{sectionActionsEnabled && activeSection && toolMode === ToolMode.Edit && (
				<SectionContextMenuSub
					section={activeSection}
					lineIndex={target.lineIndex}
				/>
			)}
			{manualCategorizationEnabled && toolMode === ToolMode.Edit && (
				<UnassignedSectionContextMenuItems lineIndex={target.lineIndex} />
			)}
			{sectionActionsEnabled && activeSection && toolMode === ToolMode.Edit && (
				<ContextMenu.Separator />
			)}
			{toolMode === ToolMode.Edit && (
				<LyricLineMenu lineIndex={target.lineIndex} />
			)}
		</ContextMenu.Content>
	);
}
