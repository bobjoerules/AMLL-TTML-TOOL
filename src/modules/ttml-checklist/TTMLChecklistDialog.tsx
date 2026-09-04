import {
	Add16Regular,
	Album20Regular,
	ArrowDownload16Regular,
	CheckmarkCircle16Filled,
	Circle16Regular,
	Cloud24Regular,
	CloudArrowDown16Regular,
	CloudArrowUp16Regular,
	Delete16Regular,
	Dismiss16Regular,
	DocumentArrowDown16Regular,
	DocumentArrowUp16Regular,
	Edit16Regular,
	Globe16Regular,
	Image16Regular,
	List16Regular,
	MusicNote2Filled,
	Search16Regular,
	Timer16Regular,
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
	Select,
	Spinner,
	Text,
	TextArea,
	TextField,
	Tooltip,
} from "@radix-ui/themes";
import {
	memo,
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { ViewportList } from "react-viewport-list";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { audioCoverArtAtom } from "$/modules/audio/states";
import { GeniusApi } from "$/modules/genius/api/client";
import { LrcLibApi } from "$/modules/lrclib/api/client";
import { LyricallyApi } from "$/modules/lyrically/api/client";
import { geniusApiKeyAtom } from "$/modules/settings/states/index.ts";
import { isSpotifyUrl, SpotifyResolver } from "$/modules/spotify/client";
import { extractSpotifyTrackId } from "$/modules/apple-ttml/api/client";
import { ImportAlbumModal, type AlbumTrackItem } from "./ImportAlbumModal";
import {
	appleTtmlImportDialogAtom,
	geniusImportLyricsDialogAtom,
	importFromLRCLIBDialogAtom,
	importLyricsPrefillAtom,
	lyricallyImportLyricsDialogAtom,
	openAccountSettingsAtom,
	ttmlChecklistDialogAtom,
} from "$/states/dialogs.ts";
import { lyricLinesAtom, projectIdentityAtom } from "$/states/main.ts";
import { useFileOpener } from "$/hooks/useFileOpener";
import { loadTTMLFromCloud } from "$/modules/cloud/ttmlStorage";
import {
	addChecklistEntry,
	createChecklistEntry,
	deleteChecklistEntry,
	normalizeChecklistEntries,
	setChecklistEntryCompleted,
	type TTMLChecklistEntry,
	type TTMLChecklistEntryInput,
	updateChecklistEntry,
} from "./logic";
import {
	exportChecklistToFile,
	loadChecklistFromCloud,
	parseChecklistJson,
	saveChecklistToCloud,
	useChecklistSyncStatus,
} from "./cloudSync";
import { ttmlChecklistAtom } from "./states";

type ProviderSearchResult = {
	id: string | number;
	name: string;
	artist: string;
	album?: string;
	cover?: string;
	source: "genius" | "lyrically" | "lrclib";
};

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
	const [source, setSource] = useState<
		"genius" | "lyrically" | "lrclib" | "spotify" | undefined
	>(initial?.source ?? "genius");
	const [sourceId, setSourceId] = useState<string | number | undefined>(
		initial?.sourceId,
	);
	const sourceUrl = initial?.sourceUrl;
	const [notes, setNotes] = useState(initial?.notes ?? "");

	// Provider Search state
	const [showProviderSearch, setShowProviderSearch] = useState(!initial);
	const [searchProvider, setSearchProvider] = useState<
		"genius" | "lyrically" | "lrclib"
	>("genius");
	const [providerQuery, setProviderQuery] = useState("");
	const [providerResults, setProviderResults] = useState<
		ProviderSearchResult[]
	>([]);
	const [isSearchingProvider, setIsSearchingProvider] = useState(false);
	const [hasSearchedProvider, setHasSearchedProvider] = useState(false);

	const projectIdentity = useAtomValue(projectIdentityAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const audioCoverArt = useAtomValue(audioCoverArtAtom);
	const geniusApiKey = useAtomValue(geniusApiKeyAtom);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const searchFieldRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (showProviderSearch) {
			const timer = setTimeout(() => {
				searchFieldRef.current?.focus();
			}, 60);
			return () => clearTimeout(timer);
		}
	}, [showProviderSearch]);

	const handleImportCurrent = () => {
		const metaAlbum = lyricLines.metadata.find(
			(m) => m.key.toLowerCase() === "album",
		)?.value[0];
		const metaCover = lyricLines.metadata.find(
			(m) =>
				m.key.toLowerCase() === "cover_art" || m.key.toLowerCase() === "cover",
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
		const currentCover = audioCoverArt || metaCover;
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

	const handleSearchProvider = async () => {
		if (!providerQuery.trim()) return;
		setIsSearchingProvider(true);
		setHasSearchedProvider(true);
		setProviderResults([]);

		let effectiveQuery = providerQuery.trim();
		let spotifyTrack: import("$/modules/spotify/client").ResolvedTrack | null = null;
		if (isSpotifyUrl(effectiveQuery)) {
			try {
				spotifyTrack = await SpotifyResolver.resolveTrack(effectiveQuery);
				if (spotifyTrack) {
					effectiveQuery = spotifyTrack.artist
						? `${spotifyTrack.artist} ${spotifyTrack.title}`
						: spotifyTrack.title;
					setProviderQuery(effectiveQuery);
				}
			} catch (err) {
				console.warn("Failed to resolve Spotify track link:", err);
			}
		}

		try {
			let hits: ProviderSearchResult[] = [];
			try {
				if (searchProvider === "genius") {
					const res = await GeniusApi.search(effectiveQuery, geniusApiKey);
					hits = res.response.hits.map(({ result }) => ({
						id: result.id,
						name: result.title,
						artist: result.primary_artist.name,
						album: result.album?.name,
						cover:
							result.song_art_image_url || result.song_art_image_thumbnail_url,
						source: "genius",
					}));
				} else if (searchProvider === "lrclib") {
					const res = await LrcLibApi.search(effectiveQuery);
					hits = res.map((track) => ({
						id: track.id,
						name: track.name,
						artist: track.artistName,
						album: track.albumName,
						source: "lrclib",
					}));
				} else {
					const res = await LyricallyApi.search(effectiveQuery);
					hits = res.map((track, idx) => ({
						id: `${track.artist}-${track.name}-${idx}`,
						name: track.name,
						artist: track.artist,
						album: track.album,
						cover: track.cover,
						source: "lyrically",
					}));
				}
			} catch (providerErr) {
				console.warn("Provider query failed:", providerErr);
			}

			if (spotifyTrack) {
				hits.unshift({
					id: spotifyTrack.id,
					name: spotifyTrack.title,
					artist: spotifyTrack.artist,
					album: spotifyTrack.album,
					cover: spotifyTrack.cover,
					source: "genius",
				});
			}

			setProviderResults(hits);
		} catch (err) {
			console.error("Provider search failed:", err);
		} finally {
			setIsSearchingProvider(false);
		}
	};

	const handleSelectSearchResult = (hit: ProviderSearchResult) => {
		setSong(hit.name);
		setArtist(hit.artist);
		if (hit.album) setAlbum(hit.album);
		if (hit.cover) setCoverArt(hit.cover);
		setSource(hit.source);
		setSourceId(hit.id);
		setShowProviderSearch(false);
	};

	const valid = song.trim().length > 0;

	return (
		<Card
			variant="surface"
			style={{
				padding: "16px",
				marginBottom: "14px",
				borderRadius: "14px",
				border: "1px solid var(--accent-a5)",
				backgroundColor: "var(--gray-a2)",
			}}
		>
			<Flex direction="column" gap="3" asChild>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						if (valid) {
							onSubmit({
								song,
								artist,
								album,
								coverArt,
								source,
								sourceId,
								sourceUrl,
								notes,
							});
						}
					}}
				>
					<Flex justify="between" align="center" wrap="wrap" gap="2">
						<Text size="2" weight="bold">
							{initial
								? t("ttmlChecklist.edit", "Edit checklist item")
								: t("ttmlChecklist.newItem", "New Song")}
						</Text>
						<Flex gap="2">
							<Button
								type="button"
								size="1"
								variant={showProviderSearch ? "solid" : "soft"}
								color="indigo"
								onClick={() => setShowProviderSearch((prev) => !prev)}
							>
								<Globe16Regular />
								{t(
									"ttmlChecklist.searchProvider",
									"Search Genius / Lyrics Providers",
								)}
							</Button>
							<Button
								type="button"
								size="1"
								variant="soft"
								color="cyan"
								onClick={handleImportCurrent}
							>
								<ArrowDownload16Regular />
								{t(
									"ttmlChecklist.importCurrent",
									"Import from Current Project",
								)}
							</Button>
						</Flex>
					</Flex>

					{/* Provider Search Sub-Panel */}
					{showProviderSearch && (
						<Box
							p="3"
							style={{
								backgroundColor: "var(--gray-a3)",
								borderRadius: "10px",
								border: "1px solid var(--gray-a5)",
							}}
						>
							<Flex gap="2" align="center" mb="2" wrap="wrap">
								<Select.Root
									value={searchProvider}
									onValueChange={(val) =>
										setSearchProvider(val as "genius" | "lyrically" | "lrclib")
									}
									size="1"
								>
									<Select.Trigger />
									<Select.Content>
										<Select.Item value="genius">Genius</Select.Item>
										<Select.Item value="lrclib">LRCLIB</Select.Item>
										<Select.Item value="lyrically">Lyrically</Select.Item>
									</Select.Content>
								</Select.Root>
								<Box style={{ flex: 1, minWidth: "180px" }}>
									<TextField.Root
										ref={searchFieldRef}
										size="1"
										placeholder={t(
											"ttmlChecklist.searchProviderPlaceholder",
											"Search song, artist, or paste Spotify track link…",
										)}
										value={providerQuery}
										onChange={(e) => setProviderQuery(e.currentTarget.value)}
										autoFocus={showProviderSearch}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												void handleSearchProvider();
											}
										}}
									>
										<TextField.Slot>
											<Search16Regular />
										</TextField.Slot>
									</TextField.Root>
								</Box>
								<Button
									type="button"
									size="1"
									variant="solid"
									color="indigo"
									onClick={() => void handleSearchProvider()}
									disabled={isSearchingProvider || !providerQuery.trim()}
								>
									{isSearchingProvider ? (
										<Spinner size="1" />
									) : (
										t("ttmlChecklist.searchProviderBtn", "Search")
									)}
								</Button>
							</Flex>

							{/* Provider Search Results List */}
							{isSearchingProvider && (
								<Flex justify="center" p="3">
									<Spinner size="2" />
								</Flex>
							)}

							{!isSearchingProvider && providerResults.length > 0 && (
								<ScrollArea
									type="auto"
									scrollbars="vertical"
									style={{ maxHeight: "160px" }}
								>
									<Flex direction="column" gap="1" pr="2">
										{providerResults.map((hit) => (
											<Flex
												key={hit.id}
												justify="between"
												align="center"
												gap="2"
												p="2"
												style={{
													borderRadius: "6px",
													backgroundColor: "var(--gray-a2)",
													cursor: "pointer",
													transition: "background 0.1s",
													minWidth: 0,
													overflow: "hidden",
												}}
												onClick={() => handleSelectSearchResult(hit)}
											>
												<Flex gap="2" align="center" style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
													{hit.cover ? (
														<img
															src={hit.cover}
															alt={hit.name}
															crossOrigin="anonymous"
															referrerPolicy="no-referrer"
															style={{
																width: "28px",
																height: "28px",
																borderRadius: "4px",
																objectFit: "cover",
																flexShrink: 0,
															}}
														/>
													) : (
														<Box
															style={{
																width: "28px",
																height: "28px",
																borderRadius: "4px",
																backgroundColor: "var(--gray-a4)",
																display: "flex",
																alignItems: "center",
																justifyContent: "center",
																flexShrink: 0,
															}}
														>
															<MusicNote2Filled
																style={{ width: 14, height: 14 }}
															/>
														</Box>
													)}
													<Flex direction="column" style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
														<Text size="1" weight="bold" truncate style={{ maxWidth: "100%", display: "block" }}>
															{hit.name}
														</Text>
														<Text size="1" color="gray" truncate style={{ maxWidth: "100%", display: "block" }}>
															{hit.artist} {hit.album ? `• ${hit.album}` : ""}
														</Text>
													</Flex>
												</Flex>
												<Badge size="1" variant="soft" color="indigo" style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
													Select
												</Badge>
											</Flex>
										))}
									</Flex>
								</ScrollArea>
							)}

							{!isSearchingProvider &&
								hasSearchedProvider &&
								providerResults.length === 0 && (
									<Box py="2">
										<Text size="1" color="gray" align="center" as="div">
											{t(
												"ttmlChecklist.noProviderResults",
												"No results found from lyric providers.",
											)}
										</Text>
									</Box>
								)}
						</Box>
					)}

					{/* Manual Details Grid */}
					<Flex gap="3" align="start">
						{/* Cover Art Preview / Upload Column */}
						<Flex direction="column" gap="1" align="center">
							<Box
								style={{
									width: "80px",
									height: "80px",
									borderRadius: "10px",
									overflow: "hidden",
									backgroundColor: "var(--gray-a4)",
									border: "1px solid var(--gray-a5)",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									position: "relative",
								}}
							>
								{coverArt ? (
									<img
										src={coverArt}
										alt={song || "Cover Art"}
										crossOrigin="anonymous"
										referrerPolicy="no-referrer"
										style={{
											width: "100%",
											height: "100%",
											objectFit: "cover",
										}}
									/>
								) : (
									<MusicNote2Filled
										style={{
											width: "32px",
											height: "32px",
											color: "var(--gray-8)",
										}}
									/>
								)}
							</Box>
							<input
								type="file"
								accept="image/*"
								ref={fileInputRef}
								style={{ display: "none" }}
								onChange={handleFileUpload}
							/>
							<Flex gap="1" mt="1">
								<Button
									type="button"
									size="1"
									variant="soft"
									onClick={() => fileInputRef.current?.click()}
									title={t("ttmlChecklist.uploadCover", "Upload Cover")}
								>
									<Image16Regular />
								</Button>
								{coverArt && (
									<Button
										type="button"
										size="1"
										variant="ghost"
										color="red"
										onClick={() => setCoverArt("")}
										title={t("ttmlChecklist.removeCover", "Remove Cover")}
									>
										<Dismiss16Regular />
									</Button>
								)}
							</Flex>
						</Flex>

						{/* Fields Column */}
						<Flex direction="column" gap="2" style={{ flex: 1 }}>
							<Flex gap="2">
								<Box style={{ flex: 2 }}>
									<TextField.Root
										placeholder={t(
											"ttmlChecklist.songPlaceholder",
											"Song title *",
										)}
										value={song}
										onChange={(event) => setSong(event.currentTarget.value)}
										autoFocus={!initial && !showProviderSearch}
										required
										size="2"
									/>
								</Box>
								<Box style={{ flex: 2 }}>
									<TextField.Root
										placeholder={t(
											"ttmlChecklist.artistPlaceholder",
											"Artist (optional)",
										)}
										value={artist}
										onChange={(event) => setArtist(event.currentTarget.value)}
										size="2"
									/>
								</Box>
							</Flex>

							<Flex gap="2">
								<Box style={{ flex: 1 }}>
									<TextField.Root
										placeholder={t(
											"ttmlChecklist.albumPlaceholder",
											"Album (optional)",
										)}
										value={album}
										onChange={(event) => setAlbum(event.currentTarget.value)}
										size="2"
									/>
								</Box>
								<Box style={{ flex: 1 }}>
									<TextField.Root
										placeholder={t(
											"ttmlChecklist.coverArtPlaceholder",
											"Cover art image URL (optional)",
										)}
										value={coverArt}
										onChange={(event) => setCoverArt(event.currentTarget.value)}
										size="2"
									/>
								</Box>
							</Flex>
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
						size="2"
					/>

					<Flex justify="end" gap="2" mt="1">
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
						<Button type="submit" disabled={!valid} variant="solid">
							{initial
								? t("ttmlChecklist.save", "Save")
								: t("ttmlChecklist.add", "Add to checklist")}
						</Button>
					</Flex>
				</form>
			</Flex>
		</Card>
	);
};

