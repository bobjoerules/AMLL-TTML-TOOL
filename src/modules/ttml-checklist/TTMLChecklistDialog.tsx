import {
	Add16Regular,
	ArrowDownload16Regular,
	CheckmarkCircle16Filled,
	Circle16Regular,
	Delete16Regular,
	Dismiss16Regular,
	Edit16Regular,
	Image16Regular,
	MusicNote2Filled,
	Search16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Dialog,
	Flex,
	IconButton,
	Progress,
	ScrollArea,
	SegmentedControl,
	Text,
	TextArea,
	TextField,
	Tooltip,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { audioCoverArtAtom } from "$/modules/audio/states";
import { customBackgroundImageAtom } from "$/modules/settings/modals/customBackground";
import { ttmlChecklistDialogAtom } from "$/states/dialogs.ts";
import { lyricLinesAtom, projectIdentityAtom } from "$/states/main.ts";
import {
	addChecklistEntry,
	deleteChecklistEntry,
	normalizeChecklistEntries,
	setChecklistEntryCompleted,
	type TTMLChecklistEntry,
	type TTMLChecklistEntryInput,
	updateChecklistEntry,
} from "./logic";
import { ttmlChecklistAtom } from "./states";

type EntryFormProps = {
	initial?: TTMLChecklistEntry;
	onCancel?: () => void;
	onSubmit: (input: TTMLChecklistEntryInput) => void;
};

const EntryForm = ({ initial, onCancel, onSubmit }: EntryFormProps) => {
	const { t } = useTranslation();
	const [song, setSong] = useState(initial?.song ?? "");
	const [artist, setArtist] = useState(initial?.artist ?? "");
	const [album, setAlbum] = useState(initial?.album ?? "");
	const [coverArt, setCoverArt] = useState(initial?.coverArt ?? "");
	const [notes, setNotes] = useState(initial?.notes ?? "");

	const projectIdentity = useAtomValue(projectIdentityAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const audioCoverArt = useAtomValue(audioCoverArtAtom);
	const customBg = useAtomValue(customBackgroundImageAtom);

	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleImportCurrent = () => {
		const metaAlbum = lyricLines.metadata.find(
			(m) => m.key.toLowerCase() === "album",
		)?.value[0];

		if (projectIdentity.name && !projectIdentity.isUntitled) {
			setSong(projectIdentity.name);
		}
		if (projectIdentity.artist) {
			setArtist(projectIdentity.artist);
		}
		if (metaAlbum) {
			setAlbum(metaAlbum);
		}
		const currentCover = audioCoverArt || customBg;
		if (currentCover) {
			setCoverArt(currentCover);
		}
	};

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (loadEvt) => {
			if (typeof loadEvt.target?.result === "string") {
				setCoverArt(loadEvt.target.result);
			}
		};
		reader.readAsDataURL(file);
	};

	const valid = song.trim().length > 0;

	return (
		<Card variant="surface" style={{ padding: "16px", marginBottom: "12px" }}>
			<Flex direction="column" gap="3" asChild>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						if (valid) {
							onSubmit({ song, artist, album, coverArt, notes });
						}
					}}
				>
					<Flex justify="between" align="center">
						<Text size="2" weight="bold">
							{initial
								? t("ttmlChecklist.edit", "Edit checklist item")
								: t("ttmlChecklist.newItem", "New Song")}
						</Text>
						<Button
							type="button"
							size="1"
							variant="soft"
							color="cyan"
							onClick={handleImportCurrent}
						>
							<ArrowDownload16Regular />
							{t("ttmlChecklist.importCurrent", "Import from Current Project")}
						</Button>
					</Flex>

					<Flex gap="3" align="start">
						{/* Cover Art Preview & Upload */}
						<Flex direction="column" align="center" gap="1">
							<Box
								style={{
									width: "74px",
									height: "74px",
									borderRadius: "8px",
									overflow: "hidden",
									backgroundColor: "var(--gray-a3)",
									border: "1px solid var(--gray-a5)",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									position: "relative",
									flexShrink: 0,
								}}
							>
								{coverArt ? (
									<img
										src={coverArt}
										alt="Cover"
										style={{
											width: "100%",
											height: "100%",
											objectFit: "cover",
										}}
									/>
								) : (
									<MusicNote2Filled
										style={{
											width: "28px",
											height: "28px",
											color: "var(--gray-8)",
										}}
									/>
								)}
							</Box>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								style={{ display: "none" }}
								onChange={handleFileUpload}
							/>
							<Flex gap="1">
								<Button
									type="button"
									size="1"
									variant="ghost"
									color="gray"
									onClick={() => fileInputRef.current?.click()}
								>
									<Image16Regular />
									{coverArt
										? t("common.replace", "Change")
										: t("ttmlChecklist.uploadCover", "Upload")}
								</Button>
								{coverArt && (
									<Button
										type="button"
										size="1"
										variant="ghost"
										color="red"
										onClick={() => setCoverArt("")}
									>
										<Dismiss16Regular />
									</Button>
								)}
							</Flex>
						</Flex>

						{/* Form inputs */}
						<Flex direction="column" gap="2" style={{ flex: 1, minWidth: 0 }}>
							<TextField.Root
								placeholder={t("ttmlChecklist.songPlaceholder", "Song title *")}
								value={song}
								onChange={(event) => setSong(event.currentTarget.value)}
								autoFocus
							/>
							<Flex gap="2">
								<Box style={{ flex: 1 }}>
									<TextField.Root
										placeholder={t(
											"ttmlChecklist.artistPlaceholder",
											"Artist (optional)",
										)}
										value={artist}
										onChange={(event) => setArtist(event.currentTarget.value)}
									/>
								</Box>
								<Box style={{ flex: 1 }}>
									<TextField.Root
										placeholder={t(
											"ttmlChecklist.albumPlaceholder",
											"Album (optional)",
										)}
										value={album}
										onChange={(event) => setAlbum(event.currentTarget.value)}
									/>
								</Box>
							</Flex>
							<TextField.Root
								placeholder={t(
									"ttmlChecklist.coverArtPlaceholder",
									"Cover art image URL (optional)",
								)}
								value={coverArt}
								onChange={(event) => setCoverArt(event.currentTarget.value)}
							/>
						</Flex>
					</Flex>

					<TextArea
						placeholder={t(
							"ttmlChecklist.notesPlaceholder",
							"Notes, checklist tasks, version, or timing idea (optional)",
						)}
						value={notes}
						onChange={(event) => setNotes(event.currentTarget.value)}
						rows={2}
					/>

					<Flex justify="end" gap="2">
						{onCancel && (
							<Button
								type="button"
								variant="soft"
								color="gray"
								onClick={onCancel}
							>
								{t("ttmlChecklist.cancel", "Cancel")}
							</Button>
						)}
						<Button type="submit" disabled={!valid}>
							{t(
								initial ? "ttmlChecklist.save" : "ttmlChecklist.add",
								initial ? "Save" : "Add to checklist",
							)}
						</Button>
					</Flex>
				</form>
			</Flex>
		</Card>
	);
};

