/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/bobjoerules/AMLL-TTML-TOOL/blob/main/LICENSE
 */

import {
	Checkbox,
	Flex,
	Grid,
	SegmentedControl,
	Slider,
	Switch,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { type FC, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentLocation } from "$/modules/lyric-editor/utils/lyric-states.ts";
import {
	displayRomanizationInSyncAtom,
	enableManualTimestampEditAtom,
	enableSyncGlowAnimationAtom,
	highlightActiveWordAtom,
	highlightErrorsAtom,
	showTimestampsAtom,
	showWordRomanizationInputAtom,
} from "$/modules/settings/states/index.ts";
import {
	currentEmptyBeatAtom,
	enableTimeModeDoubleClickEditAtom,
	showTouchSyncPanelAtom,
	syncLevelModeAtom,
	syncTimeOffsetAtom,
	syncCommitOffsetAtom,
	visualizeTimestampUpdateAtom,
	type SyncLevelMode,
} from "$/modules/settings/states/sync.ts";
import { instantHighlightFadeAtom } from "$/modules/settings/states/preview";
import {
	keySyncEndAtom,
	keySyncNextAtom,
	keySyncStartAtom,
} from "$/states/keybindings.ts";

import {
	bgLyricIgnoreSyncAtom,
	lyricLinesAtom,
	showPreviewPanelAtom,
} from "$/states/main.ts";
import { KeyBinding } from "../KeyBinding/index.tsx";

import { RibbonFrame, RibbonSection } from "./common";
import { advancedRibbonControlsAtom } from "$/modules/onboarding/states";
import {
	Clock24Regular,
	List24Regular,
	Keyboard24Regular,
	Beaker24Regular,
	TextT24Regular,
	Settings24Regular,
	Timer16Regular,
	LocalLanguage16Regular,
	Warning16Regular,
	Lightbulb16Regular,
	Eye16Regular,
	Flash16Regular,
	Sparkle16Regular,
	Keyboard16Regular,
	DocumentSync16Regular,
	Flow16Regular,
} from "@fluentui/react-icons";

const EmptyBeatField = () => {
	const [currentEmptyBeat, setCurrentEmptyBeat] = useAtom(currentEmptyBeatAtom);
	const currentWordEmptyBeat = useCurrentLocation()?.word.emptyBeat || 0;
	const { t } = useTranslation();

	return (
		<>
			<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
				{t("ribbonBar.syncMode.currentEmptyBeat", "当前空拍")}
			</Text>
			<Slider
				value={[currentEmptyBeat]}
				onValueChange={(v) => setCurrentEmptyBeat(v[0])}
				min={0}
				max={currentWordEmptyBeat}
				step={1}
				disabled={currentWordEmptyBeat === 0}
			/>
			<div />
			<Text wrap="nowrap" align="center" size="1">
				{currentEmptyBeat} / {currentWordEmptyBeat}
			</Text>
		</>
	);
};

export const SyncModeRibbonBar: FC<{ isSidebar?: boolean }> = forwardRef<
	HTMLDivElement,
	{ isSidebar?: boolean }
>(({ isSidebar }, ref) => {
	const [visualizeTimestampUpdate, setVisualizeTimestampUpdate] = useAtom(
		visualizeTimestampUpdateAtom,
	);
	const [showTouchSyncPanel, setShowTouchSyncPanel] = useAtom(
		showTouchSyncPanelAtom,
	);
	const [showPreviewPanel, setShowPreviewPanel] = useAtom(showPreviewPanelAtom);
	const [showTimestamps, setShowTimestamps] = useAtom(showTimestampsAtom);
	const [highlightErrors, setHighlightErrors] = useAtom(highlightErrorsAtom);
	const [highlightActiveWord, setHighlightActiveWord] = useAtom(
		highlightActiveWordAtom,
	);
	const [enableSyncGlowAnimation, setEnableSyncGlowAnimation] = useAtom(
		enableSyncGlowAnimationAtom,
	);
	const [enableManualTimestampEdit, setEnableManualTimestampEdit] = useAtom(
		enableManualTimestampEditAtom,
	);
	const [enableTimeModeDoubleClickEdit, setEnableTimeModeDoubleClickEdit] =
		useAtom(enableTimeModeDoubleClickEditAtom);

	const [displayRomanizationInSync, setdisplayRomanizationInSync] = useAtom(
		displayRomanizationInSyncAtom,
	);
	const [bgLyricIgnoreSync, setBgLyricIgnoreSync] = useAtom(
		bgLyricIgnoreSyncAtom,
	);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const showWordRomanizationInput = useAtomValue(showWordRomanizationInputAtom);
	const [syncTimeOffset, setSyncTimeOffset] = useAtom(syncTimeOffsetAtom);
	const [syncCommitOffset, setSyncCommitOffset] = useAtom(syncCommitOffsetAtom);
	const [syncLevelMode, setSyncLevelMode] = useAtom(syncLevelModeAtom);
	const [instantFade, setInstantFade] = useAtom(instantHighlightFadeAtom);
	const { t } = useTranslation();
	const [showAdvanced, setShowAdvanced] = useAtom(advancedRibbonControlsAtom);

	return (
		<RibbonFrame ref={ref} isSidebar={isSidebar}>
			{showAdvanced && (
				<RibbonSection
					isSidebar={isSidebar}
					label={t("ribbonBar.syncMode.currentEmptyBeat", "当前空拍")}
				>
					<Grid
						columns="max-content 4em"
						gap="4"
						gapY="1"
						flexGrow="1"
						align="center"
					>
						<EmptyBeatField />
					</Grid>
				</RibbonSection>
			)}
			<RibbonSection
				isSidebar={isSidebar}
				label={
					<Flex align="center" gap="1" style={{ display: "inline-flex" }}>
						<Clock24Regular style={{ width: "12px", height: "12px" }} />
						<span>{t("ribbonBar.syncMode.syncAdjustment", "打轴调整")}</span>
					</Flex>
				}
			>
				<Grid
					columns="max-content auto"
					gap="4"
					gapY="1"
					flexGrow="1"
					align="center"
				>
					<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
						<Flex gap="1" align="center">
							<Timer16Regular />
							{t("ribbonBar.syncMode.timeOffset", "时间戳位移")}
						</Flex>
					</Text>
					<TextField.Root
						type="number"
						step={1}
						size="1"
						style={{
							width: "8em",
						}}
						value={syncTimeOffset}
						onChange={(e) => setSyncTimeOffset(e.target.valueAsNumber)}
					>
						<TextField.Slot />
						<TextField.Slot>
							<Text>ms</Text>
						</TextField.Slot>
					</TextField.Root>
					<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
						<Flex gap="1" align="center">
							<Timer16Regular />
							{t("ribbonBar.syncMode.commitOffset", "Commit Offset")}
						</Flex>
					</Text>
					<TextField.Root
						type="number"
						step={1}
						size="1"
						style={{
							width: "8em",
						}}
						value={syncCommitOffset}
						onChange={(e) => setSyncCommitOffset(e.target.valueAsNumber)}
					>
						<TextField.Slot />
						<TextField.Slot>
							<Text>ms</Text>
						</TextField.Slot>
					</TextField.Root>
					<EmptyBeatField />
				</Grid>
			</RibbonSection>
			<RibbonSection
				isSidebar={isSidebar}
				label={
					<Flex align="center" gap="1" style={{ display: "inline-flex" }}>
						<List24Regular style={{ width: "12px", height: "12px" }} />
						<span>{t("ribbonBar.syncMode.syncLevel", "Sync Level")}</span>
					</Flex>
				}
			>
				<Flex
					direction="column"
					gap="2"
					align="center"
					justify="center"
					px="2"
					style={{ height: "100%" }}
				>
					<SegmentedControl.Root
						value={syncLevelMode}
						onValueChange={(v) => setSyncLevelMode(v as SyncLevelMode)}
						size="1"
					>
						<SegmentedControl.Item value="word">
							<Flex align="center" gap="1">
								<TextT24Regular style={{ width: "14px", height: "14px" }} />
								<span>
									{t("ribbonBar.syncMode.syncLevelWord", "Word Sync")}
								</span>
							</Flex>
						</SegmentedControl.Item>
						<SegmentedControl.Item value="line">
							<Flex align="center" gap="1">
								<List24Regular style={{ width: "14px", height: "14px" }} />
								<span>
									{t("ribbonBar.syncMode.syncLevelLine", "Line Sync")}
								</span>
							</Flex>
						</SegmentedControl.Item>
					</SegmentedControl.Root>
				</Flex>
			</RibbonSection>
			{showAdvanced && (
				<RibbonSection
					isSidebar={isSidebar}
					label={
						<Flex align="center" gap="1" style={{ display: "inline-flex" }}>
							<Beaker24Regular style={{ width: "12px", height: "12px" }} />
							<span>{t("ribbonBar.syncMode.assistSettings", "辅助设置")}</span>
						</Flex>
					}
				>
					<Grid
						columns="max-content auto"
						gap="2"
						gapY="1"
						flexGrow="1"
						align="center"
					>
						<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
							<Flex gap="1" align="center">
								<Eye16Regular />
								{t("ribbonBar.syncMode.showTimestampUpdate", "呈现时间戳更新")}
							</Flex>
						</Text>
						<Checkbox
							checked={visualizeTimestampUpdate}
							onCheckedChange={(v) => setVisualizeTimestampUpdate(!!v)}
						/>
						<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
							<Flex gap="1" align="center">
								<DocumentSync16Regular />
								{t("ribbonBar.syncMode.touchSyncPanel", "触控打轴辅助面板")}
							</Flex>
						</Text>
						<Checkbox
							checked={showTouchSyncPanel}
							onCheckedChange={(v) => setShowTouchSyncPanel(!!v)}
						/>
						<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
							<Flex gap="1" align="center">
								<Flow16Regular />
								{t("ribbonBar.syncMode.bgLyricIgnoreSync", "背景歌词忽略打轴")}
							</Flex>
						</Text>
						<Checkbox
							checked={bgLyricIgnoreSync}
							onCheckedChange={(v) => {
								const next = !!v;
								setBgLyricIgnoreSync(next);
								editLyricLines((state) => {
									for (const line of state.lyricLines) {
										if (line.isBG) {
											line.ignoreSync = next;
										}
									}
									return state;
								});
							}}
						/>
						<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
							<Flex gap="1" align="center">
								<Timer16Regular />
								{t(
									"ribbonBar.syncMode.manualTimestampEdit",
									"Manual Timestamp Editing",
								)}
							</Flex>
						</Text>
						<Checkbox
							checked={enableManualTimestampEdit}
							onCheckedChange={(v) => setEnableManualTimestampEdit(!!v)}
						/>
						<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
							<Flex gap="1" align="center">
								<Keyboard16Regular />
								{t(
									"ribbonBar.syncMode.doubleClickEdit",
									"Double-Click Word Editing",
								)}
							</Flex>
						</Text>
						<Checkbox
							checked={enableTimeModeDoubleClickEdit}
							onCheckedChange={(v) => setEnableTimeModeDoubleClickEdit(!!v)}
						/>
					</Grid>
				</RibbonSection>
			)}
			{showAdvanced && (
				<RibbonSection
					isSidebar={isSidebar}
					label={t("ribbonBar.syncMode.displayOptions", "显示选项")}
				>
					<Grid
						columns="max-content auto"
						gap="2"
						gapY="1"
						flexGrow="1"
						align="center"
					>
						<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
							<Flex gap="1" align="center">
								<Eye16Regular />
								{t("ribbonBar.syncMode.showTimestamps", "显示时间戳")}
							</Flex>
						</Text>
						<Checkbox
							checked={showTimestamps}
							onCheckedChange={(v) => setShowTimestamps(!!v)}
						/>
						<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
							<Flex gap="1" align="center">
								<Lightbulb16Regular />
								{t("ribbonBar.syncMode.highlightActiveWord", "高亮当前音节")}
							</Flex>
						</Text>
						<Checkbox
							checked={highlightActiveWord}
							onCheckedChange={(v) => setHighlightActiveWord(!!v)}
						/>
						<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
							<Flex gap="1" align="center">
								<Sparkle16Regular />
								{t(
									"ribbonBar.syncMode.enableGlowAnimation",
									"启用高亮动态特效",
								)}
							</Flex>
						</Text>
						<Checkbox
							checked={enableSyncGlowAnimation}
							onCheckedChange={(v) => setEnableSyncGlowAnimation(!!v)}
						/>
						<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
							<Flex gap="1" align="center">
								<Flash16Regular />
								{t("ribbonBar.previewMode.instantFade", "即时淡出")}
							</Flex>
						</Text>
						<Checkbox
							checked={instantFade}
							onCheckedChange={(v) => setInstantFade(!!v)}
						/>

						<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
							<Flex gap="1" align="center">
								<Warning16Regular />
								{t("ribbonBar.syncMode.highlightErrors", "高亮错误")}
							</Flex>
						</Text>
						<Checkbox
							checked={highlightErrors}
							onCheckedChange={(v) => setHighlightErrors(!!v)}
						/>

						{showWordRomanizationInput && (
							<>
								<Text
									wrap="nowrap"
									size="1"
									style={{ color: "var(--accent-11)" }}
								>
									<Flex gap="1" align="center">
										<LocalLanguage16Regular />
										{t(
											"ribbonBar.syncMode.showPerWordRomanization",
											"显示逐字音译",
										)}
									</Flex>
								</Text>
								<Checkbox
									checked={displayRomanizationInSync}
									onCheckedChange={(v) => setdisplayRomanizationInSync(!!v)}
								/>
							</>
						)}
					</Grid>
				</RibbonSection>
			)}
			<RibbonSection
				isSidebar={isSidebar}
				label={
					<Flex align="center" gap="1" style={{ display: "inline-flex" }}>
						<Keyboard24Regular style={{ width: "12px", height: "12px" }} />
						<span>
							{t("ribbonBar.syncMode.keyBindingReference", "打轴键位速查")}
						</span>
					</Flex>
				}
			>
				<Flex gap="4">
					<Grid
						columns="max-content auto"
						gap="4"
						gapY="1"
						flexGrow="1"
						align="center"
						justify="center"
					>
						<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
							{t("ribbonBar.syncMode.startSync", "起始轴")}
						</Text>
						<KeyBinding kbdAtom={keySyncStartAtom} />
						<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
							{t("ribbonBar.syncMode.continuousSync", "连续轴")}
						</Text>
						<KeyBinding kbdAtom={keySyncNextAtom} />
						<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
							{t("ribbonBar.syncMode.endSync", "结束轴")}
						</Text>
						<KeyBinding kbdAtom={keySyncEndAtom} />
					</Grid>
				</Flex>
			</RibbonSection>
			{showAdvanced && (
				<RibbonSection
					isSidebar={isSidebar}
					label={
						<Flex align="center" gap="1" style={{ display: "inline-flex" }}>
							<Beaker24Regular style={{ width: "12px", height: "12px" }} />
							<span>{t("ribbonBar.editMode.previewPanel", "预览面板")}</span>
						</Flex>
					}
				>
					<Flex direction="column" align="center" gap="1">
						<Switch
							checked={showPreviewPanel}
							onCheckedChange={setShowPreviewPanel}
						/>
					</Flex>
				</RibbonSection>
			)}
			<RibbonSection
				label={
					<Flex align="center" gap="1" style={{ display: "inline-flex" }}>
						<Settings24Regular style={{ width: "12px", height: "12px" }} />
						<span>{t("ribbonBar.advanced", "Advanced")}</span>
					</Flex>
				}
				isSidebar={isSidebar}
			>
				<Switch checked={showAdvanced} onCheckedChange={setShowAdvanced} />
			</RibbonSection>
		</RibbonFrame>
	);
});

export default SyncModeRibbonBar;
