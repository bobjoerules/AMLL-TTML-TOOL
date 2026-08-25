import { HistoryRegular, CheckmarkCircle24Filled } from "@fluentui/react-icons";
import { Badge, Box, Button, Flex, Text, TextField, Tooltip } from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSuggestedTtmlFileName } from "$/modules/project/logic/metadata-filename";
import { confirmDialogAtom, historyRestoreDialogAtom } from "$/states/dialogs";
import {
	lastSavedTimeAtom,
	lyricLinesAtom,
	saveFileNameAtom,
} from "$/states/main";
import { useSyncProgress } from "$/hooks/useSyncProgress";

export const HeaderFileInfo = () => {
	const { t } = useTranslation();
	const syncProgress = useSyncProgress();
	const [filename, setFilename] = useAtom(saveFileNameAtom);
	const lastSavedTime = useAtomValue(lastSavedTimeAtom);
	const setHistoryDialogOpen = useSetAtom(historyRestoreDialogAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const metadata = useAtomValue(lyricLinesAtom).metadata;
	const [isEditing, setIsEditing] = useState(false);
	const [draftName, setDraftName] = useState("");
	const [autoSaveExpanded, setAutoSaveExpanded] = useState(false);
	const [autoSaveTimeLabel, setAutoSaveTimeLabel] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const lastSavedTimeRef = useRef<number | null>(null);
	const suffix = ".ttml";
	const suggestedFile = getSuggestedTtmlFileName(metadata);

	const getBaseName = useCallback(
		(value: string) =>
			value.toLowerCase().endsWith(suffix)
				? value.slice(0, -suffix.length)
				: value,
		[],
	);

	const finishEditing = useCallback(
		({ commit }: { commit: boolean }) => {
			if (commit) {
				const trimmed = draftName.trim();
				if (trimmed.length > 0) {
					setFilename(`${trimmed}${suffix}`);
				} else {
					setDraftName(getBaseName(filename));
				}
			}
			setIsEditing(false);
		},
		[draftName, filename, getBaseName, setFilename],
	);

	useEffect(() => {
		if (!isEditing) return;
		setDraftName(getBaseName(filename));
		inputRef.current?.focus();
		inputRef.current?.select();
	}, [filename, getBaseName, isEditing]);

	useEffect(() => {
		if (!lastSavedTime) return;
		if (lastSavedTimeRef.current === lastSavedTime) return;
		lastSavedTimeRef.current = lastSavedTime;
		setAutoSaveTimeLabel(new Date(lastSavedTime).toLocaleTimeString());
		setAutoSaveExpanded(true);
		const timer = window.setTimeout(() => {
			setAutoSaveExpanded(false);
		}, 4000);
		return () => window.clearTimeout(timer);
	}, [lastSavedTime]);

	const handleNameClick = useCallback(() => {
		const isDefaultName = filename.toLowerCase() === "lyric.ttml";
		if (isDefaultName && suggestedFile) {
			setConfirmDialog({
				open: true,
				title: t("confirmDialog.useMetadataName.title", "使用元数据命名？"),
				description: t(
					"confirmDialog.useMetadataName.description",
					'是否使用"{name}"作为文件名？',
					{ name: suggestedFile.baseName },
				),
				onConfirm: () => {
					setFilename(suggestedFile.fileName);
				},
			});
			return;
		}
		setIsEditing(true);
	}, [filename, setConfirmDialog, setFilename, suggestedFile, t]);

	return (
		<Flex align="center" gap="2" style={{ maxWidth: "100%" }}>
			<Button
				variant="soft"
				onClick={() => setHistoryDialogOpen(true)}
				style={{
					justifyContent: "start",
					overflow: "hidden",
					whiteSpace: "nowrap",
					maxWidth: autoSaveExpanded ? 220 : 36,
					transition: "max-width 0.3s ease",
				}}
			>
				<Flex align="center" gap="1">
					<Text size="1" style={{ display: "flex" }}>
						<HistoryRegular />
					</Text>
					{autoSaveExpanded && (
						<Text size="1" color="gray">
							{t("header.status.autoSavedAt", "已自动保存于 {time}", {
								time: autoSaveTimeLabel,
							})}
						</Text>
					)}
				</Flex>
			</Button>

			<Box>
				{isEditing ? (
					<Flex align="center" gap="1">
						<TextField.Root
							ref={inputRef}
							size="1"
							value={draftName}
							onChange={(e) => setDraftName(e.target.value)}
							placeholder="example"
							style={{ width: "10rem" }}
							onBlur={() => finishEditing({ commit: true })}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									finishEditing({ commit: true });
								}
								if (event.key === "Escape") {
									finishEditing({ commit: false });
								}
							}}
						/>
						<Text size="2">{suffix}</Text>
					</Flex>
				) : (
					<Button
						variant="ghost"
						style={{
							height: "auto",
							padding: "6px 10px",
							fontWeight: "normal",
							color: "var(--accent-11)",
							maxWidth: "100%",
						}}
						onClick={handleNameClick}
					>
						<Flex align="center" gap="2" style={{ maxWidth: "100%" }}>
							<Flex
								align="center"
								style={{
									maxWidth: "10rem",
									overflow: "hidden",
									whiteSpace: "nowrap",
								}}
							>
								<Text
									weight="bold"
									size="2"
									style={{
										overflow: "hidden",
										textOverflow: "ellipsis",
									}}
								>
									{getBaseName(filename)}
								</Text>
								<Text size="2">{suffix}</Text>
							</Flex>
						</Flex>
					</Button>
				)}
			</Box>

			{syncProgress.hasLyrics && (
				<Tooltip
					content={t(
						"header.syncProgressTooltip",
						"Lines Synced: {{timedLines}}/{{totalLines}} ({{linePercent}}%) • Words Synced: {{timedWords}}/{{totalWords}} ({{wordPercent}}%)",
						{
							timedLines: syncProgress.timedLines,
							totalLines: syncProgress.totalLines,
							linePercent: syncProgress.linePercent,
							timedWords: syncProgress.timedWords,
							totalWords: syncProgress.totalWords,
							wordPercent: syncProgress.wordPercent,
						},
					)}
				>
					<Badge
						size="1"
						variant="surface"
						color={
							syncProgress.linePercent === 100
								? "green"
								: syncProgress.linePercent > 0
									? "indigo"
									: "gray"
						}
						style={{
							cursor: "default",
							fontWeight: 600,
							display: "flex",
							alignItems: "center",
							gap: "3px",
							padding: "2px 7px",
							borderRadius: "12px",
						}}
					>
						{syncProgress.linePercent === 100 ? (
							<CheckmarkCircle24Filled
								style={{ width: "12px", height: "12px", color: "var(--green-9)" }}
							/>
						) : (
							<svg
								width="12"
								height="12"
								viewBox="0 0 16 16"
								style={{ transform: "rotate(-90deg)", flexShrink: 0 }}
							>
								<circle
									cx="8"
									cy="8"
									r="6"
									stroke="var(--gray-a6)"
									strokeWidth="2.4"
									fill="none"
								/>
								<circle
									cx="8"
									cy="8"
									r="6"
									stroke="currentColor"
									strokeWidth="2.4"
									fill="none"
									strokeDasharray={2 * Math.PI * 6}
									strokeDashoffset={
										2 * Math.PI * 6 * (1 - syncProgress.linePercent / 100)
									}
									strokeLinecap="round"
									style={{ transition: "stroke-dashoffset 0.3s ease" }}
								/>
							</svg>
						)}
						<span>{syncProgress.linePercent}%</span>
					</Badge>
				</Tooltip>
			)}
		</Flex>
	);
};
