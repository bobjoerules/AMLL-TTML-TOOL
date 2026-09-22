import {
	ArrowHookUpLeft24Regular,
	Dismiss24Regular,
	Image24Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Flex,
	Heading,
	IconButton,
	Slider,
	Text,
} from "@radix-ui/themes";
import { openDB } from "idb";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
	backgroundModeAtom,
	selectedGradientAtom,
	useCustomGradientAtom,
} from "$/modules/settings/states";

const CUSTOM_BACKGROUND_DB = "amll-custom-background";
const CUSTOM_BACKGROUND_STORE = "background-image";
const CUSTOM_BACKGROUND_KEY = "main";

type CustomBackgroundRecord = {
	key: string;
	blob?: Blob;
	buffer?: ArrayBuffer;
	mime?: string;
	updatedAt: number;
};

const getCustomBackgroundDb = async () => {
	if (typeof indexedDB === "undefined") return null;
	try {
		return await openDB(CUSTOM_BACKGROUND_DB, 1, {
			upgrade(db) {
				if (!db.objectStoreNames.contains(CUSTOM_BACKGROUND_STORE)) {
					db.createObjectStore(CUSTOM_BACKGROUND_STORE, { keyPath: "key" });
				}
			},
		});
	} catch {
		return null;
	}
};

const readLegacyCustomBackground = async () => {
	try {
		const raw = localStorage.getItem("customBackgroundImage");
		if (!raw) return null;
		const parsed = JSON.parse(raw) as string | null;
		if (!parsed || typeof parsed !== "string") {
			localStorage.removeItem("customBackgroundImage");
			return null;
		}
		if (!parsed.startsWith("data:")) {
			localStorage.removeItem("customBackgroundImage");
			return null;
		}
		const response = await fetch(parsed);
		const blob = await response.blob();
		localStorage.removeItem("customBackgroundImage");
		return blob;
	} catch {
		return null;
	}
};

export const readCustomBackgroundBlob = async () => {
	try {
		const db = await getCustomBackgroundDb();
		if (db) {
			const record = (await db.get(
				CUSTOM_BACKGROUND_STORE,
				CUSTOM_BACKGROUND_KEY,
			)) as CustomBackgroundRecord | undefined;
			if (record) {
				if (record.buffer && record.mime) {
					return new Blob([record.buffer], { type: record.mime });
				}
				if (record.blob) return record.blob;
			}
		}
	} catch (e) {
		console.warn("Failed to read custom background from IndexedDB:", e);
	}
	const legacy = await readLegacyCustomBackground();
	if (!legacy) return null;
	try {
		await writeCustomBackgroundBlob(legacy);
	} catch {}
	return legacy;
};

export const writeCustomBackgroundBlob = async (blob: Blob | null) => {
	try {
		const db = await getCustomBackgroundDb();
		if (!db) return;
		if (!blob) {
			await db.delete(CUSTOM_BACKGROUND_STORE, CUSTOM_BACKGROUND_KEY);
			return;
		}
		const buffer = await blob.arrayBuffer();
		const mime = blob.type || "image/png";
		const record: CustomBackgroundRecord = {
			key: CUSTOM_BACKGROUND_KEY,
			blob,
			buffer,
			mime,
			updatedAt: Date.now(),
		};
		await db.put(CUSTOM_BACKGROUND_STORE, record);
	} catch (e) {
		console.warn("Failed to write custom background to IndexedDB:", e);
	}
};

const customBackgroundImageValueAtom = atom<string | null>(null);

export const customBackgroundImageAtom = atom(
	(get) => get(customBackgroundImageValueAtom),
	async (get, set, next: File | Blob | null) => {
		const previous = get(customBackgroundImageValueAtom);
		if (previous) {
			URL.revokeObjectURL(previous);
		}
		if (!next) {
			await writeCustomBackgroundBlob(null);
			set(customBackgroundImageValueAtom, null);
			return;
		}
		await writeCustomBackgroundBlob(next);
		const url = URL.createObjectURL(next);
		set(customBackgroundImageValueAtom, url);
	},
);

