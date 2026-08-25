import {
	ContentView24Regular,
	History24Regular,
	PaddingLeft24Regular,
	Save24Regular,
	Speaker224Regular,
	Stack24Regular,
	Timer24Regular,
	VideoBackgroundEffect24Regular,
	Sparkle24Regular,
	TimeAndWeather24Regular,
	TextT24Regular,
	Color24Regular,
	Eye24Regular,
	Checkmark16Regular,
	Checkmark24Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Flex,
	Grid,
	Heading,
	IconButton,
	Popover,
	SegmentedControl,
	Slider,
	Switch,
	Text,
	TextField,
	Tooltip,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Reorder } from "framer-motion";
import { backgroundGradients } from "$/modules/settings/states/gradients";
import {
	accentColorAtom,
	appFontAtom,
	backgroundModeAtom,
	customAccentColorAtom,
	customGradientAngleAtom,
	customGradientCenterAtom,
	customGradientColorsAtom,
	customGradientOpacityAtom,
	customGradientSizeAtom,
	customGradientTypeAtom,
	selectedGradientAtom,
	useCustomAccentAtom,
	useCustomGradientAtom,
	glassmorphismBlurAtom,
	AppearanceEditorMode,
	appearanceEditorModeAtom,
	advancedWaveformColorAtom,
	advancedWaveformProgressColorAtom,
	advancedPrimaryTextColorAtom,
	advancedSecondaryTextColorAtom,
	advTitlebarBgAtom,
	advSidebarBgAtom,
	advSidebarActiveAtom,
	advMenuHoverBgAtom,
	advEditorBgAtom,
	advActiveLineBgAtom,
	advLineHoverBgAtom,
	advChipBorderRadiusAtom,
	advChipGapAtom,
	advChipPaddingVerticalAtom,
	advChipPaddingHorizontalAtom,
	legacySpaceLabelsAtom,
	advRomanizationColorAtom,
	advTranslationColorAtom,
	advGeniusHeaderColorAtom,
	advAudioBarBgAtom,
	advAudioBarTextAtom,
	advScrollbarColorAtom,
	advDialogBgAtom,
	advDialogBorderAtom,
	advGlobalBorderRadiusAtom,
	advGlobalBorderWidthAtom,
	advShadowIntensityAtom,
	advSelectionColorAtom,
	advBackdropBlurAtom,
	appearancePresetsAtom,
	type AppearancePreset,
	appLayoutOrderAtom,
	vRibbonPositionAtom,
	legacyDarkThemeAtom,
	highlightActiveWordAtom,
	enableSyncGlowAnimationAtom,
	highlightErrorsAtom,
} from "$/modules/settings/states/index.ts";
import { instantHighlightFadeAtom } from "$/modules/settings/states/preview.ts";
import { fontSelectionDialogAtom } from "$/states/dialogs.ts";
import { isDarkThemeAtom, darkModeAtom, DarkMode } from "$/states/main.ts";
import { generateGradient, generateRadixScale } from "$/utils/colorScale";
import {
	SettingsCustomBackgroundCard,
	SettingsCustomBackgroundSettings,
} from "./customBackground";

const BUILTIN_PRESETS: AppearancePreset[] = [
	{
		id: "builtin-apple-dark",
		name: "Apple Dark",
		settings: {
			accentColor: "red",
			useCustomAccent: false,
			backgroundMode: "none",
			selectedGradient: "sunset",
			useCustomGradient: false,
			legacyDarkTheme: true,
			glassBlur: 20,
			vTitlebarBg: "#1f1f1f",
			vSidebarBg: "#1c1c1e",
			vEditorBg: "#121212",
			darkMode: DarkMode.Dark,
			advPrimaryText: "#ffffff",
			advSecondaryText: "rgba(255, 255, 255, 0.6)",
		},
	},
	{
		id: "builtin-apple-light",
		name: "Apple Light",
		settings: {
			accentColor: "red",
			useCustomAccent: false,
			backgroundMode: "gradient",
			selectedGradient: "sunset",
			useCustomGradient: false,
			legacyDarkTheme: false,
			glassBlur: 16,
			vTitlebarBg: "#f5f5f7",
			vSidebarBg: "#ffffff",
			vEditorBg: "#fafafa",
			darkMode: DarkMode.Light,
			advPrimaryText: "#000000",
			advSecondaryText: "rgba(0, 0, 0, 0.6)",
		},
	},
	{
		id: "builtin-sunset-dark",
		name: "Sunset Vibes",
		settings: {
			accentColor: "ruby",
			useCustomAccent: false,
			backgroundMode: "gradient",
			selectedGradient: "sunset",
			useCustomGradient: false,
			legacyDarkTheme: true,
			glassBlur: 20,
			vTitlebarBg: "#150a14",
			vSidebarBg: "#200f1e",
			vEditorBg: "#120812",
			darkMode: DarkMode.Dark,
			advPrimaryText: "#ffe4e6",
			advSecondaryText: "#fda4af",
		},
	},
	{
		id: "builtin-nord",
		name: "Nord Frost",
		settings: {
			accentColor: "cyan",
			useCustomAccent: false,
			backgroundMode: "gradient",
			selectedGradient: "frost",
			useCustomGradient: false,
			legacyDarkTheme: true,
			glassBlur: 16,
			vTitlebarBg: "#242933",
			vSidebarBg: "#2e3440",
			vEditorBg: "#1f232a",
			darkMode: DarkMode.Dark,
			advPrimaryText: "#eceff4",
			advSecondaryText: "#d8dee9",
		},
	},
	{
		id: "builtin-mystic",
		name: "Mystic Purple",
		settings: {
			accentColor: "purple",
			useCustomAccent: false,
			backgroundMode: "gradient",
			selectedGradient: "mystic",
			useCustomGradient: false,
			legacyDarkTheme: true,
			glassBlur: 18,
			vTitlebarBg: "#160d24",
			vSidebarBg: "#211438",
			vEditorBg: "#120a1e",
			darkMode: DarkMode.Dark,
			advPrimaryText: "#f3e8ff",
			advSecondaryText: "#d8b4fe",
		},
	},
	{
		id: "builtin-aurora",
		name: "Emerald Aurora",
		settings: {
			accentColor: "jade",
			useCustomAccent: false,
			backgroundMode: "gradient",
			selectedGradient: "aurora",
			useCustomGradient: false,
			legacyDarkTheme: true,
			glassBlur: 16,
			vTitlebarBg: "#051f18",
			vSidebarBg: "#0c2e24",
			vEditorBg: "#061a14",
			darkMode: DarkMode.Dark,
			advPrimaryText: "#f0fdf4",
			advSecondaryText: "#86efac",
		},
	},
	{
		id: "builtin-cyberpunk",
		name: "Cyberpunk Neon",
		settings: {
			accentColor: "pink",
			useCustomAccent: false,
			backgroundMode: "gradient",
			selectedGradient: "fire",
			useCustomGradient: false,
			legacyDarkTheme: true,
			glassBlur: 20,
			vTitlebarBg: "#18081a",
			vSidebarBg: "#240b27",
			vEditorBg: "#110413",
			darkMode: DarkMode.Dark,
			advPrimaryText: "#fdf2f8",
			advSecondaryText: "#f472b6",
		},
	},
	{
		id: "builtin-obsidian",
		name: "Obsidian Gold",
		settings: {
			accentColor: "amber",
			useCustomAccent: false,
			backgroundMode: "none",
			selectedGradient: "midnight",
			useCustomGradient: false,
			legacyDarkTheme: true,
			glassBlur: 20,
			vTitlebarBg: "#0a0907",
			vSidebarBg: "#14120e",
			vEditorBg: "#060504",
			darkMode: DarkMode.Dark,
			advPrimaryText: "#fef3c7",
			advSecondaryText: "#fcd34d",
		},
	},
	{
		id: "builtin-catppuccin",
		name: "Catppuccin Mocha",
		settings: {
			accentColor: "violet",
			useCustomAccent: false,
			backgroundMode: "gradient",
			selectedGradient: "mystic",
			useCustomGradient: false,
			legacyDarkTheme: true,
			glassBlur: 16,
			vTitlebarBg: "#181825",
			vSidebarBg: "#1e1e2e",
			vEditorBg: "#11111b",
			darkMode: DarkMode.Dark,
			advPrimaryText: "#cdd6f4",
			advSecondaryText: "#bac2de",
		},
	},
];

