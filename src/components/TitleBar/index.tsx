import {
	Button,
	Flex,
	IconButton,
	SegmentedControl,
	Text,
	Tooltip,
} from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { type FC, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import WindowControls from "$/components/WindowControls";
import {
	boykisserModeAtom,
	boykisserUnlockedAtom,
	experimentalFeaturesDialogOpenAtom,
} from "$/modules/settings/states";
import {
	Beaker24Regular,
	Edit24Regular,
	Timer24Regular,
	Play24Regular,
	PanelRight24Regular,
	PanelRight24Filled,
} from "@fluentui/react-icons";
import {
	keySwitchEditModeAtom,
	keySwitchPreviewModeAtom,
	keySwitchSyncModeAtom,
} from "$/states/keybindings.ts";
import {
	selectedLinesAtom,
	selectedWordsAtom,
	showPreviewPanelAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main.ts";
import { useKeyBindingAtom } from "$/utils/keybindings.ts";
import { TopMenu } from "../TopMenu/index.tsx";
import styles from "./index.module.css";

export const TitleBar: FC = () => {
	const [toolMode, setToolMode] = useAtom(toolModeAtom);
	const [showPreviewPanel, setShowPreviewPanel] = useAtom(showPreviewPanelAtom);
	const setSelectedLines = useSetImmerAtom(selectedLinesAtom);
	const setSelectedWords = useSetImmerAtom(selectedWordsAtom);
	const { t } = useTranslation();
	const [boykisserMode, setBoykisserMode] = useAtom(boykisserModeAtom);
	const [boykisserUnlocked] = useAtom(boykisserUnlockedAtom);
	const isApp = useMemo(() => {
		const isTauri =
			typeof window !== "undefined" &&
			(!!(window as any).__TAURI__ || !!import.meta.env.TAURI_ENV_PLATFORM);
		const isPwa =
			typeof window !== "undefined" &&
			(window.matchMedia("(display-mode: standalone)").matches ||
				(window.navigator as any).standalone);
		return isTauri || isPwa;
	}, []);
	const isUnlocked = !isApp || boykisserUnlocked;
	const setExperimentalDialogOpen = useSetAtom(
		experimentalFeaturesDialogOpenAtom,
	);

	const onSwitchEditMode = useCallback(() => {
		setToolMode(ToolMode.Edit);
	}, [setToolMode]);
	const onSwitchSyncMode = useCallback(() => {
		setToolMode(ToolMode.Sync);
	}, [setToolMode]);
	const onSwitchPreviewMode = useCallback(() => {
		setToolMode(ToolMode.Preview);
	}, [setToolMode]);

	useKeyBindingAtom(keySwitchEditModeAtom, onSwitchEditMode);
	useKeyBindingAtom(keySwitchSyncModeAtom, onSwitchSyncMode);
	useKeyBindingAtom(keySwitchPreviewModeAtom, onSwitchPreviewMode);

	return (
		<WindowControls
			startChildren={<TopMenu />}
			titleChildren={
				<SegmentedControl.Root
					value={toolMode}
					onValueChange={(v) => setToolMode(v as ToolMode)}
				>
					<SegmentedControl.Item value={ToolMode.Edit}>
						<Flex align="center" gap="1">
							<Edit24Regular style={{ width: "16px", height: "16px" }} />
							{t("topBar.modeBtns.edit", "编辑")}
						</Flex>
					</SegmentedControl.Item>
					<SegmentedControl.Item value={ToolMode.Sync}>
						<Flex align="center" gap="1">
							<Timer24Regular style={{ width: "16px", height: "16px" }} />
							{t("topBar.modeBtns.sync", "打轴")}
						</Flex>
					</SegmentedControl.Item>
					<SegmentedControl.Item value={ToolMode.Preview}>
						<Flex align="center" gap="1">
							<Play24Regular style={{ width: "16px", height: "16px" }} />
							{t("topBar.modeBtns.preview", "预览")}
						</Flex>
					</SegmentedControl.Item>
				</SegmentedControl.Root>
			}
			endChildren={
				<Flex align="center" gap="2" mr="2">
					{toolMode !== ToolMode.Preview && (
						<Tooltip
							content={
								showPreviewPanel
									? t("topBar.menu.hidePreviewPanel", "Hide Side Preview Panel")
									: t("topBar.menu.showPreviewPanel", "Show Side Preview Panel")
							}
						>
							<Button
								size="1"
								variant={showPreviewPanel ? "solid" : "soft"}
								color={showPreviewPanel ? "indigo" : "gray"}
								onClick={() => setShowPreviewPanel((prev) => !prev)}
								style={{ cursor: "pointer", fontWeight: 500 }}
							>
								{showPreviewPanel ? (
									<PanelRight24Filled
										style={{ width: "14px", height: "14px" }}
									/>
								) : (
									<PanelRight24Regular
										style={{ width: "14px", height: "14px" }}
									/>
								)}
								<span>{t("topBar.sidePreview", "Preview Panel")}</span>
							</Button>
						</Tooltip>
					)}

					{isUnlocked && !window.location.href.includes("spicylyrics.org") && (
						<button
							type="button"
							style={{
								display: "none",
								width: "6px",
								height: "6px",
								borderRadius: "50%",
								background: "var(--accent-9)",
								border: "none",
								cursor: "pointer",
								opacity: 0.2,
								transition: "opacity 0.2s",
								outline: "none",
								marginRight: "4px",
							}}
							onClick={() => setBoykisserMode(!boykisserMode)}
							title={t("topBar.boykisser", "boykisser")}
						/>
					)}

					<IconButton
						variant="ghost"
						color="gray"
						onClick={() => setExperimentalDialogOpen(true)}
						title={t("ribbonBar.experimentalFeatures", "Experimental Features")}
					>
						<Beaker24Regular />
					</IconButton>

					{!import.meta.env.TAURI_ENV_PLATFORM && (
						<Flex
							direction="column"
							align="end"
							justify="center"
							style={{ lineHeight: 1.2 }}
						>
							<Text
								style={{ color: "var(--accent-11)" }}
								wrap="nowrap"
								size="2"
							>
								<span className={styles.title}>
									{t("topBar.appName", "Apple Music-like Lyrics TTML Tool")}
								</span>
							</Text>
							<Text size="1" color="gray" style={{ opacity: 0.7 }}>
								Forked by Bobjoerules
							</Text>
						</Flex>
					)}
				</Flex>
			}
			onSpacerClicked={() => {
				setSelectedLines((o) => o.clear());
				setSelectedWords((o) => o.clear());
			}}
		/>
	);
};
