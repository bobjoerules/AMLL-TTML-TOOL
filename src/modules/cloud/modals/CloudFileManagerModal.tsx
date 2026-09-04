import {
	Badge,
	Box,
	Button,
	Card,
	Dialog,
	Flex,
	IconButton,
	ScrollArea,
	Spinner,
	Switch,
	Tabs,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { type FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useFileOpener } from "$/hooks/useFileOpener";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
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
} from "../ttmlStorage";
import type { CloudTTMLMetadata } from "../types";

export const CloudFileManagerModal: FC = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(cloudFileManagerOpenAtom);
	const initialTab = useAtomValue(cloudFileManagerInitialTabAtom);
	const [activeTab, setActiveTab] = useState<string>("open");
	const user = useAtomValue(currentUserAtom);
	const openAccountSettings = useSetAtom(openAccountSettingsAtom);

	const lyricLines = useAtomValue(lyricLinesAtom);
	const saveFileName = useAtomValue(saveFileNameAtom);
	const normalizationOptions = useAtomValue(lyricTextNormalizationOptionsAtom);
	const allowConsecutiveBackgroundLines = useAtomValue(
		allowConsecutiveBackgroundLinesAtom,
	);
	const { openFile } = useFileOpener();

	const cloudList = useAtomValue(cloudTTMLListAtom);
	const isLoading = useAtomValue(cloudTTMLLoadingAtom);

	const [searchQuery, setSearchQuery] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [publishToCommunity, setPublishToCommunity] = useState(false);
	const [uploadProgress, setUploadProgress] = useState<number | null>(null);
	const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
	const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

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

	useEffect(() => {
		if (open) {
			setActiveTab(initialTab);
			setSaveTitle(currentTrackInfo.title);
			setSaveArtist(currentTrackInfo.artist);
			setSaveAlbum(currentTrackInfo.album);
			setPublishToCommunity(false);
			if (user) {
				fetchUserTTMLList().catch(console.error);
			}
		}
	}, [open, initialTab, user, currentTrackInfo]);

	const filteredList = useMemo(() => {
		if (!searchQuery.trim()) return cloudList;
		const q = searchQuery.toLowerCase();
		return cloudList.filter(
			(item) =>
				item.title.toLowerCase().includes(q) ||
				item.artist.toLowerCase().includes(q) ||
				item.album.toLowerCase().includes(q),
		);
	}, [cloudList, searchQuery]);

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

			await saveTTMLToCloud({
				title: saveTitle || "Untitled",
				artist: saveArtist,
				album: saveAlbum,
				rawTTML,
				lineCount: lyricLines.lyricLines.length,
				durationMs: currentTrackInfo.durationMs,
				includeAudio: false,
				audioBlob: null,
				audioFileName: null,
				publishToCommunity,
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

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content style={{ maxWidth: 640 }}>
				<Dialog.Title>
					<Flex justify="between" align="center">
						<Text weight="bold" size="4">
							☁️ {t("cloud.fileManagerTitle", "TTML Cloud Storage")}
						</Text>
						<Dialog.Close>
							<IconButton variant="ghost" color="gray" size="1">
								✕
							</IconButton>
						</Dialog.Close>
					</Flex>
				</Dialog.Title>

				{!user ? (
					<Flex direction="column" align="center" gap="3" py="5">
						<Text size="3" color="gray">
							{t(
								"cloud.mustSignIn",
								"Sign in to access your cloud-saved TTML library and sync your files.",
							)}
						</Text>
						<Button
							variant="solid"
							size="3"
							onClick={() => {
								setOpen(false);
								openAccountSettings();
							}}
						>
							{t("cloud.signInButton", "Sign In to TTML Cloud")}
						</Button>
					</Flex>
				) : (
					<Tabs.Root value={activeTab} onValueChange={setActiveTab}>
						<Tabs.List>
							<Tabs.Trigger value="open">
								📂 {t("cloud.openTab", "My Cloud Library")}
							</Tabs.Trigger>
							<Tabs.Trigger value="save">
								💾 {t("cloud.saveTab", "Save Current to Cloud")}
							</Tabs.Trigger>
						</Tabs.List>

						<Box pt="3">
							<Tabs.Content value="open">
								<Flex direction="column" gap="3">
									<Flex gap="2" align="center">
										<TextField.Root
											size="2"
											placeholder={t(
												"cloud.searchPlaceholder",
												"Search saved songs by title, artist, or album...",
											)}
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											style={{ flex: 1 }}
										/>
										<Button
											variant="soft"
											size="2"
											disabled={isLoading}
											onClick={() => fetchUserTTMLList()}
										>
											🔄 {t("cloud.refresh", "Refresh")}
										</Button>
									</Flex>

									<ScrollArea style={{ maxHeight: 360, minHeight: 200 }}>
										{isLoading ? (
											<Flex
												justify="center"
												align="center"
												style={{ minHeight: 180 }}
											>
												<Spinner size="3" />
											</Flex>
										) : filteredList.length === 0 ? (
											<Flex
												direction="column"
												justify="center"
												align="center"
												gap="2"
												style={{ minHeight: 180 }}
											>
												<Text size="2" color="gray">
													{searchQuery
														? t(
															"cloud.noSearchResults",
															"No cloud lyrics found matching your search.",
														)
														: t(
															"cloud.emptyLibrary",
															"No saved lyrics in your Cloud library yet.",
														)}
												</Text>
												<Button
													size="1"
													variant="soft"
													onClick={() => setActiveTab("save")}
												>
													{t(
														"cloud.saveCurrentNow",
														"Save Current Lyrics to Cloud",
													)}
												</Button>
											</Flex>
										) : (
											<Flex direction="column" gap="2">
												{filteredList.map((item) => (
													<Card
														key={item.id}
														variant="classic"
														style={{ background: "var(--gray-a2)" }}
													>
														<Flex justify="between" align="center" gap="3">
															<Flex
																direction="column"
																gap="1"
																style={{ flex: 1, minWidth: 0 }}
															>
																<Flex align="center" gap="2">
																	<Text weight="bold" size="3" truncate>
																		{item.title}
																	</Text>
																	<Badge color="cyan" size="1">
																		{item.lineCount} {t("cloud.lines", "lines")}
																	</Badge>
																</Flex>
																<Text size="2" color="gray" truncate>
																	{[item.artist, item.album]
																		.filter(Boolean)
																		.join(" • ") ||
																		t("cloud.unknownArtist", "Unknown Artist")}
																</Text>
																<Text size="1" color="gray">
																	{new Date(item.updatedAt).toLocaleString()}
																</Text>
															</Flex>

															<Flex gap="2">
																<Button
																	size="2"
																	variant="solid"
																	disabled={
																		loadingDocId === item.id ||
																		deletingDocId === item.id
																	}
																	onClick={() => handleOpenItem(item)}
																>
																	{loadingDocId === item.id ? (
																		<Spinner size="1" />
																	) : (
																		t("cloud.openInEditor", "Open")
																	)}
																</Button>
																<Button
																	size="2"
																	variant="soft"
																	color="red"
																	disabled={
																		loadingDocId === item.id ||
																		deletingDocId === item.id
																	}
																	onClick={() => handleDeleteItem(item)}
																>
																	{deletingDocId === item.id ? (
																		<Spinner size="1" />
																	) : (
																		"🗑️"
																	)}
																</Button>
															</Flex>
														</Flex>
													</Card>
												))}
											</Flex>
										)}
									</ScrollArea>
								</Flex>
							</Tabs.Content>

							<Tabs.Content value="save">
								<Flex direction="column" gap="3">
									<Card
										variant="surface"
										style={{ background: "var(--gray-a2)" }}
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
												/>
											</Flex>

											<Flex gap="3">
												<Flex direction="column" gap="1" style={{ flex: 1 }}>
													<Text size="2" weight="bold">
														{t("cloud.artist", "Artist")}
													</Text>
													<TextField.Root
														value={saveArtist}
														onChange={(e) => setSaveArtist(e.target.value)}
														placeholder="Artist Name"
													/>
												</Flex>

												<Flex direction="column" gap="1" style={{ flex: 1 }}>
													<Text size="2" weight="bold">
														{t("cloud.album", "Album")}
													</Text>
													<TextField.Root
														value={saveAlbum}
														onChange={(e) => setSaveAlbum(e.target.value)}
														placeholder="Album Name"
													/>
												</Flex>
											</Flex>

											<Flex gap="2" align="center" mt="1">
												<Badge color="purple" size="1">
													{lyricLines.lyricLines.length}{" "}
													{t("cloud.lyricLines", "lyric lines")}
												</Badge>
												<Text size="1" color="gray">
													{t(
														"cloud.readyToSave",
														"Will be saved under your cloud profile.",
													)}
												</Text>
											</Flex>

											<Card
												variant="surface"
												style={{
													background: "var(--gray-a3)",
													padding: "10px 12px",
													marginTop: 4,
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
															>
																{publishToCommunity
																	? t("cloud.publicBadge", "Public")
																	: t(
																		"cloud.privateBadge",
																		"Private (Default)",
																	)}
															</Badge>
														</Flex>
														<Text size="1" color="gray">
															{t(
																"cloud.publishToCommunityDesc",
																"Opt-in to showcase this finished song in the public library on ttml.bobjoerules.com/#finished.",
															)}
														</Text>
													</Flex>
													<Switch
														checked={publishToCommunity}
														onCheckedChange={setPublishToCommunity}
													/>
												</Flex>
											</Card>
										</Flex>
									</Card>

									<Flex justify="end" gap="3">
										<Dialog.Close>
											<Button variant="soft" color="gray">
												{t("common.cancel", "Cancel")}
											</Button>
										</Dialog.Close>
										<Button
											variant="solid"
											disabled={isSaving}
											onClick={handleSave}
										>
											{isSaving ? (
												<Flex align="center" gap="2">
													<Spinner size="1" />
													<Text size="2">{t("cloud.saving", "Saving...")}</Text>
												</Flex>
											) : (
												t("cloud.saveToCloudButton", "Save to Cloud")
											)}
										</Button>
									</Flex>
								</Flex>
							</Tabs.Content>
						</Box>
					</Tabs.Root>
				)}
			</Dialog.Content>
		</Dialog.Root>
	);
};