type ChecklistEntryCardProps = {
	entry: TTMLChecklistEntry;
	onComplete: (completed: boolean) => void;
	onDelete: () => void;
	onEdit: (input: TTMLChecklistEntryInput) => void;
};

const ChecklistEntryCard = ({
	entry,
	onComplete,
	onDelete,
	onEdit,
}: ChecklistEntryCardProps) => {
	const { t } = useTranslation();
	const [editing, setEditing] = useState(false);

	if (editing) {
		return (
			<EntryForm
				initial={entry}
				onCancel={() => setEditing(false)}
				onSubmit={(input) => {
					onEdit(input);
					setEditing(false);
				}}
			/>
		);
	}

	return (
		<Card
			variant="surface"
			style={{
				width: "100%",
				padding: "12px",
				border: "1px solid var(--gray-a4)",
				borderRadius: "var(--radius-3)",
				backgroundColor: entry.completed ? "var(--gray-a2)" : "var(--color-surface)",
				transition: "all 0.15s ease",
			}}
		>
			<Flex gap="3" align="center">
				{/* Song Cover Art */}
				<Box
					style={{
						width: "52px",
						height: "52px",
						borderRadius: "8px",
						overflow: "hidden",
						backgroundColor: "var(--gray-a4)",
						border: "1px solid var(--gray-a5)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						flexShrink: 0,
					}}
				>
					{entry.coverArt ? (
						<img
							src={entry.coverArt}
							alt={entry.song}
							style={{
								width: "100%",
								height: "100%",
								objectFit: "cover",
								filter: entry.completed ? "grayscale(80%) opacity(70%)" : "none",
							}}
						/>
					) : (
						<MusicNote2Filled
							style={{
								width: "22px",
								height: "22px",
								color: entry.completed ? "var(--gray-7)" : "var(--accent-9)",
							}}
						/>
					)}
				</Box>

				{/* Song & Meta Info */}
				<Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
					<Flex align="center" gap="2" wrap="wrap">
						<Text
							weight="bold"
							size="3"
							style={{
								textDecoration: entry.completed ? "line-through" : undefined,
								color: entry.completed ? "var(--gray-10)" : "inherit",
							}}
						>
							{entry.song}
						</Text>
						{entry.completed && (
							<Badge size="1" color="green" variant="soft">
								{t("ttmlChecklist.completed", "Completed")}
							</Badge>
						)}
					</Flex>

					<Flex align="center" gap="2" wrap="wrap">
						{entry.artist && (
							<Text size="2" color="gray">
								{entry.artist}
							</Text>
						)}
						{entry.artist && entry.album && (
							<Text size="1" color="gray">
								•
							</Text>
						)}
						{entry.album && (
							<Badge size="1" color="gray" variant="surface">
								{entry.album}
							</Badge>
						)}
					</Flex>

					{entry.notes && (
						<details style={{ marginTop: "4px" }}>
							<summary
								style={{
									fontSize: "12px",
									color: "var(--gray-10)",
									cursor: "pointer",
								}}
							>
								{t("ttmlChecklist.showNotes", "Show notes")}
							</summary>
							<Text
								size="2"
								as="div"
								mt="1"
								style={{
									whiteSpace: "pre-wrap",
									color: "var(--gray-11)",
									backgroundColor: "var(--gray-a3)",
									padding: "6px 8px",
									borderRadius: "4px",
								}}
							>
								{entry.notes}
							</Text>
						</details>
					)}
				</Flex>

				{/* Action Buttons */}
				<Flex gap="1" align="center">
					<Tooltip
						content={
							entry.completed
								? t("ttmlChecklist.reopen", "Reopen")
								: t("ttmlChecklist.markDone", "Done")
						}
					>
						<Button
							size="2"
							variant={entry.completed ? "soft" : "solid"}
							color={entry.completed ? "gray" : "green"}
							onClick={() => onComplete(!entry.completed)}
							style={{ height: "32px" }}
						>
							{entry.completed ? (
								<Circle16Regular />
							) : (
								<CheckmarkCircle16Filled />
							)}
							{entry.completed
								? t("ttmlChecklist.reopen", "Reopen")
								: t("ttmlChecklist.markDone", "Done")}
						</Button>
					</Tooltip>
					<Tooltip content={t("ttmlChecklist.edit", "Edit checklist item")}>
						<IconButton
							variant="soft"
							color="gray"
							onClick={() => setEditing(true)}
							aria-label={t("ttmlChecklist.edit", "Edit checklist item")}
						>
							<Edit16Regular />
						</IconButton>
					</Tooltip>
					<Tooltip content={t("ttmlChecklist.delete", "Delete checklist item")}>
						<IconButton
							variant="soft"
							color="red"
							onClick={onDelete}
							aria-label={t("ttmlChecklist.delete", "Delete checklist item")}
						>
							<Delete16Regular />
						</IconButton>
					</Tooltip>
				</Flex>
			</Flex>
		</Card>
	);
};

