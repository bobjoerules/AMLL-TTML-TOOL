import {
	CenterHorizontal24Regular,
	EyeTrackingOff24Regular,
	LayoutRowTwo24Regular,
	LayoutRowTwoSplitBottom24Regular,
	NextFrame24Regular,
	Target24Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Flex,
	SegmentedControl,
	Select,
	Slider,
	Switch,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	customPaletteStopsAtom,
	predefinedPalettes,
	type SpectrogramPlayheadTrackingMode,
	selectedPaletteIdAtom,
	spectrogramFftSizeAtom,
	spectrogramFullWidthAtom,
	spectrogramHeightAtom,
	spectrogramOnlyShowSyncLineAtom,
	spectrogramPlayheadTrackingModeAtom,
	spectrogramSplitBgMainAtom,
} from "$/modules/spectrogram/states";

export const SettingsSpectrogramTab = () => {
	const { t } = useTranslation();
	const [spectrogramFullWidth, setSpectrogramFullWidth] = useAtom(
		spectrogramFullWidthAtom,
	);
	const [selectedPaletteId, setSelectedPaletteId] = useAtom(
		selectedPaletteIdAtom,
	);
	const [globalStops, setGlobalStops] = useAtom(customPaletteStopsAtom);
	const [localStops, setLocalStops] = useState(globalStops);
	const [spectrogramOnlyShowSyncLine, setSpectrogramOnlyShowSyncLine] = useAtom(
		spectrogramOnlyShowSyncLineAtom,
	);
	const [spectrogramSplitBgMain, setSpectrogramSplitBgMain] = useAtom(
		spectrogramSplitBgMainAtom,
	);
	const [playheadTrackingMode, setPlayheadTrackingMode] = useAtom(
		spectrogramPlayheadTrackingModeAtom,
	);
	const [fftSize, setFftSize] = useAtom(spectrogramFftSizeAtom);
	const [dataHeight, setDataHeight] = useAtom(spectrogramHeightAtom);

	useEffect(() => {
		setLocalStops(globalStops);
	}, [globalStops]);

	const gradientCss = useMemo(() => {
		const stopsString = localStops
			.map((stop) => `${stop.color} ${stop.pos * 100}%`)
			.join(", ");
		return `linear-gradient(to right, ${stopsString})`;
	}, [localStops]);

	const handleStopColorChange = (index: number, color: string) => {
		setLocalStops(
			localStops.map((stop, i) => (i === index ? { ...stop, color } : stop)),
		);
	};

	const handleStopPosChange = (index: number, pos: number) => {
		const newPos = Number.isNaN(pos) ? 0 : Math.max(0, Math.min(1, pos));

		setLocalStops(
			localStops.map((stop, i) =>
				i === index ? { ...stop, pos: newPos } : stop,
			),
		);
	};

	const commitLocalChanges = () => {
		const sortedStops = [...localStops].sort((a, b) => a.pos - b.pos);
		setGlobalStops(sortedStops);
		setLocalStops(sortedStops);
	};

	const handleRemoveStop = (index: number) => {
		setGlobalStops(globalStops.filter((_, i) => i !== index));
	};

	const handleAddStop = () => {
		setGlobalStops(
			[
				...globalStops,
				{
					id: crypto.randomUUID(),
					pos: 1.0,
					color: "#ffffff",
				},
			].sort((a, b) => a.pos - b.pos),
		);
	};

	return (
		<Flex direction="column" gap="4">
			<Card>
				<Text as="label">
					<Flex gap="3" align="center">
						<LayoutRowTwoSplitBottom24Regular />
						<Box flexGrow="1">
							<Flex gap="2" align="center" justify="between">
								<Flex direction="column" gap="1">
									<Text>
										{t(
											"spectrogram.fullWidth",
											"Full-Width Spectrogram & Timeline",
										)}
									</Text>
									<Text size="1" color="gray">
										{t(
											"spectrogram.fullWidthDesc",
											"Make preview panel not take up full height so the spectrogram uses the full window width.",
										)}
									</Text>
								</Flex>
								<Switch
									checked={spectrogramFullWidth}
									onCheckedChange={setSpectrogramFullWidth}
								/>
							</Flex>
						</Box>
					</Flex>
				</Text>
			</Card>

			<Card>
				<Text as="label">
					<Flex gap="3" align="center">
						<Target24Regular />
						<Box flexGrow="1">
							<Flex gap="2" align="center" justify="between">
								<Flex direction="column" gap="1">
									<Text>
										{t(
											"settings.spectrogram.onlyShowSyncLine",
											"Only Show Active Sync Line on Spectrogram",
										)}
									</Text>
									<Text size="1" color="gray">
										{t(
											"settings.spectrogram.onlyShowSyncLineDesc",
											"When syncing lyrics, hides other lines and only displays the line currently being synchronized on the spectrogram overlay.",
										)}
									</Text>
								</Flex>
								<Switch
									checked={spectrogramOnlyShowSyncLine}
									onCheckedChange={setSpectrogramOnlyShowSyncLine}
								/>
							</Flex>
						</Box>
					</Flex>
				</Text>
			</Card>

			<Card>
				<Text as="label">
					<Flex gap="3" align="center">
						<LayoutRowTwo24Regular />
						<Box flexGrow="1">
							<Flex gap="2" align="center" justify="between">
								<Flex direction="column" gap="1">
									<Text>
										{t(
											"settings.spectrogram.splitBgMain",
											"Split Background and Main Vocals",
										)}
									</Text>
									<Text size="1" color="gray">
										{t(
											"settings.spectrogram.splitBgMainDesc",
											"Display main vocals in the upper half and background vocals in the lower half of the spectrogram.",
										)}
									</Text>
								</Flex>
								<Switch
									checked={spectrogramSplitBgMain}
									onCheckedChange={setSpectrogramSplitBgMain}
								/>
							</Flex>
						</Box>
					</Flex>
				</Text>
			</Card>

			<Card>
				<Flex gap="3" align="center">
					{playheadTrackingMode === "follow" ? (
						<CenterHorizontal24Regular />
					) : playheadTrackingMode === "snap" ? (
						<NextFrame24Regular />
					) : (
						<EyeTrackingOff24Regular />
					)}
					<Box flexGrow="1">
						<Flex gap="2" align="center" justify="between">
							<Flex direction="column" gap="1">
								<Text>
									{t(
										"settings.spectrogram.playheadTracking",
										"Playhead Tracking",
									)}
								</Text>
								<Text size="1" color="gray">
									{playheadTrackingMode === "follow"
										? t(
												"settings.spectrogram.followPlayheadDesc",
												"Automatically scrolls the spectrogram during playback and seeking to keep the playhead in the middle of the frame.",
											)
										: playheadTrackingMode === "snap"
											? t(
													"settings.spectrogram.snapPlayheadToStartDesc",
													"When the playhead moves past the visible area during playback, automatically snaps the spectrogram view with the playhead at the start.",
												)
											: t(
													"settings.spectrogram.playheadTrackingOffDesc",
													"Spectrogram view will not automatically move with the playhead.",
												)}
								</Text>
							</Flex>
							<SegmentedControl.Root
								value={playheadTrackingMode}
								onValueChange={(val) =>
									setPlayheadTrackingMode(
										val as SpectrogramPlayheadTrackingMode,
									)
								}
							>
								<SegmentedControl.Item value="off">
									{t("settings.spectrogram.playheadTrackingOff", "Off")}
								</SegmentedControl.Item>
								<SegmentedControl.Item value="snap">
									{t("settings.spectrogram.playheadTrackingSnap", "Snap")}
								</SegmentedControl.Item>
								<SegmentedControl.Item value="follow">
									{t("settings.spectrogram.playheadTrackingFollow", "Follow")}
								</SegmentedControl.Item>
							</SegmentedControl.Root>
						</Flex>
					</Box>
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="2">
					<Flex justify="between" align="center">
						<Flex direction="column" gap="1">
							<Text>{t("spectrogram.fftSize", "FFT Size")}</Text>
							<Text size="1" color="gray">
								{t("spectrogram.resolution", "FFT Resolution")}
							</Text>
						</Flex>
						<Select.Root
							value={fftSize.toString()}
							onValueChange={(v) => setFftSize(Number.parseInt(v))}
						>
							<Select.Trigger />
							<Select.Content>
								<Select.Item value="512">
									{t("spectrogram.fftSizeOption.512", "512 (Fast)")}
								</Select.Item>
								<Select.Item value="1024">
									{t("spectrogram.fftSizeOption.1024", "1024 (Normal)")}
								</Select.Item>
								<Select.Item value="2048">
									{t("spectrogram.fftSizeOption.2048", "2048 (Better Freq)")}
								</Select.Item>
								<Select.Item value="4096">
									{t("spectrogram.fftSizeOption.4096", "4096 (High Res)")}
								</Select.Item>
							</Select.Content>
						</Select.Root>
					</Flex>
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="2">
					<Flex justify="between" align="center">
						<Text>{t("spectrogram.height", "Display Height")}</Text>
						<Text size="2" color="gray">
							{dataHeight}px
						</Text>
					</Flex>
					<Slider
						size="1"
						min={100}
						max={800}
						step={10}
						value={[dataHeight]}
						onValueChange={(v) => setDataHeight(v[0])}
					/>
				</Flex>
			</Card>

			<Text as="label">
				<Flex direction="column" gap="2" align="start">
					<Text>{t("settings.spectrogram.palette", "Color Palette")}</Text>
					<Select.Root
						value={selectedPaletteId}
						onValueChange={(v) => setSelectedPaletteId(v)}
					>
						<Select.Trigger />
						<Select.Content>
							{predefinedPalettes.map((palette) => (
								<Select.Item key={palette.id} value={palette.id}>
									{palette.name}
								</Select.Item>
							))}
							<Select.Separator />
							<Select.Item value="custom">
								{t("settings.spectrogram.paletteCustom", "Custom")}
							</Select.Item>
						</Select.Content>
					</Select.Root>
				</Flex>
			</Text>

			{selectedPaletteId === "custom" && (
				<Flex
					asChild
					p="2"
					style={{
						border: "1px solid var(--gray-a5)",
						borderRadius: "var(--radius-3)",
					}}
				>
					<section>
						<Flex direction="column" gap="3" width="100%">
							<Text size="1" color="gray">
								{t(
									"settings.spectrogram.gradientEditorDesc",
									"Pos 0.0 corresponds to the quietest part, 1.0 to the loudest part. It is recommended to use brighter colors for larger Pos values.",
								)}
							</Text>

							<div
								style={{
									width: "100%",
									height: "24px",
									backgroundImage: gradientCss,
									border: "1px solid var(--gray-a6)",
									borderRadius: "var(--radius-2)",
								}}
							/>

							{localStops.map((stop, index) => (
								<Flex key={stop.id} align="center" gap="2">
									<input
										type="color"
										value={stop.color}
										onChange={(e) =>
											handleStopColorChange(index, e.target.value)
										}
										onBlur={commitLocalChanges}
										style={{
											border: "none",
											padding: 0,
											background: "none",
											width: "28px",
											height: "28px",
										}}
									/>
									<TextField.Root
										type="number"
										min={0}
										max={1}
										step={0.01}
										value={stop.pos}
										onChange={(e) =>
											handleStopPosChange(
												index,
												e.target.value === ""
													? NaN
													: Number.parseFloat(e.target.value),
											)
										}
										onBlur={commitLocalChanges}
										style={{ maxWidth: "80px" }}
									/>
									<Text size="1">Pos: {stop.pos.toFixed(2)}</Text>
									<Button
										variant="soft"
										color="red"
										disabled={localStops.length <= 1}
										onClick={() => handleRemoveStop(index)}
										style={{ marginLeft: "auto" }}
									>
										{t("common.remove", "Remove")}
									</Button>
								</Flex>
							))}
							<Button variant="outline" onClick={handleAddStop}>
								{t("settings.spectrogram.addStop", "Add Color Stop")}
							</Button>
						</Flex>
					</section>
				</Flex>
			)}
		</Flex>
	);
};
