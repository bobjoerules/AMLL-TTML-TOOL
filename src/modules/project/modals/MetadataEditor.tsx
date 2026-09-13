import {
	Add16Regular,
	AlbumRegular,
	Delete16Regular,
	Image16Regular,
	Info16Regular,
	MusicNote1Regular,
	NumberSymbol16Regular,
	Open16Regular,
	Person16Regular,
	Search16Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Dialog,
	DropdownMenu,
	Flex,
	IconButton,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import { useImmerAtom } from "jotai-immer";
import {
	memo,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { getBetterGeniusCoverArt } from "$/modules/genius/utils/image";
import {
	geniusSearchDialogAtom,
	metadataEditorDialogAtom,
} from "$/states/dialogs.ts";
import { lyricLinesAtom } from "$/states/main.ts";
import type { TTMLLyric } from "$/types/ttml";
import styles from "./MetadataEditor.module.css";
import {
	AppleMusicIcon,
	GithubIcon,
	NeteaseIcon,
	QQMusicIcon,
	SpotifyIcon,
} from "./PlatformIcons";

interface MetadataEntryProps {
	entry: { key: string; value: string[] };
	index: number;
	setLyricLines: (args: (prev: TTMLLyric) => void) => void;
	option: SelectOption | null;
	focusAddKeyButton: () => void;
}

const MetadataEntry = memo(
	({
		entry,
		index,
		setLyricLines,
		option,
		focusAddKeyButton,
	}: MetadataEntryProps) => {
		const validation = option?.validation;
		const rowHasError = validation
			? entry.value.some(
					(val) => val.trim() !== "" && !validation.verifier(val),
				)
			: false;

		const rowHasDuplicate = useMemo(() => {
			const values = entry.value.filter((v) => v.trim() !== "");
			return new Set(values).size !== values.length;
		}, [entry.value]);

		const { t } = useTranslation();

		const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

		const [focusIndex, setFocusIndex] = useState<number | null>(null);

		useEffect(() => {
			if (focusIndex !== null) {
				const targetInput = inputRefs.current[focusIndex];
				if (targetInput) {
					targetInput.focus();
					const len = targetInput.value.length;
					targetInput.setSelectionRange(len, len);
				}
				setFocusIndex(null);
			}
		}, [focusIndex]);

		const [isDraggingCategory, setIsDraggingCategory] = useState(false);
		const [dragInputIndex, setDragInputIndex] = useState<number | null>(null);

		const handleCategoryDrop = useCallback(
			(e: React.DragEvent) => {
				e.preventDefault();
				setIsDraggingCategory(false);
				const text = e.dataTransfer.getData("text");
				if (!text) return;

				const parts = text
					.split(/[\n,;/，；、|\\]/)
					.map((s) => s.trim())
					.filter((s) => s !== "");

				if (parts.length === 0) return;

				setLyricLines((prev) => {
					const currentList = prev.metadata[index].value;
					const existingSet = new Set<string>();
					const emptyIndices: number[] = [];

					currentList.forEach((val, i) => {
						if (val.trim() === "") {
							emptyIndices.push(i);
						} else {
							existingSet.add(val);
						}
					});

					for (const part of parts) {
						if (existingSet.has(part)) continue;

						if (emptyIndices.length > 0) {
							// biome-ignore lint/style/noNonNullAssertion: 肯定有
							const slotIndex = emptyIndices.shift()!;
							currentList[slotIndex] = part;
						} else {
							currentList.push(part);
						}
						existingSet.add(part);
					}
				});
			},
			[index, setLyricLines],
		);

		return (
			<tbody
				className={isDraggingCategory ? styles.dragOverCategory : undefined}
				onDragOver={(e) => {
					e.preventDefault();
					setIsDraggingCategory(true);
				}}
				onDragLeave={(e) => {
					if (!e.currentTarget.contains(e.relatedTarget as Node)) {
						setIsDraggingCategory(false);
					}
				}}
				onDrop={handleCategoryDrop}
			>
				{entry.value.map((vv, ii) => {
					const itemHasError = validation
						? vv.trim() !== "" && !validation.verifier(vv)
						: false;
					const isDuplicate =
						vv.trim() !== "" && entry.value.filter((v) => v === vv).length > 1;
					const hasAnyError = itemHasError || isDuplicate;

					const url = option?.urlFormatter?.(vv);
					const isLinkable = !!option?.isLinkable;
					const isValid = validation ? validation.verifier(vv) : true;
					const isButtonEnabled = !!url && isValid;

					return (
						<tr key={`metadata-${entry.key}-${ii}`}>
							<td>
								{ii === 0 && (
									<Flex
										align="center"
										gap="2"
										style={{
											width: "100%",
										}}
									>
										<span
											style={{
												display: "flex",
												color: "var(--gray-12)",
											}}
										>
											{option?.icon || <Info16Regular />}
										</span>

										<Text
											style={{
												whiteSpace: "normal",
												wordBreak: "break-word",
											}}
										>
											{option?.label || entry.key}
										</Text>
									</Flex>
								)}
							</td>
							<td>
								<Flex gap="1" ml="2" mt="1">
									<TextField.Root
										data-metadata-input="true"
										ref={(el) => {
											inputRefs.current[ii] = el;
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												setLyricLines((prev) => {
													prev.metadata[index].value.splice(ii + 1, 0, "");
												});
												setFocusIndex(ii + 1);
											} else if (
												e.key === "Backspace" &&
												e.currentTarget.value === ""
											) {
												if (e.repeat) return;

												e.preventDefault();

												if (ii > 0) {
													setLyricLines((prev) => {
														prev.metadata[index].value.splice(ii, 1);
													});
													setFocusIndex(ii - 1);
												} else {
													setLyricLines((prev) => {
														prev.metadata[index].value.splice(ii, 1);
														if (prev.metadata[index].value.length === 0) {
															prev.metadata.splice(index, 1);
														}
													});
												}
											} else if (e.key === "Tab" && !e.shiftKey) {
												const allInputs = Array.from(
													document.querySelectorAll<HTMLInputElement>(
														'[data-metadata-input="true"]',
													),
												);
												const currentIndex = allInputs.indexOf(e.currentTarget);
												const nextInput =
													currentIndex >= 0
														? allInputs[currentIndex + 1]
														: null;

												e.preventDefault();
												if (nextInput) {
													nextInput.focus();
													const len = nextInput.value.length;
													nextInput.setSelectionRange(len, len);
												} else {
													focusAddKeyButton();
												}
											}
										}}
										value={vv}
										className={`${styles.metadataInput} ${
											dragInputIndex === ii ? styles.dragOverInput : ""
										}`}
										onChange={(e) => {
											const newValue = e.currentTarget.value;
											setLyricLines((prev) => {
												prev.metadata[index].value[ii] = newValue;
											});
										}}
										onDragOver={(e) => {
											e.preventDefault();
											e.stopPropagation();
											setDragInputIndex(ii);
										}}
										onDragLeave={() => setDragInputIndex(null)}
										onDrop={(e) => {
											e.preventDefault();
											e.stopPropagation();
											setDragInputIndex(null);
											setIsDraggingCategory(false);
											const text = e.dataTransfer.getData("text");
											if (text) {
												setLyricLines((prev) => {
													prev.metadata[index].value[ii] = text;
												});
											}
										}}
										variant={hasAnyError ? "soft" : "surface"}
										color={
											itemHasError
												? validation?.severe
													? "red"
													: "orange"
												: isDuplicate
													? "red"
													: undefined
										}
									/>
									{entry.key === "cover_art" && vv && (
										<Box
											style={{
												width: "32px",
												height: "32px",
												borderRadius: "4px",
												overflow: "hidden",
												flexShrink: 0,
											}}
										>
											<img
												src={getBetterGeniusCoverArt(vv, 100)}
												alt="Cover"
												style={{
													width: "100%",
													height: "100%",
													objectFit: "cover",
												}}
												referrerPolicy="no-referrer"
											/>
										</Box>
									)}
									{isLinkable && (
										<IconButton
											disabled={!isButtonEnabled}
											asChild={isButtonEnabled}
											variant="soft"
											title={t("metadataDialog.openLink", "Open link")}
										>
											{isButtonEnabled ? (
												<a
													href={url || ""}
													target="_blank"
													rel="noopener noreferrer"
												>
													<Open16Regular />
												</a>
											) : (
												<Open16Regular />
											)}
										</IconButton>
									)}
									<IconButton
										variant="soft"
										onClick={() => {
											setLyricLines((prev) => {
												prev.metadata[index].value.splice(ii, 1);
												if (prev.metadata[index].value.length === 0) {
													prev.metadata.splice(index, 1);
												}
											});
										}}
									>
										<Delete16Regular />
									</IconButton>
								</Flex>
							</td>
						</tr>
					);
				})}
				<tr className={styles.newItemLine}>
					<td />
					<td className={styles.newItemBtnRow}>
						<Flex direction="column">
							{validation && rowHasError && (
								<Text
									color={validation.severe ? "red" : "orange"}
									size="1"
									mb="1"
									mt="1"
									wrap="wrap"
								>
									{validation.message}
								</Text>
							)}
							{rowHasDuplicate && (
								<Text color="red" size="1" mb="1" mt="1" wrap="wrap">
									{t(
										"metadataDialog.duplicateMsg",
										"Found duplicate metadata values",
									)}
								</Text>
							)}
							<Button
								variant="soft"
								my="1"
								onClick={() => {
									setLyricLines((prev) => {
										prev.metadata[index].value.push("");
									});
								}}
							>
								{t("metadataDialog.addValue", "Add")}
							</Button>
						</Flex>
					</td>
				</tr>
			</tbody>
		);
	},
);

interface SelectOption {
	label: string;
	value: string;
	icon: ReactNode;
	isLinkable?: true;
	urlFormatter?: (value: string) => string | null;
	validation?: {
		verifier: (value: string) => boolean;
		message: string;
		/** red for true, orange for false */
		severe?: boolean;
	};
}

export const MetadataEditor = () => {
	const [metadataEditorDialog, setMetadataEditorDialog] = useAtom(
		metadataEditorDialogAtom,
	);
	const [customKey, setCustomKey] = useState("");
	const [lyricLines, setLyricLines] = useImmerAtom(lyricLinesAtom);
	const addKeyButtonRef = useRef<HTMLButtonElement | null>(null);
	const setGeniusSearchDialogOpen = useSetAtom(geniusSearchDialogAtom);

	const { t } = useTranslation();

	const builtinOptions: SelectOption[] = useMemo(() => {
		const numeric = (value: string) => /^\d+$/.test(value);
		const alphanumeric = (value: string) => /^[a-zA-Z0-9]+$/.test(value);

		const getPlatformUrl = (key: string, value: string) => {
			if (!value || !value.trim()) return null;

			switch (key) {
				case "ncmMusicId":
					return `https://music.163.com/#/song?id=${value}`;
				case "qqMusicId":
					return `https://y.qq.com/n/ryqq/songDetail/${value}`;
				case "spotifyId":
					return `https://open.spotify.com/track/${value}`;
				case "appleMusicId":
					return `https://music.apple.com/song/${value}`;
				case "ttmlAuthorGithubLogin":
					return `https://github.com/${value}`;
				case "isrc":
					return `https://isrcsearch.ifpi.org/?tab=%22code%22&isrcCode=%22${value}%22`;
				default:
					return null;
			}
		};
		return [
			{
				// 歌词所匹配的歌曲名
				label: t("metadataDialog.builtinOptions.musicName", "Track Name"),
				value: "musicName",
				icon: <MusicNote1Regular />,
			},
			{
				// 歌词所匹配的歌手名
				label: t("metadataDialog.builtinOptions.artists", "Track Artists"),
				value: "artists",
				icon: <Person16Regular />,
				validation: {
					verifier: (value: string) => !/^.+[,;&，；、].+$/.test(value),
					message: t(
						"metadataDialog.builtinOptions.artistsInvalidMsg",
						"If there are multiple artists, please add this key multiple times instead of using delimiters; if an artist name contains delimiters, please ignore this message",
					),
				},
			},
			{
				label: t("metadataDialog.builtinOptions.songwriter", "Songwriter"),
				value: "songwriter",
				icon: <Person16Regular />,
				validation: {
					verifier: (value: string) => !/^.+[,;&，；、].+$/.test(value),
					message: t(
						"metadataDialog.builtinOptions.songwriterInvalidMsg",
						"If there are multiple songwriters, please add this key multiple times instead of using delimiters",
					),
				},
			},
			{
				// 歌词所匹配的专辑名
				label: t("metadataDialog.builtinOptions.album", "Album Name"),
				value: "album",
				icon: <AlbumRegular />,
			},
			{
				label: t("metadataDialog.builtinOptions.coverArt", "Cover URL"),
				value: "cover_art",
				icon: <Image16Regular />,
			},
			{
				// 歌词所匹配的网易云音乐 ID
				label: t(
					"metadataDialog.builtinOptions.ncmMusicId",
					"NetEase Music ID",
				),
				value: "ncmMusicId",
				icon: <NeteaseIcon />,
				isLinkable: true,
				urlFormatter: (val) => getPlatformUrl("ncmMusicId", val),
				validation: {
					verifier: numeric,
					message: t(
						"metadataDialog.builtinOptions.ncmMusicIdInvalidMsg",
						"NetEase Music ID should be numeric",
					),
					severe: true,
				},
			},
			{
				// 歌词所匹配的 QQ 音乐 ID
				label: t("metadataDialog.builtinOptions.qqMusicId", "QQ Music ID"),
				value: "qqMusicId",
				icon: <QQMusicIcon />,
				isLinkable: true,
				urlFormatter: (val) => getPlatformUrl("qqMusicId", val),
				validation: {
					verifier: alphanumeric,
					message: t(
						"metadataDialog.builtinOptions.qqMusicIdInvalidMsg",
						"QQ Music ID should be alphanumeric",
					),
					severe: true,
				},
			},
			{
				// 歌词所匹配的 Spotify 音乐 ID
				label: t("metadataDialog.builtinOptions.spotifyId", "Spotify Track ID"),
				value: "spotifyId",
				icon: <SpotifyIcon />,
				isLinkable: true,
				urlFormatter: (val) => getPlatformUrl("spotifyId", val),
				validation: {
					verifier: alphanumeric,
					message: t(
						"metadataDialog.builtinOptions.spotifyIdInvalidMsg",
						"Spotify Track ID should be alphanumeric",
					),
					severe: true,
				},
			},
			{
				// 歌词所匹配的 Apple Music 音乐 ID
				label: t(
					"metadataDialog.builtinOptions.appleMusicId",
					"Apple Music Track ID",
				),
				value: "appleMusicId",
				icon: <AppleMusicIcon />,
				isLinkable: true,
				urlFormatter: (val) => getPlatformUrl("appleMusicId", val),
				validation: {
					verifier: numeric,
					message: t(
						"metadataDialog.builtinOptions.appleMusicIdInvalidMsg",
						"Apple Music Track ID should be numeric",
					),
					severe: true,
				},
			},
			{
				// 歌词所匹配的 ISRC 编码
				label: t("metadataDialog.builtinOptions.isrc", "Track ISRC Code"),
				value: "isrc",
				icon: <NumberSymbol16Regular />,
				isLinkable: true,
				urlFormatter: (val) => getPlatformUrl("isrc", val),
				validation: {
					verifier: (value: string) =>
						/^[A-Z]{2}-?[A-Z0-9]{3}-?\d{2}-?\d{5}$/.test(value),
					message: t(
						"metadataDialog.builtinOptions.isrcInvalidMsg",
						"ISRC code format should be CC-XXX-YY-NNNNN",
					),
					severe: true,
				},
			},
			{
				// 逐词歌词作者 GitHub ID，例如 39523898
				label: t(
					"metadataDialog.builtinOptions.ttmlAuthorGithub",
					"Lyrics Author GitHub ID",
				),
				value: "ttmlAuthorGithub",
				icon: <GithubIcon />,
				validation: {
					verifier: numeric,
					message: t(
						"metadataDialog.builtinOptions.ttmlAuthorGithubInvalidMsg",
						"GitHub ID should be numeric",
					),
					severe: true,
				},
			},
			{
				// 逐词歌词作者 GitHub 用户名，例如 Steve-xmh
				label: t(
					"metadataDialog.builtinOptions.ttmlAuthorGithubLogin",
					"Lyrics Author GitHub Username",
				),
				value: "ttmlAuthorGithubLogin",
				icon: <GithubIcon />,
				isLinkable: true,
				urlFormatter: (val) => getPlatformUrl("ttmlAuthorGithubLogin", val),
				validation: {
					verifier: (value: string) =>
						/^(?!.*--)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(
							value,
						),
					message: t(
						"metadataDialog.builtinOptions.ttmlAuthorGithubLoginInvalidMsg",
						"GitHub username should be alphanumeric or hyphens, up to 39 characters",
					),
					severe: true,
				},
			},
		];
	}, [t]);

	const findOptionByKey = useCallback(
		(key: string) => {
			return builtinOptions.find((v) => v.value === key) || null;
		},
		[builtinOptions],
	);

	const focusAddKeyButton = useCallback(() => {
		addKeyButtonRef.current?.focus();
	}, []);

	return (
		<Dialog.Root
			open={metadataEditorDialog}
			onOpenChange={setMetadataEditorDialog}
		>
			<Dialog.Content className={styles.dialogContent}>
				<div className={styles.dialogHeader}>
					<Flex align="center" gap="2" justify="between">
						<Dialog.Title style={{ margin: 0 }}>
							{t("metadataDialog.title", "Metadata Editor")}
						</Dialog.Title>
						<IconButton variant="ghost" color="gray" asChild>
							<a
								href="https://github.com/bobjoerules/AMLL-TTML-TOOL"
								target="_blank"
								rel="noreferrer"
								title="GitHub"
							>
								<GithubIcon />
							</a>
						</IconButton>
					</Flex>
				</div>

				<div className={styles.dialogBody}>
					<table className={styles.metadataTable}>
						<thead>
							<tr>
								<th className={styles.keyColumn}>
									{t("metadataDialog.key", "Key")}
								</th>
								<th>{t("metadataDialog.value", "Value")}</th>
							</tr>
						</thead>
						{lyricLines.metadata.length === 0 && (
							<tbody>
								<tr style={{ height: "4em" }}>
									<td
										colSpan={2}
										style={{ color: "var(--gray-9)", textAlign: "center" }}
									>
										{t("metadataDialog.empty", "No metadata")}
									</td>
								</tr>
							</tbody>
						)}
						{lyricLines.metadata.map((v, i) => (
							<MetadataEntry
								key={`metadata-${v.key}`}
								entry={v}
								index={i}
								setLyricLines={setLyricLines}
								option={findOptionByKey(v.key)}
								focusAddKeyButton={focusAddKeyButton}
							/>
						))}
					</table>
				</div>
				<Flex
					gap="1"
					direction={{
						sm: "row",
						initial: "column",
					}}
					className={styles.dialogFooter}
				>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger
							style={{
								flex: "1 0 auto",
							}}
						>
							<Button variant="soft" ref={addKeyButtonRef}>
								{t("metadataDialog.addKeyValue", "Add new key-value")}
								<DropdownMenu.TriggerIcon />
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content>
							<Flex gap="1">
								<TextField.Root
									style={{
										flexGrow: "1",
									}}
									placeholder={t("metadataDialog.customKey", "Custom Key")}
									value={customKey}
									onChange={(e) => setCustomKey(e.currentTarget.value)}
								/>
								<IconButton
									variant="soft"
									onClick={() => {
										setLyricLines((prev) => {
											const existsKey = prev.metadata.find(
												(k) => k.key === customKey,
											);
											if (existsKey) {
												existsKey.value.push("");
											} else {
												prev.metadata.push({
													key: customKey,
													value: [""],
												});
											}
										});
										setCustomKey("");
									}}
								>
									<Add16Regular />
								</IconButton>
							</Flex>
							{builtinOptions.map((opt) => (
								<DropdownMenu.Item
									key={opt.value}
									onClick={() => {
										setLyricLines((prev) => {
											const existsKey = prev.metadata.find(
												(k) => k.key === opt.value,
											);
											if (existsKey) {
												existsKey.value.push("");
											} else {
												prev.metadata.push({
													key: opt.value,
													value: [""],
												});
											}
										});
									}}
								>
									<Flex align="center" gap="1">
										{opt.icon}
										{opt.label}
									</Flex>
								</DropdownMenu.Item>
							))}
						</DropdownMenu.Content>
					</DropdownMenu.Root>
					<Button
						style={{
							flex: "1 0 auto",
						}}
						variant="soft"
						onClick={() => setGeniusSearchDialogOpen(true)}
					>
						<Search16Regular />
						{t(
							"metadataDialog.fetchSongwriters.button",
							"Fetch Songwriters from Genius",
						)}
					</Button>
					<Button
						style={{ flex: "1 0 auto" }}
						variant="soft"
						onClick={() => {
							setLyricLines((prev) => {
								for (const opt of builtinOptions) {
									const existsKey = prev.metadata.find(
										(k) => k.key === opt.value,
									);
									if (!existsKey) {
										prev.metadata.push({
											key: opt.value,
											value: [""],
										});
									}
								}
							});
						}}
					>
						{t("metadataDialog.addPresets", "Add all preset keys")}
					</Button>
					<Button
						style={{ flex: "1 0 auto" }}
						color="red"
						variant="solid"
						onClick={() => {
							setLyricLines((prev) => {
								prev.metadata = [];
							});
						}}
					>
						<Delete16Regular />
						{t("metadataDialog.clear", "Clear")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