const SURFACE_TINTS = [
	{ id: "pure-black", name: "Pure Dark", titlebar: "#0d0d0d", sidebar: "#141414", editor: "#080808", dot: "#0d0d0d" },
	{ id: "charcoal", name: "Charcoal Slate", titlebar: "#16181d", sidebar: "#1e2127", editor: "#121316", dot: "#1e2127" },
	{ id: "deep-navy", name: "Midnight Navy", titlebar: "#0b1329", sidebar: "#101d3f", editor: "#070c1b", dot: "#101d3f" },
	{ id: "emerald", name: "Pine Emerald", titlebar: "#051f18", sidebar: "#0c2e24", editor: "#061a14", dot: "#0c2e24" },
	{ id: "amethyst", name: "Deep Amethyst", titlebar: "#160d24", sidebar: "#211438", editor: "#120a1e", dot: "#211438" },
	{ id: "espresso", name: "Warm Espresso", titlebar: "#14100c", sidebar: "#1f1812", editor: "#0c0a08", dot: "#1f1812" },
];

const accentColors = [
	"gray",
	"gold",
	"bronze",
	"brown",
	"yellow",
	"amber",
	"orange",
	"tomato",
	"red",
	"ruby",
	"crimson",
	"pink",
	"plum",
	"purple",
	"violet",
	"iris",
	"indigo",
	"blue",
	"cyan",
	"teal",
	"jade",
	"green",
	"grass",
	"lime",
	"mint",
	"sky",
] as const;

