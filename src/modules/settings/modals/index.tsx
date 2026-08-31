import {
	Code24Regular,
	Edit24Regular,
	Folder24Regular,
	Info24Regular,
	Keyboard12324Regular,
	PaintBrush24Regular,
	PlugConnected24Regular,
	Settings24Regular,
	Speaker224Regular,
	PersonCircle24Regular,
} from "@fluentui/react-icons";
import { Box, Dialog, Flex, Heading, Tabs, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { settingsDialogAtom, settingsTabAtom } from "$/states/dialogs.ts";
import { SettingsAboutTab } from "./about";
import { SettingsAccountTab } from "./account";
import { SettingsAppearanceTab } from "./appearance";
import { AudioSettingsTab } from "./audio";
import { SettingsBackupTab } from "./backup";
import { SettingsCommonTab } from "./common";
import { SettingsDevTab } from "./dev";
import { SettingsKeyBindingsDialog } from "./keybindings";
import styles from "./settings.module.css";
import { SettingsSpectrogramTab } from "./spectrogram";
import { DiscordPresenceSettings } from "$/modules/discord-presence/DiscordPresenceSettings";

const SettingsPage = ({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) => (
	<Flex direction="column" gap="4" className={styles.page}>
		<Box>
			<Heading size="7">{title}</Heading>
			{description && (
				<Text size="2" color="gray">
					{description}
				</Text>
			)}
		</Box>
		{children}
	</Flex>
);

const NavigationItem = ({
	value,
	icon,
	children,
}: {
	value: string;
	icon: ReactNode;
	children: ReactNode;
}) => (
	<Tabs.Trigger value={value} className={styles.navigationItem}>
		{icon}
		<span>{children}</span>
	</Tabs.Trigger>
);

export const SettingsDialog = memo(() => {
	const [settingsDialogOpen, setSettingsDialogOpen] =
		useAtom(settingsDialogAtom);
	const [activeTab, setActiveTab] = useAtom(settingsTabAtom);
	const { t } = useTranslation();
	const displayedTab = activeTab === "assistant" ? "ai" : activeTab;

	return (
		<Dialog.Root open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
			<Dialog.Content maxWidth="980px" className={styles.dialogContent}>
				<Tabs.Root
					value={displayedTab}
					onValueChange={setActiveTab}
					orientation="vertical"
					className={styles.settingsLayout}
				>
					<aside className={styles.sidebar}>
						<Dialog.Title className={styles.sidebarTitle}>
							{t("settingsDialog.title", "Preferences")}
						</Dialog.Title>
						<Tabs.List className={styles.navigation}>
							<NavigationItem value="common" icon={<Settings24Regular />}>
								{t("settingsDialog.tab.common", "General")}
							</NavigationItem>
							<NavigationItem value="account" icon={<PersonCircle24Regular />}>
								{t("settingsDialog.tab.account", "Account")}
							</NavigationItem>
							<NavigationItem value="editor" icon={<Edit24Regular />}>
								{t("settingsDialog.tab.editor", "Editor & Sync")}
							</NavigationItem>
							<NavigationItem value="files" icon={<Folder24Regular />}>
								{t("settingsDialog.tab.files", "Files & Storage")}
							</NavigationItem>
							<NavigationItem value="audio" icon={<Speaker224Regular />}>
								{t("settingsDialog.tab.audio", "Audio")}
							</NavigationItem>
							<NavigationItem
								value="keybinding"
								icon={<Keyboard12324Regular />}
							>
								{t("settingsDialog.tab.keybindings", "Keybindings")}
							</NavigationItem>
							<NavigationItem value="appearance" icon={<PaintBrush24Regular />}>
								{t("settingsDialog.tab.appearance", "Appearance")}
							</NavigationItem>
							{import.meta.env.TAURI_ENV_PLATFORM && (
								<NavigationItem
									value="discord"
									icon={<PlugConnected24Regular />}
								>
									{t("settingsDialog.tab.discord", "Discord RPC")}
								</NavigationItem>
							)}
							<NavigationItem value="about" icon={<Info24Regular />}>
								{t("common.about", "About")}
							</NavigationItem>
							<NavigationItem value="dev" icon={<Code24Regular />}>
								{t("settingsDialog.tab.dev", "Developer")}
							</NavigationItem>
						</Tabs.List>
					</aside>

					<main className={styles.contentPane}>
						<Tabs.Content value="common" className={styles.tabContent}>
							<SettingsPage
								title={t("settingsDialog.tab.common", "General")}
								description={t(
									"settingsDialog.page.generalDesc",
									"Language, layout, privacy, and app-wide behavior.",
								)}
							>
								<SettingsCommonTab section="general" />
							</SettingsPage>
						</Tabs.Content>
						<Tabs.Content value="account" className={styles.tabContent}>
							<SettingsPage
								title={t("settingsDialog.tab.account", "Account & Cloud")}
								description={t(
									"settingsDialog.page.accountDesc",
									"Manage your cloud profile, synchronized lyrics statistics, and account security.",
								)}
							>
								<SettingsAccountTab />
							</SettingsPage>
						</Tabs.Content>
						<Tabs.Content value="editor" className={styles.tabContent}>
							<SettingsPage
								title={t("settingsDialog.tab.editor", "Editor & Sync")}
								description={t(
									"settingsDialog.page.editorDesc",
									"Timing input, synchronization behavior, and visual cues.",
								)}
							>
								<SettingsCommonTab section="editor" />
							</SettingsPage>
						</Tabs.Content>
						<Tabs.Content value="files" className={styles.tabContent}>
							<SettingsPage
								title={t("settingsDialog.tab.files", "Files & Storage")}
								description={t(
									"settingsDialog.page.filesDesc",
									"Import cleanup, autosave history, and portable backups.",
								)}
							>
								<SettingsCommonTab section="files" />
								<SettingsBackupTab />
							</SettingsPage>
						</Tabs.Content>
						<Tabs.Content value="audio" className={styles.tabContent}>
							<SettingsPage
								title={t("settingsDialog.tab.audio", "Audio")}
								description={t(
									"settingsDialog.page.audioDesc",
									"Playback, conversion, equalizer, and spectrogram display.",
								)}
							>
								<SettingsCommonTab section="audio" />
								<AudioSettingsTab />
								<SettingsSpectrogramTab />
							</SettingsPage>
						</Tabs.Content>
						<Tabs.Content value="keybinding" className={styles.tabContent}>
							<SettingsPage
								title={t("settingsDialog.tab.keybindings", "Keybindings")}
							>
								<SettingsKeyBindingsDialog />
							</SettingsPage>
						</Tabs.Content>
						<Tabs.Content value="appearance" className={styles.tabContent}>
							<SettingsPage
								title={t("settingsDialog.tab.appearance", "Appearance")}
							>
								<SettingsAppearanceTab />
							</SettingsPage>
						</Tabs.Content>
						{import.meta.env.TAURI_ENV_PLATFORM && (
							<Tabs.Content value="discord" className={styles.tabContent}>
								<SettingsPage
									title={t("settingsDialog.tab.discord", "Discord RPC")}
									description={t(
										"settingsDialog.page.discordDesc",
										"Manage how the tool publishes your editing activity and playback progress to Discord.",
									)}
								>
									<DiscordPresenceSettings />
								</SettingsPage>
							</Tabs.Content>
						)}
						<Tabs.Content value="about" className={styles.tabContent}>
							<SettingsPage title={t("common.about", "About")}>
								<SettingsAboutTab />
							</SettingsPage>
						</Tabs.Content>
						<Tabs.Content value="dev" className={styles.tabContent}>
							<SettingsPage title={t("settingsDialog.tab.dev", "Developer")}>
								<SettingsDevTab />
							</SettingsPage>
						</Tabs.Content>
					</main>
				</Tabs.Root>
			</Dialog.Content>
		</Dialog.Root>
	);
});