export const customBackgroundImageInitAtom = atom(null, async (get, set) => {
	const previous = get(customBackgroundImageValueAtom);
	if (previous) {
		URL.revokeObjectURL(previous);
	}
	const blob = await readCustomBackgroundBlob();
	if (!blob) {
		set(customBackgroundImageValueAtom, null);
		return;
	}
	const url = URL.createObjectURL(blob);
	set(customBackgroundImageValueAtom, url);
});

export const hasCustomBackgroundAtom = atom((get) => {
	const mode = get(backgroundModeAtom);
	if (mode === "image") {
		return !!get(customBackgroundImageAtom);
	}
	if (mode === "gradient") {
		return !!(get(selectedGradientAtom) || get(useCustomGradientAtom));
	}
	return false;
});

export const customBackgroundOpacityAtom = atomWithStorage(
	"customBackgroundOpacity",
	0.8,
);

export const customBackgroundMaskAtom = atomWithStorage(
	"customBackgroundMask",
	0.2,
);

export const customBackgroundBlurAtom = atomWithStorage(
	"customBackgroundBlur",
	0,
);

export const customBackgroundBrightnessAtom = atomWithStorage(
	"customBackgroundBrightness",
	1,
);

export const SettingsCustomBackgroundSettings = ({
	onClose,
}: {
	onClose: () => void;
}) => {
	const customBackgroundImage = useAtomValue(customBackgroundImageAtom);
	const setCustomBackgroundImage = useSetAtom(customBackgroundImageAtom);
	const setBackgroundMode = useSetAtom(backgroundModeAtom);
	const [customBackgroundOpacity, setCustomBackgroundOpacity] = useAtom(
		customBackgroundOpacityAtom,
	);
	const [customBackgroundMask, setCustomBackgroundMask] = useAtom(
		customBackgroundMaskAtom,
	);
	const [customBackgroundBlur, setCustomBackgroundBlur] = useAtom(
		customBackgroundBlurAtom,
	);
	const [customBackgroundBrightness, setCustomBackgroundBrightness] = useAtom(
		customBackgroundBrightnessAtom,
	);
	const { t } = useTranslation();
	const backgroundFileInputRef = useRef<HTMLInputElement>(null);

	const onSelectBackgroundFile = useCallback(
		(file: File) => {
			setBackgroundMode("image");
			setCustomBackgroundImage(file);
		},
		[setBackgroundMode, setCustomBackgroundImage],
	);

	return (
		<Flex direction="column" gap="4">
			<Flex align="center" justify="between">
				<Heading size="4">
					{t("settings.common.customBackground", "Custom Background")}
				</Heading>
				<IconButton variant="ghost" onClick={onClose}>
					<Dismiss24Regular />
				</IconButton>
			</Flex>

			<Card>
				<Flex direction="column" gap="3">
					<Text size="1" color="gray">
						{t(
							"settings.common.customBackgroundDesc",
							"Select an image to use as background.",
						)}
					</Text>
					<input
						ref={backgroundFileInputRef}
						type="file"
						accept="image/*"
						style={{ display: "none" }}
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (!file) return;
							onSelectBackgroundFile(file);
							event.target.value = "";
						}}
					/>
					<Flex gap="2" align="center">
						<Button
							variant="soft"
							onClick={() => backgroundFileInputRef.current?.click()}
						>
							{t("settings.common.customBackgroundPick", "Select Image")}
						</Button>
						<Button
							variant="ghost"
							disabled={!customBackgroundImage}
							onClick={() => setCustomBackgroundImage(null)}
						>
							{t("settings.common.customBackgroundClear", "Clear")}
						</Button>
					</Flex>
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="2">
					<Flex align="center" justify="between">
						<Text>
							{t("settings.common.customBackgroundOpacity", "Opacity")}
						</Text>
						<Flex align="center" gap="2">
							<Text wrap="nowrap" color="gray" size="1">
								{Math.round(customBackgroundOpacity * 100)}%
							</Text>
							{customBackgroundOpacity !== 0.8 && (
								<IconButton
									variant="ghost"
									size="1"
									onClick={() => setCustomBackgroundOpacity(0.8)}
								>
									<ArrowHookUpLeft24Regular />
								</IconButton>
							)}
						</Flex>
					</Flex>
					<Slider
						min={0}
						max={1}
						step={0.01}
						value={[customBackgroundOpacity]}
						onValueChange={(v) => setCustomBackgroundOpacity(v[0])}
					/>
					{customBackgroundOpacity >= 0.9 && (
						<Text size="1" color="orange">
							{t(
								"settings.common.customBackgroundOpacityWarning",
								"If this value is too high, it might obscure page content.",
							)}
						</Text>
					)}
				</Flex>
			</Card>

			<Card style={{ marginBottom: "var(--space-1)" }}>
				<Flex direction="column" gap="2">
					<Flex align="center" justify="between">
						<Text>{t("settings.common.customBackgroundMask", "Mask")}</Text>
						<Flex align="center" gap="2">
							<Text wrap="nowrap" color="gray" size="1">
								{Math.round(customBackgroundMask * 100)}%
							</Text>
							{customBackgroundMask !== 0.2 && (
								<IconButton
									variant="ghost"
									size="1"
									onClick={() => setCustomBackgroundMask(0.2)}
								>
									<ArrowHookUpLeft24Regular />
								</IconButton>
							)}
						</Flex>
					</Flex>
					<Slider
						min={0}
						max={1}
						step={0.01}
						value={[customBackgroundMask]}
						onValueChange={(v) => setCustomBackgroundMask(v[0])}
					/>
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="2">
					<Flex align="center" justify="between">
						<Text>
							{t("settings.common.customBackgroundBlur", "Blur Radius")}
						</Text>
						<Flex align="center" gap="2">
							<Text wrap="nowrap" color="gray" size="1">
								{customBackgroundBlur.toFixed(0)}px
							</Text>
							{customBackgroundBlur !== 0 && (
								<IconButton
									variant="ghost"
									size="1"
									onClick={() => setCustomBackgroundBlur(0)}
								>
									<ArrowHookUpLeft24Regular />
								</IconButton>
							)}
						</Flex>
					</Flex>
					<Slider
						min={0}
						max={30}
						step={1}
						value={[customBackgroundBlur]}
						onValueChange={(v) => setCustomBackgroundBlur(v[0])}
					/>
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="2">
					<Flex align="center" justify="between">
						<Text>
							{t("settings.common.customBackgroundBrightness", "Brightness")}
						</Text>
						<Flex align="center" gap="2">
							<Text wrap="nowrap" color="gray" size="1">
								{Math.round(customBackgroundBrightness * 100)}%
							</Text>
							{customBackgroundBrightness !== 1 && (
								<IconButton
									variant="ghost"
									size="1"
									onClick={() => setCustomBackgroundBrightness(1)}
								>
									<ArrowHookUpLeft24Regular />
								</IconButton>
							)}
						</Flex>
					</Flex>
					<Slider
						min={0.5}
						max={1.5}
						step={0.01}
						value={[customBackgroundBrightness]}
						onValueChange={(v) => setCustomBackgroundBrightness(v[0])}
					/>
				</Flex>
			</Card>
		</Flex>
	);
};

export const SettingsCustomBackgroundCard = ({
	onOpen,
}: {
	onOpen: () => void;
}) => {
	const customBackgroundImage = useAtomValue(customBackgroundImageAtom);
	const { t } = useTranslation();

	return (
		<Card style={{ width: "100%", marginBottom: "var(--space-1)" }}>
			<Flex gap="3" align="center">
				<Image24Regular />
				<Box flexGrow="1">
					<Flex align="center" justify="between" gap="4">
						<Flex direction="column" gap="1">
							<Text>
								{t("settings.common.customBackground", "Custom Background")}
							</Text>
							<Text size="1" color="gray">
								{customBackgroundImage
									? t(
											"settings.common.customBackgroundEnabled",
											"Background applied",
										)
									: t(
											"settings.common.customBackgroundDesc",
											"Select an image to use as background.",
										)}
							</Text>
						</Flex>
						<Button variant="soft" onClick={onOpen}>
							{t("settings.common.customBackgroundManage", "Manage")}
						</Button>
					</Flex>
				</Box>
			</Flex>
		</Card>
	);
};
