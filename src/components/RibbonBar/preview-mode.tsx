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
	Button,
	Flex,
	Grid,
	Switch,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { type FC, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import {
	Eye24Regular,
	TextT24Regular,
	FastForward24Regular,
	Settings24Regular,
	Sparkle16Regular,
	Image16Regular,
	People16Regular,
	FullScreenMaximize20Regular,
	FullScreenMinimize20Regular,
	LocalLanguage16Regular,
	Translate16Regular,
	Warning16Regular,
	TopSpeed16Regular,
} from "@fluentui/react-icons";
import {
	bgFollowsDuetAtom,
	hideObsceneWordsAtom,
	previewFullscreenAtom,
	previewShowAlbumArtworkAtom,
	showFpsCounterAtom,
	showRomanLinesAtom,
	showTranslationLinesAtom,
	spicySimpleLyricsModeAtom,
} from "$/modules/settings/states/preview";
import { RibbonFrame, RibbonSection } from "./common";
import { advancedRibbonControlsAtom } from "$/modules/onboarding/states";

export const PreviewModeRibbonBar: FC<{ isSidebar?: boolean }> = forwardRef<
	HTMLDivElement,
	{ isSidebar?: boolean }
>(({ isSidebar }, ref) => {
	const [showTranslationLine, setShowTranslationLine] = useAtom(
		showTranslationLinesAtom,
	);
	const [showRomanLine, setShowRomanLine] = useAtom(showRomanLinesAtom);
	const [hideObsceneWords, setHideObsceneWords] = useAtom(hideObsceneWordsAtom);
	const [showFps, setShowFps] = useAtom(showFpsCounterAtom);
	const [spicySimpleMode, setSpicySimpleMode] = useAtom(
		spicySimpleLyricsModeAtom,
	);
	const [bgFollowsDuet, setBgFollowsDuet] = useAtom(bgFollowsDuetAtom);
	const [showArtwork, setShowArtwork] = useAtom(previewShowAlbumArtworkAtom);
	const [isFullscreen, setIsFullscreen] = useAtom(previewFullscreenAtom);
	const [showAdvanced, setShowAdvanced] = useAtom(advancedRibbonControlsAtom);
	const { t } = useTranslation();

	return (
		<RibbonFrame ref={ref} isSidebar={isSidebar} reserveControlRows={2}>
			{/* View / Display Section */}
			<RibbonSection
				isSidebar={isSidebar}
				label={
					<Flex gap="1" align="center">
						<Eye24Regular />
						{t("ribbonBar.previewMode.view", "View")}
					</Flex>
				}
			>
				<Grid
					columns={isSidebar ? "1" : "2"}
					gap="1"
					gapX="2"
					align="center"
					style={{ width: isSidebar ? "100%" : undefined }}
				>
					<Button
						size="1"
						variant={spicySimpleMode ? "solid" : "surface"}
						color={spicySimpleMode ? undefined : "gray"}
						onClick={() => setSpicySimpleMode((v) => !v)}
						style={{
							cursor: "pointer",
							justifyContent: "flex-start",
							gap: "6px",
							paddingLeft: "8px",
							paddingRight: "10px",
							height: "26px",
							fontSize: "12px",
							fontWeight: spicySimpleMode ? 600 : 500,
						}}
					>
						<Sparkle16Regular />
						<span>{t("ribbonBar.previewMode.simpleLyrics", "Simple Lyrics")}</span>
					</Button>

					<Button
						size="1"
						variant={showArtwork ? "solid" : "surface"}
						color={showArtwork ? undefined : "gray"}
						onClick={() => setShowArtwork((v) => !v)}
						style={{
							cursor: "pointer",
							justifyContent: "flex-start",
							gap: "6px",
							paddingLeft: "8px",
							paddingRight: "10px",
							height: "26px",
							fontSize: "12px",
							fontWeight: showArtwork ? 600 : 500,
						}}
					>
						<Image16Regular />
						<span>{t("ribbonBar.previewMode.showArtwork", "Album Artwork")}</span>
					</Button>

					<Button
						size="1"
						variant={bgFollowsDuet ? "solid" : "surface"}
						color={bgFollowsDuet ? undefined : "gray"}
						onClick={() => setBgFollowsDuet((v) => !v)}
						style={{
							cursor: "pointer",
							justifyContent: "flex-start",
							gap: "6px",
							paddingLeft: "8px",
							paddingRight: "10px",
							height: "26px",
							fontSize: "12px",
							fontWeight: bgFollowsDuet ? 600 : 500,
						}}
					>
						<People16Regular />
						<span>{t("ribbonBar.previewMode.bgFollowsDuet", "Duet Layout")}</span>
					</Button>

					{!isSidebar && (
						<Button
							size="1"
							variant={isFullscreen ? "solid" : "surface"}
							color={isFullscreen ? undefined : "gray"}
							onClick={() => setIsFullscreen((v) => !v)}
							style={{
								cursor: "pointer",
								justifyContent: "flex-start",
								gap: "6px",
								paddingLeft: "8px",
								paddingRight: "10px",
								height: "26px",
								fontSize: "12px",
								fontWeight: isFullscreen ? 600 : 500,
							}}
						>
							{isFullscreen ? (
								<FullScreenMinimize20Regular style={{ width: "16px", height: "16px" }} />
							) : (
								<FullScreenMaximize20Regular style={{ width: "16px", height: "16px" }} />
							)}
							<span>{t("ribbonBar.previewMode.fullscreen", "Fullscreen")}</span>
						</Button>
					)}
				</Grid>
			</RibbonSection>

			{/* Lyrics / Subtitles Section */}
			<RibbonSection
				isSidebar={isSidebar}
				label={
					<Flex gap="1" align="center">
						<TextT24Regular />
						{t("ribbonBar.previewMode.lyrics", "Lyrics")}
					</Flex>
				}
			>
				<Grid
					columns={isSidebar ? "1" : "2"}
					gap="1"
					gapX="2"
					align="center"
					style={{ width: isSidebar ? "100%" : undefined }}
				>
					<Button
						size="1"
						variant={showTranslationLine ? "solid" : "surface"}
						color={showTranslationLine ? undefined : "gray"}
						onClick={() => setShowTranslationLine((v) => !v)}
						style={{
							cursor: "pointer",
							justifyContent: "flex-start",
							gap: "6px",
							paddingLeft: "8px",
							paddingRight: "10px",
							height: "26px",
							fontSize: "12px",
							fontWeight: showTranslationLine ? 600 : 500,
						}}
					>
						<LocalLanguage16Regular />
						<span>{t("ribbonBar.previewMode.showTranslation", "Translation")}</span>
					</Button>

					<Button
						size="1"
						variant={showRomanLine ? "solid" : "surface"}
						color={showRomanLine ? undefined : "gray"}
						onClick={() => setShowRomanLine((v) => !v)}
						style={{
							cursor: "pointer",
							justifyContent: "flex-start",
							gap: "6px",
							paddingLeft: "8px",
							paddingRight: "10px",
							height: "26px",
							fontSize: "12px",
							fontWeight: showRomanLine ? 600 : 500,
						}}
					>
						<Translate16Regular />
						<span>{t("ribbonBar.previewMode.showRoman", "Romanization")}</span>
					</Button>

					<Button
						size="1"
						variant={hideObsceneWords ? "solid" : "surface"}
						color={hideObsceneWords ? undefined : "gray"}
						onClick={() => setHideObsceneWords((v) => !v)}
						style={{
							cursor: "pointer",
							justifyContent: "flex-start",
							gap: "6px",
							paddingLeft: "8px",
							paddingRight: "10px",
							height: "26px",
							fontSize: "12px",
							fontWeight: hideObsceneWords ? 600 : 500,
						}}
					>
						<Warning16Regular />
						<span>{t("ribbonBar.previewMode.maskObsceneWords", "Mask Obscene")}</span>
					</Button>
				</Grid>
			</RibbonSection>

			{/* Advanced Render Section */}
			{showAdvanced && (
				<RibbonSection
					isSidebar={isSidebar}
					label={
						<Flex gap="1" align="center">
							<FastForward24Regular />
							{t("ribbonBar.previewMode.render", "Render")}
						</Flex>
					}
				>
					<Button
						size="1"
						variant={showFps ? "solid" : "surface"}
						color={showFps ? undefined : "gray"}
						onClick={() => setShowFps((v) => !v)}
						style={{
							cursor: "pointer",
							justifyContent: "flex-start",
							gap: "6px",
							paddingLeft: "8px",
							paddingRight: "10px",
							height: "26px",
							fontSize: "12px",
							fontWeight: showFps ? 600 : 500,
						}}
					>
						<TopSpeed16Regular />
						<span>{t("ribbonBar.previewMode.showFps", "Show FPS")}</span>
					</Button>
				</RibbonSection>
			)}

			{/* Advanced Switch */}
			<RibbonSection
				label={
					<Flex gap="1" align="center">
						<Settings24Regular />
						{t("ribbonBar.advanced", "Advanced")}
					</Flex>
				}
				isSidebar={isSidebar}
			>
				<Switch checked={showAdvanced} onCheckedChange={setShowAdvanced} />
			</RibbonSection>
		</RibbonFrame>
	);
});

export default PreviewModeRibbonBar;
