import { Cloud24Regular } from "@fluentui/react-icons";
import { Avatar, Button, DropdownMenu, Flex, Text } from "@radix-ui/themes";
import { useAtomValue, useSetAtom } from "jotai";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { openAccountSettingsAtom } from "$/states/dialogs";
import {
	cloudFileManagerInitialTabAtom,
	cloudFileManagerOpenAtom,
	currentUserAtom,
} from "../states";

export const CloudStatusButton: FC = () => {
	const { t } = useTranslation();
	const user = useAtomValue(currentUserAtom);
	const openAccountSettings = useSetAtom(openAccountSettingsAtom);
	const setCloudFileManagerOpen = useSetAtom(cloudFileManagerOpenAtom);
	const setCloudFileManagerTab = useSetAtom(cloudFileManagerInitialTabAtom);

	const handleOpenAuth = () => {
		openAccountSettings();
	};

	const handleOpenCloudManager = (tab: "save" | "open") => {
		setCloudFileManagerTab(tab);
		setCloudFileManagerOpen(true);
	};

	if (!user) {
		return (
			<Button
				variant="soft"
				color="gray"
				size="1"
				onClick={handleOpenAuth}
				style={{
					borderRadius: 16,
					paddingLeft: 8,
					paddingRight: 10,
					height: 26,
					cursor: "pointer",
					display: "flex",
					alignItems: "center",
					gap: 5,
				}}
				title={t("cloud.signInTooltip", "Sign in to TTML Cloud")}
			>
				<Cloud24Regular style={{ width: 15, height: 15 }} />
				<Text size="1" weight="medium">
					{t("cloud.signIn", "Cloud")}
				</Text>
			</Button>
		);
	}

	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				<Button
					variant="soft"
					color="gray"
					size="1"
					style={{
						borderRadius: 16,
						paddingLeft: 4,
						paddingRight: 8,
						height: 26,
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						gap: 6,
					}}
				>
					<Avatar
						size="1"
						src={user.photoURL || undefined}
						fallback={user.displayName?.[0]?.toUpperCase() || "U"}
						radius="full"
					/>
					<Text size="1" weight="medium" truncate style={{ maxWidth: 80 }}>
						{user.displayName?.split(" ")[0] || "Account"}
					</Text>
				</Button>
			</DropdownMenu.Trigger>
			<DropdownMenu.Content>
				<DropdownMenu.Label>
					<Flex direction="column">
						<Text weight="bold" size="2">
							{user.displayName}
						</Text>
						{user.email && (
							<Text size="1" color="gray">
								{user.email}
							</Text>
						)}
					</Flex>
				</DropdownMenu.Label>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onSelect={() => handleOpenCloudManager("open")}>
					📂 {t("cloud.myCloudLibrary", "My Cloud Library...")}
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={() => handleOpenCloudManager("save")}>
					💾 {t("cloud.saveToCloud", "Save Current to Cloud...")}
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onSelect={handleOpenAuth}>
					⚙️ {t("cloud.accountSettings", "Cloud Account Settings...")}
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
