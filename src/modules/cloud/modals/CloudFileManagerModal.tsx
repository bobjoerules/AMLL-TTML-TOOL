import {
	Badge,
	Box,
	Button,
	Card,
	Dialog,
	Flex,
	IconButton,
	ScrollArea,
	Select,
	Spinner,
	Switch,
	Text,
	TextField,
	Tooltip,
} from "@radix-ui/themes";
import {
	ArrowClockwise16Regular,
	Checkmark16Filled,
	Checkmark16Regular,
	ChevronDown16Regular,
	ChevronUp16Regular,
	Cloud24Filled,
	Cloud24Regular,
	DataUsage20Regular,
	Delete16Regular,
	Dismiss16Regular,
	DocumentArrowDown16Regular,
	Folder16Regular,
	Globe16Regular,
	History16Regular,
	List16Regular,
	MusicNote2Filled,
	Person16Regular,
	Play16Regular,
	Save16Regular,
	Search16Regular,
} from "@fluentui/react-icons";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { type FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useFileOpener } from "$/hooks/useFileOpener";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import { openExternal } from "$/utils/openExternal";
import { isTTML100PercentCompleted } from "$/modules/ttml-checklist/logic";
import {
	areCloudTTMLsSameSong,
	groupCloudTTMLs,
	type SongGroup,
} from "../songGrouping";
import {
	allowConsecutiveBackgroundLinesAtom,
	lyricTextNormalizationOptionsAtom,
} from "$/modules/settings/states";
import { openAccountSettingsAtom } from "$/states/dialogs";
import { lyricLinesAtom, saveFileNameAtom } from "$/states/main";
import {
	cloudFileManagerInitialTabAtom,
	cloudFileManagerOpenAtom,
	cloudTTMLListAtom,
	cloudTTMLLoadingAtom,
	currentUserAtom,
} from "../states";
import {
	deleteTTMLFromCloud,
	fetchUserTTMLList,
	loadTTMLFromCloud,
	saveTTMLToCloud,
	updateTTMLFinishedInCloud,
} from "../ttmlStorage";
import type { CloudTTMLMetadata } from "../types";

