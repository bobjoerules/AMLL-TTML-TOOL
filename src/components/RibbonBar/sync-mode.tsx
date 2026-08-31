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
	Box,
	Button,
	Checkbox,
	Flex,
	Grid,
	SegmentedControl,
	Slider,
	Switch,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { type FC, forwardRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useCurrentLocation } from "$/modules/lyric-editor/utils/lyric-states.ts";
import { useSyncProgress } from "$/hooks/useSyncProgress";
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
import { spectrogramOnlyShowSyncLineAtom } from "$/modules/spectrogram/states/index.ts";
import { currentTimeAtom } from "$/modules/audio/states/index.ts";

import {
	bgLyricIgnoreSyncAtom,
	copiedTimingsAtom,
	lyricLinesAtom,
	mainLyricIgnoreSyncAtom,
	selectedLinesAtom,
	selectedWordsAtom,
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
	Copy16Regular,
	ClipboardPaste16Regular,
	FastForward16Regular,
} from "@fluentui/react-icons";

export const LineTimingTools = () => {
	const { t } = useTranslation();
	const store = useStore();
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const [copiedTimings, setCopiedTimings] = useAtom(copiedTimingsAtom);

	const handleCopyTimings = useCallback(() => {
		const lyricLines = store.get(lyricLinesAtom).lyricLines;
		const selLines = store.get(selectedLinesAtom);
		const selWords = store.get(selectedWordsAtom);

		if (selLines.size === 0 && selWords.size === 0) {
			toast.info(
				t(
					"ribbonBar.timingTools.selectLineFirst",
					"Please select a line first",
				),
			);
			return;
		}

		if (selLines.size > 0) {
			const targetLine = lyricLines.find((l) => selLines.has(l.id));
			if (targetLine) {
				const duration = Math.max(0, targetLine.endTime - targetLine.startTime);
				const wordTimings = (targetLine.words || []).map((w) => ({
					relativeStart: Math.max(0, w.startTime - targetLine.startTime),
					duration: Math.max(0, w.endTime - w.startTime),
					emptyBeat: w.emptyBeat,
				}));
				setCopiedTimings({
					startTime: targetLine.startTime,
					endTime: targetLine.endTime,
					duration,
					wordTimings,
				});
				toast.success(
					t(
						"ribbonBar.timingTools.copiedLineTimings",
						"Copied line timings to clipboard",
					),
				);
				return;
			}
		}

		if (selWords.size > 0) {
			for (const line of lyricLines) {
				for (const word of line.words) {
					if (selWords.has(word.id)) {
						const duration = Math.max(0, word.endTime - word.startTime);
						setCopiedTimings({
							startTime: word.startTime,
							endTime: word.endTime,
							duration,
						});
						toast.success(
							t(
								"ribbonBar.timingTools.copiedWordTimings",
								"Copied word timing",
							),
						);
						return;
					}
				}
			}
		}
	}, [setCopiedTimings, store, t]);

	const handlePasteTimings = useCallback(() => {
		if (!copiedTimings) {
			toast.info(
				t(
					"ribbonBar.timingTools.noTimingsCopied",
					"No timings copied yet",
				),
			);
			return;
		}
		const selLines = store.get(selectedLinesAtom);
		const selWords = store.get(selectedWordsAtom);

		if (selLines.size === 0 && selWords.size === 0) {
			toast.info(
				t(
					"ribbonBar.timingTools.selectTargetFirst",
					"Please select a target line or word",
				),
			);
			return;
		}

		editLyricLines((state) => {
			for (const line of state.lyricLines) {
				if (selLines.has(line.id)) {
					line.startTime = copiedTimings.startTime;
					line.endTime = copiedTimings.endTime;
					if (
						copiedTimings.wordTimings &&
						line.words &&
						line.words.length > 0
					) {
						const count = Math.min(
							line.words.length,
							copiedTimings.wordTimings.length,
						);
						for (let i = 0; i < count; i++) {
							const wt = copiedTimings.wordTimings[i];
							line.words[i].startTime = line.startTime + wt.relativeStart;
							line.words[i].endTime = line.words[i].startTime + wt.duration;
							if (wt.emptyBeat !== undefined) {
								line.words[i].emptyBeat = wt.emptyBeat;
							}
						}
					}
				}
				if (selWords.size > 0) {
					for (const word of line.words) {
						if (selWords.has(word.id)) {
							word.startTime = copiedTimings.startTime;
							word.endTime = copiedTimings.endTime;
						}
					}
				}
			}
			return state;
		});
		toast.success(
			t(
				"ribbonBar.timingTools.pastedTimings",
				"Pasted timings to selection",
			),
		);
	}, [copiedTimings, editLyricLines, store, t]);

	const handleSnapToPlayhead = useCallback(() => {
		const currentTime = Math.round(store.get(currentTimeAtom));
		const selLines = store.get(selectedLinesAtom);
		const selWords = store.get(selectedWordsAtom);

		if (selLines.size === 0 && selWords.size === 0) {
			toast.info(
				t(
					"ribbonBar.timingTools.selectLineFirst",
					"Please select a line first",
				),
			);
			return;
		}

		editLyricLines((state) => {
			for (const line of state.lyricLines) {
				if (selLines.has(line.id)) {
					const origStart = line.startTime;
					const duration =
						line.endTime > origStart ? line.endTime - origStart : 3000;
					const offset = currentTime - origStart;
					line.startTime = currentTime;
					line.endTime = currentTime + duration;
					if (line.words) {
						for (const word of line.words) {
							if (word.startTime > 0 || word.endTime > 0) {
								const wDur = Math.max(0, word.endTime - word.startTime);
								word.startTime = Math.max(0, word.startTime + offset);
								word.endTime = word.startTime + wDur;
							}
						}
					}
				}
				if (selWords.size > 0) {
					for (const word of line.words) {
						if (selWords.has(word.id)) {
							const wDur =
								word.endTime > word.startTime
									? word.endTime - word.startTime
									: 500;
							word.startTime = currentTime;
							word.endTime = currentTime + wDur;
						}
					}
				}
			}
			return state;
		});
		toast.success(
			t(
				"ribbonBar.timingTools.snappedToPlayhead",
				"Snapped timing to playhead",
			),
		);
	}, [editLyricLines, store, t]);

	return (
		<Flex gap="1" align="center" wrap="wrap">
			<Button
				size="1"
				variant="soft"
				onClick={handleCopyTimings}
				title={t("ribbonBar.timingTools.copyTimings", "Copy Timings")}
			>
				<Copy16Regular />
				<span>{t("ribbonBar.timingTools.copy", "Copy Timings")}</span>
			</Button>
			<Button
				size="1"
				variant="soft"
				onClick={handlePasteTimings}
				disabled={!copiedTimings}
				title={t("ribbonBar.timingTools.pasteTimings", "Paste Timings")}
			>
				<ClipboardPaste16Regular />
				<span>{t("ribbonBar.timingTools.paste", "Paste Timings")}</span>
			</Button>
			<Button
				size="1"
				variant="soft"
				color="indigo"
				onClick={handleSnapToPlayhead}
				title={t(
					"ribbonBar.timingTools.snapPlayhead",
					"Snap Timings to Playhead",
				)}
			>
				<FastForward16Regular />
				<span>{t("ribbonBar.timingTools.snap", "Snap to Playhead")}</span>
			</Button>
		</Flex>
	);
};

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