export const SettingsAppearanceTab = () => {
	const [accentColor, setAccentColor] = useAtom(accentColorAtom);
	const [useCustomAccent, setUseCustomAccent] = useAtom(useCustomAccentAtom);
	const [customAccentColor, setCustomAccentColor] = useAtom(
		customAccentColorAtom,
	);
	const isDarkTheme = useAtomValue(isDarkThemeAtom);
	const customScale = useMemo(
		() => generateRadixScale(customAccentColor, isDarkTheme),
		[customAccentColor, isDarkTheme],
	);

	const [backgroundMode, setBackgroundMode] = useAtom(backgroundModeAtom);
	const [selectedGradient, setSelectedGradient] = useAtom(selectedGradientAtom);
	const [useCustomGradient, setUseCustomGradient] = useAtom(
		useCustomGradientAtom,
	);
	const [customGradientColors, setCustomGradientColors] = useAtom(
		customGradientColorsAtom,
	);
	const [customGradientType, setCustomGradientType] = useAtom(
		customGradientTypeAtom,
	);
	const [customGradientOpacity, setCustomGradientOpacity] = useAtom(
		customGradientOpacityAtom,
	);
	const [customGradientCenter, setCustomGradientCenter] = useAtom(
		customGradientCenterAtom,
	);
	const [customGradientAngle, setCustomGradientAngle] = useAtom(
		customGradientAngleAtom,
	);
	const [customGradientSize, setCustomGradientSize] = useAtom(
		customGradientSizeAtom,
	);
	const [editorMode, setEditorMode] = useAtom(appearanceEditorModeAtom);
	const [legacyDarkTheme, setLegacyDarkTheme] = useAtom(legacyDarkThemeAtom);
	const [advWaveformColor, setAdvWaveformColor] = useAtom(
		advancedWaveformColorAtom,
	);
	const [advWaveformProgress, setAdvWaveformProgress] = useAtom(
		advancedWaveformProgressColorAtom,
	);
	const [advPrimaryText, setAdvPrimaryText] = useAtom(
		advancedPrimaryTextColorAtom,
	);
	const [advSecondaryText, setAdvSecondaryText] = useAtom(
		advancedSecondaryTextColorAtom,
	);

	const [vTitlebarBg, setVTitlebarBg] = useAtom(advTitlebarBgAtom);
	const [vSidebarBg, setVSidebarBg] = useAtom(advSidebarBgAtom);
	const [vSidebarActive, setVSidebarActive] = useAtom(advSidebarActiveAtom);
	const [vMenuHover, setVMenuHover] = useAtom(advMenuHoverBgAtom);
	const [vEditorBg, setVEditorBg] = useAtom(advEditorBgAtom);
	const [vActiveLine, setVActiveLine] = useAtom(advActiveLineBgAtom);
	const [vLineHover, setVLineHover] = useAtom(advLineHoverBgAtom);
	const [vChipRadius, setVChipRadius] = useAtom(advChipBorderRadiusAtom);
	const [vChipGap, setVChipGap] = useAtom(advChipGapAtom);
	const [vChipPaddingV, setVChipPaddingV] = useAtom(advChipPaddingVerticalAtom);
	const [vChipPaddingH, setVChipPaddingH] = useAtom(
		advChipPaddingHorizontalAtom,
	);
	const [legacySpaceLabels, setLegacySpaceLabels] = useAtom(
		legacySpaceLabelsAtom,
	);
	const [vRomanColor, setVRomanColor] = useAtom(advRomanizationColorAtom);
	const [vTransColor, setVTransColor] = useAtom(advTranslationColorAtom);
	const [vGeniusHeaderColor, setVGeniusHeaderColor] = useAtom(
		advGeniusHeaderColorAtom,
	);
	const [vAudioBarBg, setVAudioBarBg] = useAtom(advAudioBarBgAtom);
	const [vAudioBarText, setVAudioBarText] = useAtom(advAudioBarTextAtom);
	const [vScrollbar, setVScrollbar] = useAtom(advScrollbarColorAtom);
	const [vDialogBg, setVDialogBg] = useAtom(advDialogBgAtom);
	const [vDialogBorder, setVDialogBorder] = useAtom(advDialogBorderAtom);
	const [vGlobalRadius, setVGlobalRadius] = useAtom(advGlobalBorderRadiusAtom);
	const [vGlobalBorderWidth, setVGlobalBorderWidth] = useAtom(
		advGlobalBorderWidthAtom,
	);
	const [vShadow, setVShadow] = useAtom(advShadowIntensityAtom);
	const [vSelection, setVSelection] = useAtom(advSelectionColorAtom);
	const [vBackdrop, setVBackdrop] = useAtom(advBackdropBlurAtom);
	const [presets, setPresets] = useAtom(appearancePresetsAtom);
	const [layoutOrder, setLayoutOrder] = useAtom(appLayoutOrderAtom);
	const [vRibbonPos, setVRibbonPos] = useAtom(vRibbonPositionAtom);
	const [darkMode, setDarkMode] = useAtom(darkModeAtom);
	const [highlightActiveWord, setHighlightActiveWord] = useAtom(
		highlightActiveWordAtom,
	);
	const [enableSyncGlowAnimation, setEnableSyncGlowAnimation] = useAtom(
		enableSyncGlowAnimationAtom,
	);
	const [highlightErrors, setHighlightErrors] = useAtom(highlightErrorsAtom);
	const [instantHighlightFade, setInstantHighlightFade] = useAtom(
		instantHighlightFadeAtom,
	);
	const [newPresetName, setNewPresetName] = useState("");

	const appFont = useAtomValue(appFontAtom);
	const [glassBlur, setGlassBlur] = useAtom(glassmorphismBlurAtom);

	const [lastLoaded, setLastLoaded] = useState<string | null>(null);

	const handleSavePreset = () => {
		if (!newPresetName.trim()) return;
		const newPreset: AppearancePreset = {
			id: Date.now().toString(),
			name: newPresetName,
			settings: {
				// Basic & General
				accentColor,
				useCustomAccent,
				customAccentColor,
				glassBlur,
				// Backgrounds
				backgroundMode,
				selectedGradient,
				useCustomGradient,
				customGradientColors,
				customGradientType,
				customGradientOpacity,
				customGradientCenter,
				customGradientAngle,
				customGradientSize,
				// Advanced
				advWaveformColor,
				advWaveformProgress,
				advPrimaryText,
				advSecondaryText,
				vTitlebarBg,
				vSidebarBg,
				vSidebarActive,
				vMenuHover,
				vEditorBg,
				vActiveLine,
				vLineHover,
				vSelection,
				vChipRadius,
				vChipGap,
				vChipPaddingV,
				vChipPaddingH,
				vRomanColor,
				vTransColor,
				vGeniusHeaderColor,
				vAudioBarBg,
				vAudioBarText,
				vScrollbar,
				vDialogBg,
				vDialogBorder,
				vGlobalRadius,
				vGlobalBorderWidth,
				vShadow,
				vBackdrop,
				layoutOrder,
				vRibbonPos,
				legacyDarkTheme,
				darkMode,
			},
		};
		setPresets([...presets, newPreset]);
		setNewPresetName("");
	};

	const handleLoadPreset = (p: AppearancePreset) => {
		const s = p.settings;

		// Set a small loading indicator state
		setLastLoaded(p.name);

		// Basic & General
		if (s.accentColor !== undefined) setAccentColor(s.accentColor);
		if (s.useCustomAccent !== undefined)
			setUseCustomAccent(!!s.useCustomAccent);
		if (s.customAccentColor !== undefined)
			setCustomAccentColor(s.customAccentColor);
		if (s.glassBlur !== undefined) setGlassBlur(Number(s.glassBlur));

		// Backgrounds
		if (s.backgroundMode !== undefined) setBackgroundMode(s.backgroundMode);
		if (s.selectedGradient !== undefined)
			setSelectedGradient(s.selectedGradient);
		if (s.useCustomGradient !== undefined)
			setUseCustomGradient(!!s.useCustomGradient);
		if (s.customGradientColors !== undefined)
			setCustomGradientColors(s.customGradientColors);
		if (s.customGradientType !== undefined)
			setCustomGradientType(s.customGradientType);
		if (s.customGradientOpacity !== undefined)
			setCustomGradientOpacity(Number(s.customGradientOpacity));
		if (s.customGradientCenter !== undefined)
			setCustomGradientCenter(s.customGradientCenter);
		if (s.customGradientAngle !== undefined)
			setCustomGradientAngle(Number(s.customGradientAngle));
		if (s.customGradientSize !== undefined)
			setCustomGradientSize(Number(s.customGradientSize));
		if (s.legacyDarkTheme !== undefined)
			setLegacyDarkTheme(!!s.legacyDarkTheme);
		if (s.darkMode !== undefined) setDarkMode(s.darkMode);

		// Advanced
		if (s.advWaveformColor !== undefined)
			setAdvWaveformColor(s.advWaveformColor);
		if (s.advWaveformProgress !== undefined)
			setAdvWaveformProgress(s.advWaveformProgress);
		if (s.advPrimaryText !== undefined) setAdvPrimaryText(s.advPrimaryText);
		if (s.advSecondaryText !== undefined)
			setAdvSecondaryText(s.advSecondaryText);
		if (s.vTitlebarBg !== undefined) setVTitlebarBg(s.vTitlebarBg);
		if (s.vSidebarBg !== undefined) setVSidebarBg(s.vSidebarBg);
		if (s.vSidebarActive !== undefined) setVSidebarActive(s.vSidebarActive);
		if (s.vMenuHover !== undefined) setVMenuHover(s.vMenuHover);
		if (s.vEditorBg !== undefined) setVEditorBg(s.vEditorBg);
		if (s.vActiveLine !== undefined) setVActiveLine(s.vActiveLine);
		if (s.vLineHover !== undefined) setVLineHover(s.vLineHover);
		if (s.vSelection !== undefined) setVSelection(s.vSelection);
		if (s.vChipRadius !== undefined) setVChipRadius(Number(s.vChipRadius));
		if (s.vChipGap !== undefined) setVChipGap(Number(s.vChipGap));
		if (s.vChipPaddingV !== undefined)
			setVChipPaddingV(Number(s.vChipPaddingV));
		if (s.vChipPaddingH !== undefined)
			setVChipPaddingH(Number(s.vChipPaddingH));
		if (s.vRomanColor !== undefined) setVRomanColor(s.vRomanColor);
		if (s.vTransColor !== undefined) setVTransColor(s.vTransColor);
		if (s.vGeniusHeaderColor !== undefined)
			setVGeniusHeaderColor(s.vGeniusHeaderColor);
		if (s.vAudioBarBg !== undefined) setVAudioBarBg(s.vAudioBarBg);
		if (s.vAudioBarText !== undefined) setVAudioBarText(s.vAudioBarText);
		if (s.vScrollbar !== undefined) setVScrollbar(s.vScrollbar);
		if (s.vDialogBg !== undefined) setVDialogBg(s.vDialogBg);
		if (s.vDialogBorder !== undefined) setVDialogBorder(s.vDialogBorder);
		if (s.vGlobalRadius !== undefined)
			setVGlobalRadius(Number(s.vGlobalRadius));
		if (s.vGlobalBorderWidth !== undefined)
			setVGlobalBorderWidth(Number(s.vGlobalBorderWidth));
		if (s.vShadow !== undefined) setVShadow(Number(s.vShadow));
		if (s.vBackdrop !== undefined) setVBackdrop(Number(s.vBackdrop));
		if (s.layoutOrder !== undefined) setLayoutOrder(s.layoutOrder);
		if (s.vRibbonPos !== undefined) setVRibbonPos(s.vRibbonPos);

		// Small timeout to clear the flash of "active" state if desired,
		// but keeping it visible helps user know it worked.
	};
	const setIsFontSelectionOpen = useSetAtom(fontSelectionDialogAtom);

	const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);
	const { t } = useTranslation();

	if (showBackgroundSettings) {
		return (
			<SettingsCustomBackgroundSettings
				onClose={() => setShowBackgroundSettings(false)}
			/>
		);
	}

	return (
		<Flex direction="column" gap="4">
			<Flex direction="column" gap="2">
				<SegmentedControl.Root
					value={editorMode}
					onValueChange={(v) => setEditorMode(v as AppearanceEditorMode)}
				>
					<SegmentedControl.Item value={AppearanceEditorMode.Basic}>
						{t("settings.appearance.mode.basic", "Basic Editor")}
					</SegmentedControl.Item>
					<SegmentedControl.Item value={AppearanceEditorMode.Advanced}>
						{t("settings.appearance.mode.advanced", "Advanced Editor")}
					</SegmentedControl.Item>
				</SegmentedControl.Root>
			</Flex>

			<Flex direction="column" gap="3">
				<Heading size="4">
					<Save24Regular />{" "}
					{t("settings.appearance.presets.title", "Appearance Presets")}
				</Heading>
				<Card>
					<Flex direction="column" gap="3">
						<Text
							size="1"
							weight="bold"
							color="gray"
							style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}
						>
							{t("settings.appearance.presets.builtin", "Built-in Themes")}
						</Text>
						<Grid columns="3" gap="2">
							{BUILTIN_PRESETS.map((p) => {
								const isActive = lastLoaded === p.name;
								const s = p.settings;
								return (
									<Card
										key={p.id}
										size="1"
										style={{
											cursor: "pointer",
											border: isActive
												? "2px solid var(--accent-9)"
												: "1px solid var(--gray-a4)",
											backgroundColor: isActive ? "var(--accent-2)" : "var(--gray-a2)",
											transition: "all 0.15s ease",
											padding: "8px 10px",
										}}
										onClick={() => handleLoadPreset(p)}
									>
										<Flex direction="column" gap="2">
											<Flex align="center" justify="between">
												<Text
													size="2"
													weight="bold"
													style={{
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap",
													}}
												>
													{p.name}
												</Text>
												{isActive ? (
													<Badge size="1" color="green" variant="solid">
														Active
													</Badge>
												) : (
													<Badge size="1" variant="soft" color={s.darkMode === DarkMode.Light ? "orange" : "gray"}>
														{s.darkMode === DarkMode.Light ? "Light" : "Dark"}
													</Badge>
												)}
											</Flex>
											{/* Theme Color Palette Preview */}
											<Flex align="center" gap="1">
												<Box
													style={{
														width: "14px",
														height: "14px",
														borderRadius: "50%",
														backgroundColor: s.vTitlebarBg || "#1f1f1f",
														border: "1px solid rgba(255,255,255,0.2)",
													}}
													title="Titlebar"
												/>
												<Box
													style={{
														width: "14px",
														height: "14px",
														borderRadius: "50%",
														backgroundColor: s.vEditorBg || "#121212",
														border: "1px solid rgba(255,255,255,0.2)",
													}}
													title="Editor"
												/>
												<Box
													style={{
														width: "14px",
														height: "14px",
														borderRadius: "50%",
														backgroundColor: s.advPrimaryText || "#fff",
														border: "1px solid rgba(255,255,255,0.2)",
													}}
													title="Text"
												/>
												<Box
													style={{
														width: "14px",
														height: "14px",
														borderRadius: "50%",
														backgroundColor: s.useCustomAccent ? (s.customAccentColor || "#e5484d") : (s.accentColor ? `var(--${s.accentColor}-9, #e5484d)` : "var(--accent-9)"),
														border: "1px solid rgba(255,255,255,0.2)",
														marginLeft: "auto",
													}}
													title="Accent"
												/>
											</Flex>
										</Flex>
									</Card>
								);
							})}
						</Grid>

						<div
							style={{
								borderBottom: "1px solid var(--gray-a5)",
								margin: "8px 0",
							}}
						/>

						<Text
							size="1"
							weight="bold"
							color="gray"
							style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}
						>
							{t("settings.appearance.presets.custom", "My Custom Themes")}
						</Text>
						<Flex gap="3" align="center">
							<TextField.Root
								placeholder={t(
									"settings.appearance.presets.namePlaceholder",
									"Theme Name...",
								)}
								value={newPresetName}
								onChange={(e) => setNewPresetName(e.target.value)}
								style={{ flexGrow: 1 }}
							>
								<TextField.Slot>
									<Save24Regular />
								</TextField.Slot>
							</TextField.Root>
							<Button
								onClick={handleSavePreset}
								disabled={!newPresetName.trim()}
							>
								{t("settings.appearance.presets.save", "Save Current")}
							</Button>
						</Flex>

						{presets.length > 0 ? (
							<Grid columns="2" gap="2">
								{presets.map((p) => (
									<Card
										key={p.id}
										size="1"
										style={{
											border:
												lastLoaded === p.name
													? "1px solid var(--accent-9)"
													: undefined,
											backgroundColor:
												lastLoaded === p.name ? "var(--accent-2)" : undefined,
										}}
									>
										<Flex align="center" justify="between">
											<Box flexGrow="1" overflow="hidden">
												<Text
													size="2"
													weight="bold"
													style={{
														display: "block",
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap",
													}}
												>
													{p.name}
												</Text>
												{lastLoaded === p.name && (
													<Text
														size="1"
														color="accent"
														style={{ display: "block" }}
													>
														Active
													</Text>
												)}
											</Box>
											<Flex gap="1">
												<IconButton
													size="1"
													variant="soft"
													onClick={() => handleLoadPreset(p)}
													title="Load Preset"
												>
													<Timer24Regular />
												</IconButton>
												<IconButton
													size="1"
													variant="ghost"
													color="red"
													onClick={() =>
														setPresets(presets.filter((pr) => pr.id !== p.id))
													}
													title="Delete Preset"
												>
													<History24Regular />
												</IconButton>
											</Flex>
										</Flex>
									</Card>
								))}
							</Grid>
						) : (
							<Text size="2" color="gray" align="center">
								{t(
									"settings.appearance.presets.empty",
									"No saved presets yet.",
								)}
							</Text>
						)}
					</Flex>
				</Card>
			</Flex>

			{editorMode === AppearanceEditorMode.Basic ? (
				<>
					<Flex direction="column" gap="2">
						<Heading size="4">
							{t("settings.appearance.theme", "Theme")}
						</Heading>

						<Card>
							<Flex direction="column" gap="4">
								<Flex gap="3" align="start">
									<TimeAndWeather24Regular />
									<Box flexGrow="1">
										<Flex direction="column" gap="3">
											<Flex align="center" justify="between">
												<Flex direction="column" gap="1">
													<Text>
														{t("settings.appearance.themeMode", "Theme Mode")}
													</Text>
													<Text size="1" color="gray">
														{t(
															"settings.appearance.themeModeDesc",
															"Choose light, dark, or system default appearance",
														)}
													</Text>
												</Flex>
												<SegmentedControl.Root
													value={darkMode}
													onValueChange={(v) => setDarkMode(v as DarkMode)}
												>
													<SegmentedControl.Item value={DarkMode.Auto}>
														{t("settings.appearance.theme.auto", "Auto")}
													</SegmentedControl.Item>
													<SegmentedControl.Item value={DarkMode.Light}>
														{t("settings.appearance.theme.light", "Light")}
													</SegmentedControl.Item>
													<SegmentedControl.Item value={DarkMode.Dark}>
														{t("settings.appearance.theme.dark", "Dark")}
													</SegmentedControl.Item>
												</SegmentedControl.Root>
											</Flex>
										</Flex>
									</Box>
								</Flex>

								<div
									style={{
										borderBottom: "1px solid var(--gray-a4)",
										margin: "4px 0",
									}}
								/>

								{/* Quick Workspace Surface Tint */}
								<Flex gap="3" align="start">
									<ContentView24Regular />
									<Box flexGrow="1">
										<Flex direction="column" gap="3">
											<Flex align="center" justify="between">
												<Flex direction="column" gap="1">
													<Text weight="bold">
														{t(
															"settings.appearance.surfaceTint",
															"Workspace Surface Tint",
														)}
													</Text>
													<Text size="1" color="gray">
														{t(
															"settings.appearance.surfaceTintDesc",
															"Quickly set the dark background shade of the editor, sidebar, and panels.",
														)}
													</Text>
												</Flex>
											</Flex>

											<Grid columns="3" gap="2">
												{SURFACE_TINTS.map((tint) => {
													const isCurrent = vEditorBg === tint.editor;
													return (
														<Card
															key={tint.id}
															size="1"
															style={{
																cursor: "pointer",
																border: isCurrent
																	? "2px solid var(--accent-9)"
																	: "1px solid var(--gray-a4)",
																backgroundColor: isCurrent
																	? "var(--accent-2)"
																	: "var(--gray-a2)",
																padding: "6px 8px",
																transition: "all 0.15s ease",
															}}
															onClick={() => {
																setVTitlebarBg(tint.titlebar);
																setVSidebarBg(tint.sidebar);
																setVEditorBg(tint.editor);
															}}
														>
															<Flex align="center" gap="2">
																<Box
																	style={{
																		width: "16px",
																		height: "16px",
																		borderRadius: "4px",
																		backgroundColor: tint.dot,
																		border: "1px solid rgba(255,255,255,0.2)",
																		flexShrink: 0,
																	}}
																/>
																<Text size="1" weight={isCurrent ? "bold" : "regular"} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
																	{tint.name}
																</Text>
															</Flex>
														</Card>
													);
												})}
											</Grid>
										</Flex>
									</Box>
								</Flex>

								<div
									style={{
										borderBottom: "1px solid var(--gray-a4)",
										margin: "4px 0",
									}}
								/>

								<Flex gap="3" align="start">
									<Color24Regular />
									<Box flexGrow="1">
										<Flex direction="column" gap="3">
											<Flex align="center" justify="between">
												<Flex direction="column" gap="1">
													<Text weight="bold">
														{t(
															"settings.appearance.accentAndHighlight",
															"Highlight & Accent Color",
														)}
													</Text>
													<Text size="1" color="gray">
														{t(
															"settings.appearance.accentAndHighlightDesc",
															"Controls active lyric highlights, word glows, playback markers, badges, and button accents throughout the app.",
														)}
													</Text>
												</Flex>
												<Flex align="center" gap="2">
													<Text size="1" color="gray">
														{useCustomAccent ? "Custom Hex" : "Preset Palette"}
													</Text>
													<Switch
														checked={useCustomAccent}
														onCheckedChange={setUseCustomAccent}
													/>
												</Flex>
											</Flex>

											{useCustomAccent ? (
												<Flex direction="column" gap="3">
													<Flex align="center" gap="3">
														<input
															type="color"
															value={customAccentColor}
															onChange={(e) => {
																const newColor = e.target.value;
																setCustomAccentColor(newColor);
															}}
															style={{
																width: "44px",
																height: "44px",
																padding: 0,
																border: "1px solid var(--gray-a6)",
																borderRadius: "var(--radius-3)",
																cursor: "pointer",
																backgroundColor: "transparent",
															}}
														/>
														<Flex direction="column" gap="1">
															<Text size="2" weight="bold">
																{customAccentColor.toUpperCase()}
															</Text>
															<Text size="1" color="gray">
																{t("settings.appearance.customHexHelp", "Pick any custom color for active lyric highlights and theme accents.")}
															</Text>
														</Flex>
													</Flex>
													<Grid columns="12" gap="1">
														{Array.from({ length: 12 }).map((_, i) => (
															<Box
																key={`shade-${i + 1}`}
																style={{
																	height: "22px",
																	borderRadius: "var(--radius-1)",
																	backgroundColor:
																		customScale[`--accent-${i + 1}`],
																}}
															/>
														))}
													</Grid>
												</Flex>
											) : (
												<Flex direction="column" gap="2">
													<Grid columns="7" gap="2">
														{accentColors.map((color) => {
															const isSelected = accentColor === color;
															return (
																<Tooltip key={color} content={color.charAt(0).toUpperCase() + color.slice(1)}>
																	<IconButton
																		size="2"
																		variant={isSelected ? "solid" : "soft"}
																		color={color}
																		style={{
																			borderRadius: "var(--radius-2)",
																			cursor: "pointer",
																			position: "relative",
																			transition: "transform 0.15s ease",
																			transform: isSelected ? "scale(1.08)" : undefined,
																			boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.3)" : undefined,
																		}}
																		onClick={() => setAccentColor(color)}
																	>
																		{isSelected ? (
																			<Checkmark16Regular style={{ width: 14, height: 14 }} />
																		) : (
																			<Box
																				style={{
																					width: "12px",
																					height: "12px",
																					borderRadius: "50%",
																					backgroundColor: "currentColor",
																				}}
																			/>
																		)}
																	</IconButton>
																</Tooltip>
															);
														})}
													</Grid>
												</Flex>
											)}

											{/* Interactive Live Highlight Preview Widget */}
											<Card
												variant="surface"
												style={{
													background: "var(--gray-a2)",
													border: "1px solid var(--accent-a5, var(--gray-a4))",
													borderRadius: "var(--radius-3)",
													padding: "12px 14px",
													marginTop: "4px",
												}}
											>
												<Flex direction="column" gap="2">
													<Flex justify="between" align="center">
														<Text size="1" weight="bold" color="gray" style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
															👁️ {t("settings.appearance.liveHighlightPreview", "Live Highlight & Glow Preview")}
														</Text>
														<Badge color={useCustomAccent ? undefined : accentColor} size="1" style={useCustomAccent ? { backgroundColor: customAccentColor, color: "#fff" } : undefined}>
															{useCustomAccent ? customAccentColor.toUpperCase() : accentColor}
														</Badge>
													</Flex>

													<Box
														p="2"
														style={{
															background: "var(--gray-a3)",
															borderRadius: "var(--radius-2)",
															border: "1px solid var(--accent-a4)",
														}}
													>
														<Flex align="center" gap="2" wrap="wrap">
															<Badge size="1" variant="soft" color={useCustomAccent ? undefined : accentColor}>
																00:02.336
															</Badge>
															<span
																style={{
																	fontSize: "14px",
																	fontWeight: 700,
																	color: "var(--accent-11, #fff)",
																	textShadow: enableSyncGlowAnimation
																		? `0 0 12px ${useCustomAccent ? customAccentColor : "var(--accent-9)"}`
																		: undefined,
																	background: "var(--accent-a3)",
																	padding: "2px 6px",
																	borderRadius: "4px",
																	border: "1px solid var(--accent-a5)",
																}}
															>
																2003,
															</span>
															<span style={{ fontSize: "14px", fontWeight: 600, color: "var(--gray-12)" }}>
																Arizona
															</span>
															<span style={{ fontSize: "14px", fontWeight: 600, color: "var(--gray-12)" }}>
																Iced
															</span>
															<span style={{ fontSize: "14px", fontWeight: 600, color: "var(--gray-12)" }}>
																Out
															</span>
															<span style={{ fontSize: "14px", fontWeight: 600, color: "var(--gray-12)" }}>
																Boys
															</span>
															<Badge size="1" variant="soft" color="gray">
																00:06.446
															</Badge>
														</Flex>
													</Box>

													{/* Quick Highlight Toggles */}
													<Grid columns="2" gap="2" mt="1">
														<Flex align="center" justify="between" p="2" style={{ background: "var(--gray-a2)", borderRadius: "var(--radius-2)" }}>
															<Text size="1">
																{t("ribbonBar.syncMode.highlightActiveWord", "Highlight Active Word")}
															</Text>
															<Switch
																size="1"
																checked={highlightActiveWord}
																onCheckedChange={setHighlightActiveWord}
															/>
														</Flex>
														<Flex align="center" justify="between" p="2" style={{ background: "var(--gray-a2)", borderRadius: "var(--radius-2)" }}>
															<Text size="1">
																{t("ribbonBar.syncMode.enableGlowAnimation", "Sync Glow Animation")}
															</Text>
															<Switch
																size="1"
																checked={enableSyncGlowAnimation}
																onCheckedChange={setEnableSyncGlowAnimation}
															/>
														</Flex>
														<Flex align="center" justify="between" p="2" style={{ background: "var(--gray-a2)", borderRadius: "var(--radius-2)" }}>
															<Text size="1">
																{t("ribbonBar.syncMode.highlightErrors", "Highlight Timing Errors")}
															</Text>
															<Switch
																size="1"
																checked={highlightErrors}
																onCheckedChange={setHighlightErrors}
															/>
														</Flex>
														<Flex align="center" justify="between" p="2" style={{ background: "var(--gray-a2)", borderRadius: "var(--radius-2)" }}>
															<Text size="1">
																{t("ribbonBar.previewMode.instantHighlightFade", "Instant Fadeout")}
															</Text>
															<Switch
																size="1"
																checked={instantHighlightFade}
																onCheckedChange={setInstantHighlightFade}
															/>
														</Flex>
													</Grid>
												</Flex>
											</Card>
										</Flex>
									</Box>
								</Flex>
							</Flex>
						</Card>

						<Heading size="4" mt="4">
							{t("settings.appearance.glass", "Glassmorphism")}
						</Heading>
						<Card>
							<Flex direction="column" gap="4">
								<Flex gap="3" align="start">
									<Sparkle24Regular />
									<Box flexGrow="1">
										<Flex direction="column" gap="3">
											<Flex align="center" justify="between">
												<Flex direction="column" gap="1">
													<Text>
														{t(
															"settings.appearance.glassBlur",
															"Glass Intensity",
														)}
													</Text>
													<Text size="1" color="gray">
														{t(
															"settings.appearance.glassBlurDesc",
															"Adjust the background blur effect for glassmorphic elements.",
														)}
													</Text>
												</Flex>
												<Text size="1" weight="bold" color="accent">
													{glassBlur}px
												</Text>
											</Flex>
											<Slider
												min={0}
												max={64}
												step={1}
												value={[glassBlur]}
												onValueChange={(v) => setGlassBlur(v[0])}
											/>
										</Flex>
									</Box>
								</Flex>
							</Flex>
						</Card>
					</Flex>

					<Flex direction="column" gap="3">
						<Heading size="4">
							{t("settings.appearance.background", "Background")}
						</Heading>

						<SegmentedControl.Root
							value={backgroundMode}
							onValueChange={(v) =>
								setBackgroundMode(v as "none" | "image" | "gradient")
							}
						>
							<SegmentedControl.Item value="none">
								{t("settings.appearance.mode.none", "None")}
							</SegmentedControl.Item>
							<SegmentedControl.Item value="image">
								{t("settings.appearance.mode.image", "Image")}
							</SegmentedControl.Item>
							<SegmentedControl.Item value="gradient">
								{t("settings.appearance.mode.gradient", "Gradient")}
							</SegmentedControl.Item>
						</SegmentedControl.Root>

						{backgroundMode === "image" && (
							<SettingsCustomBackgroundCard
								onOpen={() => setShowBackgroundSettings(true)}
							/>
						)}

						{backgroundMode === "gradient" && (
							<Card>
								<Flex direction="column" gap="4">
									<Flex gap="3" align="start">
										<Sparkle24Regular />
										<Box flexGrow="1">
											<Flex direction="column" gap="3">
												<Flex align="center" justify="between">
													<Flex direction="column" gap="1">
														<Text>
															{t(
																"settings.appearance.useCustomGradient",
																"Custom Gradient Color",
															)}
														</Text>
														<Text size="1" color="gray">
															{t(
																"settings.appearance.useCustomGradientDesc",
																"Generate a gradient from a single color.",
															)}
														</Text>
													</Flex>
													<Switch
														checked={useCustomGradient}
														onCheckedChange={setUseCustomGradient}
													/>
												</Flex>

												{useCustomGradient ? (
													<Flex direction="column" gap="4">
														<Flex align="center" justify="between">
															<Text>
																{t(
																	"settings.appearance.syncGradientToAccent",
																	"Sync first color with Accent",
																)}
															</Text>
															<Button
																variant="soft"
																onClick={() => {
																	const newGradientColors = [
																		...customGradientColors,
																	];
																	newGradientColors[0] = customAccentColor;
																	setCustomGradientColors(newGradientColors);
																}}
															>
																{t("common.sync", "Sync")}
															</Button>
														</Flex>
														<Flex align="center" gap="3" wrap="wrap">
															{customGradientColors.map((color, idx) => (
																// biome-ignore lint/suspicious/noArrayIndexKey: primitive array without unique IDs
																<Flex key={idx} align="center" gap="2">
																	<input
																		type="color"
																		value={color}
																		onChange={(e) => {
																			const newColor = e.target.value;
																			const newColors = [
																				...customGradientColors,
																			];
																			newColors[idx] = newColor;
																			setCustomGradientColors(newColors);
																		}}
																		style={{
																			width: "40px",
																			height: "40px",
																			padding: 0,
																			border: "none",
																			borderRadius: "var(--radius-3)",
																			cursor: "pointer",
																			backgroundColor: "transparent",
																		}}
																	/>
																	{customGradientColors.length > 1 && (
																		<Button
																			variant="soft"
																			color="red"
																			size="1"
																			onClick={() => {
																				setCustomGradientColors(
																					customGradientColors.filter(
																						(_, i) => i !== idx,
																					),
																				);
																			}}
																		>
																			{t("common.remove", "Remove")}
																		</Button>
																	)}
																</Flex>
															))}
															{customGradientColors.length < 4 && (
																<Button
																	variant="outline"
																	onClick={() => {
																		setCustomGradientColors([
																			...customGradientColors,
																			"#ffffff",
																		]);
																	}}
																>
																	{t(
																		"settings.appearance.addGradientColor",
																		"Add Color",
																	)}
																</Button>
															)}
														</Flex>
														<Flex align="center" justify="between">
															<Text>
																{t(
																	"settings.appearance.gradientType",
																	"Gradient Type",
																)}
															</Text>
															<SegmentedControl.Root
																value={customGradientType}
																onValueChange={(v) =>
																	setCustomGradientType(
																		v as "linear" | "radial" | "conic",
																	)
																}
															>
																<SegmentedControl.Item value="linear">
																	{t(
																		"settings.appearance.type.linear",
																		"Linear",
																	)}
																</SegmentedControl.Item>
																<SegmentedControl.Item value="radial">
																	{t(
																		"settings.appearance.type.radial",
																		"Radial",
																	)}
																</SegmentedControl.Item>
																<SegmentedControl.Item value="conic">
																	{t("settings.appearance.type.conic", "Conic")}
																</SegmentedControl.Item>
															</SegmentedControl.Root>
														</Flex>
														<Flex direction="column" gap="2">
															<Flex align="center" justify="between">
																<Text>
																	{t(
																		"settings.appearance.gradientOpacity",
																		"Gradient Opacity",
																	)}
																</Text>
																<Text wrap="nowrap" color="gray" size="1">
																	{Math.round(customGradientOpacity * 100)}%
																</Text>
															</Flex>
															<Slider
																min={0}
																max={1}
																step={0.01}
																value={[customGradientOpacity]}
																onValueChange={(v) =>
																	setCustomGradientOpacity(v[0])
																}
															/>
														</Flex>
														<Flex direction="column" gap="2">
															<Flex align="center" justify="between">
																<Text>
																	{t(
																		"settings.appearance.gradientSize",
																		"Gradient Scale",
																	)}
																</Text>
																<Text wrap="nowrap" color="gray" size="1">
																	{Math.round(customGradientSize * 100)}%
																</Text>
															</Flex>
															<Slider
																min={0.1}
																max={3}
																step={0.1}
																value={[customGradientSize]}
																onValueChange={(v) =>
																	setCustomGradientSize(v[0])
																}
															/>
														</Flex>
														<Flex align="center" gap="2">
															<Popover.Root>
																<Popover.Trigger>
																	<Button
																		variant="soft"
																		style={{ flexGrow: 1 }}
																	>
																		<Timer24Regular />
																		{t(
																			"settings.appearance.gradientPositionSettings",
																			"Adjust Center & Angle",
																		)}
																	</Button>
																</Popover.Trigger>
																<Popover.Content
																	size="2"
																	style={{ width: 300 }}
																>
																	<Flex direction="column" gap="3">
																		<Text weight="bold" size="2">
																			{t(
																				"settings.appearance.gradientPositionSettings",
																				"Center & Angle",
																			)}
																		</Text>

																		{customGradientType !== "linear" && (
																			<>
																				<Text size="1" color="gray">
																					{t(
																						"settings.appearance.gradientCenterX",
																						"Center X (Horizontal)",
																					)}
																					: {customGradientCenter[0]}%
																				</Text>
																				<Slider
																					min={0}
																					max={100}
																					step={1}
																					value={[customGradientCenter[0]]}
																					onValueChange={(v) =>
																						setCustomGradientCenter([
																							v[0],
																							customGradientCenter[1],
																						])
																					}
																				/>

																				<Text size="1" color="gray">
																					{t(
																						"settings.appearance.gradientCenterY",
																						"Center Y (Vertical)",
																					)}
																					: {customGradientCenter[1]}%
																				</Text>
																				<Slider
																					min={0}
																					max={100}
																					step={1}
																					value={[customGradientCenter[1]]}
																					onValueChange={(v) =>
																						setCustomGradientCenter([
																							customGradientCenter[0],
																							v[0],
																						])
																					}
																				/>
																			</>
																		)}

																		{customGradientType !== "radial" && (
																			<>
																				<Text size="1" color="gray">
																					{t(
																						"settings.appearance.gradientAngle",
																						"Angle",
																					)}
																					: {customGradientAngle}°
																				</Text>
																				<Slider
																					min={0}
																					max={360}
																					step={1}
																					value={[customGradientAngle]}
																					onValueChange={(v) =>
																						setCustomGradientAngle(v[0])
																					}
																				/>
																			</>
																		)}
																	</Flex>
																</Popover.Content>
															</Popover.Root>
															<IconButton
																variant="outline"
																onClick={() => {
																	setCustomGradientCenter([50, 50]);
																	setCustomGradientAngle(45);
																}}
															>
																<History24Regular />
															</IconButton>
														</Flex>
														<Box
															style={{
																height: "40px",
																borderRadius: "var(--radius-2)",
																background: generateGradient(
																	customGradientColors,
																	customGradientType,
																	customGradientCenter,
																	customGradientAngle,
																	customGradientSize,
																),
																marginTop: "var(--space-2)",
															}}
														/>
													</Flex>
												) : (
													<Grid columns="4" gap="2">
														{backgroundGradients.map((gradient) => {
															const isSelected = selectedGradient === gradient.id;
															return (
																<Box
																	key={gradient.id}
																	style={{
																		height: "56px",
																		borderRadius: "var(--radius-3)",
																		background: gradient.css,
																		cursor: "pointer",
																		position: "relative",
																		display: "flex",
																		alignItems: "flex-end",
																		padding: "4px 6px",
																		boxShadow: isSelected
																			? "0 0 0 2px var(--accent-9), 0 4px 12px rgba(0,0,0,0.3)"
																			: "0 2px 4px rgba(0,0,0,0.15)",
																		transition: "transform 0.15s ease, box-shadow 0.15s ease",
																		overflow: "hidden",
																	}}
																	onClick={() =>
																		setSelectedGradient(gradient.id)
																	}
																>
																	<Box
																		style={{
																			backgroundColor: "rgba(0, 0, 0, 0.55)",
																			backdropFilter: "blur(4px)",
																			borderRadius: "var(--radius-1)",
																			padding: "1px 5px",
																			display: "flex",
																			alignItems: "center",
																			justifyContent: "space-between",
																			width: "100%",
																		}}
																	>
																		<Text
																			size="1"
																			weight="bold"
																			style={{ color: "#ffffff", fontSize: "10px" }}
																		>
																			{gradient.name}
																		</Text>
																		{isSelected && (
																			<Checkmark24Regular
																				style={{
																					width: 12,
																					height: 12,
																					color: "#22c55e",
																				}}
																			/>
																		)}
																	</Box>
																</Box>
															);
														})}
													</Grid>
												)}
											</Flex>
										</Box>
									</Flex>
								</Flex>
							</Card>
						)}
					</Flex>
					<Flex direction="column" gap="3">
						<Heading size="4">
							{t("settings.appearance.font", "Application Font")}
						</Heading>
						<Card>
							<Flex direction="column" gap="3">
								<Flex direction="column" gap="1">
									<Text size="2" weight="bold">
										{t("settings.appearance.currentFont", "Current Font")}
									</Text>
									<Text size="1" color="gray" style={{ fontFamily: appFont }}>
										{appFont.split(",")[0].replace(/"/g, "")}
									</Text>
								</Flex>
								<Button
									variant="soft"
									style={{ cursor: "pointer" }}
									onClick={() => setIsFontSelectionOpen(true)}
								>
									<TextT24Regular />
									{t("settings.appearance.changeFont", "Change Font...")}
								</Button>
							</Flex>
						</Card>
					</Flex>

					<Flex direction="column" gap="3">
						<Heading size="4">
							{t("settings.appearance.resetTitle", "Reset Theme")}
						</Heading>
						<Card>
							<Flex direction="column" gap="2">
								<Flex align="center" gap="2" color="gray">
									<History24Regular />
									<Text size="2">
										{t(
											"settings.appearance.resetDesc",
											"Reset all colors, backgrounds, gradients, and custom overrides back to the default theme.",
										)}
									</Text>
								</Flex>
								<Button
									variant="soft"
									color="red"
									onClick={() => {
										setAccentColor("red");
										setUseCustomAccent(false);
										setCustomAccentColor("#e5484d");
										setBackgroundMode("none");
										setSelectedGradient("sunset");
										setUseCustomGradient(false);
										setCustomGradientColors(["#7028e4"]);
										setCustomGradientType("linear");
										setCustomGradientOpacity(1);
										setCustomGradientCenter([50, 50]);
										setCustomGradientAngle(45);
										setCustomGradientSize(1);
										setGlassBlur(24);
										setLegacyDarkTheme(false);

										setAdvWaveformColor("");
										setAdvWaveformProgress("");
										setAdvPrimaryText("");
										setAdvSecondaryText("");
										setVTitlebarBg("");
										setVSidebarBg("");
										setVSidebarActive("");
										setVMenuHover("");
										setVEditorBg("");
										setVActiveLine("");
										setVLineHover("");
										setVSelection("");
										setVChipRadius(8);
										setVChipGap(8);
										setVChipPaddingV(4);
										setVChipPaddingH(12);
										setVRomanColor("");
										setVTransColor("");
										setVAudioBarBg("");
										setVAudioBarText("");
										setVScrollbar("");
										setVDialogBg("");
										setVDialogBorder("");
										setVGlobalRadius(12);
										setVGlobalBorderWidth(1);
										setVShadow(1);
										setVBackdrop(16);
										setLayoutOrder([
											"titlebar",
											"ribbonbar",
											"editor",
											"audio-controls",
										]);
										setVRibbonPos("top");
									}}
								>
									<History24Regular />
									{t(
										"settings.appearance.resetTheme",
										"Reset Theme to Default",
									)}
								</Button>
							</Flex>
						</Card>
					</Flex>
				</>
			) : (
				<Flex direction="column" gap="4">
					<Flex direction="column" gap="3">
						<Heading size="4">
							{t(
								"settings.appearance.advanced.projectColors",
								"Project Colors",
							)}
						</Heading>
						<Card>
							<Flex direction="column" gap="4">
								<Flex gap="3" align="start">
									<TextT24Regular />
									<Box flexGrow="1">
										<Flex direction="column" gap="3">
											<Flex align="center" justify="between">
												<Flex direction="column" gap="1">
													<Text>
														{t(
															"settings.appearance.advanced.primaryText",
															"Primary Text Color",
														)}
													</Text>
													<Text size="1" color="gray">
														{t(
															"settings.appearance.advanced.primaryTextDesc",
															"Global primary text override.",
														)}
													</Text>
												</Flex>
												<input
													type="color"
													value={advPrimaryText || "#ffffff"}
													onChange={(e) => setAdvPrimaryText(e.target.value)}
													style={{ width: "32px", height: "32px" }}
												/>
											</Flex>

											<Flex align="center" justify="between">
												<Flex direction="column" gap="1">
													<Text>
														{t(
															"settings.appearance.advanced.secondaryText",
															"Secondary Text Color",
														)}
													</Text>
													<Text size="1" color="gray">
														{t(
															"settings.appearance.secondaryDesc",
															"Translations & Metadata.",
														)}
													</Text>
												</Flex>
												<input
													type="color"
													value={advSecondaryText || "#888888"}
													onChange={(e) => setAdvSecondaryText(e.target.value)}
													style={{ width: "32px", height: "32px" }}
												/>
											</Flex>
										</Flex>
									</Box>
								</Flex>
							</Flex>
						</Card>
					</Flex>

					<Flex direction="column" gap="3">
						<Heading size="4">
							<ContentView24Regular />{" "}
							{t("settings.appearance.advanced.workspace", "Workspace Theme")}
						</Heading>
						<Card>
							<Grid columns="2" gap="3">
								<AdvancedColorItem
									label={t(
										"settings.appearance.advanced.titlebarBackground",
										"Titlebar Background",
									)}
									value={vTitlebarBg}
									onChange={setVTitlebarBg}
								/>
								<AdvancedColorItem
									label={t(
										"settings.appearance.advanced.sidebarBackground",
										"Sidebar Background",
									)}
									value={vSidebarBg}
									onChange={setVSidebarBg}
								/>
								<AdvancedColorItem
									label={t(
										"settings.appearance.advanced.activeItemHighlight",
										"Active Item Highlight",
									)}
									value={vSidebarActive}
									onChange={setVSidebarActive}
								/>
								<AdvancedColorItem
									label={t(
										"settings.appearance.advanced.menuHoverColor",
										"Menu Hover Color",
									)}
									value={vMenuHover}
									onChange={setVMenuHover}
								/>
							</Grid>
						</Card>
					</Flex>

					<Flex direction="column" gap="3">
						<Heading size="4">
							<Stack24Regular />{" "}
							{t("settings.appearance.advanced.editor", "Editor Layout")}
						</Heading>
						<Card>
							<Flex direction="column" gap="4">
								<Grid columns="2" gap="3">
									<AdvancedColorItem
										label={t(
											"settings.appearance.advanced.editorCanvas",
											"Editor Canvas",
										)}
										value={vEditorBg}
										onChange={setVEditorBg}
									/>
									<AdvancedColorItem
										label={t(
											"settings.appearance.advanced.activeLineHighlight",
											"Active Line Highlight",
										)}
										value={vActiveLine}
										onChange={setVActiveLine}
									/>
									<AdvancedColorItem
										label={t(
											"settings.appearance.advanced.lineHoverEffect",
											"Line Hover Effect",
										)}
										value={vLineHover}
										onChange={setVLineHover}
									/>
									<AdvancedColorItem
										label={t(
											"settings.appearance.advanced.selectionHighlight",
											"Selection Highlight",
										)}
										value={vSelection}
										onChange={setVSelection}
									/>
								</Grid>
								<AdvancedSliderItem
									label={t(
										"settings.appearance.advanced.chipBorderRadius",
										"Chip Border Radius",
									)}
									icon={<Stack24Regular />}
									value={vChipRadius}
									min={0}
									max={32}
									onChange={setVChipRadius}
									unit="px"
								/>
								<AdvancedSliderItem
									label={t(
										"settings.appearance.advanced.chipSpacing",
										"Chip Spacing (Gap)",
									)}
									icon={<Stack24Regular />}
									value={vChipGap}
									min={0}
									max={32}
									onChange={setVChipGap}
									unit="px"
								/>
								<AdvancedSliderItem
									label={t(
										"settings.appearance.advanced.chipPaddingVertical",
										"Chip Padding (V)",
									)}
									icon={<PaddingLeft24Regular />}
									value={vChipPaddingV}
									min={0}
									max={32}
									onChange={setVChipPaddingV}
									unit="px"
								/>
								<AdvancedSliderItem
									label={t(
										"settings.appearance.advanced.chipPaddingHorizontal",
										"Chip Padding (H)",
									)}
									icon={<PaddingLeft24Regular />}
									value={vChipPaddingH}
									min={0}
									max={32}
									onChange={setVChipPaddingH}
									unit="px"
								/>
								<Flex align="center" justify="between" gap="3">
									<Flex direction="column" gap="1">
										<Text>
											{t(
												"settings.appearance.advanced.legacySpaceLabels",
												"Legacy Space Labels",
											)}
										</Text>
										<Text size="1" color="gray">
											{t(
												"settings.appearance.advanced.legacySpaceLabelsDesc",
												"Show Space xN instead of compact empty space cells.",
											)}
										</Text>
									</Flex>
									<Switch
										checked={legacySpaceLabels}
										onCheckedChange={setLegacySpaceLabels}
									/>
								</Flex>
							</Flex>
						</Card>
					</Flex>

					<Flex direction="column" gap="3">
						<Heading size="4">
							<VideoBackgroundEffect24Regular />{" "}
							{t(
								"settings.appearance.advanced.audioVisuals",
								"Playback & Visuals",
							)}
						</Heading>
						<Card>
							<Flex direction="column" gap="4">
								<Grid columns="2" gap="3">
									<AdvancedColorItem
										label={t(
											"settings.appearance.advanced.audioBarColor",
											"Audio Bar Color",
										)}
										value={vAudioBarBg}
										onChange={setVAudioBarBg}
									/>
									<AdvancedColorItem
										label={t(
											"settings.appearance.advanced.audioBarText",
											"Audio Bar Text",
										)}
										value={vAudioBarText}
										onChange={setVAudioBarText}
									/>
									<AdvancedColorItem
										label={t(
											"settings.appearance.advanced.waveformInactive",
											"Waveform Inactive",
										)}
										value={advWaveformColor}
										onChange={setAdvWaveformColor}
									/>
									<AdvancedColorItem
										label={t(
											"settings.appearance.advanced.waveformProgress",
											"Waveform Progress",
										)}
										value={advWaveformProgress}
										onChange={setAdvWaveformProgress}
									/>
								</Grid>
								<AdvancedColorItem
									label="Romanization Text"
									value={vRomanColor}
									onChange={setVRomanColor}
								/>
								<AdvancedColorItem
									label="Translation Text"
									value={vTransColor}
									onChange={setVTransColor}
								/>
								<AdvancedColorItem
									label="Genius Header Color"
									value={vGeniusHeaderColor}
									onChange={setVGeniusHeaderColor}
								/>
							</Flex>
						</Card>
					</Flex>

					<Flex direction="column" gap="3">
						<Heading size="4">
							<Sparkle24Regular />{" "}
							{t("settings.appearance.advanced.global", "Global Design System")}
						</Heading>
						<Card>
							<Flex direction="column" gap="4">
								<Grid columns="2" gap="3">
									<AdvancedColorItem
										label="Scrollbar Thumb"
										value={vScrollbar}
										onChange={setVScrollbar}
									/>
									<AdvancedColorItem
										label="Dialog Background"
										value={vDialogBg}
										onChange={setVDialogBg}
									/>
									<AdvancedColorItem
										label="Dialog Border"
										value={vDialogBorder}
										onChange={setVDialogBorder}
									/>
								</Grid>
								<AdvancedSliderItem
									label="Global Border Radius"
									icon={<Stack24Regular />}
									value={vGlobalRadius}
									min={0}
									max={40}
									onChange={setVGlobalRadius}
									unit="px"
								/>
								<AdvancedSliderItem
									label="Global Border Width"
									icon={<Timer24Regular />}
									value={vGlobalBorderWidth}
									min={0}
									max={8}
									onChange={setVGlobalBorderWidth}
									unit="px"
								/>
								<AdvancedSliderItem
									label="Shadow Intensity"
									icon={<VideoBackgroundEffect24Regular />}
									value={vShadow}
									min={0}
									max={10}
									step={0.1}
									onChange={setVShadow}
									unit=""
								/>
								<AdvancedSliderItem
									label="Backdrop Blur"
									icon={<Sparkle24Regular />}
									value={vBackdrop}
									min={0}
									max={100}
									onChange={setVBackdrop}
									unit="px"
								/>
							</Flex>
						</Card>
					</Flex>

					<Flex direction="column" gap="3">
						<Heading size="4">
							<Stack24Regular />{" "}
							{t("settings.appearance.layout.title", "Application Layout")}
						</Heading>
						<Card>
							<Flex direction="column" gap="4">
								<Flex direction="column" gap="1">
									<Text weight="bold">
										{t("settings.appearance.layout.order", "Element Order")}
									</Text>
									<Text size="1" color="gray">
										{t(
											"settings.appearance.layout.orderDesc",
											"Drag to reorder elements. Some positions may be limited by constraints.",
										)}
									</Text>
								</Flex>

								<Reorder.Group
									axis="y"
									values={layoutOrder}
									onReorder={setLayoutOrder}
									style={{
										display: "flex",
										flexDirection: "column",
										gap: "8px",
										listStyle: "none",
										padding: 0,
									}}
								>
									{layoutOrder.map((item) => (
										<Reorder.Item
											key={item}
											value={item}
											style={{ cursor: "grab" }}
										>
											<Card size="1">
												<Flex align="center" gap="3">
													<Stack24Regular style={{ color: "var(--gray-8)" }} />
													<Box flexGrow="1">
														<Text size="2" weight="bold">
															{item === "titlebar" && (
																<>
																	<ContentView24Regular />{" "}
																	{t(
																		"settings.appearance.layout.titlebar",
																		"Title Bar",
																	)}
																</>
															)}
															{item === "ribbonbar" && (
																<>
																	<Stack24Regular
																		style={{ transform: "rotate(180deg)" }}
																	/>{" "}
																	{t(
																		"settings.appearance.layout.ribbonbar",
																		"Toolbar (Ribbon)",
																	)}
																</>
															)}
															{item === "editor" && (
																<>
																	<TextT24Regular />{" "}
																	{t(
																		"settings.appearance.layout.editor",
																		"Main Editor Area",
																	)}
																</>
															)}
															{item === "audio-controls" && (
																<>
																	<Speaker224Regular />{" "}
																	{t(
																		"settings.appearance.layout.audio",
																		"Audio Controls",
																	)}
																</>
															)}
														</Text>
													</Box>
												</Flex>
											</Card>
										</Reorder.Item>
									))}
								</Reorder.Group>

								<Flex direction="column" gap="2" mt="2">
									<Text size="2" weight="bold">
										{t(
											"settings.appearance.layout.ribbonPos",
											"Toolbar Orientation",
										)}
									</Text>
									<SegmentedControl.Root
										value={vRibbonPos}
										onValueChange={(v) => setVRibbonPos(v as any)}
									>
										<SegmentedControl.Item value="top">
											{t("settings.appearance.layout.pos.top", "Top")}
										</SegmentedControl.Item>
										<SegmentedControl.Item value="bottom">
											{t("settings.appearance.layout.pos.bottom", "Bottom")}
										</SegmentedControl.Item>
										<SegmentedControl.Item value="left">
											{t("settings.appearance.layout.pos.left", "Left")}
										</SegmentedControl.Item>
										<SegmentedControl.Item value="right">
											{t("settings.appearance.layout.pos.right", "Right")}
										</SegmentedControl.Item>
									</SegmentedControl.Root>
									{(vRibbonPos === "left" || vRibbonPos === "right") && (
										<Text size="1" color="amber">
											{t(
												"settings.appearance.layout.sidebarWarning",
												"Note: Sidebar mode is experimental and may look different.",
											)}
										</Text>
									)}
								</Flex>
							</Flex>
						</Card>
					</Flex>

					<Card size="2">
						<Flex direction="column" gap="2">
							<Flex align="center" gap="2" color="gray">
								<Sparkle24Regular />
								<Text size="2">
									{t(
										"settings.appearance.advanced.masterResetNote",
										"This will reset all 20+ granular overrides.",
									)}
								</Text>
							</Flex>
							<Button
								variant="soft"
								color="red"
								onClick={() => {
									setAdvWaveformColor("");
									setAdvWaveformProgress("");
									setAdvPrimaryText("");
									setAdvSecondaryText("");
									setVTitlebarBg("");
									setVSidebarBg("");
									setVSidebarActive("");
									setVMenuHover("");
									setVEditorBg("");
									setVActiveLine("");
									setVLineHover("");
									setVSelection("");
									setVChipRadius(8);
									setVChipGap(8);
									setVChipPaddingV(4);
									setVChipPaddingH(12);
									setVRomanColor("");
									setVTransColor("");
									setVAudioBarBg("");
									setVAudioBarText("");
									setVScrollbar("");
									setVDialogBg("");
									setVDialogBorder("");
									setVGlobalRadius(12);
									setVGlobalBorderWidth(1);
									setVShadow(1);
									setVBackdrop(16);
									setLegacyDarkTheme(false);
									setLayoutOrder([
										"titlebar",
										"ribbonbar",
										"editor",
										"audio-controls",
									]);
									setVRibbonPos("top");
								}}
							>
								<History24Regular />
								{t(
									"settings.appearance.advanced.resetMaster",
									"Master Reset Advanced Config",
								)}
							</Button>
						</Flex>
					</Card>
				</Flex>
			)}
		</Flex>
	);
};

