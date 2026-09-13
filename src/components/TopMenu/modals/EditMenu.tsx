import { Button, DropdownMenu } from "@radix-ui/themes";
import { Toolbar } from "radix-ui";
import type { CSSProperties } from "react";
import { Trans, useTranslation } from "react-i18next";
import { formatKeyBindings } from "$/utils/keybindings";
import { useTopMenuActions } from "../useTopMenuActions";

type EditMenuProps = {
	variant: "toolbar" | "submenu";
	triggerStyle?: CSSProperties;
	buttonStyle?: CSSProperties;
};

const EditMenuItems = () => {
	const { t } = useTranslation();
	const menu = useTopMenuActions();

	const getShortcut = (key: string[] | undefined) =>
		key ? formatKeyBindings(key) : undefined;

	return (
		<>
			<DropdownMenu.Item
				onSelect={menu.onUndo}
				shortcut={getShortcut(menu.undoKey)}
			>
				<Trans i18nKey="topBar.menu.undo">Undo</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onRedo}
				shortcut={getShortcut(menu.redoKey)}
			>
				<Trans i18nKey="topBar.menu.redo">Redo</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				onSelect={menu.onOpenFind}
				shortcut={getShortcut(menu.findKey)}
			>
				<Trans i18nKey="topBar.menu.find">Find...</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onOpenReplace}
				shortcut={getShortcut(menu.replaceKey)}
			>
				<Trans i18nKey="topBar.menu.replace">Replace...</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				onSelect={menu.onSelectAll}
				shortcut={getShortcut(menu.selectAllLinesKey)}
			>
				<Trans i18nKey="topBar.menu.selectAllLines">Select all lines</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onUnselectAll}
				shortcut={getShortcut(menu.selectAllLinesKey)}
			>
				<Trans i18nKey="topBar.menu.unselectAllLines">Deselect all lines</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onSelectInverted}>
				<Trans i18nKey="topBar.menu.invertSelectAllLines">
					Invert line selections
				</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onSelectWordsOfMatchedSelection}
				shortcut={getShortcut(menu.selectWordsOfMatchedSelectionKey)}
			>
				<Trans i18nKey="topBar.menu.selectWordsOfMatchedSelection">
					Select words matching selection
				</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onDeleteSelection}>
				<Trans i18nKey="contextMenu.deleteWords">Delete Selected Words</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onOpenTimeShift}>
				{t("topBar.menu.timeShift", "Time Shift...")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenTimeStretch}>
				{t("topBar.menu.timeStretch", "Time Stretch...")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenMetadataEditor}>
				<Trans i18nKey="topBar.menu.editMetadata">Edit lyrics metadata…</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onOpenSettings}>
				<Trans i18nKey="settingsDialog.title">Settings</Trans>
			</DropdownMenu.Item>
		</>
	);
};

export const EditMenu = (props: EditMenuProps) => {
	if (props.variant === "submenu") {
		return (
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<Trans i18nKey="topBar.menu.edit">Edit</Trans>
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<EditMenuItems />
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		);
	}

	return (
		<DropdownMenu.Root>
			<Toolbar.Button asChild>
				<DropdownMenu.Trigger style={props.triggerStyle}>
					<Button
						variant="ghost"
						className="topMenuBarButton"
						style={props.buttonStyle}
					>
						<Trans i18nKey="topBar.menu.edit">Edit</Trans>
					</Button>
				</DropdownMenu.Trigger>
			</Toolbar.Button>
			<DropdownMenu.Content>
				<EditMenuItems />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