const ChecklistEntryCard = memo(({
	entry,
	onComplete,
	onDelete,
	onEdit,
	onImportLyrics,
	onImportAppleTtml,
	onLoadCloud,
	isLoadingCloud,
}: {
	entry: TTMLChecklistEntry;
	onComplete: (id: string, completed: boolean) => void;
	onDelete: (id: string) => void;
	onEdit: (id: string, input: TTMLChecklistEntryInput) => void;
	onImportLyrics: (entry: TTMLChecklistEntry) => void;
	onImportAppleTtml?: (entry: TTMLChecklistEntry) => void;
	onLoadCloud?: (docId: string) => void;
	isLoadingCloud?: boolean;
}) => {
	const { t } = useTranslation();
	const [editing, setEditing] = useState(false);

	if (editing) {
		return (
			<EntryForm
				initial={entry}
				onCancel={() => setEditing(false)}
				onSubmit={(input) => {
					onEdit(entry.id, input);
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
				boxSizing: "border-box",
				padding: "10px 12px",
				border: "1px solid var(--gray-a4)",
				borderRadius: "12px",
				backgroundColor: entry.completed
					? "var(--gray-a2)"
					: "var(--color-surface)",
				opacity: entry.completed ? 0.78 : 1,
				transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
				marginBottom: "8px",
			}}
		>
			<Flex gap="3" align="center" style={{ width: "100%", minWidth: 0 }}>
				{/* Song Cover Art */}
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
					{entry.coverArt ? (
						<img
							src={entry.coverArt}
							alt={entry.song}
							loading="lazy"
							decoding="async"
							style={{
								width: "100%",
								height: "100%",
								objectFit: "cover",
								filter: entry.completed
									? "grayscale(70%) opacity(70%)"
									: "none",
							}}
						/>
					) : (
						<MusicNote2Filled
							style={{
								width: "24px",
								height: "24px",
								color: entry.completed ? "var(--gray-7)" : "var(--accent-9)",
							}}
						/>
					)}
				</Box>

				{/* Song & Meta Info */}
				<Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
					<Flex align="center" gap="2" style={{ minWidth: 0, width: "100%" }}>
						<Text
							weight="bold"
							size="3"
							title={entry.song}
							style={{
								textDecoration: entry.completed ? "line-through" : undefined,
								color: entry.completed ? "var(--gray-10)" : "inherit",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
								minWidth: 0,
								flexShrink: 1,
							}}
						>
							{entry.song}
						</Text>
						{entry.source && (
							<Badge
								size="1"
								color={
									entry.source === "genius"
										? "amber"
										: entry.source === "lrclib"
											? "cyan"
											: entry.source === "spotify"
												? "green"
												: "indigo"
								}
								variant="surface"
								style={{
									fontWeight: 600,
									letterSpacing: "0.4px",
									flexShrink: 0,
								}}
							>
								{entry.source.toUpperCase()}
							</Badge>
						)}
						{entry.cloudDocId && (
							<Badge
								size="1"
								color="sky"
								variant="surface"
								style={{ fontWeight: 600, flexShrink: 0 }}
							>
								{t("ttmlChecklist.cloudLinked", "Cloud Linked")}
							</Badge>
						)}
						{entry.completed && (
							<Badge
								size="1"
								color="green"
								variant="soft"
								style={{ flexShrink: 0 }}
							>
								{t("ttmlChecklist.completed", "Completed")}
							</Badge>
						)}
					</Flex>

					<Flex align="center" gap="2" style={{ minWidth: 0, width: "100%" }}>
						{entry.artist && (
							<Text
								size="2"
								color="gray"
								title={entry.artist}
								style={{
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
									minWidth: 0,
									flexShrink: 1,
								}}
							>
								{entry.artist}
							</Text>
						)}
						{entry.artist && entry.album && (
							<Text size="1" color="gray" style={{ flexShrink: 0 }}>
								•
							</Text>
						)}
						{entry.album && (
							<Badge
								size="1"
								color="gray"
								variant="surface"
								title={entry.album}
								style={{
									maxWidth: "200px",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									flexShrink: 1,
								}}
							>
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
									borderRadius: "6px",
								}}
							>
								{entry.notes}
							</Text>
						</details>
					)}
				</Flex>

				{/* Action Buttons */}
				<Flex
					gap="2"
					align="center"
					style={{ flexShrink: 0, marginLeft: "auto" }}
				>
					{/* Download / Open Cloud TTML Button */}
					{entry.cloudDocId && (
						<Tooltip
							content={t(
								"ttmlChecklist.loadCloudTTMLTooltip",
								"Download & load linked TTML from Cloud",
							)}
						>
							<IconButton
								size="2"
								variant="surface"
								color="sky"
								disabled={isLoadingCloud}
								onClick={() => onLoadCloud?.(entry.cloudDocId!)}
								aria-label={t("ttmlChecklist.loadCloudTTML", "Download TTML")}
								style={{
									borderRadius: "8px",
									cursor: "pointer",
									flexShrink: 0,
								}}
							>
								{isLoadingCloud ? (
									<Spinner size="1" />
								) : (
									<CloudArrowDown16Regular />
								)}
							</IconButton>
						</Tooltip>
					)}

					{/* 1-Click Import Lyrics Page */}
					<Tooltip
						content={t(
							"ttmlChecklist.importLyricsTooltip",
							"Open lyrics import & review page for this song",
						)}
					>
						<IconButton
							size="2"
							variant="soft"
							color="indigo"
							onClick={() => onImportLyrics(entry)}
							aria-label={t("ttmlChecklist.importLyrics", "Import Lyrics")}
							style={{
								borderRadius: "8px",
								cursor: "pointer",
								flexShrink: 0,
							}}
						>
							<ArrowDownload16Regular />
						</IconButton>
					</Tooltip>

					{/* 1-Click Apple Music TTML (when Spotify ID/link available) */}
					{(entry.source === "spotify" ||
						isSpotifyUrl(String(entry.sourceId || "")) ||
						isSpotifyUrl(String(entry.song || ""))) && onImportAppleTtml && (
						<Tooltip
							content={t(
								"ttmlChecklist.importAppleTtmlTooltip",
								"Import word-synced TTML from Apple Music",
							)}
						>
							<IconButton
								size="2"
								variant="soft"
								color="crimson"
								onClick={() => onImportAppleTtml(entry)}
								aria-label={t("appleTtml.dialogTitle", "Import Apple Music TTML")}
								style={{
									borderRadius: "8px",
									cursor: "pointer",
									flexShrink: 0,
								}}
							>
								<MusicNote2Filled style={{ width: 16, height: 16 }} />
							</IconButton>
						</Tooltip>
					)}

					{/* Done / Reopen Button */}
					<Tooltip
						content={
							entry.completed
								? t("ttmlChecklist.reopen", "Reopen")
								: t("ttmlChecklist.markDone", "Done")
						}
					>
						<IconButton
							size="2"
							variant={entry.completed ? "surface" : "soft"}
							color={entry.completed ? "gray" : "green"}
							onClick={() => onComplete(entry.id, !entry.completed)}
							aria-label={
								entry.completed
									? t("ttmlChecklist.reopen", "Reopen")
									: t("ttmlChecklist.markDone", "Done")
							}
							style={{
								borderRadius: "8px",
								cursor: "pointer",
								flexShrink: 0,
							}}
						>
							{entry.completed ? (
								<Circle16Regular />
							) : (
								<CheckmarkCircle16Filled />
							)}
						</IconButton>
					</Tooltip>

					<Tooltip content={t("ttmlChecklist.edit", "Edit checklist item")}>
						<IconButton
							size="2"
							variant="soft"
							color="gray"
							onClick={() => setEditing(true)}
							aria-label={t("ttmlChecklist.edit", "Edit checklist item")}
							style={{
								borderRadius: "8px",
								cursor: "pointer",
								flexShrink: 0,
							}}
						>
							<Edit16Regular />
						</IconButton>
					</Tooltip>
					<Tooltip content={t("ttmlChecklist.delete", "Delete checklist item")}>
						<IconButton
							size="2"
							variant="soft"
							color="red"
							onClick={() => onDelete(entry.id)}
							aria-label={t("ttmlChecklist.delete", "Delete checklist item")}
							style={{
								borderRadius: "8px",
								cursor: "pointer",
								flexShrink: 0,
							}}
						>
							<Delete16Regular />
						</IconButton>
					</Tooltip>
				</Flex>
			</Flex>
		</Card>
	);
});

