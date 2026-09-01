import { Flex, Select, Text } from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
	Dismiss12Regular,
	Sparkle16Regular,
	MusicNote216Regular,
	Timer16Regular,
} from "@fluentui/react-icons";
import {
	PreviewModeType,
	previewModeTypeAtom,
} from "$/modules/settings/states/preview";
import { showPreviewPanelAtom } from "$/states/main";
import { PreviewModeSwitcher } from "$/components/PreviewModeSwitcher";
import styles from "./index.module.css";

export const SidePreviewPanel = memo(() => {
	const { t } = useTranslation();
	const setShowPreviewPanel = useSetAtom(showPreviewPanelAtom);
	const [previewModeType, setPreviewModeType] = useAtom(previewModeTypeAtom);

	return (
		<div className={styles.sidePreviewContainer}>
			<div className={styles.tabHeader}>
				<Select.Root
					value={previewModeType}
					onValueChange={(val: any) => setPreviewModeType(val)}
					size="1"
				>
					<Select.Trigger
						variant="surface"
						style={{
							minWidth: "150px",
							fontSize: "12px",
							fontWeight: 500,
						}}
					/>
					<Select.Content position="popper" size="1">
						<Select.Item value={PreviewModeType.Standard}>
							<Flex align="center" gap="2">
								<MusicNote216Regular />
								<Text>Standard</Text>
							</Flex>
						</Select.Item>
						<Select.Item value={PreviewModeType.Spicy}>
							<Flex align="center" gap="2">
								<Sparkle16Regular />
								<Text>SpicyLyrics</Text>
							</Flex>
						</Select.Item>
						<Select.Item value={PreviewModeType.Toxi}>
							<Flex align="center" gap="2">
								<MusicNote216Regular />
								<Text>Toxi (Apple Style)</Text>
							</Flex>
						</Select.Item>
						<Select.Item value={PreviewModeType.Timing}>
							<Flex align="center" gap="2">
								<Timer16Regular />
								<Text>Timing Overview</Text>
							</Flex>
						</Select.Item>
					</Select.Content>
				</Select.Root>

				<button
					type="button"
					className={styles.closeButton}
					onClick={() => setShowPreviewPanel(false)}
					title={t("common.close", "Close Preview Panel")}
				>
					<Dismiss12Regular />
				</button>
			</div>

			<div className={styles.previewBody}>
				<PreviewModeSwitcher />
			</div>
		</div>
	);
});

export default SidePreviewPanel;
