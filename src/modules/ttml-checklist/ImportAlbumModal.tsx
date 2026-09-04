import {
	Album20Regular,
	MusicNote216Regular,
	Search16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Checkbox,
	Dialog,
	Flex,
	ScrollArea,
	Spinner,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import type React from "react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
	GeniusApi,
	GeniusResolver,
	isGeniusAlbumUrl,
	isGeniusSongUrl,
} from "$/modules/genius/api/client";
import type { GeniusAlbumSummary } from "$/modules/genius/types";
import { geniusApiKeyAtom } from "$/modules/settings/states/index.ts";
import { isSpotifyUrl, SpotifyResolver } from "$/modules/spotify/client";

export interface AlbumTrackItem {
	number: number;
	song: string;
	artist: string;
	album: string;
	coverArt?: string;
	source: "genius" | "spotify";
	sourceId?: string | number;
}

interface ImportAlbumModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onImportTracks: (tracks: AlbumTrackItem[]) => void;
}

export const ImportAlbumModal: React.FC<ImportAlbumModalProps> = ({
	open,
	onOpenChange,
	onImportTracks,
}) => {
	const { t } = useTranslation();
	const geniusApiKey = useAtomValue(geniusApiKeyAtom);

	const [query, setQuery] = useState("");
	const [loading, setLoading] = useState(false);
	const [albumSummary, setAlbumSummary] = useState<{
		title: string;
		artist: string;
		cover?: string;
		source: "genius" | "spotify";
	} | null>(null);
	const [albumList, setAlbumList] = useState<GeniusAlbumSummary[]>([]);
	const [tracks, setTracks] = useState<AlbumTrackItem[]>([]);
	const [selectedTrackIndices, setSelectedTrackIndices] = useState<Set<number>>(
		new Set(),
	);

	const reset = useCallback(() => {
		setQuery("");
		setLoading(false);
		setAlbumSummary(null);
		setAlbumList([]);
		setTracks([]);
		setSelectedTrackIndices(new Set());
	}, []);

	const handleClose = useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen) {
				reset();
			}
			onOpenChange(nextOpen);
		},
		[onOpenChange, reset],
	);

	const loadGeniusAlbumTracks = useCallback(
		async (album: GeniusAlbumSummary) => {
			setLoading(true);
			try {
				let albumCover = album.cover_art_url;
				if (!albumCover && geniusApiKey) {
					try {
						const detail = await GeniusApi.getAlbumById(album.id, geniusApiKey);
						albumCover =
							detail.response?.album?.cover_art_url ||
							(detail.response?.album as unknown as Record<string, string>)
								?.header_image_url ||
							"";
					} catch {
						// ignore
					}
				}

				const geniusTracks = await GeniusApi.getAlbumTracks(
					album.id,
					geniusApiKey,
				);
				const formattedTracks: AlbumTrackItem[] = geniusTracks.map(
					(item, idx) => ({
						number: item.number || idx + 1,
						song: item.song.title || item.song.title_with_featured,
						artist:
							item.song.primary_artist?.name ||
							item.song.artist_names ||
							album.artist,
						album: album.name,
						coverArt:
							item.song.song_art_image_url ||
							item.song.song_art_image_thumbnail_url ||
							albumCover ||
							undefined,
						source: "genius",
						sourceId: item.song.id,
					}),
				);

				setAlbumSummary({
					title: album.name,
					artist: album.artist,
					cover: albumCover || undefined,
					source: "genius",
				});
				setTracks(formattedTracks);
				setSelectedTrackIndices(new Set(formattedTracks.map((_, i) => i)));
				setAlbumList([]);
			} catch (err) {
				console.error("Failed to load Genius album tracks:", err);
				toast.error(
					t(
						"ttmlChecklist.albumTracksError",
						"Failed to load tracks for album.",
					),
				);
			} finally {
				setLoading(false);
			}
		},
		[geniusApiKey, t],
	);

	const handleSearch = useCallback(async () => {
		const q = query.trim();
		if (!q) return;

		setLoading(true);
		setAlbumSummary(null);
		setAlbumList([]);
		setTracks([]);
		setSelectedTrackIndices(new Set());

		try {
			// 1. Spotify URL
			if (isSpotifyUrl(q)) {
				const resolved = await SpotifyResolver.resolveAlbum(q);
				if (resolved && resolved.tracks.length > 0) {
					const formattedTracks: AlbumTrackItem[] = resolved.tracks.map(
						(item) => ({
							number: item.number,
							song: item.title,
							artist: item.artist,
							album: resolved.title,
							coverArt: item.cover || resolved.cover,
							source: "spotify",
							sourceId: resolved.id,
						}),
					);

					setAlbumSummary({
						title: resolved.title,
						artist: resolved.artist,
						cover: resolved.cover,
						source: "spotify",
					});
					setTracks(formattedTracks);
					setSelectedTrackIndices(new Set(formattedTracks.map((_, i) => i)));
					return;
				} else {
					toast.warn(
						t(
							"ttmlChecklist.spotifyAlbumNotFound",
							"Could not retrieve tracklist from this Spotify link.",
						),
					);
					return;
				}
			}

			// 2. Genius Album URL
			if (isGeniusAlbumUrl(q)) {
				const resolved = await GeniusResolver.resolveAlbum(q, geniusApiKey);
				if (resolved && resolved.tracks.length > 0) {
					const formattedTracks: AlbumTrackItem[] = resolved.tracks.map(
						(item) => ({
							number: item.number,
							song: item.title,
							artist: item.artist,
							album: resolved.title,
							coverArt: item.cover || resolved.cover,
							source: "genius",
							sourceId: item.id,
						}),
					);

					setAlbumSummary({
						title: resolved.title,
						artist: resolved.artist,
						cover: resolved.cover,
						source: "genius",
					});
					setTracks(formattedTracks);
					setSelectedTrackIndices(new Set(formattedTracks.map((_, i) => i)));
					return;
				} else {
					toast.warn(
						t(
							"ttmlChecklist.geniusAlbumNotFound",
							"Could not retrieve tracklist from this Genius album link.",
						),
					);
					return;
				}
			}

			// 3. Genius Song URL (User pasted song link into album importer)
			if (isGeniusSongUrl(q)) {
				const resolvedSong = await GeniusResolver.resolveSong(q, geniusApiKey);
				if (resolvedSong) {
					if (resolvedSong.albumId) {
						const resolvedAlbum = await GeniusResolver.resolveAlbum(
							`https://genius.com/albums/${resolvedSong.albumId}`,
							geniusApiKey,
						);
						if (resolvedAlbum && resolvedAlbum.tracks.length > 0) {
							const formattedTracks: AlbumTrackItem[] =
								resolvedAlbum.tracks.map((item) => ({
									number: item.number,
									song: item.title,
									artist: item.artist,
									album: resolvedAlbum.title,
									coverArt: item.cover || resolvedAlbum.cover,
									source: "genius",
									sourceId: item.id,
								}));

							setAlbumSummary({
								title: resolvedAlbum.title,
								artist: resolvedAlbum.artist,
								cover: resolvedAlbum.cover,
								source: "genius",
							});
							setTracks(formattedTracks);
							setSelectedTrackIndices(
								new Set(formattedTracks.map((_, i) => i)),
							);
							return;
						}
					}

					// Standalone single fallback
					const singleTrack: AlbumTrackItem = {
						number: 1,
						song: resolvedSong.title,
						artist: resolvedSong.artist,
						album: resolvedSong.album || resolvedSong.title,
						coverArt: resolvedSong.cover,
						source: "genius",
						sourceId: resolvedSong.id,
					};

					setAlbumSummary({
						title: resolvedSong.album || resolvedSong.title,
						artist: resolvedSong.artist,
						cover: resolvedSong.cover,
						source: "genius",
					});
					setTracks([singleTrack]);
					setSelectedTrackIndices(new Set([0]));
					return;
				} else {
					toast.warn(
						t(
							"ttmlChecklist.geniusSongNotFound",
							"Could not retrieve details for this Genius song link.",
						),
					);
					return;
				}
			}

			// 4. Genius Album search / slug
			const albums = await GeniusApi.searchAlbums(q, geniusApiKey);
			if (albums.length === 1) {
				await loadGeniusAlbumTracks(albums[0]);
			} else if (albums.length > 1) {
				setAlbumList(albums);
			} else {
				toast.info(
					t("ttmlChecklist.noAlbumsFound", "No albums found for this query."),
				);
			}
		} catch (err) {
			console.error("Album search error:", err);
			toast.error(
				t("ttmlChecklist.albumSearchError", "Search failed: {err}", {
					err: String(err),
				}),
			);
		} finally {
			setLoading(false);
		}
	}, [query, geniusApiKey, loadGeniusAlbumTracks, t]);

	const toggleTrack = (index: number) => {
		setSelectedTrackIndices((prev) => {
			const next = new Set(prev);
			if (next.has(index)) {
				next.delete(index);
			} else {
				next.add(index);
			}
			return next;
		});
	};

	const setTrackSelected = (index: number, selected: boolean) => {
		setSelectedTrackIndices((prev) => {
			const next = new Set(prev);
			if (selected) {
				next.add(index);
			} else {
				next.delete(index);
			}
			return next;
		});
	};

	const selectAll = () => {
		setSelectedTrackIndices(new Set(tracks.map((_, i) => i)));
	};

	const deselectAll = () => {
		setSelectedTrackIndices(new Set());
	};

	const handleImport = () => {
		const selected = tracks.filter((_, i) => selectedTrackIndices.has(i));
		if (selected.length === 0) return;

		onImportTracks(selected);
		toast.success(
			t(
				"ttmlChecklist.importAlbumSuccess",
				"Imported {count} songs into checklist!",
				{
					count: selected.length,
				},
			),
		);
		handleClose(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={handleClose}>
			<Dialog.Content style={{ maxWidth: 640, maxHeight: "88vh" }}>
				<Dialog.Title>
					<Flex align="center" gap="2">
						<Album20Regular style={{ width: 22, height: 22 }} />
						<Text weight="bold">
							{t("ttmlChecklist.importAlbumTitle", "Import Full Album")}
						</Text>
					</Flex>
				</Dialog.Title>

				<Dialog.Description size="2" color="gray" mb="3">
					{t(
						"ttmlChecklist.importAlbumDesc",
						"Search for an album on Genius, or paste a Spotify album URL to import all tracks into your checklist.",
					)}
				</Dialog.Description>

				<Flex gap="2" mb="3">
					<TextField.Root
						style={{ flex: 1 }}
						placeholder={t(
							"ttmlChecklist.importAlbumPlaceholder",
							"Album name, or paste Spotify / Genius link…",
						)}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleSearch()}
					>
						<TextField.Slot>
							<Search16Regular />
						</TextField.Slot>
					</TextField.Root>
					<Button onClick={handleSearch} disabled={loading || !query.trim()}>
						{loading ? <Spinner /> : t("common.search", "Search")}
					</Button>
				</Flex>

				{/* Loading indicator */}
				{loading && (
					<Flex justify="center" align="center" p="6">
						<Spinner size="3" />
					</Flex>
				)}

				{/* Multiple Albums Matching (Choose one) */}
				{!loading && albumList.length > 0 && (
					<Box mb="3">
						<Text size="2" weight="bold" mb="2" as="p">
							{t("ttmlChecklist.chooseAlbum", "Select an album:")}
						</Text>
						<ScrollArea type="auto" style={{ maxHeight: 280 }}>
							<Flex direction="column" gap="2" pr="2">
								{albumList.map((alb) => (
									<Card
										key={alb.id}
										variant="surface"
										style={{
											cursor: "pointer",
											padding: "10px",
											transition: "background 0.2s",
										}}
										onClick={() => loadGeniusAlbumTracks(alb)}
									>
										<Flex align="center" gap="3">
											{alb.cover_art_url ? (
												<img
													src={alb.cover_art_url}
													alt={alb.name}
													style={{
														width: 44,
														height: 44,
														borderRadius: 6,
														objectFit: "cover",
													}}
												/>
											) : (
												<Box
													style={{
														width: 44,
														height: 44,
														borderRadius: 6,
														background: "var(--gray-a4)",
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
													}}
												>
													<MusicNote216Regular />
												</Box>
											)}
											<Flex direction="column" style={{ flex: 1, minWidth: 0 }}>
												<Text weight="bold" size="2" truncate>
													{alb.name}
												</Text>
												<Text size="1" color="gray" truncate>
													{alb.artist}
												</Text>
											</Flex>
											<Button size="1" variant="soft">
												{t("common.select", "Select")}
											</Button>
										</Flex>
									</Card>
								))}
							</Flex>
						</ScrollArea>
					</Box>
				)}

				{/* Album Tracklist Preview */}
				{!loading && albumSummary && tracks.length > 0 && (
					<Flex direction="column" gap="3">
						<Card variant="classic" style={{ padding: 12 }}>
							<Flex align="center" justify="between" gap="3">
								<Flex align="center" gap="3" style={{ minWidth: 0 }}>
									{albumSummary.cover ? (
										<img
											src={albumSummary.cover}
											alt={albumSummary.title}
											style={{
												width: 54,
												height: 54,
												borderRadius: 8,
												objectFit: "cover",
												flexShrink: 0,
											}}
										/>
									) : (
										<Box
											style={{
												width: 54,
												height: 54,
												borderRadius: 8,
												background: "var(--gray-a4)",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												flexShrink: 0,
											}}
										>
											<Album20Regular />
										</Box>
									)}
									<Flex direction="column" style={{ minWidth: 0 }}>
										<Text weight="bold" size="3" truncate>
											{albumSummary.title}
										</Text>
										<Text size="2" color="gray" truncate>
											{albumSummary.artist}
										</Text>
										<Flex gap="2" align="center" mt="1">
											<Badge color="indigo" size="1">
												{t("ttmlChecklist.trackCount", "{count} tracks", {
													count: tracks.length,
												})}
											</Badge>
											<Badge color="gray" size="1">
												{albumSummary.source.toUpperCase()}
											</Badge>
										</Flex>
									</Flex>
								</Flex>

								<Flex gap="2" align="center">
									<Button size="1" variant="ghost" onClick={selectAll}>
										{t("common.selectAll", "Select All")}
									</Button>
									<Button size="1" variant="ghost" onClick={deselectAll}>
										{t("common.deselectAll", "Deselect All")}
									</Button>
								</Flex>
							</Flex>
						</Card>

						<ScrollArea type="auto" style={{ maxHeight: 320 }}>
							<Flex direction="column" gap="1" pr="2">
								{tracks.map((track, idx) => {
									const isChecked = selectedTrackIndices.has(idx);
									return (
										<Flex
											key={idx}
											align="center"
											gap="3"
											p="2"
											style={{
												borderRadius: 6,
												background: isChecked
													? "var(--accent-a2)"
													: "transparent",
												cursor: "pointer",
											}}
											onClick={() => toggleTrack(idx)}
										>
											<Box
												onClick={(e) => e.stopPropagation()}
												style={{ display: "flex", alignItems: "center" }}
											>
												<Checkbox
													checked={isChecked}
													onCheckedChange={(val) =>
														setTrackSelected(idx, !!val)
													}
												/>
											</Box>
											<Text
												size="1"
												color="gray"
												style={{ minWidth: 20, textAlign: "right" }}
											>
												{track.number}.
											</Text>
											<Flex direction="column" style={{ flex: 1, minWidth: 0 }}>
												<Text
													size="2"
													weight={isChecked ? "bold" : "regular"}
													truncate
												>
													{track.song}
												</Text>
												{track.artist !== albumSummary.artist && (
													<Text size="1" color="gray" truncate>
														{track.artist}
													</Text>
												)}
											</Flex>
										</Flex>
									);
								})}
							</Flex>
						</ScrollArea>
					</Flex>
				)}

				<Flex justify="end" gap="3" mt="4">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.cancel", "Cancel")}
						</Button>
					</Dialog.Close>
					{tracks.length > 0 && (
						<Button
							disabled={selectedTrackIndices.size === 0}
							onClick={handleImport}
						>
							{t(
								"ttmlChecklist.importSelectedTracks",
								"Import {count} Tracks",
								{
									count: selectedTrackIndices.size,
								},
							)}
						</Button>
					)}
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