export const TTMLChecklistDialog = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(ttmlChecklistDialogAtom);
	const [storedEntries, setStoredEntries] = useAtom(ttmlChecklistAtom);
	const [showAddForm, setShowAddForm] = useState(false);
	const [filterTab, setFilterTab] = useState<"all" | "pending" | "completed">("all");
	const [searchQuery, setSearchQuery] = useState("");

	const entries = useMemo(
		() => normalizeChecklistEntries(storedEntries),
		[storedEntries],
	);

	const totalCount = entries.length;
	const completedCount = entries.filter((e) => e.completed).length;
	const pendingCount = totalCount - completedCount;
	const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

	const filteredEntries = useMemo(() => {
		let result = entries;
		if (filterTab === "pending") {
			result = result.filter((e) => !e.completed);
		} else if (filterTab === "completed") {
			result = result.filter((e) => e.completed);
		}

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			result = result.filter(
				(e) =>
					e.song.toLowerCase().includes(q) ||
					e.artist.toLowerCase().includes(q) ||
					(e.album && e.album.toLowerCase().includes(q)) ||
					e.notes.toLowerCase().includes(q),
			);
		}
		return result;
	}, [entries, filterTab, searchQuery]);

	const save = (nextEntries: TTMLChecklistEntry[]) => {
		setStoredEntries(nextEntries);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content style={{ maxWidth: 660, maxHeight: "85vh" }}>
				<Dialog.Title>
					<Flex justify="between" align="center">
						<Text size="5" weight="bold">
							{t("ttmlChecklist.title", "TTML Checklist")}
						</Text>
						<Button
							size="2"
							variant={showAddForm ? "soft" : "solid"}
							color={showAddForm ? "gray" : "accent"}
							onClick={() => setShowAddForm((prev) => !prev)}
						>
							{showAddForm ? (
								<Dismiss16Regular />
							) : (
								<Add16Regular />
							)}
							{showAddForm
								? t("ttmlChecklist.cancel", "Cancel")
								: t("ttmlChecklist.newItem", "New Song")}
						</Button>
					</Flex>
				</Dialog.Title>

				<Dialog.Description size="2" color="gray" mb="3">
					{t(
						"ttmlChecklist.description",
						"Keep track of songs, cover art, and ideas you want to sync.",
					)}
				</Dialog.Description>

				{/* Progress summary banner */}
				{totalCount > 0 && (
					<Box
						mb="3"
						p="3"
						style={{
							backgroundColor: "var(--gray-a3)",
							borderRadius: "var(--radius-3)",
							border: "1px solid var(--gray-a4)",
						}}
					>
						<Flex justify="between" align="center" mb="2">
							<Flex gap="3" align="center">
								<Text size="2" weight="medium">
									{completedCount} / {totalCount} {t("ttmlChecklist.completed", "Completed")}
								</Text>
								<Badge size="1" color={progressPercent === 100 ? "green" : "blue"}>
									{progressPercent}%
								</Badge>
							</Flex>
							<Text size="1" color="gray">
								{pendingCount} {t("ttmlChecklist.pending", "In Progress")}
							</Text>
						</Flex>
						<Progress value={progressPercent} color="accent" size="2" />
					</Box>
				)}

				{/* Collapsible New Entry Form */}
				{showAddForm && (
					<EntryForm
						onCancel={() => setShowAddForm(false)}
						onSubmit={(input) => {
							save(addChecklistEntry(entries, input));
							setShowAddForm(false);
						}}
					/>
				)}

				{/* Search & Filter Controls */}
				<Flex gap="2" mb="3" align="center">
					<Box style={{ flex: 1 }}>
						<TextField.Root
							placeholder={t(
								"ttmlChecklist.searchPlaceholder",
								"Search songs, artists, albums, or notes...",
							)}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.currentTarget.value)}
						>
							<TextField.Slot>
								<Search16Regular />
							</TextField.Slot>
							{searchQuery && (
								<TextField.Slot>
									<IconButton
										size="1"
										variant="ghost"
										color="gray"
										onClick={() => setSearchQuery("")}
									>
										<Dismiss16Regular />
									</IconButton>
								</TextField.Slot>
							)}
						</TextField.Root>
					</Box>

					<SegmentedControl.Root
						value={filterTab}
						onValueChange={(val) =>
							setFilterTab(val as "all" | "pending" | "completed")
						}
					>
						<SegmentedControl.Item value="all">
							{t("ttmlChecklist.all", "All")} ({totalCount})
						</SegmentedControl.Item>
						<SegmentedControl.Item value="pending">
							{t("ttmlChecklist.pending", "In Progress")} ({pendingCount})
						</SegmentedControl.Item>
						<SegmentedControl.Item value="completed">
							{t("ttmlChecklist.completed", "Completed")} ({completedCount})
						</SegmentedControl.Item>
					</SegmentedControl.Root>
				</Flex>

				{/* Items List */}
				<ScrollArea
					type="auto"
					scrollbars="vertical"
					style={{ maxHeight: "45vh" }}
				>
					<Flex direction="column" gap="2" pr="2">
						{filteredEntries.length === 0 ? (
							<Box py="6" style={{ textAlign: "center" }}>
								<Text color="gray">
									{searchQuery || filterTab !== "all"
										? t(
												"ttmlChecklist.noMatch",
												"No checklist items match your search or filter.",
											)
										: t(
												"ttmlChecklist.empty",
												"No items yet. Add a song or import from the current project!",
											)}
								</Text>
							</Box>
						) : (
							filteredEntries.map((entry) => (
								<ChecklistEntryCard
									key={entry.id}
									entry={entry}
									onComplete={(completed) =>
										save(
											setChecklistEntryCompleted(entries, entry.id, completed),
										)
									}
									onDelete={() => save(deleteChecklistEntry(entries, entry.id))}
									onEdit={(input) =>
										save(updateChecklistEntry(entries, entry.id, input))
									}
								/>
							))
						)}
					</Flex>
				</ScrollArea>
			</Dialog.Content>
		</Dialog.Root>
	);
};

export default TTMLChecklistDialog;