const formatDuration = (ms: number): string => {
	if (!ms || ms <= 0) return "--:--";
	const totalSecs = Math.floor(ms / 1000);
	const mins = Math.floor(totalSecs / 60);
	const secs = totalSecs % 60;
	return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatDate = (timestamp: number): string => {
	if (!timestamp) return "";
	return new Date(timestamp).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
};

export type { SongGroup };

const SongGroupItem: FC<{
	group: SongGroup;
	loadingDocId: string | null;
	deletingDocId: string | null;
	togglingDocId: string | null;
	handleOpenItem: (item: CloudTTMLMetadata) => Promise<void>;
	handleDownloadRawTTML: (item: CloudTTMLMetadata) => Promise<void>;
	handleDeleteItem: (item: CloudTTMLMetadata) => Promise<void>;
	handleToggleFinished: (item: CloudTTMLMetadata) => Promise<void>;
}> = ({
	group,
	loadingDocId,
	deletingDocId,
	togglingDocId,
	handleOpenItem,
	handleDownloadRawTTML,
	handleDeleteItem,
	handleToggleFinished,
}) => {
	const { t } = useTranslation();
	const [selectedVersionId, setSelectedVersionId] = useState<string>(
		group.versions[0]?.id || "",
	);
	const [isExpanded, setIsExpanded] = useState<boolean>(false);

	const activeVersion = useMemo(() => {
		return (
			group.versions.find((v) => v.id === selectedVersionId) ||
			group.versions[0]
		);
	}, [group.versions, selectedVersionId]);

	if (!activeVersion) return null;

	const hasMultipleVersions = group.versions.length > 1;

	return (
		<Card
			variant="surface"
			style={{
				width: "100%",
				boxSizing: "border-box",
				padding: "10px 14px",
				border: "1px solid var(--gray-a4)",
				borderRadius: "12px",
				backgroundColor: "var(--color-surface)",
				transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
			}}
		>
			<Flex direction="column" gap="2">
				<Flex gap="3" align="center" style={{ width: "100%", minWidth: 0 }}>
					{/* Cover Art / Icon */}
					<Box
						style={{
							width: "48px",
							height: "48px",
							minWidth: "48px",
							borderRadius: "10px",
							overflow: "hidden",
							backgroundColor: "var(--gray-a4)",
							border: "1px solid var(--gray-a5)",
							boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							flexShrink: 0,
						}}
					>
						{activeVersion.coverArt || group.coverArt ? (
							<img
								src={activeVersion.coverArt || group.coverArt!}
								alt={group.title}
								loading="lazy"
								style={{
									width: "100%",
									height: "100%",
									objectFit: "cover",
								}}
							/>
						) : (
							<MusicNote2Filled
								style={{
									width: 24,
									height: 24,
									color: "var(--accent-9)",
								}}
							/>
						)}
					</Box>

					{/* Song Info */}
					<Flex
						direction="column"
						gap="1"
						style={{ flex: 1, minWidth: 0 }}
					>
						{/* Title, Version Dropdown & Badges */}
						<Flex
							align="center"
							gap="2"
							wrap="wrap"
							style={{ minWidth: 0, width: "100%" }}
						>
							<Text
								weight="bold"
								size="3"
								title={activeVersion.title || group.title}
								style={{
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
									minWidth: 0,
									flexShrink: 1,
								}}
							>
								{activeVersion.title || group.title}
							</Text>

							{/* Multiple versions dropdown selector */}
							{hasMultipleVersions && (
								<Flex align="center" gap="1" style={{ flexShrink: 0 }}>
									<Select.Root
										value={activeVersion.id}
										onValueChange={(val) => setSelectedVersionId(val)}
										size="1"
									>
										<Select.Trigger
											style={{
												borderRadius: "6px",
												fontWeight: 600,
												fontSize: "12px",
												height: "22px",
												padding: "0 8px",
											}}
										/>
										<Select.Content>
											{group.versions.map((ver, idx) => (
												<Select.Item key={ver.id} value={ver.id}>
													v{group.versions.length - idx}
													{idx === 0 ? " (Latest)" : ""} • {formatDate(ver.updatedAt || ver.createdAt)}
												</Select.Item>
											))}
										</Select.Content>
									</Select.Root>
									<Tooltip
										content={
											isExpanded
												? t("cloud.collapseVersions", "Collapse versions list")
												: t("cloud.expandVersions", "Expand versions list")
										}
									>
										<IconButton
											size="1"
											variant="ghost"
											color="gray"
											onClick={() => setIsExpanded(!isExpanded)}
											style={{
												cursor: "pointer",
												height: "22px",
												width: "22px",
											}}
											aria-label="Toggle version list"
										>
											{isExpanded ? (
												<ChevronUp16Regular />
											) : (
												<ChevronDown16Regular />
											)}
										</IconButton>
									</Tooltip>
								</Flex>
							)}

							{activeVersion.publishedToCommunity ? (
								<Badge
									size="1"
									color="green"
									variant="surface"
									style={{ fontWeight: 600, flexShrink: 0 }}
								>
									{t("cloud.publicBadge", "Public")}
								</Badge>
							) : (
								<Flex align="center" gap="1" style={{ flexShrink: 0 }}>
									<Badge
										size="1"
										color="gray"
										variant="surface"
										style={{ flexShrink: 0 }}
									>
										{t("cloud.privateBadge", "Private")}
									</Badge>
									{activeVersion.finished && (
										<Badge
											size="1"
											color="green"
											variant="surface"
											style={{ fontWeight: 600, flexShrink: 0 }}
										>
											{t("cloud.completedBadge", "Completed")}
										</Badge>
									)}
								</Flex>
							)}
							{activeVersion.durationMs > 0 && (
								<Badge
									size="1"
									color="gray"
									variant="surface"
									style={{ flexShrink: 0 }}
								>
									{formatDuration(activeVersion.durationMs)}
								</Badge>
							)}
						</Flex>

						{/* Artist & Album */}
						<Flex
							align="center"
							gap="2"
							style={{ minWidth: 0, width: "100%" }}
						>
							<Text
								size="2"
								color="gray"
								title={activeVersion.artist || group.artist}
								style={{
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
									minWidth: 0,
									flexShrink: 1,
								}}
							>
								{activeVersion.artist ||
									group.artist ||
									t("cloud.unknownArtist", "Unknown Artist")}
							</Text>
							{Boolean(activeVersion.album || group.album) && (
								<>
									<Text
										size="1"
										color="gray"
										style={{ flexShrink: 0 }}
									>
										•
									</Text>
									<Badge
										size="1"
										color="gray"
										variant="surface"
										title={activeVersion.album || group.album}
										style={{
											maxWidth: "200px",
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
											flexShrink: 1,
										}}
									>
										{activeVersion.album || group.album}
									</Badge>
								</>
							)}
						</Flex>

						{/* Timestamp */}
						<Text size="1" color="gray">
							{t("cloud.updated", "Updated")}{" "}
							{formatDate(activeVersion.updatedAt || activeVersion.createdAt)}
						</Text>
					</Flex>

					{/* Actions for Active Version */}
					<Flex
						gap="2"
						align="center"
						style={{ flexShrink: 0, marginLeft: "auto" }}
					>
						{/* Open in Editor */}
						<Button
							size="2"
							variant="solid"
							disabled={
								loadingDocId === activeVersion.id ||
								deletingDocId === activeVersion.id
							}
							onClick={() => handleOpenItem(activeVersion)}
							style={{
								borderRadius: "8px",
								cursor: "pointer",
							}}
						>
							{loadingDocId === activeVersion.id ? (
								<Spinner size="1" />
							) : (
								<>
									<Play16Regular />
									{t("cloud.openInEditor", "Open")}
								</>
							)}
						</Button>

						{/* Download Raw TTML */}
						<Tooltip
							content={t(
								"cloud.downloadTTML",
								"Download .ttml file",
							)}
						>
							<IconButton
								size="2"
								variant="surface"
								color="gray"
								disabled={
									loadingDocId === activeVersion.id ||
									deletingDocId === activeVersion.id
								}
								onClick={() => handleDownloadRawTTML(activeVersion)}
								aria-label={t(
									"cloud.downloadTTML",
									"Download .ttml file",
								)}
								style={{
									borderRadius: "8px",
									cursor: "pointer",
									flexShrink: 0,
								}}
							>
								<DocumentArrowDown16Regular />
							</IconButton>
						</Tooltip>

						{/* Toggle Completed */}
						{!activeVersion.publishedToCommunity && (
							<Tooltip
								content={
									activeVersion.finished
										? t("cloud.markInProgressTooltip", "Mark as in-progress")
										: t("cloud.markCompletedTooltip", "Mark as completed")
								}
							>
								<IconButton
									size="2"
									variant={activeVersion.finished ? "solid" : "surface"}
									color={activeVersion.finished ? "green" : "gray"}
									disabled={
										loadingDocId === activeVersion.id ||
										deletingDocId === activeVersion.id ||
										togglingDocId === activeVersion.id
									}
									onClick={() => handleToggleFinished(activeVersion)}
									aria-label={
										activeVersion.finished
											? t("cloud.markInProgressTooltip", "Mark as in-progress")
											: t("cloud.markCompletedTooltip", "Mark as completed")
									}
									style={{
										borderRadius: "8px",
										cursor: "pointer",
										flexShrink: 0,
									}}
								>
									{togglingDocId === activeVersion.id ? (
										<Spinner size="1" />
									) : activeVersion.finished ? (
										<Checkmark16Filled />
									) : (
										<Checkmark16Regular />
									)}
								</IconButton>
							</Tooltip>
						)}

						{/* Delete */}
						<Tooltip
							content={t(
								"cloud.deleteTooltip",
								"Delete from Cloud",
							)}
						>
							<IconButton
								size="2"
								variant="soft"
								color="red"
								disabled={
									loadingDocId === activeVersion.id ||
									deletingDocId === activeVersion.id
								}
								onClick={() => handleDeleteItem(activeVersion)}
								aria-label={t("cloud.delete", "Delete")}
								style={{
									borderRadius: "8px",
									cursor: "pointer",
									flexShrink: 0,
								}}
							>
								{deletingDocId === activeVersion.id ? (
									<Spinner size="1" />
								) : (
									<Delete16Regular />
								)}
							</IconButton>
						</Tooltip>
					</Flex>
				</Flex>

				{/* Expanded Versions Dropdown List */}
				{hasMultipleVersions && isExpanded && (
					<Flex
						direction="column"
						gap="2"
						style={{
							marginTop: "8px",
							paddingTop: "8px",
							borderTop: "1px solid var(--gray-a4)",
							paddingLeft: "12px",
						}}
					>
						<Text size="1" color="gray" weight="bold">
							{t("cloud.savedVersions", "All Saved Versions")} ({group.versions.length})
						</Text>
						{group.versions.map((ver, vIdx) => {
							const isSelected = ver.id === activeVersion.id;
							return (
								<Flex
									key={ver.id}
									align="center"
									justify="between"
									gap="2"
									style={{
										padding: "6px 10px",
										borderRadius: "8px",
										backgroundColor: isSelected
											? "var(--accent-a3)"
											: "var(--gray-a2)",
										border: isSelected
											? "1px solid var(--accent-a6)"
											: "1px solid var(--gray-a3)",
									}}
								>
									<Flex align="center" gap="2" wrap="wrap" style={{ minWidth: 0, flex: 1 }}>
										<Text size="1" weight="bold">
											v{group.versions.length - vIdx}
											{vIdx === 0 && (
												<Text color="accent" size="1" style={{ marginLeft: "4px" }}>
													({t("cloud.latest", "Latest")})
												</Text>
											)}
										</Text>
										{Boolean(ver.artist && ver.artist !== group.artist) && (
											<Text size="1" color="gray" style={{ fontStyle: "italic" }}>
												• {ver.artist}
											</Text>
										)}
										{ver.publishedToCommunity ? (
											<Badge size="1" color="green" variant="surface">
												{t("cloud.publicBadge", "Public")}
											</Badge>
										) : (
											<Flex align="center" gap="1" style={{ flexShrink: 0 }}>
												<Badge size="1" color="gray" variant="surface">
													{t("cloud.privateBadge", "Private")}
												</Badge>
												{ver.finished && (
													<Badge
														size="1"
														color="green"
														variant="surface"
														style={{ fontWeight: 600 }}
													>
														{t("cloud.completedBadge", "Completed")}
													</Badge>
												)}
											</Flex>
										)}
										{ver.durationMs > 0 && (
											<Badge size="1" color="gray" variant="surface">
												{formatDuration(ver.durationMs)}
											</Badge>
										)}
										<Text size="1" color="gray">
											{formatDate(ver.updatedAt || ver.createdAt)}
										</Text>
									</Flex>

									<Flex gap="1" align="center" style={{ flexShrink: 0 }}>
										<Button
											size="1"
											variant={isSelected ? "solid" : "soft"}
											disabled={
												loadingDocId === ver.id ||
												deletingDocId === ver.id
											}
											onClick={() => handleOpenItem(ver)}
											style={{ borderRadius: "6px", cursor: "pointer" }}
										>
											{loadingDocId === ver.id ? (
												<Spinner size="1" />
											) : (
												<>
													<Play16Regular />
													{t("cloud.openInEditor", "Open")}
												</>
											)}
										</Button>
										<Tooltip content={t("cloud.downloadTTML", "Download .ttml file")}>
											<IconButton
												size="1"
												variant="surface"
												color="gray"
												disabled={
													loadingDocId === ver.id ||
													deletingDocId === ver.id
												}
												onClick={() => handleDownloadRawTTML(ver)}
												style={{ borderRadius: "6px", cursor: "pointer" }}
											>
												<DocumentArrowDown16Regular />
											</IconButton>
										</Tooltip>
										{!ver.publishedToCommunity && (
											<Tooltip
												content={
													ver.finished
														? t("cloud.markInProgressTooltip", "Mark as in-progress")
														: t("cloud.markCompletedTooltip", "Mark as completed")
												}
											>
												<IconButton
													size="1"
													variant={ver.finished ? "solid" : "surface"}
													color={ver.finished ? "green" : "gray"}
													disabled={
														loadingDocId === ver.id ||
														deletingDocId === ver.id ||
														togglingDocId === ver.id
													}
													onClick={() => handleToggleFinished(ver)}
													aria-label={
														ver.finished
															? t("cloud.markInProgressTooltip", "Mark as in-progress")
															: t("cloud.markCompletedTooltip", "Mark as completed")
													}
													style={{ borderRadius: "6px", cursor: "pointer" }}
												>
													{togglingDocId === ver.id ? (
														<Spinner size="1" />
													) : ver.finished ? (
														<Checkmark16Filled />
													) : (
														<Checkmark16Regular />
													)}
												</IconButton>
											</Tooltip>
										)}
										<Tooltip content={t("cloud.deleteTooltip", "Delete from Cloud")}>
											<IconButton
												size="1"
												variant="soft"
												color="red"
												disabled={
													loadingDocId === ver.id ||
													deletingDocId === ver.id
												}
												onClick={() => handleDeleteItem(ver)}
												style={{ borderRadius: "6px", cursor: "pointer" }}
											>
												{deletingDocId === ver.id ? (
													<Spinner size="1" />
												) : (
													<Delete16Regular />
												)}
											</IconButton>
										</Tooltip>
									</Flex>
								</Flex>
							);
						})}
					</Flex>
				)}
			</Flex>
		</Card>
	);
};

export const CloudFileManagerModal: FC = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(cloudFileManagerOpenAtom);
	const initialTab = useAtomValue(cloudFileManagerInitialTabAtom);
	const [activeTab, setActiveTab] = useState<"open" | "save">("open");
	const [filterTab, setFilterTab] = useState<"all" | "public" | "private">(
		"all",
	);
	const [sortBy, setSortBy] = useState<
		"recent" | "title-asc" | "title-desc" | "artist-asc" | "lines-desc"
	>("recent");

	const user = useAtomValue(currentUserAtom);
	const openAccountSettings = useSetAtom(openAccountSettingsAtom);

	const lyricLines = useAtomValue(lyricLinesAtom);
	const saveFileName = useAtomValue(saveFileNameAtom);
	const normalizationOptions = useAtomValue(lyricTextNormalizationOptionsAtom);
	const allowConsecutiveBackgroundLines = useAtomValue(
		allowConsecutiveBackgroundLinesAtom,
	);
	const { openFile } = useFileOpener();

	const [cloudList, setCloudList] = useAtom(cloudTTMLListAtom);
	const isLoading = useAtomValue(cloudTTMLLoadingAtom);

	const [searchQuery, setSearchQuery] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [publishToCommunity, setPublishToCommunity] = useState(false);
	const [isSaveCompleted, setIsSaveCompleted] = useState(false);
	const [, setUploadProgress] = useState<number | null>(null);
	const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
	const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
	const [togglingDocId, setTogglingDocId] = useState<string | null>(null);

	// Extract track info from metadata & file name
	const currentTrackInfo = useMemo(() => {
		let title = "";
		let artist = "";
		let album = "";

		for (const meta of lyricLines.metadata) {
			const key = meta.key.toLowerCase();
			const val = meta.value.join(", ").trim();
			if (!val) continue;
			if (
				key === "musicname" ||
				key === "title" ||
				key === "track" ||
				key === "ti"
			) {
				if (!title) title = val;
			} else if (key === "artists" || key === "artist" || key === "ar") {
				if (!artist) artist = val;
			} else if (key === "album" || key === "al") {
				if (!album) album = val;
			}
		}

		if (!title || !artist) {
			const base = saveFileName.replace(/\.ttml$/i, "").trim();
			if (base && base.toLowerCase() !== "lyric") {
				if (base.includes(" - ")) {
					const parts = base.split(" - ");
					if (!artist && parts[0]?.trim()) artist = parts[0].trim();
					if (!title && parts.slice(1).join(" - ")?.trim())
						title = parts.slice(1).join(" - ").trim();
				} else if (!title) {
					title = base;
				}
			}
		}

		return {
			title: title || "Untitled",
			artist,
			album,
			lineCount: lyricLines.lyricLines.length,
			durationMs:
				lyricLines.lyricLines.length > 0
					? lyricLines.lyricLines[lyricLines.lyricLines.length - 1].endTime
					: 0,
		};
	}, [lyricLines, saveFileName]);

	const [saveTitle, setSaveTitle] = useState(currentTrackInfo.title);
	const [saveArtist, setSaveArtist] = useState(currentTrackInfo.artist);
	const [saveAlbum, setSaveAlbum] = useState(currentTrackInfo.album);

	const [overwriteLatest, setOverwriteLatest] = useState<boolean>(false);

	const isCurrentFullySynced = useMemo(() => {
		return isTTML100PercentCompleted(lyricLines);
	}, [lyricLines]);

	useEffect(() => {
		if (open) {
			setActiveTab(initialTab === "save" ? "save" : "open");
			setSaveTitle(currentTrackInfo.title);
			setSaveArtist(currentTrackInfo.artist);
			setSaveAlbum(currentTrackInfo.album);
			setPublishToCommunity(false);
			setIsSaveCompleted(isCurrentFullySynced);
			setOverwriteLatest(false);
			if (user) {
				// Instant local cache hydration if state is empty
				if (cloudList.length === 0) {
					try {
						const cached = localStorage.getItem(`amll_cloud_ttmls_${user.uid}`);
						if (cached) {
							const parsed = JSON.parse(cached);
							if (Array.isArray(parsed) && parsed.length > 0) {
								setCloudList(parsed);
							}
						}
					} catch {
						// ignore
					}
				}
				fetchUserTTMLList().catch(console.error);
			}
		}
	}, [open, initialTab, user]);

	// Group saved songs by title and artist to consolidate multiple versions
	const songGroups = useMemo(() => {
		return groupCloudTTMLs(cloudList);
	}, [cloudList]);

	// Detect if current lyric matches an existing song in cloud library
	const matchingExistingGroup = useMemo(() => {
		if (!saveTitle) return null;
		return songGroups.find((g) =>
			areCloudTTMLsSameSong(
				{
					title: saveTitle,
					artist: saveArtist,
					album: saveAlbum,
				} as CloudTTMLMetadata,
				{
					title: g.title,
					artist: g.artist,
					album: g.album,
				} as CloudTTMLMetadata,
			),
		);
	}, [songGroups, saveTitle, saveArtist, saveAlbum]);

	// Stats calculations - each unique song is only counted once
	const uniqueSongsCount = songGroups.length;
	const publicCount = useMemo(
		() => songGroups.filter((g) => g.isPublic).length,
		[songGroups],
	);
	const privateCount = uniqueSongsCount - publicCount;

	const filteredSongGroups = useMemo(() => {
		let result = [...songGroups];

		if (filterTab === "public") {
			result = result.filter((g) => g.isPublic);
		} else if (filterTab === "private") {
			result = result.filter((g) => !g.isPublic);
		}

		const q = searchQuery.toLowerCase().trim();
		if (q) {
			result = result.filter(
				(g) =>
					g.title.toLowerCase().includes(q) ||
					g.artist.toLowerCase().includes(q) ||
					g.album.toLowerCase().includes(q) ||
					g.versions.some(
						(v) =>
							(v.title && v.title.toLowerCase().includes(q)) ||
							(v.artist && v.artist.toLowerCase().includes(q)) ||
							(v.album && v.album.toLowerCase().includes(q)),
					),
			);
		}

		if (sortBy === "title-asc") {
			result.sort((a, b) => a.title.localeCompare(b.title));
		} else if (sortBy === "title-desc") {
			result.sort((a, b) => b.title.localeCompare(a.title));
		} else if (sortBy === "artist-asc") {
			result.sort(
				(a, b) =>
					(a.artist || "zzz").localeCompare(b.artist || "zzz") ||
					a.title.localeCompare(b.title),
			);
		} else if (sortBy === "lines-desc") {
			result.sort((a, b) => b.maxLines - a.maxLines);
		} else {
			// recent
			result.sort((a, b) => b.latestUpdated - a.latestUpdated);
		}

		return result;
	}, [songGroups, filterTab, searchQuery, sortBy]);

	const handleSave = async () => {
		if (!user) {
			toast.error(
				t(
					"cloud.loginRequiredToSave",
					"Please sign in to save lyrics to the cloud.",
				),
			);
			openAccountSettings();
			return;
		}

		try {
			setIsSaving(true);
			const rawTTML = exportTTMLText(lyricLines, normalizationOptions, {
				allowConsecutiveBackgroundLines,
			});

			const docIdToUse =
				overwriteLatest && matchingExistingGroup
					? matchingExistingGroup.versions[0].id
					: undefined;

			const shouldMarkCompleted =
				isSaveCompleted ||
				isCurrentFullySynced ||
				isTTML100PercentCompleted(lyricLines);

			await saveTTMLToCloud({
				title: saveTitle || "Untitled",
				artist: saveArtist,
				album: saveAlbum,
				rawTTML,
				docId: docIdToUse,
				lineCount: lyricLines.lyricLines.length,
				durationMs: currentTrackInfo.durationMs,
				includeAudio: false,
				audioBlob: null,
				audioFileName: null,
				publishToCommunity,
				isCompleted: shouldMarkCompleted,
				onProgress: (pct) => setUploadProgress(pct),
			});
			toast.success(
				t("cloud.savedSuccess", "Lyrics saved to Cloud successfully!"),
			);
			setActiveTab("open");
		} catch (err: unknown) {
			console.error(err);
			toast.error((err as Error)?.message || "Failed to save to cloud");
		} finally {
			setIsSaving(false);
			setUploadProgress(null);
		}
	};

	const handleOpenItem = async (item: CloudTTMLMetadata) => {
		try {
			setLoadingDocId(item.id);
			const doc = await loadTTMLFromCloud(item.id);
			const file = new File([doc.rawTTML], `${doc.title || "lyric"}.ttml`, {
				type: "application/xml",
			});
			await openFile(file);
			toast.success(
				t("cloud.openedSuccess", 'Loaded "{title}" from Cloud', {
					title: doc.title || "Untitled",
				}),
			);
			setOpen(false);
		} catch (err: unknown) {
			console.error(err);
			toast.error((err as Error)?.message || "Failed to open cloud file");
		} finally {
			setLoadingDocId(null);
		}
	};

	const handleDownloadRawTTML = async (item: CloudTTMLMetadata) => {
		try {
			setLoadingDocId(item.id);
			const doc = await loadTTMLFromCloud(item.id);
			const blob = new Blob([doc.rawTTML], { type: "application/xml" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${doc.title || "lyric"}.ttml`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			toast.success(
				t("cloud.downloadedSuccess", 'Downloaded "{title}.ttml"', {
					title: doc.title || "Untitled",
				}),
			);
		} catch (err: unknown) {
			console.error(err);
			toast.error((err as Error)?.message || "Failed to download TTML");
		} finally {
			setLoadingDocId(null);
		}
	};

	const handleDeleteItem = async (item: CloudTTMLMetadata) => {
		if (
			!confirm(
				t(
					"cloud.confirmDelete",
					'Are you sure you want to delete "{title}" from your Cloud library?',
					{ title: item.title || "Untitled" },
				),
			)
		) {
			return;
		}

		try {
			setDeletingDocId(item.id);
			await deleteTTMLFromCloud(item.id);
			toast.info(
				t("cloud.deletedSuccess", 'Deleted "{title}" from Cloud.', {
					title: item.title || "Untitled",
				}),
			);
		} catch (err: unknown) {
			console.error(err);
			toast.error((err as Error)?.message || "Failed to delete cloud file");
		} finally {
			setDeletingDocId(null);
		}
	};

	const handleToggleFinished = async (item: CloudTTMLMetadata) => {
		try {
			setTogglingDocId(item.id);
			const newFinished = !item.finished;
			await updateTTMLFinishedInCloud(item.id, newFinished);
			toast.success(
				newFinished
					? t("cloud.markedCompletedSuccess", 'Marked "{title}" as completed.', {
							title: item.title || "Untitled",
						})
					: t("cloud.markedInProgressSuccess", 'Marked "{title}" as in-progress.', {
							title: item.title || "Untitled",
						}),
			);
		} catch (err: unknown) {
			console.error(err);
			toast.error((err as Error)?.message || "Failed to update completion status");
		} finally {
			setTogglingDocId(null);
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content
				onOpenAutoFocus={(e) => e.preventDefault()}
				style={{
					maxWidth: 960,
					width: "min(960px, 96vw)",
					height: "640px",
					maxHeight: "88vh",
					borderRadius: "16px",
					display: "flex",
					flexDirection: "column",
				}}
			>
				{/* Dialog Title / Header */}
				<Dialog.Title style={{ flexShrink: 0 }}>
					<Flex justify="between" align="center" gap="3" wrap="wrap">
						{/* Left: Cloud Icon Tile & Titles */}
						<Flex align="center" gap="3">
							<Box
								style={{
									width: "36px",
									height: "36px",
									borderRadius: "50%",
									backgroundColor: "var(--accent-a3)",
									color: "var(--accent-9)",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									flexShrink: 0,
								}}
							>
								<Cloud24Filled style={{ width: 20, height: 20 }} />
							</Box>
							<Flex direction="column" gap="0">
								<Flex align="center" gap="2">
									<Text size="5" weight="bold">
										{t("cloud.fileManagerTitle", "TTML Cloud Storage")}
									</Text>
									{user ? (
										<Tooltip
											content={`${t("cloud.cloudSynced", "Connected as")} ${user.displayName || user.email || user.uid}`}
										>
											<Box
												style={{
													display: "inline-flex",
													alignItems: "center",
													justifyContent: "center",
													color: "var(--green-9)",
													cursor: "default",
												}}
											>
												<Cloud24Regular style={{ width: 20, height: 20 }} />
											</Box>
										</Tooltip>
									) : (
										<Tooltip
											content={t("cloud.signInToSync", "Sign in to sync")}
										>
											<IconButton
												size="1"
												variant="ghost"
												color="gray"
												onClick={() => openAccountSettings()}
												aria-label={t(
													"cloud.signInToSync",
													"Sign in to sync",
												)}
											>
												<Globe16Regular />
											</IconButton>
										</Tooltip>
									)}
								</Flex>
								<Text size="1" color="gray">
									{t(
										"cloud.description",
										"Access your cloud-saved songs, sync lyrics, and manage community releases.",
									)}
								</Text>
							</Flex>
						</Flex>

						{/* Right: Actions */}
						<Flex
							align="center"
							gap="2"
							wrap="nowrap"
							style={{ flexShrink: 0 }}
						>
							{/* Refresh Button */}
							{user && activeTab === "open" && (
								<Tooltip content={t("cloud.refresh", "Refresh Library")}>
									<IconButton
										size="2"
										variant="surface"
										color="gray"
										disabled={isLoading}
										onClick={() => fetchUserTTMLList()}
										style={{
											height: "32px",
											width: "32px",
											borderRadius: "8px",
											cursor: "pointer",
										}}
										aria-label={t("cloud.refresh", "Refresh")}
									>
										{isLoading ? (
											<Spinner size="1" />
										) : (
											<ArrowClockwise16Regular
												style={{ width: "16px", height: "16px" }}
											/>
										)}
									</IconButton>
								</Tooltip>
							)}

							{/* Stats & Profiles Web Button */}
							{activeTab === "open" && (
								<Tooltip
									content={t(
										"ttmlChecklist.statsAndProfiles",
										"View Community Stats & Creator Profiles on Web",
									)}
								>
									<Button
										size="2"
										variant="surface"
										color="purple"
										onClick={() => {
											const url = user?.uid
												? `https://ttml.bobjoerules.com/#user=${user.uid}`
												: "https://ttml.bobjoerules.com/#stats";
											openExternal(url);
										}}
										style={{
											height: "32px",
											borderRadius: "8px",
											cursor: "pointer",
											marginLeft: "4px",
										}}
									>
										<DataUsage20Regular
											style={{ width: "16px", height: "16px" }}
										/>
										{t("ttmlChecklist.statsAndProfilesShort", "Stats")}
									</Button>
								</Tooltip>
							)}

							{/* Mode Switcher Button (Library vs Save) */}
							{user && (
								<Button
									size="2"
									variant={activeTab === "save" ? "soft" : "solid"}
									color={activeTab === "save" ? "gray" : undefined}
									onClick={() =>
										setActiveTab((prev) => (prev === "save" ? "open" : "save"))
									}
									style={{
										height: "32px",
										borderRadius: "8px",
										cursor: "pointer",
										marginLeft: "4px",
									}}
								>
									{activeTab === "save" ? (
										<>
											<Folder16Regular />
											{t("cloud.backToLibrary", "My Library")}
										</>
									) : (
										<>
											<Save16Regular />
											{t("cloud.saveCurrentShort", "Save Song")}
										</>
									)}
								</Button>
							)}

							{/* Close Button */}
							<Dialog.Close>
								<IconButton
									size="2"
									variant="ghost"
									color="gray"
									style={{
										height: "32px",
										width: "32px",
										borderRadius: "8px",
										cursor: "pointer",
									}}
									aria-label={t("common.close", "Close")}
								>
									<Dismiss16Regular />
								</IconButton>
							</Dialog.Close>
						</Flex>
					</Flex>
				</Dialog.Title>

				{/* Body Content */}
				{!user ? (
					/* Not Signed In View */
					<Flex
						direction="column"
						align="center"
						justify="center"
						gap="4"
						style={{
							flex: 1,
							minHeight: 280,
							padding: "32px 16px",
							textAlign: "center",
						}}
					>
						<Box
							style={{
								width: "64px",
								height: "64px",
								borderRadius: "50%",
								backgroundColor: "var(--accent-a3)",
								color: "var(--accent-9)",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Cloud24Filled style={{ width: 36, height: 36 }} />
						</Box>
						<Flex
							direction="column"
							gap="1"
							align="center"
							style={{ maxWidth: 460 }}
						>
							<Text size="4" weight="bold">
								{t("cloud.signInTitle", "Sign in to access TTML Cloud")}
							</Text>
							<Text size="2" color="gray">
								{t(
									"cloud.mustSignIn",
									"Sync your lyrics across devices, back up your progress, and optionally publish finished works to the community library.",
								)}
							</Text>
						</Flex>
						<Button
							size="3"
							variant="solid"
							style={{ borderRadius: "8px", cursor: "pointer" }}
							onClick={() => {
								setOpen(false);
								openAccountSettings();
							}}
						>
							<Person16Regular style={{ width: 18, height: 18 }} />
							{t("cloud.signInButton", "Sign In to TTML Cloud")}
						</Button>
					</Flex>
				) : activeTab === "save" ? (
					/* Save Current Song View */
					<Box
						style={{
							flex: 1,
							minHeight: 0,
							overflowY: "auto",
							marginTop: "12px",
						}}
					>
						<Card
							variant="surface"
							style={{
								padding: "16px",
								borderRadius: "12px",
								border: "1px solid var(--gray-a4)",
								background: "var(--gray-a2)",
							}}
						>
							<Flex direction="column" gap="3">
								<Flex direction="column" gap="1">
									<Text size="2" weight="bold">
										{t("cloud.trackTitle", "Track Title")}
									</Text>
									<TextField.Root
										value={saveTitle}
										onChange={(e) => setSaveTitle(e.target.value)}
										placeholder="Song Title"
										style={{ borderRadius: "8px" }}
									/>
								</Flex>

								<Flex gap="3" wrap="wrap">
									<Flex
										direction="column"
										gap="1"
										style={{ flex: 1, minWidth: 200 }}
									>
										<Text size="2" weight="bold">
											{t("cloud.artist", "Artist")}
										</Text>
										<TextField.Root
											value={saveArtist}
											onChange={(e) => setSaveArtist(e.target.value)}
											placeholder="Artist Name"
											style={{ borderRadius: "8px" }}
										/>
									</Flex>

									<Flex
										direction="column"
										gap="1"
										style={{ flex: 1, minWidth: 200 }}
									>
										<Text size="2" weight="bold">
											{t("cloud.album", "Album")}
										</Text>
										<TextField.Root
											value={saveAlbum}
											onChange={(e) => setSaveAlbum(e.target.value)}
											placeholder="Album Name"
											style={{ borderRadius: "8px" }}
										/>
									</Flex>
								</Flex>

								<Flex gap="2" align="center" wrap="wrap" mt="1">
									<Badge color="purple" size="1" variant="surface">
										{lyricLines.lyricLines.length}{" "}
										{t("cloud.lyricLines", "lyric lines")}
									</Badge>
									{currentTrackInfo.durationMs > 0 && (
										<Badge color="gray" size="1" variant="surface">
											{formatDuration(currentTrackInfo.durationMs)}
										</Badge>
									)}
									<Text size="1" color="gray">
										{t("cloud.savedAsAuthor", "Author:")}{" "}
										{user.displayName || user.email || user.uid}
									</Text>
								</Flex>

								{matchingExistingGroup && (
									<Card
										variant="surface"
										style={{
											background: "var(--accent-a3)",
											padding: "12px 14px",
											marginTop: 4,
											borderRadius: "10px",
											border: "1px solid var(--accent-a5)",
										}}
									>
										<Flex align="center" justify="between" gap="2" wrap="wrap">
											<Flex align="center" gap="2">
												<History16Regular style={{ color: "var(--accent-9)" }} />
												<Flex direction="column" gap="0">
													<Flex align="center" gap="2">
														<Text size="2" weight="bold">
															{t(
																"cloud.existingFound",
																'Existing song in Cloud: "{title}"',
																{
																	title: matchingExistingGroup.title,
																},
															)}
														</Text>
														<Badge size="1" color="purple" variant="surface">
															{matchingExistingGroup.versions.length}{" "}
															{matchingExistingGroup.versions.length === 1
																? t("cloud.versionSingular", "version")
																: t("cloud.versionPlural", "versions")}
														</Badge>
													</Flex>
													<Text size="1" color="gray">
														{overwriteLatest
															? t("cloud.willOverwrite", "Will overwrite v{ver}", {
																	ver: matchingExistingGroup.versions.length,
																})
															: t(
																	"cloud.willAddVersion",
																	"Will save as new version v{ver}",
																	{
																		ver:
																			matchingExistingGroup.versions
																				.length + 1,
																	},
																)}
													</Text>
												</Flex>
											</Flex>
											<Button
												size="1"
												variant={overwriteLatest ? "solid" : "soft"}
												color={overwriteLatest ? "amber" : "gray"}
												onClick={() => setOverwriteLatest(!overwriteLatest)}
												style={{ borderRadius: "6px", cursor: "pointer" }}
											>
												{overwriteLatest
													? t(
															"cloud.saveAsNewVersionBtn",
															"Save as New Version",
														)
													: t(
															"cloud.overwriteLatestBtn",
															"Overwrite Latest",
														)}
											</Button>
										</Flex>
									</Card>
								)}

								<Card
									variant="surface"
									style={{
										background: "var(--gray-a3)",
										padding: "12px 14px",
										marginTop: 4,
										borderRadius: "10px",
										border: "1px solid var(--gray-a4)",
									}}
								>
									<Flex align="center" justify="between" gap="3">
										<Flex direction="column" gap="1">
											<Flex align="center" gap="2" wrap="wrap">
												<Text size="2" weight="bold">
													✅ {t("cloud.markAsCompleted", "Mark as Completed")}
												</Text>
												<Badge
													color={
														isSaveCompleted || isCurrentFullySynced
															? "green"
															: "gray"
													}
													size="1"
													variant="surface"
												>
													{isSaveCompleted || isCurrentFullySynced
														? t("cloud.completedBadge", "Completed")
														: t("cloud.inProgressBadge", "In Progress")}
												</Badge>
												{isCurrentFullySynced && (
													<Badge color="blue" size="1" variant="surface">
														{t(
															"cloud.autoDetectedBadge",
															"Auto-detected (Fully Synced)",
														)}
													</Badge>
												)}
											</Flex>
											<Text size="1" color="gray">
												{isCurrentFullySynced
													? t(
															"cloud.markAsCompletedAutoDesc",
															"All lines are fully synchronized. This song will be saved as Completed automatically.",
														)
													: t(
															"cloud.markAsCompletedDesc",
															"Mark this lyric file as completed. Automatically set when all lines are fully synced.",
														)}
											</Text>
										</Flex>
										<Switch
											checked={isSaveCompleted || isCurrentFullySynced}
											disabled={isCurrentFullySynced}
											onCheckedChange={setIsSaveCompleted}
										/>
									</Flex>
								</Card>

								<Card
									variant="surface"
									style={{
										background: "var(--gray-a3)",
										padding: "12px 14px",
										marginTop: 4,
										borderRadius: "10px",
										border: "1px solid var(--gray-a4)",
									}}
								>
									<Flex align="center" justify="between" gap="3">
										<Flex direction="column" gap="1">
											<Flex align="center" gap="2">
												<Text size="2" weight="bold">
													🌐{" "}
													{t(
														"cloud.publishToCommunity",
														"Publish to Website Library",
													)}
												</Text>
												<Badge
													color={publishToCommunity ? "green" : "gray"}
													size="1"
													variant="surface"
												>
													{publishToCommunity
														? t("cloud.publicBadge", "Public")
														: t("cloud.privateBadge", "Private (Default)")}
												</Badge>
											</Flex>
											<Text size="1" color="gray">
												{t(
													"cloud.publishToCommunityDesc",
													"Opt-in to showcase this finished song in the public community library on ttml.bobjoerules.com/#finished.",
												)}
											</Text>
										</Flex>
										<Switch
											checked={publishToCommunity}
											onCheckedChange={(val) => {
												setPublishToCommunity(val);
												if (val) setIsSaveCompleted(true);
											}}
										/>
									</Flex>
								</Card>

								<Flex justify="end" gap="2" mt="2">
									<Button
										variant="soft"
										color="gray"
										onClick={() => setActiveTab("open")}
										style={{ borderRadius: "8px", cursor: "pointer" }}
									>
										{t("common.cancel", "Cancel")}
									</Button>
									<Button
										variant="solid"
										disabled={isSaving}
										onClick={handleSave}
										style={{ borderRadius: "8px", cursor: "pointer" }}
									>
										{isSaving ? (
											<Flex align="center" gap="2">
												<Spinner size="1" />
												<Text size="2">{t("cloud.saving", "Saving...")}</Text>
											</Flex>
										) : (
											<>
												<Save16Regular />
												{t("cloud.saveToCloudButton", "Save to Cloud")}
											</>
										)}
									</Button>
								</Flex>
							</Flex>
						</Card>
					</Box>
				) : (
					/* Library List View */
					<Flex
						direction="column"
						style={{ flex: 1, minHeight: 0, marginTop: "8px" }}
					>
						{/* Summary Stats Banner (Checklist style) */}
						{cloudList.length > 0 && (
							<Card
								variant="surface"
								style={{
									padding: "12px 16px",
									marginBottom: "12px",
									borderRadius: "12px",
									border: "1px solid var(--gray-a4)",
									background:
										"linear-gradient(135deg, var(--gray-a3) 0%, var(--gray-a2) 100%)",
									flexShrink: 0,
								}}
							>
								<Flex justify="between" align="center" wrap="wrap" gap="2">
									<Flex align="center" gap="2">
										<Text size="2" weight="bold">
											{uniqueSongsCount} {t("cloud.savedSongs", "Saved Songs")}
										</Text>
									</Flex>
									<Flex align="center" gap="3">
										<Flex align="center" gap="1">
											<span
												style={{
													width: 6,
													height: 6,
													borderRadius: "50%",
													backgroundColor: "var(--green-9)",
												}}
											/>
											<Text size="1" color="gray">
												{publicCount} {t("cloud.publicBadge", "Public")}
											</Text>
										</Flex>
										<Flex align="center" gap="1">
											<span
												style={{
													width: 6,
													height: 6,
													borderRadius: "50%",
													backgroundColor: "var(--gray-9)",
												}}
											/>
											<Text size="1" color="gray">
												{privateCount} {t("cloud.privateBadge", "Private")}
											</Text>
										</Flex>
									</Flex>
								</Flex>
							</Card>
						)}

						{/* Search, Sort & Filter Controls */}
						<Flex
							gap="2"
							mb="3"
							align="center"
							wrap="wrap"
							style={{ flexShrink: 0 }}
						>
							<Box style={{ flex: 1, minWidth: "160px" }}>
								<TextField.Root
									size="2"
									placeholder={t(
										"cloud.searchPlaceholder",
										"Search songs, artists, or albums...",
									)}
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.currentTarget.value)}
									style={{ borderRadius: "8px" }}
								>
									<TextField.Slot>
										<Search16Regular style={{ color: "var(--gray-9)" }} />
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

							{/* Sort Selector */}
							<Select.Root
								value={sortBy}
								onValueChange={(val) => setSortBy(val as typeof sortBy)}
								size="2"
							>
								<Select.Trigger
									style={{ borderRadius: "8px" }}
									placeholder={t("ttmlChecklist.sortBy", "Sort")}
								/>
								<Select.Content>
									<Select.Item value="recent">
										{t("ttmlChecklist.sortDefault", "Recently Updated")}
									</Select.Item>
									<Select.Item value="title-asc">
										{t("ttmlChecklist.sortTitleAsc", "Title (A–Z)")}
									</Select.Item>
									<Select.Item value="title-desc">
										{t("ttmlChecklist.sortTitleDesc", "Title (Z–A)")}
									</Select.Item>
									<Select.Item value="artist-asc">
										{t("ttmlChecklist.sortArtistAsc", "Artist (A–Z)")}
									</Select.Item>
									<Select.Item value="lines-desc">
										{t("cloud.sortLinesDesc", "Most Lines")}
									</Select.Item>
								</Select.Content>
							</Select.Root>

							{/* Segmented Filter Pills with Active Indicator Line (Checklist style) */}
							<Flex
								align="center"
								style={{
									position: "relative",
									backgroundColor: "var(--gray-a3)",
									borderRadius: "10px",
									padding: "2px",
									border: "1px solid var(--gray-a4)",
									gap: "2px",
								}}
							>
								<Tooltip
									content={`${t("ttmlChecklist.all", "All")} (${uniqueSongsCount})`}
								>
									<button
										type="button"
										onClick={() => setFilterTab("all")}
										style={{
											position: "relative",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											padding: "6px 12px 9px 12px",
											borderRadius: "8px",
											border: "none",
											background:
												filterTab === "all"
													? "var(--color-surface)"
													: "transparent",
											color:
												filterTab === "all"
													? "var(--accent-11)"
													: "var(--gray-10)",
											cursor: "pointer",
											transition: "all 0.15s ease",
											boxShadow:
												filterTab === "all"
													? "0 1px 3px rgba(0, 0, 0, 0.2)"
													: "none",
										}}
									>
										<List16Regular style={{ width: 16, height: 16 }} />
										{filterTab === "all" && (
											<span
												style={{
													position: "absolute",
													bottom: "3px",
													left: "6px",
													right: "6px",
													height: "2.5px",
													borderRadius: "2px",
													backgroundColor: "var(--accent-9)",
													boxShadow: "0 0 6px var(--accent-9)",
												}}
											/>
										)}
									</button>
								</Tooltip>

								<Tooltip
									content={`${t("cloud.publicBadge", "Public")} (${publicCount})`}
								>
									<button
										type="button"
										onClick={() => setFilterTab("public")}
										style={{
											position: "relative",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											padding: "6px 12px 9px 12px",
											borderRadius: "8px",
											border: "none",
											background:
												filterTab === "public"
													? "var(--color-surface)"
													: "transparent",
											color:
												filterTab === "public"
													? "var(--green-11)"
													: "var(--gray-10)",
											cursor: "pointer",
											transition: "all 0.15s ease",
											boxShadow:
												filterTab === "public"
													? "0 1px 3px rgba(0, 0, 0, 0.2)"
													: "none",
										}}
									>
										<Globe16Regular style={{ width: 16, height: 16 }} />
										{filterTab === "public" && (
											<span
												style={{
													position: "absolute",
													bottom: "3px",
													left: "6px",
													right: "6px",
													height: "2.5px",
													borderRadius: "2px",
													backgroundColor: "var(--green-9)",
													boxShadow: "0 0 6px var(--green-9)",
												}}
											/>
										)}
									</button>
								</Tooltip>

								<Tooltip
									content={`${t("cloud.privateBadge", "Private")} (${privateCount})`}
								>
									<button
										type="button"
										onClick={() => setFilterTab("private")}
										style={{
											position: "relative",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											padding: "6px 12px 9px 12px",
											borderRadius: "8px",
											border: "none",
											background:
												filterTab === "private"
													? "var(--color-surface)"
													: "transparent",
											color:
												filterTab === "private"
													? "var(--gray-11)"
													: "var(--gray-10)",
											cursor: "pointer",
											transition: "all 0.15s ease",
											boxShadow:
												filterTab === "private"
													? "0 1px 3px rgba(0, 0, 0, 0.2)"
													: "none",
										}}
									>
										<Folder16Regular style={{ width: 16, height: 16 }} />
										{filterTab === "private" && (
											<span
												style={{
													position: "absolute",
													bottom: "3px",
													left: "6px",
													right: "6px",
													height: "2.5px",
													borderRadius: "2px",
													backgroundColor: "var(--gray-9)",
													boxShadow: "0 0 6px var(--gray-9)",
												}}
											/>
										)}
									</button>
								</Tooltip>
							</Flex>
						</Flex>

						{/* Scrollable Song Cards List */}
						<ScrollArea
							style={{
								flex: 1,
								minHeight: 0,
								paddingRight: "8px",
							}}
						>
							{isLoading && cloudList.length === 0 ? (
								<Flex
									justify="center"
									align="center"
									style={{ minHeight: 240 }}
								>
									<Spinner size="3" />
								</Flex>
							) : filteredSongGroups.length === 0 ? (
								<Flex
									direction="column"
									justify="center"
									align="center"
									gap="3"
									style={{ minHeight: 240, textAlign: "center" }}
								>
									<Box
										style={{
											width: "48px",
											height: "48px",
											borderRadius: "50%",
											backgroundColor: "var(--gray-a3)",
											color: "var(--gray-9)",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										<Folder16Regular style={{ width: 24, height: 24 }} />
									</Box>
									<Text size="2" color="gray">
										{searchQuery
											? t(
													"cloud.noSearchResults",
													"No cloud lyrics found matching your search.",
												)
											: filterTab !== "all"
												? t("cloud.noCategoryResults", "No songs in this view.")
												: t(
														"cloud.emptyLibrary",
														"No saved lyrics in your Cloud library yet.",
													)}
									</Text>
									<Button
										size="2"
										variant="soft"
										onClick={() => setActiveTab("save")}
										style={{ borderRadius: "8px", cursor: "pointer" }}
									>
										<Save16Regular />
										{t("cloud.saveCurrentNow", "Save Current Lyrics to Cloud")}
									</Button>
								</Flex>
							) : (
								<Flex direction="column" gap="2" pb="2">
									{filteredSongGroups.map((group) => (
										<SongGroupItem
											key={group.key}
											group={group}
											loadingDocId={loadingDocId}
											deletingDocId={deletingDocId}
											togglingDocId={togglingDocId}
											handleOpenItem={handleOpenItem}
											handleDownloadRawTTML={handleDownloadRawTTML}
											handleDeleteItem={handleDeleteItem}
											handleToggleFinished={handleToggleFinished}
										/>
									))}
								</Flex>
							)}
						</ScrollArea>
					</Flex>
				)}
			</Dialog.Content>
		</Dialog.Root>
	);
};