export const RibbonSyncProgressWidget = () => {
	const syncProgress = useSyncProgress();
	const { t } = useTranslation();

	if (!syncProgress.hasLyrics) {
		return (
			<Flex align="center" justify="center" px="3" py="1">
				<Text size="1" color="gray">
					{t("ribbonBar.syncMode.noLyrics", "No Lyrics")}
				</Text>
			</Flex>
		);
	}

	return (
		<Flex align="center" gap="3" px="2" py="1">
			<Box
				style={{
					position: "relative",
					width: 36,
					height: 36,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					flexShrink: 0,
				}}
			>
				<svg
					width="36"
					height="36"
					viewBox="0 0 36 36"
					style={{ transform: "rotate(-90deg)", display: "block" }}
				>
					<circle
						cx="18"
						cy="18"
						r="15"
						stroke="var(--gray-a4)"
						strokeWidth="3"
						fill="none"
					/>
					<circle
						cx="18"
						cy="18"
						r="15"
						stroke={
							syncProgress.linePercent === 100
								? "var(--green-9)"
								: "var(--accent-9)"
						}
						strokeWidth="3"
						fill="none"
						strokeDasharray={2 * Math.PI * 15}
						strokeDashoffset={
							2 * Math.PI * 15 * (1 - syncProgress.linePercent / 100)
						}
						strokeLinecap="round"
						style={{ transition: "stroke-dashoffset 0.3s ease" }}
					/>
				</svg>
				<Text
					size="1"
					weight="bold"
					style={{
						position: "absolute",
						fontSize: syncProgress.linePercent === 100 ? "8.5px" : "10px",
						letterSpacing: syncProgress.linePercent === 100 ? "-0.5px" : undefined,
						lineHeight: 1,
						color:
							syncProgress.linePercent === 100
								? "var(--green-11)"
								: "var(--accent-11)",
					}}
				>
					{syncProgress.linePercent}%
				</Text>
			</Box>
			<Flex direction="column" gap="0" style={{ lineHeight: 1.2 }}>
				<Text size="1" weight="bold" style={{ color: "var(--gray-12)" }}>
					{syncProgress.timedLines} / {syncProgress.totalLines}{" "}
					{t("ribbonBar.syncMode.lines", "Lines")}
				</Text>
				<Text size="1" color="gray" style={{ fontSize: "11px" }}>
					{syncProgress.timedWords} / {syncProgress.totalWords}{" "}
					{t("ribbonBar.syncMode.words", "Words")}
				</Text>
			</Flex>
		</Flex>
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
	const [mainLyricIgnoreSync, setMainLyricIgnoreSync] = useAtom(
		mainLyricIgnoreSyncAtom,
	);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const showWordRomanizationInput = useAtomValue(showWordRomanizationInputAtom);
	const [syncTimeOffset, setSyncTimeOffset] = useAtom(syncTimeOffsetAtom);
	const [syncCommitOffset, setSyncCommitOffset] = useAtom(syncCommitOffsetAtom);
	const [syncLevelMode, setSyncLevelMode] = useAtom(syncLevelModeAtom);
	const [instantFade, setInstantFade] = useAtom(instantHighlightFadeAtom);
	const [spectrogramOnlyShowSyncLine, setSpectrogramOnlyShowSyncLine] = useAtom(
		spectrogramOnlyShowSyncLineAtom,
	);
	const { t } = useTranslation();
	const [showAdvanced, setShowAdvanced] = useAtom(advancedRibbonControlsAtom);

	return (
		<RibbonFrame ref={ref} isSidebar={isSidebar}>
			<RibbonSection
				isSidebar={isSidebar}
				label={
					<Flex align="center" gap="1" style={{ display: "inline-flex" }}>
						<Timer16Regular style={{ width: "12px", height: "12px" }} />
						<span>{t("ribbonBar.syncMode.syncProgress", "Sync Progress")}</span>
					</Flex>
				}
			>
				<RibbonSyncProgressWidget />
			</RibbonSection>
			<RibbonSection
				isSidebar={isSidebar}
				label={
					<Flex align="center" gap="1" style={{ display: "inline-flex" }}>
						<Timer16Regular style={{ width: "12px", height: "12px" }} />
						<span>{t("ribbonBar.timingTools.title", "Timing Tools")}</span>
					</Flex>
				}
			>
				<Flex direction="column" align="center" gap="2">
					<LineTimingTools />
				</Flex>
			</RibbonSection>
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
			{showAdvanced && (
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
			)}
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
								{t("ribbonBar.syncMode.mainLyricIgnoreSync", "主歌词忽略打轴")}
							</Flex>
						</Text>
						<Checkbox
							checked={mainLyricIgnoreSync}
							onCheckedChange={(v) => {
								const next = !!v;
								setMainLyricIgnoreSync(next);
								editLyricLines((state) => {
									for (const line of state.lyricLines) {
										if (!line.isBG) {
											line.ignoreSync = next;
										}
									}
									return state;
								});
							}}
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

						<Text wrap="nowrap" size="1" style={{ color: "var(--accent-11)" }}>
							<Flex gap="1" align="center">
								<DocumentSync16Regular />
								{t(
									"ribbonBar.syncMode.onlyShowSyncLineOnSpectrogram",
									"仅在频谱图显示当前打轴行",
								)}
							</Flex>
						</Text>
						<Checkbox
							checked={spectrogramOnlyShowSyncLine}
							onCheckedChange={(v) => setSpectrogramOnlyShowSyncLine(!!v)}
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
