import classNames from "classnames";
import { Flex, Text, Tooltip } from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
	Dismiss12Regular,
	Sparkle16Regular,
	People16Regular,
	LayoutRowTwoSplitBottom16Regular,
} from "@fluentui/react-icons";
import { bgFollowsDuetAtom } from "$/modules/settings/states/preview";
import { spectrogramFullWidthAtom } from "$/modules/spectrogram/states";
import { showPreviewPanelAtom } from "$/states/main";
import { PreviewModeSwitcher } from "$/components/PreviewModeSwitcher";
import styles from "./index.module.css";

export const SidePreviewPanel = memo(() => {
	const { t } = useTranslation();
	const setShowPreviewPanel = useSetAtom(showPreviewPanelAtom);
	const [bgFollowsDuet, setBgFollowsDuet] = useAtom(bgFollowsDuetAtom);
	const [spectrogramFullWidth, setSpectrogramFullWidth] = useAtom(
		spectrogramFullWidthAtom,
	);

	return (
		<div className={styles.sidePreviewContainer}>
			<div className={styles.tabHeader}>
				<Flex align="center" gap="2" style={{ paddingLeft: "4px" }}>
					<Sparkle16Regular style={{ color: "var(--accent-11)" }} />
					<Text weight="medium" size="2">
						SpicyLyrics
					</Text>
				</Flex>

				<Flex align="center" gap="1">
					<Tooltip
						content={t(
							"ribbonBar.previewMode.bgFollowsDuet",
							"BG Follows Duet",
						)}
					>
						<button
							type="button"
							className={classNames(
								styles.toggleButton,
								bgFollowsDuet && styles.toggleButtonActive,
							)}
							onClick={() => setBgFollowsDuet((v) => !v)}
							title={t(
								"ribbonBar.previewMode.bgFollowsDuet",
								"BG Follows Duet",
							)}
							aria-label={t(
								"ribbonBar.previewMode.bgFollowsDuet",
								"BG Follows Duet",
							)}
						>
							<People16Regular />
						</button>
					</Tooltip>

					<Tooltip
						content={t("spectrogram.fullWidth", "Full Width Spectrogram")}
					>
						<button
							type="button"
							className={classNames(
								styles.toggleButton,
								spectrogramFullWidth && styles.toggleButtonActive,
							)}
							onClick={() => setSpectrogramFullWidth((v) => !v)}
							aria-label={t("spectrogram.fullWidth", "Full Width Spectrogram")}
						>
							<LayoutRowTwoSplitBottom16Regular />
						</button>
					</Tooltip>

					<button
						type="button"
						className={styles.closeButton}
						onClick={() => setShowPreviewPanel(false)}
						title={t("common.close", "Close Preview Panel")}
					>
						<Dismiss12Regular />
					</button>
				</Flex>
			</div>

			<div className={styles.previewBody}>
				<PreviewModeSwitcher isPanel />
			</div>
		</div>
	);
});

export default SidePreviewPanel;
