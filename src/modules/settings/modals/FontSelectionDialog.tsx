import {
	DismissRegular,
	Search16Regular,
	TextFont24Regular,
	ArrowUpload24Regular,
	Delete20Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Dialog,
	Flex,
	Grid,
	Heading,
	IconButton,
	ScrollArea,
	SegmentedControl,
	Text,
	TextField,
	VisuallyHidden,
} from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import { useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { fontSelectionDialogAtom } from "$/states/dialogs";
import {
	appFontAtom,
	appFontStyleAtom,
	appFontWeightAtom,
	customFontDataAtom,
	customFontNameAtom,
	editorFontAtom,
	previewFontAtom,
	fontSelectionTargetAtom,
	type FontSelectionTarget,
	customEditorFontDataAtom,
	customEditorFontNameAtom,
	customPreviewFontDataAtom,
	customPreviewFontNameAtom,
} from "../states/index.ts";

// A massive library of popular Google Fonts (300+)
export const GOOGLE_FONTS = [
	"Inter",
	"Roboto",
	"Open Sans",
	"Montserrat",
	"Lato",
	"Poppins",
	"Source Sans Pro",
	"Roboto Condensed",
	"Oswald",
	"Raleway",
	"Merriweather",
	"Noto Sans",
	"Playfair Display",
	"Mukta",
	"Rubik",
	"Lora",
	"Nunito",
	"Ubuntu",
	"PT Sans",
	"Work Sans",
	"Arimo",
	"Quicksand",
	"Kanit",
	"Noto Serif",
	"Barlow",
	"Titillium Web",
	"Fira Sans",
	"Nanum Gothic",
	"Heebo",
	"Josefin Sans",
	"Dosis",
	"Arvo",
	"Oxygen",
	"PT Serif",
	"Libre Franklin",
	"Hind",
	"Bitter",
	"Karla",
	"Bebas Neue",
	"Crimson Text",
	"Libre Baskerville",
	"Cabin",
	"Anton",
	"Abel",
	"Cairo",
	"Exo 2",
	"Varela Round",
	"Prompt",
	"EB Garamond",
	"Muli",
	"Comfortaa",
	"Orbitron",
	"Questrial",
	"Saira",
	"Archivo",
	"Rajdhani",
	"Pacifico",
	"Dancing Script",
	"Caveat",
	"Satisfy",
	"Lobster",
	"Righteous",
	"Permanent Marker",
	"Fredoka One",
	"Patua One",
	"Yellowtail",
	"Abril Fatface",
	"Kaushan Script",
	"Passion One",
	"Lobster Two",
	"Courgette",
	"Shadows Into Light",
	"Creepster",
	"Bangers",
	"Luckiest Guy",
	"Sacramento",
	"Cookie",
	"Great Vibes",
	"Indie Flower",
	"Zilla Slab",
	"Cinzel",
	"Cormorant Garamond",
	"Domine",
	"Cardo",
	"Josefin Slab",
	"Spectral",
	"Tinos",
	"Old Standard TT",
	"Crimson Pro",
	"JetBrains Mono",
	"Fira Code",
	"Source Code Pro",
	"Inconsolata",
	"Ubuntu Mono",
	"Space Mono",
	"IBM Plex Mono",
	"Courier Prime",
	"Anonymous Pro",
	"Nanum Gothic Coding",
	"Alice",
	"Amatic SC",
	"Assistant",
	"Balsamiq Sans",
	"Bebas Neue",
	"BioRhyme",
	"Bree Serif",
	"Cantarell",
	"Catamaran",
	"Chivo",
	"Cinzel Decorative",
	"Concert One",
	"Cookie",
	"Cormorant",
	"Cuprum",
	"DM Sans",
	"DM Serif Display",
	"Didact Gothic",
	"Eczar",
	"Faustina",
	"Frank Ruhl Libre",
	"Gelasio",
	"Hind Siliguri",
	"Inika",
	"Jost",
	"Kufam",
	"Lexend",
	"Libre Caslon Text",
	"Manrope",
	"Martel",
	"Newsreader",
	"Overpass",
	"Oxanium",
	"Public Sans",
	"Recursive",
	"Red Hat Display",
	"Sen",
	"Sora",
	"Syne",
	"Tenor Sans",
	"Urbanist",
	"Vollkorn",
	"Yantramanav",
	"Alata",
	"Aleo",
	"Almarai",
	"Amaranth",
	"Asap",
	"Asap Condensed",
	"Averia Serif Libre",
	"B612",
	"Baloo 2",
	"Baskervville",
	"Belleza",
	"Bodoni Moda",
	"Calistoga",
	"Castoro",
	"Chakra Petch",
	"Charm",
	"Codystar",
	"Coming Soon",
	"Copse",
	"Covered By Your Grace",
	"DM Mono",
	"Darker Grotesque",
	"Delius",
	"Diplomata SC",
	"Domine",
	"DotGothic16",
	"Eagle Lake",
	"Economica",
	"El Messiri",
	"Enriqueta",
	"Ewert",
	"Fahkwang",
	"Fanwood Text",
	"Farro",
	"Farsan",
	"Fascinate",
	"Fauna One",
	"Federant",
	"Federo",
	"Felipa",
	"Fenix",
	"Finger Paint",
	"Flamenco",
	"Flavors",
	"Fondamento",
	"Forum",
	"Fraunces",
	"Fredericka the Great",
	"Fresca",
	"Frijole",
	"Fugaz One",
	"GFS Didot",
	"GFS Neohellenic",
	"Gabriela",
	"Gafata",
	"Galada",
	"Galdeano",
	"Galindo",
	"Gentium Basic",
	"Gentium Book Basic",
	"Geo",
	"Geostar",
	"Geostar Fill",
	"Germania One",
	"Gidugu",
	"Gilda Display",
	"Give You Glory",
	"Glass Antiqua",
	"Glegoo",
	"Gloria Hallelujah",
	"Glory",
	"Gluten",
	"Goblin One",
	"Gochi Hand",
	"Goldman",
	"Goudy Bookletter 1911",
	"Gowun Batang",
	"Gowun Dodum",
	"Graduate",
	"Grand Hotel",
	"Grandstander",
	"Gravitas One",
	"Great Vibes",
	"Grechen Fuemen",
	"Grenze",
	"Grenze Gotisch",
	"Griffy",
	"Gruppo",
	"Gudea",
	"Gugi",
	"Gupter",
	"Gurajada",
	"Habibi",
	"Halant",
	"Hammersmith One",
	"Hanalei",
	"Hanalei Fill",
	"Handlee",
	"Hanuman",
	"Happy Monkey",
	"Hepta Slab",
	"Herr Von Muellerhoff",
	"Hi Melody",
	"Hina Mincho",
	"Hind Guntur",
	"Hind Madurai",
	"Hind Vadodara",
	"Holtwood One SC",
	"Homemade Apple",
	"Hubballi",
	"IBM Plex Sans",
	"IBM Plex Serif",
	"IM Fell DW Pica",
	"IM Fell Double Pica",
	"IM Fell English",
	"IM Fell French Canon",
	"IM Fell Great Primer",
	"Ibarra Real Nova",
	"Iceberg",
	"Iceland",
	"Imbue",
	"Imperial Script",
	"Imprima",
	"Inspiration",
	"Instrument Sans",
	"Inter Tight",
];

export interface SystemFontDef {
	label: string;
	value: string;
}

const SYSTEM_FONTS: SystemFontDef[] = [
	{ label: "Arial", value: "Arial, Helvetica, sans-serif" },
	{ label: "Helvetica", value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
	{ label: "Verdana", value: "Verdana, Geneva, sans-serif" },
	{ label: "Tahoma", value: "Tahoma, Verdana, Segoe UI, sans-serif" },
	{ label: "Trebuchet MS", value: '"Trebuchet MS", "Lucida Grande", "Lucida Sans Unicode", sans-serif' },
	{ label: "Impact", value: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif' },
	{ label: "Times New Roman", value: '"Times New Roman", Times, Georgia, serif' },
	{ label: "Georgia", value: 'Georgia, Cambria, "Times New Roman", Times, serif' },
	{ label: "Garamond", value: 'Garamond, "Baskerville", "Baskerville Old Face", serif' },
	{ label: "Courier New", value: '"Courier New", Courier, monospace' },
	{ label: "Comic Sans MS", value: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", cursive, sans-serif' },
	{ label: "Palatino", value: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif' },
	{ label: "Bookman", value: '"Bookman Old Style", Bookman, Georgia, serif' },
	{ label: "Apple System", value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
	{ label: "Segoe UI", value: '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif' },
	{ label: "San Francisco", value: 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro", sans-serif' },
	{ label: "Avenir", value: '"Avenir Next", Avenir, "Segoe UI", sans-serif' },
	{ label: "Futura", value: 'Futura, "Century Gothic", "AppleGothic", sans-serif' },
	{ label: "Optima", value: 'Optima, Candara, "Segoe UI", sans-serif' },
	{ label: "Gill Sans", value: '"Gill Sans", "Gill Sans MT", Calibri, sans-serif' },
	{ label: "Franklin Gothic", value: '"Franklin Gothic Medium", Arial, sans-serif' },
	{ label: "Century Gothic", value: '"Century Gothic", AppleGothic, sans-serif' },
	{ label: "Lucida Grande", value: '"Lucida Grande", "Lucida Sans Unicode", "Lucida Sans", sans-serif' },
];

const DEFAULT_FONTS = [
	{
		label: "AMLL Default (MiSans)",
		value:
			'"MiSans", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
	},
	{
		label: "Modern Sans Stack",
		value:
			'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
	},
	{
		label: "Modern Serif Stack",
		value: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
	},
	{
		label: "Modern Mono Stack",
		value:
			'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
	},
];

export const FontSelectionDialog = () => {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useAtom(fontSelectionDialogAtom);
	const [targetScope, setTargetScope] = useAtom(fontSelectionTargetAtom);
	const [appFont, setAppFont] = useAtom(appFontAtom);
	const [editorFont, setEditorFont] = useAtom(editorFontAtom);
	const [previewFont, setPreviewFont] = useAtom(previewFontAtom);

	const [appFontWeight, setAppFontWeight] = useAtom(appFontWeightAtom);
	const [appFontStyle, setAppFontStyle] = useAtom(appFontStyleAtom);

	const [customFontData, setCustomFontData] = useAtom(customFontDataAtom);
	const [customFontName, setCustomFontName] = useAtom(customFontNameAtom);
	const [customEditorFontData, setCustomEditorFontData] = useAtom(
		customEditorFontDataAtom,
	);
	const [customEditorFontName, setCustomEditorFontName] = useAtom(
		customEditorFontNameAtom,
	);
	const [customPreviewFontData, setCustomPreviewFontData] = useAtom(
		customPreviewFontDataAtom,
	);
	const [customPreviewFontName, setCustomPreviewFontName] = useAtom(
		customPreviewFontNameAtom,
	);

	const currentFont =
		targetScope === "editor"
			? editorFont
			: targetScope === "preview"
				? previewFont
				: appFont;

	const currentCustomName =
		targetScope === "editor"
			? customEditorFontName
			: targetScope === "preview"
				? customPreviewFontName
				: customFontName;

	const [searchQuery, setSearchQuery] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);

	const standardStacks = useMemo(() => {
		const stacks = [...DEFAULT_FONTS];
		if (targetScope === "editor") {
			stacks.unshift({
				label: t("settings.appearance.inheritAppFont", "Inherit Application Font"),
				value: "inherit",
			});
		} else if (targetScope === "preview") {
			stacks.unshift(
				{
					label: t(
						"settings.appearance.defaultPreviewFont",
						"Default (SpicyLyrics / Toxi)",
					),
					value: "default",
				},
				{
					label: t(
						"settings.appearance.inheritAppFont",
						"Inherit Application Font",
					),
					value: "inherit",
				},
			);
		}
		return stacks;
	}, [targetScope, t]);

	const filteredGoogleFonts = useMemo(() => {
		const search = searchQuery.toLowerCase();
		return GOOGLE_FONTS.filter((font) => font.toLowerCase().includes(search));
	}, [searchQuery]);

	const filteredSystemFonts = useMemo(() => {
		const search = searchQuery.toLowerCase();
		return SYSTEM_FONTS.filter((font) =>
			font.label.toLowerCase().includes(search),
		);
	}, [searchQuery]);

	const handleSelectFont = (fontFamily: string, isGoogleFont = true) => {
		const val = isGoogleFont ? `"${fontFamily}", sans-serif` : fontFamily;
		if (isGoogleFont) {
			const fontId = `google-font-${fontFamily.replace(/\s+/g, "-")}`;
			if (!document.getElementById(fontId)) {
				const link = document.createElement("link");
				link.id = fontId;
				link.rel = "stylesheet";
				link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, "+")}:wght@300;400;500;600;700;800&display=swap`;
				link.onerror = () => {
					link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, "+")}&display=swap`;
				};
				document.head.appendChild(link);
			}
		}
		if (targetScope === "editor") {
			setEditorFont(val);
			document.documentElement.style.setProperty(
				"--editor-font-family",
				val === "inherit" ? appFont : val,
			);
		} else if (targetScope === "preview") {
			setPreviewFont(val);
			document.documentElement.style.setProperty(
				"--preview-font-family",
				val === "default"
					? '"SpicyLyrics", "Noto Sans Georgian", "VazirmatnRegular", sans-serif'
					: val === "inherit"
						? appFont
						: val,
			);
			document.documentElement.style.setProperty(
				"--toxi-font-family",
				val === "default"
					? '"SF Pro Display", "SF Pro", "Inter", -apple-system, BlinkMacSystemFont, sans-serif'
					: val === "inherit"
						? appFont
						: val,
			);
		} else {
			setAppFont(val);
			document.documentElement.style.setProperty("--default-font-family", val);
			if (editorFont === "inherit") {
				document.documentElement.style.setProperty("--editor-font-family", val);
			}
			if (previewFont === "inherit") {
				document.documentElement.style.setProperty(
					"--preview-font-family",
					val,
				);
				document.documentElement.style.setProperty(
					"--toxi-font-family",
					val,
				);
			}
		}
	};

	const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			const dataUrl = event.target?.result as string;
			const fontName = file.name.split(".")[0].replace(/[^a-zA-Z0-9]/g, "");
			const fontVal = `"${fontName}", sans-serif`;
			if (targetScope === "editor") {
				setCustomEditorFontData(dataUrl);
				setCustomEditorFontName(fontName);
				setEditorFont(fontVal);
				document.documentElement.style.setProperty("--editor-font-family", fontVal);
			} else if (targetScope === "preview") {
				setCustomPreviewFontData(dataUrl);
				setCustomPreviewFontName(fontName);
				setPreviewFont(fontVal);
				document.documentElement.style.setProperty(
					"--preview-font-family",
					fontVal,
				);
				document.documentElement.style.setProperty(
					"--toxi-font-family",
					fontVal,
				);
			} else {
				setCustomFontData(dataUrl);
				setCustomFontName(fontName);
				setAppFont(fontVal);
				document.documentElement.style.setProperty("--default-font-family", fontVal);
			}
			toast.success(
				t(
					"settings.appearance.fontImportSuccess",
					"Font imported successfully!",
				),
			);
		};
		reader.readAsDataURL(file);
	};

	const clearCustomFont = () => {
		if (targetScope === "editor") {
			setCustomEditorFontData(null);
			setCustomEditorFontName(null);
			setEditorFont("inherit");
			document.documentElement.style.setProperty("--editor-font-family", appFont);
		} else if (targetScope === "preview") {
			setCustomPreviewFontData(null);
			setCustomPreviewFontName(null);
			setPreviewFont("default");
			document.documentElement.style.setProperty(
				"--preview-font-family",
				'"SpicyLyrics", "Noto Sans Georgian", "VazirmatnRegular", sans-serif',
			);
			document.documentElement.style.setProperty(
				"--toxi-font-family",
				'"SF Pro Display", "SF Pro", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
			);
		} else {
			setCustomFontData(null);
			setCustomFontName(null);
			const defaultFont =
				'"MiSans", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
			setAppFont(defaultFont);
			document.documentElement.style.setProperty(
				"--default-font-family",
				defaultFont,
			);
		}
	};

	const isFontSelected = (fontValue: string) => {
		if (currentFont === fontValue) return true;
		if (currentFont && fontValue) {
			const cleanCurrent = currentFont.replace(/["']/g, "").trim().toLowerCase();
			const cleanTarget = fontValue.replace(/["']/g, "").trim().toLowerCase();
			if (cleanCurrent === cleanTarget) return true;
			if (cleanCurrent.startsWith(cleanTarget + ",") || cleanTarget.startsWith(cleanCurrent + ",")) return true;
		}
		return false;
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content
				style={{
					maxWidth: 850,
					width: "95vw",
					height: "90vh",
					maxHeight: 900,
					padding: "24px 32px",
					display: "flex",
					flexDirection: "column",
					boxSizing: "border-box",
				}}
			>
				<VisuallyHidden>
					<Dialog.Description>
						Select a font from standard, system, or Google fonts library.
					</Dialog.Description>
				</VisuallyHidden>
				<Flex justify="between" align="center" mb="4" style={{ flexShrink: 0 }}>
					<Flex align="center" gap="3">
						<TextFont24Regular />
						<Dialog.Title mb="0" style={{ fontSize: "28px" }}>
							{t("settings.appearance.fontLibrary", "Font Library")}
						</Dialog.Title>
					</Flex>
					<Dialog.Close>
						<IconButton
							variant="ghost"
							color="gray"
							style={{ cursor: "pointer", margin: 0 }}
						>
							<DismissRegular />
						</IconButton>
					</Dialog.Close>
				</Flex>

				<Flex direction="column" gap="4" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
					<Flex direction="column" gap="2" style={{ flexShrink: 0 }}>
						<Text size="2" weight="bold" color="gray">
							{t("settings.appearance.fontScope", "Customize Font For:")}
						</Text>
						<SegmentedControl.Root
							size="3"
							value={targetScope}
							onValueChange={(v) => setTargetScope(v as FontSelectionTarget)}
							style={{ width: "100%" }}
						>
							<SegmentedControl.Item value="app" style={{ flexGrow: 1 }}>
								{t("settings.appearance.fontScopeApp", "Application UI")}
							</SegmentedControl.Item>
							<SegmentedControl.Item value="editor" style={{ flexGrow: 1 }}>
								{t("settings.appearance.fontScopeEditor", "Lyric Editor")}
							</SegmentedControl.Item>
							<SegmentedControl.Item value="preview" style={{ flexGrow: 1 }}>
								{t("settings.appearance.fontScopePreview", "Lyrics Preview")}
							</SegmentedControl.Item>
						</SegmentedControl.Root>
					</Flex>

					<Card
						variant="surface"
						style={{
							padding: "16px 20px",
							backgroundColor: "var(--gray-2)",
							flexShrink: 0,
						}}
					>
						<Grid columns="2" gap="5" width="100%">
							<Flex direction="column" gap="2">
								<Text size="3" weight="bold">
									{t("settings.appearance.fontWeight", "Font Weight")}
								</Text>
								<SegmentedControl.Root
									size="3"
									value={appFontWeight}
									onValueChange={setAppFontWeight}
									style={{ width: "100%" }}
								>
									<SegmentedControl.Item value="400" style={{ flexGrow: 1 }}>
										{t("settings.appearance.weight.regular", "Regular")}
									</SegmentedControl.Item>
									<SegmentedControl.Item value="700" style={{ flexGrow: 1 }}>
										{t("settings.appearance.weight.bold", "Bold")}
									</SegmentedControl.Item>
								</SegmentedControl.Root>
							</Flex>
							<Flex direction="column" gap="2">
								<Text size="3" weight="bold">
									{t("settings.appearance.fontStyle", "Font Style")}
								</Text>
								<SegmentedControl.Root
									size="3"
									value={appFontStyle}
									onValueChange={setAppFontStyle}
									style={{ width: "100%" }}
								>
									<SegmentedControl.Item value="normal" style={{ flexGrow: 1 }}>
										{t("settings.appearance.style.normal", "Normal")}
									</SegmentedControl.Item>
									<SegmentedControl.Item value="italic" style={{ flexGrow: 1 }}>
										{t("settings.appearance.style.italic", "Italic")}
									</SegmentedControl.Item>
								</SegmentedControl.Root>
							</Flex>
						</Grid>
					</Card>

					<Flex gap="3" wrap="wrap" align="center" style={{ flexShrink: 0 }}>
						<TextField.Root
							placeholder={t("common.search", "Search fonts...")}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							style={{ flexGrow: 1, minWidth: "200px" }}
							size="3"
						>
							<TextField.Slot>
								<Search16Regular />
							</TextField.Slot>
						</TextField.Root>

						<input
							type="file"
							accept=".ttf,.otf,.woff,.woff2"
							style={{ display: "none" }}
							ref={fileInputRef}
							onChange={handleFileImport}
						/>
						<Button
							variant="solid"
							size="3"
							onClick={() => fileInputRef.current?.click()}
							style={{ cursor: "pointer" }}
						>
							<ArrowUpload24Regular />
							{t("settings.appearance.importFont", "Import Font File")}
						</Button>
					</Flex>

					{currentCustomName && (
						<Card
							variant="surface"
							style={{ backgroundColor: "var(--accent-3)", flexShrink: 0 }}
						>
							<Flex align="center" justify="between">
								<Flex direction="column">
									<Text
										size="1"
										style={{ color: "var(--accent-11)" }}
										weight="bold"
									>
										{t(
											"settings.appearance.customFontActive",
											"LOCAL CUSTOM FONT",
										)}
									</Text>
									<Text
										size="3"
										style={{ fontFamily: `"${currentCustomName}", sans-serif` }}
									>
										{currentCustomName}
									</Text>
								</Flex>
								<Flex gap="2">
									<Button
										variant="solid"
										size="1"
										onClick={() =>
											handleSelectFont(`"${currentCustomName}", sans-serif`, false)
										}
										disabled={currentFont === `"${currentCustomName}", sans-serif`}
									>
										{t("common.apply", "Apply")}
									</Button>
									<IconButton
										variant="ghost"
										color="red"
										size="1"
										onClick={clearCustomFont}
									>
										<Delete20Regular />
									</IconButton>
								</Flex>
							</Flex>
						</Card>
					)}

					<ScrollArea
						type="always"
						scrollbars="vertical"
						style={{ flex: 1, minHeight: 0 }}
					>
						<Flex direction="column" gap="4" pr="4" pb="6">
							<Box>
								<Heading size="3" mb="2">
									{t("settings.appearance.defaultFonts", "Standard Stacks")}
								</Heading>
								<Grid columns="repeat(auto-fill, minmax(280px, 1fr))" gap="3">
									{standardStacks.map((font) => (
										<Card
											key={font.label}
											style={{
												cursor: "pointer",
												padding: "12px",
												minHeight: "60px",
												display: "flex",
												alignItems: "center",
												border: isFontSelected(font.value)
													? "2px solid var(--accent-9)"
													: "none",
											}}
											onClick={() => handleSelectFont(font.value, false)}
										>
											<Text size="3" style={{ fontFamily: font.value === "inherit" || font.value === "default" ? undefined : font.value }}>
												{font.label}
											</Text>
										</Card>
									))}
								</Grid>
							</Box>

							{filteredSystemFonts.length > 0 && (
								<Box>
									<Heading size="3" mb="2">
										{t("settings.appearance.systemFonts", "System Fonts")}
									</Heading>
									<Grid columns="repeat(auto-fill, minmax(280px, 1fr))" gap="3">
										{filteredSystemFonts.map((font) => (
											<Card
												key={font.label}
												style={{
													cursor: "pointer",
													padding: "12px",
													minHeight: "60px",
													display: "flex",
													alignItems: "center",
													border: isFontSelected(font.value)
														? "2px solid var(--accent-9)"
														: "none",
												}}
												onClick={() => handleSelectFont(font.value, false)}
											>
												<Text
													size="4"
													style={{
														fontFamily: font.value,
														fontWeight: appFontWeight,
														fontStyle: appFontStyle,
													}}
												>
													{font.label}
												</Text>
											</Card>
										))}
									</Grid>
								</Box>
							)}

							<Box>
								<Heading size="3" mb="2">
									{t("settings.appearance.googleFonts", "Google Fonts Library")}
								</Heading>
								<Grid columns="repeat(auto-fill, minmax(280px, 1fr))" gap="3">
									{filteredGoogleFonts.map((font) => (
										<Card
											key={font}
											style={{
												cursor: "pointer",
												padding: "12px",
												minHeight: "80px",
												display: "flex",
												flexDirection: "column",
												justifyContent: "center",
												border:
													isFontSelected(`"${font}", sans-serif`) || isFontSelected(font)
														? "2px solid var(--accent-9)"
														: "none",
											}}
											onPointerEnter={() => {
												const fontId = `google-font-${font.replace(/\s+/g, "-")}`;
												if (!document.getElementById(fontId)) {
													const link = document.createElement("link");
													link.id = fontId;
													link.rel = "stylesheet";
													link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/\s+/g, "+")}&display=swap`;
													document.head.appendChild(link);
												}
											}}
											onClick={() => handleSelectFont(font)}
										>
											<Flex direction="column" gap="1">
												<Text size="1" color="gray">
													{font}
												</Text>
												<Text
													size="5"
													style={{
														fontFamily: `"${font}", sans-serif`,
														fontWeight: appFontWeight,
														fontStyle: appFontStyle,
														whiteSpace: "nowrap",
														overflow: "hidden",
														textOverflow: "ellipsis",
													}}
												>
													{font}
												</Text>
											</Flex>
										</Card>
									))}
								</Grid>
							</Box>
						</Flex>
					</ScrollArea>

					<Flex justify="end" pt="2" style={{ flexShrink: 0 }}>
						<Dialog.Close>
							<Button variant="soft" color="gray">
								{t("common.close", "Close")}
							</Button>
						</Dialog.Close>
					</Flex>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
