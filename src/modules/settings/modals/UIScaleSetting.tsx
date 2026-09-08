import { ArrowReset24Regular, ZoomIn24Regular } from "@fluentui/react-icons";
import { Badge, Box, Button, Card, Flex, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_UI_SCALE, uiScaleAtom } from "$/modules/settings/states";

const SCALE_PRESETS = [50, 65, 75, 85, 100, 115, 125, 150, 175, 200];

export const UIScaleSetting = memo(() => {
	const [uiScale, setUiScale] = useAtom(uiScaleAtom);
	const { t } = useTranslation();

	return (
		<Card>
			<Flex gap="3" align="start">
				<ZoomIn24Regular />
				<Box flexGrow="1">
					<Flex direction="column" gap="3">
						<Flex align="center" justify="between" wrap="wrap" gap="2">
							<Flex direction="column" gap="1">
								<Flex align="center" gap="2">
									<Text weight="bold">
										{t("settings.appearance.uiScale", "Interface Scale")}
									</Text>
									<Badge
										size="1"
										variant={uiScale === DEFAULT_UI_SCALE ? "surface" : "solid"}
									>
										{uiScale}%
									</Badge>
								</Flex>
								<Text size="1" color="gray">
									{t(
										"settings.appearance.uiScaleDesc",
										"Adjust the size of text, icons, and elements across the entire app. Use Cmd/Ctrl +/- to zoom anytime.",
									)}
								</Text>
							</Flex>

							<Button
								variant="soft"
								color="gray"
								size="1"
								disabled={uiScale === DEFAULT_UI_SCALE}
								onClick={() => setUiScale(DEFAULT_UI_SCALE)}
								style={{
									cursor: uiScale === DEFAULT_UI_SCALE ? "default" : "pointer",
								}}
							>
								<ArrowReset24Regular style={{ width: 14, height: 14 }} />
								{t("settings.appearance.resetScale", "Reset (100%)")}
							</Button>
						</Flex>

						{/* Quick Preset Buttons */}
						<Flex gap="2" wrap="wrap">
							{SCALE_PRESETS.map((preset) => {
								const isSelected = uiScale === preset;
								return (
									<Button
										key={preset}
										size="1"
										variant={isSelected ? "solid" : "soft"}
										color={isSelected ? undefined : "gray"}
										onClick={() => setUiScale(preset)}
										style={{ cursor: "pointer" }}
									>
										{preset}%
									</Button>
								);
							})}
						</Flex>
					</Flex>
				</Box>
			</Flex>
		</Card>
	);
});