export const TTMLChecklistDialog = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(ttmlChecklistDialogAtom);
	const [storedEntries, setStoredEntries] = useAtom(ttmlChecklistAtom);
	const [showAddForm, setShowAddForm] = useState(false);
	const [filterTab, setFilterTab] = useState<"all" | "pending" | "completed">(
		"all",
	);
	const [searchQuery, setSearchQuery] = useState("");
	const deferredSearchQuery = useDeferredValue(searchQuery);
	const [sortBy, setSortBy] = useState<
		"default" | "title-asc" | "title-desc" | "artist-asc" | "artist-desc"
	>("default");

	const listScrollRef = useRef<HTMLDivElement>(null);

	const { isLoggedIn, user } = useChecklistSyncStatus();
	const openAccountSettings = useSetAtom(openAccountSettingsAtom);
	const setImportLyricsPrefill = useSetAtom(importLyricsPrefillAtom);
	const setGeniusImportDialog = useSetAtom(geniusImportLyricsDialogAtom);
	const setLyricallyImportDialog = useSetAtom(lyricallyImportLyricsDialogAtom);
	const setLrclibImportDialog = useSetAtom(importFromLRCLIBDialogAtom);
	const setAppleTtmlImportDialog = useSetAtom(appleTtmlImportDialogAtom);

	const entries = useMemo(
		() => normalizeChecklistEntries(storedEntries),
		[storedEntries],
	);

	useEffect(() => {
		if (entries.length !== storedEntries.length) {
			setStoredEntries(entries);
		}
	}, [entries, storedEntries.length, setStoredEntries]);

	const totalCount = entries.length;
	const completedCount = entries.filter((e) => e.completed).length;
	const pendingCount = totalCount - completedCount;
	const progressPercent =
		totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

	const filteredEntries = useMemo(() => {
		let result = [...entries];
		if (filterTab === "pending") {
			result = result.filter((e) => !e.completed);
		} else if (filterTab === "completed") {
			result = result.filter((e) => e.completed);
		}

		const q = deferredSearchQuery.toLowerCase().trim();
		if (q) {
			result = result.filter(
				(e) =>
					e.song.toLowerCase().includes(q) ||
					e.artist.toLowerCase().includes(q) ||
					(e.album && e.album.toLowerCase().includes(q)) ||
					e.notes.toLowerCase().includes(q),
			);
		}

		if (sortBy === "title-asc") {
			result.sort((a, b) => a.song.localeCompare(b.song));
		} else if (sortBy === "title-desc") {
			result.sort((a, b) => b.song.localeCompare(a.song));
		} else if (sortBy === "artist-asc") {
			result.sort(
				(a, b) =>
					(a.artist || "zzz").localeCompare(b.artist || "zzz") ||
					a.song.localeCompare(b.song),
			);
		} else if (sortBy === "artist-desc") {
			result.sort(
				(a, b) =>
					(b.artist || "").localeCompare(a.artist || "") ||
					b.song.localeCompare(a.song),
			);
		}

		return result;
	}, [entries, filterTab, deferredSearchQuery, sortBy]);

	const save = useCallback(
		(nextEntries: TTMLChecklistEntry[]) => {
			setStoredEntries(nextEntries);
		},
		[setStoredEntries],
	);

	const handleComplete = useCallback(
		(id: string, completed: boolean) => {
			setStoredEntries((prev) => setChecklistEntryCompleted(prev, id, completed));
		},
		[setStoredEntries],
	);

	const handleDelete = useCallback(
		(id: string) => {
			setStoredEntries((prev) => deleteChecklistEntry(prev, id));
		},
		[setStoredEntries],
	);

	const handleEdit = useCallback(
		(id: string, input: TTMLChecklistEntryInput) => {
			setStoredEntries((prev) => updateChecklistEntry(prev, id, input));
		},
		[setStoredEntries],
	);

	const [showAlbumImport, setShowAlbumImport] = useState(false);

	const handleImportAlbumTracks = useCallback(
		(albumTracks: AlbumTrackItem[]) => {
			if (!albumTracks.length) return;

			const existingKeys = new Set(
				entries.map(
					(item) => `${item.song.toLowerCase()}|${item.artist.toLowerCase()}`,
				),
			);

			const newEntries: TTMLChecklistEntry[] = [];
			for (const t of albumTracks) {
				const key = `${t.song.toLowerCase()}|${t.artist.toLowerCase()}`;
				if (!existingKeys.has(key)) {
					existingKeys.add(key);
					newEntries.push(
						createChecklistEntry({
							song: t.song,
							artist: t.artist,
							album: t.album,
							coverArt: t.coverArt,
							source: t.source,
							sourceId: t.sourceId,
						}),
					);
				}
			}

			if (newEntries.length > 0) {
				const nextList = [...newEntries, ...entries];
				save(nextList);
			}
		},
		[entries, save],
	);

	const { openFile } = useFileOpener();
	const [loadingCloudDocId, setLoadingCloudDocId] = useState<string | null>(
		null,
	);

	const handleLoadCloudTTML = useCallback(
		async (docId: string) => {
			try {
				setLoadingCloudDocId(docId);
				const cloudDoc = await loadTTMLFromCloud(docId);
				const file = new File(
					[cloudDoc.rawTTML],
					`${cloudDoc.title || "lyric"}.ttml`,
					{ type: "application/xml" },
				);
				await openFile(file);
				toast.success(
					t("cloud.openedSuccess", 'Loaded "{title}" from Cloud', {
						title: cloudDoc.title || "Untitled",
					}),
				);
				setOpen(false);
			} catch (err) {
				console.error("Failed to load cloud TTML from checklist:", err);
				toast.error((err as Error)?.message || "Failed to load cloud TTML.");
			} finally {
				setLoadingCloudDocId(null);
			}
		},
		[openFile, setOpen, t],
	);

	const handleImportLyricsForEntry = useCallback(
		(entry: TTMLChecklistEntry) => {
			const source =
				entry.source === "lrclib"
					? "lrclib"
					: entry.source === "lyrically"
						? "lyrically"
						: "genius";
			const titleQuery = String(
				entry.artist ? `${entry.artist} - ${entry.song}` : entry.song || "",
			).trim();

			setImportLyricsPrefill({
				source,
				track: {
					id: entry.sourceId ? String(entry.sourceId) : undefined,
					name: entry.song,
					artist: entry.artist,
					album: entry.album,
					cover: entry.coverArt,
				},
				query: titleQuery,
			});

			// Open target provider dialog
			if (source === "lrclib") {
				setLrclibImportDialog(true);
			} else if (source === "lyrically") {
				setLyricallyImportDialog(true);
			} else {
				setGeniusImportDialog(true);
			}

			// Close checklist so user sees the import review page immediately
			setOpen(false);
		},
		[
			setImportLyricsPrefill,
			setLrclibImportDialog,
			setLyricallyImportDialog,
			setGeniusImportDialog,
			setOpen,
		],
	);

	const handleImportAppleTtmlForEntry = useCallback(
		(entry: TTMLChecklistEntry) => {
			const rawCandidate =
				(entry.source === "spotify" ? String(entry.sourceId) : undefined) ||
				(isSpotifyUrl(String(entry.sourceId || "")) ? String(entry.sourceId) : undefined) ||
				(isSpotifyUrl(String(entry.song || "")) ? String(entry.song) : undefined) ||
				String(entry.sourceId || "") ||
				"";
			const spotifyId = extractSpotifyTrackId(rawCandidate);

			setImportLyricsPrefill({
				source: "apple-ttml",
				track: {
					id: spotifyId,
					name: entry.song,
					artist: entry.artist,
					album: entry.album,
					cover: entry.coverArt,
				},
				query: spotifyId,
			});

			setAppleTtmlImportDialog(true);
			setOpen(false);
		},
		[setImportLyricsPrefill, setAppleTtmlImportDialog, setOpen],
	);

	const [isSyncingCloud, setIsSyncingCloud] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleExportChecklist = async () => {
		if (entries.length === 0) {
			toast.info(t("ttmlChecklist.emptyExport", "Checklist is empty."));
			return;
		}
		try {
			setIsExporting(true);
			const saved = await exportChecklistToFile(entries);
			if (saved !== null) {
				toast.success(
					t("ttmlChecklist.exportSuccess", "Checklist exported successfully!"),
				);
			}
		} catch (e) {
			console.error("Failed to export checklist:", e);
			toast.error(
				t("ttmlChecklist.exportError", "Failed to export checklist file."),
			);
		} finally {
			setIsExporting(false);
		}
	};

	const handleImportFileChange = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = e.target.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			const imported = parseChecklistJson(text);
			if (imported.length === 0) {
				toast.error(
					t(
						"ttmlChecklist.invalidJson",
						"Invalid or empty checklist JSON file.",
					),
				);
				return;
			}
			// Merge imported items with existing items without duplicates by song+artist or ID
			const existingIds = new Set(entries.map((item) => item.id));
			const newItems = imported.filter((item) => !existingIds.has(item.id));
			const merged = normalizeChecklistEntries([...entries, ...newItems]);
			save(merged);
			toast.success(
				t(
					"ttmlChecklist.importSuccess",
					"Imported {count} songs into checklist!",
					{ count: newItems.length || imported.length },
				),
			);
		} catch (err) {
			console.error("Failed to parse imported file:", err);
			toast.error(
				t("ttmlChecklist.importError", "Failed to read checklist file."),
			);
		} finally {
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const handlePushToCloud = async () => {
		if (!user?.uid) {
			toast.info(
				t(
					"ttmlChecklist.signInRequired",
					"Please sign in to sync your checklist with the cloud.",
				),
			);
			openAccountSettings();
			return;
		}
		try {
			setIsSyncingCloud(true);
			const result = await saveChecklistToCloud(entries, user.uid);
			if (result.success) {
				toast.success(
					t("ttmlChecklist.pushSuccess", "Pushed checklist to cloud!"),
				);
			} else {
				toast.error(
					result.error ||
						t(
							"ttmlChecklist.pushFailed",
							"Could not push to cloud. Check network or permissions.",
						),
				);
			}
		} catch (err) {
			toast.error(
				(err as Error)?.message ||
					t("ttmlChecklist.pushFailed", "Push to cloud failed."),
			);
		} finally {
			setIsSyncingCloud(false);
		}
	};
	const handlePullFromCloud = async () => {
		if (!user?.uid) {
			toast.info(
				t(
					"ttmlChecklist.signInRequired",
					"Please sign in to sync your checklist with the cloud.",
				),
			);
			openAccountSettings();
			return;
		}
		try {
			setIsSyncingCloud(true);
			const result = await loadChecklistFromCloud(user.uid);
			if (result.entries && result.entries.length > 0) {
				save(result.entries);
				toast.success(
					t(
						"ttmlChecklist.pullSuccess",
						"Synced {count} songs from cloud checklist!",
						{ count: result.entries.length },
					),
				);
			} else if (result.entries) {
				toast.info(
					t("ttmlChecklist.cloudEmpty", "Cloud checklist is currently empty."),
				);
			} else {
				toast.error(
					result.error ||
						t("ttmlChecklist.pullFailed", "Could not fetch cloud checklist."),
				);
			}
		} catch (err) {
			toast.error(
				(err as Error)?.message ||
					t("ttmlChecklist.pullFailed", "Could not fetch cloud checklist."),
			);
		} finally {
			setIsSyncingCloud(false);
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content
				onOpenAutoFocus={(e) => e.preventDefault()}
				style={{
					maxWidth: 1000,
					width: "min(1000px, 96vw)",
					height: "640px",
					maxHeight: "88vh",
					borderRadius: "16px",
					display: "flex",
					flexDirection: "column",
				}}
			>
				<input
					type="file"
					ref={fileInputRef}
					accept=".json,application/json"
					style={{ display: "none" }}
					onChange={handleImportFileChange}
				/>
				<Dialog.Title style={{ flexShrink: 0 }}>
					<Flex justify="between" align="center" gap="3" wrap="wrap">
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
								<MusicNote2Filled style={{ width: 20, height: 20 }} />
							</Box>
							<Flex direction="column" gap="0">
								<Flex align="center" gap="2">
									<Text size="5" weight="bold">
										{t("ttmlChecklist.title", "TTML Checklist")}
									</Text>
									{isLoggedIn ? (
										<Tooltip
											content={`${t("ttmlChecklist.cloudSynced", "Cloud Synced")}${user?.displayName ? ` (${user.displayName})` : ""}`}
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
											content={t(
												"ttmlChecklist.signInToSync",
												"Sign in to sync",
											)}
										>
											<IconButton
												size="1"
												variant="ghost"
												color="gray"
												onClick={() => openAccountSettings()}
												aria-label={t(
													"ttmlChecklist.signInToSync",
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
										"ttmlChecklist.description",
										"Keep track of songs, cover art, and ideas you want to sync.",
									)}
								</Text>
							</Flex>
						</Flex>

						<Flex align="center" gap="2" wrap="nowrap" style={{ flexShrink: 0 }}>
							{/* Cloud Pull Button */}
							{isLoggedIn && (
								<Tooltip
									content={t(
										"ttmlChecklist.downloadCloud",
										"Download from Cloud",
									)}
								>
									<IconButton
										size="2"
										variant="surface"
										color="gray"
										disabled={isSyncingCloud}
										onClick={handlePullFromCloud}
										style={{
											height: "32px",
											width: "32px",
											borderRadius: "8px",
											cursor: "pointer",
										}}
										aria-label={t(
											"ttmlChecklist.downloadCloud",
											"Download from Cloud",
										)}
									>
										{isSyncingCloud ? (
											<Spinner size="1" />
										) : (
											<CloudArrowDown16Regular
												style={{ width: "18px", height: "18px" }}
											/>
										)}
									</IconButton>
								</Tooltip>
							)}

							{/* Cloud Push Button */}
							{isLoggedIn && (
								<Tooltip
									content={t("ttmlChecklist.pushCloud", "Push to Cloud")}
								>
									<IconButton
										size="2"
										variant="surface"
										color="gray"
										disabled={isSyncingCloud}
										onClick={handlePushToCloud}
										style={{
											height: "32px",
											width: "32px",
											borderRadius: "8px",
											cursor: "pointer",
										}}
										aria-label={t("ttmlChecklist.pushCloud", "Push to Cloud")}
									>
										{isSyncingCloud ? (
											<Spinner size="1" />
										) : (
											<CloudArrowUp16Regular
												style={{ width: "18px", height: "18px" }}
											/>
										)}
									</IconButton>
								</Tooltip>
							)}

							{/* Export / Download File Button */}
							<Tooltip
								content={t(
									"ttmlChecklist.downloadJson",
									"Download / Export JSON",
								)}
							>
								<IconButton
									size="2"
									variant="surface"
									color="gray"
									disabled={isExporting}
									onClick={handleExportChecklist}
									style={{
										height: "32px",
										width: "32px",
										borderRadius: "8px",
										cursor: "pointer",
									}}
									aria-label={t(
										"ttmlChecklist.downloadJson",
										"Download / Export JSON",
									)}
								>
									<DocumentArrowDown16Regular
										style={{ width: "18px", height: "18px" }}
									/>
								</IconButton>
							</Tooltip>

							{/* Import File Button */}
							<Tooltip
								content={t("ttmlChecklist.importJson", "Import JSON file")}
							>
								<IconButton
									size="2"
									variant="surface"
									color="gray"
									onClick={() => fileInputRef.current?.click()}
									style={{
										height: "32px",
										width: "32px",
										borderRadius: "8px",
										cursor: "pointer",
									}}
									aria-label={t("ttmlChecklist.importJson", "Import JSON file")}
								>
									<DocumentArrowUp16Regular
										style={{ width: "18px", height: "18px" }}
									/>
								</IconButton>
							</Tooltip>

							{/* Import Album Button */}
							<Tooltip
								content={t(
									"ttmlChecklist.importAlbumTooltip",
									"Import full album from Genius or Spotify",
								)}
							>
								<Button
									size="2"
									variant="surface"
									color="gray"
									onClick={() => setShowAlbumImport(true)}
									style={{
										height: "32px",
										borderRadius: "8px",
										cursor: "pointer",
										marginLeft: "4px",
									}}
									aria-label={t("ttmlChecklist.importAlbum", "Import Album")}
								>
									<Album20Regular style={{ width: "16px", height: "16px" }} />
									{t("ttmlChecklist.importAlbum", "Import Album")}
								</Button>
							</Tooltip>

							{/* Add New Song Button */}
							<Button
								size="2"
								variant={showAddForm ? "soft" : "solid"}
								color={showAddForm ? "gray" : undefined}
								onClick={() => setShowAddForm((prev) => !prev)}
								style={{
									height: "32px",
									borderRadius: "8px",
									cursor: "pointer",
									marginLeft: "4px",
								}}
							>
								{showAddForm ? <Dismiss16Regular /> : <Add16Regular />}
								{showAddForm
									? t("ttmlChecklist.cancel", "Cancel")
									: t("ttmlChecklist.newItem", "New Song")}
							</Button>
						</Flex>
					</Flex>
				</Dialog.Title>

				{/* Body Content */}
				{showAddForm ? (
					/* New Entry Form View */
					<Box
						style={{
							flex: 1,
							minHeight: 0,
							overflowY: "auto",
							marginTop: "8px",
						}}
					>
						<EntryForm
							onCancel={() => setShowAddForm(false)}
							onSubmit={(input) => {
								save(addChecklistEntry(entries, input));
								setShowAddForm(false);
							}}
						/>
					</Box>
				) : (
					/* Checklist List View */
					<Flex
						direction="column"
						style={{ flex: 1, minHeight: 0, marginTop: "8px" }}
					>
						{/* Progress summary banner */}
						{totalCount > 0 && (
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
								<Flex justify="between" align="center" mb="2">
									<Flex align="center" gap="2">
										<Text size="2" weight="bold">
											{completedCount} / {totalCount}{" "}
											{t("ttmlChecklist.completed", "Completed")}
										</Text>
										<Badge
											size="1"
											color={progressPercent === 100 ? "green" : "indigo"}
											variant="solid"
											style={{ borderRadius: "10px", padding: "1px 8px" }}
										>
											{progressPercent}%
										</Badge>
									</Flex>
									<Flex align="center" gap="3">
										<Flex align="center" gap="1">
											<span
												style={{
													width: 6,
													height: 6,
													borderRadius: "50%",
													backgroundColor: "var(--amber-9)",
												}}
											/>
											<Text size="1" color="gray">
												{pendingCount}{" "}
												{t("ttmlChecklist.pending", "In Progress")}
											</Text>
										</Flex>
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
												{completedCount} {t("ttmlChecklist.completed", "Done")}
											</Text>
										</Flex>
									</Flex>
								</Flex>
								<Progress
									value={progressPercent}
									color={progressPercent === 100 ? "green" : undefined}
									size="2"
									style={{ borderRadius: "6px" }}
								/>
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
										"ttmlChecklist.searchPlaceholder",
										"Search songs, artists, albums, or notes...",
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
									<Select.Item value="default">
										{t("ttmlChecklist.sortDefault", "Recently Added")}
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
									<Select.Item value="artist-desc">
										{t("ttmlChecklist.sortArtistDesc", "Artist (Z–A)")}
									</Select.Item>
								</Select.Content>
							</Select.Root>

							{/* Status Filter Tabs as Icons with Active Indicator Bar */}
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
									content={`${t("ttmlChecklist.all", "All")} (${totalCount})`}
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
									content={`${t("ttmlChecklist.pending", "In Progress")} (${pendingCount})`}
								>
									<button
										type="button"
										onClick={() => setFilterTab("pending")}
										style={{
											position: "relative",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											padding: "6px 12px 9px 12px",
											borderRadius: "8px",
											border: "none",
											background:
												filterTab === "pending"
													? "var(--color-surface)"
													: "transparent",
											color:
												filterTab === "pending"
													? "var(--amber-11)"
													: "var(--gray-10)",
											cursor: "pointer",
											transition: "all 0.15s ease",
											boxShadow:
												filterTab === "pending"
													? "0 1px 3px rgba(0, 0, 0, 0.2)"
													: "none",
										}}
									>
										<Timer16Regular style={{ width: 16, height: 16 }} />
										{filterTab === "pending" && (
											<span
												style={{
													position: "absolute",
													bottom: "3px",
													left: "6px",
													right: "6px",
													height: "2.5px",
													borderRadius: "2px",
													backgroundColor: "var(--amber-9)",
													boxShadow: "0 0 6px var(--amber-9)",
												}}
											/>
										)}
									</button>
								</Tooltip>

								<Tooltip
									content={`${t("ttmlChecklist.completed", "Completed")} (${completedCount})`}
								>
									<button
										type="button"
										onClick={() => setFilterTab("completed")}
										style={{
											position: "relative",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											padding: "6px 12px 9px 12px",
											borderRadius: "8px",
											border: "none",
											background:
												filterTab === "completed"
													? "var(--color-surface)"
													: "transparent",
											color:
												filterTab === "completed"
													? "var(--green-11)"
													: "var(--gray-10)",
											cursor: "pointer",
											transition: "all 0.15s ease",
											boxShadow:
												filterTab === "completed"
													? "0 1px 3px rgba(0, 0, 0, 0.2)"
													: "none",
										}}
									>
										<CheckmarkCircle16Filled
											style={{ width: 16, height: 16 }}
										/>
										{filterTab === "completed" && (
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
							</Flex>
						</Flex>

						{/* Items List */}
						<Box
							ref={listScrollRef}
							style={{
								flex: 1,
								minHeight: 0,
								overflowY: "auto",
								overflowX: "hidden",
								paddingRight: "6px",
							}}
						>
							{filteredEntries.length === 0 ? (
								<Card
									variant="surface"
									style={{
										padding: "36px 20px",
										textAlign: "center",
										borderRadius: "12px",
										border: "1px dashed var(--gray-a5)",
										backgroundColor: "var(--gray-a2)",
									}}
								>
									<Flex direction="column" align="center" gap="2">
										<MusicNote2Filled
											style={{
												width: 32,
												height: 32,
												color: "var(--gray-7)",
											}}
										/>
										<Text size="2" color="gray">
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
									</Flex>
								</Card>
							) : (
								<ViewportList
									viewportRef={listScrollRef}
									items={filteredEntries}
									overscan={8}
								>
									{(entry) => (
										<ChecklistEntryCard
											key={entry.id}
											entry={entry}
											onComplete={handleComplete}
											onDelete={handleDelete}
											onEdit={handleEdit}
											onImportLyrics={handleImportLyricsForEntry}
											onImportAppleTtml={handleImportAppleTtmlForEntry}
											onLoadCloud={handleLoadCloudTTML}
											isLoadingCloud={loadingCloudDocId === entry.cloudDocId}
										/>
									)}
								</ViewportList>
							)}
						</Box>
					</Flex>
				)}
			</Dialog.Content>

			<ImportAlbumModal
				open={showAlbumImport}
				onOpenChange={setShowAlbumImport}
				onImportTracks={handleImportAlbumTracks}
			/>
		</Dialog.Root>
	);
};

export default TTMLChecklistDialog;
