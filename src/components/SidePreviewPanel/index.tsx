import { DropdownMenu, Flex, Text } from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
	Add16Regular,
	Dismiss12Regular,
	Eye16Regular,
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

	const getModeLabel = () => {
		switch (previewModeType) {
			case PreviewModeType.Spicy:
				return "Preview: SpicyLyrics";
			case PreviewModeType.Toxi:
				return "Preview: Toxi";
			case PreviewModeType.Timing:
				return "Preview: Timing";
			default:
				return "Preview";
		}
	};

	return (
		<div className={styles.sidePreviewContainer}>
			<div className={styles.tabHeader}>
				<Flex align="center" gap="1">
					<div className={styles.tabItem}>
						<Eye16Regular style={{ width: 14, height: 14 }} />
						<span>{getModeLabel()}</span>
						<button
							type="button"
							className={styles.closeButton}
							onClick={() => setShowPreviewPanel(false)}
							title={t("common.close", "Close Preview Panel")}
						>
							<Dismiss12Regular />
						</button>
					</div>
				</Flex>

				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						<button
							type="button"
							className={styles.addButton}
							title={t("ribbonBar.previewMode.selectEngine", "Switch Preview Engine")}
						>
							<Add16Regular />
						</button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" size="1">
						<DropdownMenu.Label>
							{t("ribbonBar.previewMode.engine", "Preview Engine")}
						</DropdownMenu.Label>
						<DropdownMenu.Item
							onSelect={() => setPreviewModeType(PreviewModeType.Standard)}
						>
							<Flex align="center" gap="2">
								<MusicNote216Regular />
								<Text>Standard</Text>
							</Flex>
						</DropdownMenu.Item>
						<DropdownMenu.Item
							onSelect={() => setPreviewModeType(PreviewModeType.Spicy)}
						>
							<Flex align="center" gap="2">
								<Sparkle16Regular />
								<Text>SpicyLyrics</Text>
							</Flex>
						</DropdownMenu.Item>
						<DropdownMenu.Item
							onSelect={() => setPreviewModeType(PreviewModeType.Toxi)}
						>
							<Flex align="center" gap="2">
								<MusicNote216Regular />
								<Text>Toxi (Apple Style)</Text>
							</Flex>
						</DropdownMenu.Item>
						<DropdownMenu.Item
							onSelect={() => setPreviewModeType(PreviewModeType.Timing)}
						>
							<Flex align="center" gap="2">
								<Timer16Regular />
								<Text>Timing Overview</Text>
							</Flex>
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>

			<div className={styles.previewBody}>
				<PreviewModeSwitcher />
			</div>
		</div>
	);
});

export default SidePreviewPanel;