// --- Helper Components for Advanced Editor ---

const AdvancedColorItem = ({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
}) => (
	<Flex direction="column" gap="1">
		<Flex align="center" justify="between">
			<Text size="1" color="gray" weight="bold">
				{label}
			</Text>
			{value && (
				<IconButton size="1" variant="ghost" onClick={() => onChange("")}>
					<History24Regular />
				</IconButton>
			)}
		</Flex>
		<input
			type="color"
			value={value || "#000000"}
			onChange={(e) => onChange(e.target.value)}
			style={{
				width: "100%",
				height: "24px",
				border: "1px solid var(--gray-5)",
				borderRadius: "4px",
				cursor: "pointer",
				padding: 0,
			}}
		/>
	</Flex>
);

const AdvancedSliderItem = ({
	label,
	icon,
	value,
	min,
	max,
	step = 1,
	onChange,
	unit,
}: {
	label: string;
	icon: React.ReactNode;
	value: number;
	min: number;
	max: number;
	step?: number;
	onChange: (v: number) => void;
	unit: string;
}) => (
	<Box>
		<Flex align="center" justify="between" mb="1">
			<Flex align="center" gap="2">
				<Box color="accent">{icon}</Box>
				<Text size="1" weight="bold">
					{label}
				</Text>
			</Flex>
			<Text size="1" color="gray">
				{value}
				{unit}
			</Text>
		</Flex>
		<Slider
			min={min}
			max={max}
			step={step}
			value={[value]}
			onValueChange={(v) => onChange(v[0])}
		/>
	</Box>
);
