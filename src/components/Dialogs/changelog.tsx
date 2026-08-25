import { DismissRegular } from "@fluentui/react-icons";
import {
	Box,
	Button,
	Dialog,
	Flex,
	Heading,
	ScrollArea,
	Text,
} from "@radix-ui/themes";
import { open } from "@tauri-apps/plugin-shell";
import { useAtom } from "jotai";
import { changelogDialogAtom } from "$/states/dialogs.ts";

export function ChangelogDialog() {
	const [isOpen, setIsOpen] = useAtom(changelogDialogAtom);

	const openGitHub = async () => {
		const repoUrl =
			"https://github.com/bobjoerules/AMLL-TTML-TOOL/commits/main";
		if (import.meta.env.TAURI_ENV_PLATFORM) {
			await open(repoUrl);
		} else {
			window.open(repoUrl, "_blank");
		}
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content style={{ maxWidth: 650, height: "70vh", maxHeight: 600 }}>
				<Flex justify="between" align="center" mb="4">
					<Flex align="center" gap="3">
						<Dialog.Title mb="0">Changelog & Updates</Dialog.Title>
						<Button
							variant="soft"
							size="1"
							color="indigo"
							onClick={openGitHub}
							style={{ cursor: "pointer" }}
						>
							View Commits on GitHub
						</Button>
					</Flex>
					<Dialog.Close>
						<Button variant="ghost" color="gray">
							<DismissRegular />
						</Button>
					</Dialog.Close>
				</Flex>

				<ScrollArea
					type="always"
					scrollbars="vertical"
					style={{ height: "calc(100% - 60px)" }}
				>
					<Flex direction="column" gap="5" pr="4">
						<Box>
							<Heading size="4" mb="2" color="indigo">
								v1.0.2
							</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Dedicated Sync Progress Toolbar Widget:</strong> Added an integrated synchronization progress widget directly in the main ribbon bar featuring an animated SVG circular progress wheel, line sync counter (<code>timedLines / totalLines Lines</code>), and word count (<code>timedWords / totalWords Words</code>).
								</Text>
								<Text size="2">
									<strong>Discord Rich Presence Status Controls:</strong> Added support for switching between <code>Playing</code> (interactive repository button enabled) and <code>Listening</code> activity status types.
								</Text>
								<Text size="2">
									<strong>Performance & Stability Fixes:</strong> Optimized component rendering, corrected toolbar import bindings, and streamlined RPC activity dispatching.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="indigo">
								v1.0.1
							</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Dedicated Preview Panel Button:</strong> Added an easily accessible Preview Panel toggle button directly on the right side of the top toolbar for one-click access on both desktop and web.
								</Text>
								<Text size="2">
									<strong>New Line Timing Tools:</strong> Added quick-action timing tools to Copy line/word timings, Paste timings onto selected target lines with proportional word preservation, and Snap timings directly to the current audio playhead.
								</Text>
								<Text size="2">
									<strong>Advanced Timing Adjustment:</strong> Moved time and commit offset controls into the Advanced options panel for a cleaner, streamlined synchronization toolbar.
								</Text>
								<Text size="2">
									<strong>Toolbar Layout & Smooth Scrolling:</strong> Resolved container clipping to ensure bottom section labels are never cut off, and enhanced native trackpad horizontal scrolling with responsive resizing when the preview panel is opened.
								</Text>
								<Text size="2">
									<strong>Streamlined Preview Engines:</strong> Cleaned up preview mode options to focus on high-fidelity Standard, Toxi, SpicyLyrics, and Timing Overview engines.
								</Text>
								<Text size="2">
									<strong>Dynamic Sync Progress Wheel:</strong> Restored the real-time animated circular progress ring in the header status badge.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="indigo">
								v1.0.0
							</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Cloud Account & Cross-Device Sync:</strong> Integrated Firebase Cloud accounts with secure Sign In, Sign Up, and multi-provider authentication (Google, GitHub, Apple) to seamlessly back up, sync, and access TTML lyrics across all your devices.
								</Text>
								<Text size="2">
									<strong>Cloud Project Storage Library:</strong> Save, load, and manage full TTML projects to your personal cloud library with instant metadata tracking, auto-syncing, and cloud lyric management.
								</Text>
								<Text size="2">
									<strong>User Profiles & Custom Avatars:</strong> Upload custom avatars (PNG, JPG, GIF, WebP) directly from your device or link image URLs, with automatic cloud hosting and profile customization.
								</Text>
								<Text size="2">
									<strong>Discord Rich Presence 2.0:</strong> Rich status lines with project, editor, playback, and timing variables; dynamic raw image tab badges (Edit, Sync, Preview); and custom profile avatar display on Discord RPC.
								</Text>
								<Text size="2">
									<strong>Spicy Lyrics Preview Mode:</strong> High-fidelity Apple Music-style lyric renderer featuring dynamic mesh gradients, smooth scrolling, interlude countdown dots, CJK/romanized word wrapping, duet/RTL awareness, custom backgrounds, and customizable frame rate / V-Sync.
								</Text>
								<Text size="2">
									<strong>Advanced Appearance & Theming System:</strong> Deep Intonated Black dark theme, custom gradient designer (linear/radial/conic), 40+ granular customization tokens (waveform colors, chips, titlebar, dialogs, borders, shadows, backdrop blur), Google Fonts gallery (300+ fonts), and custom local font (.ttf/.otf/.woff) imports.
								</Text>
								<Text size="2">
									<strong>Sample-Accurate Native Audio Engine:</strong> High-precision Web Audio clock playback via AudioBufferSourceNode, eliminating WebKit seek latency and desynchronization on macOS and desktop, with automated sleep/wake context recovery and audio device change handling.
								</Text>
								<Text size="2">
									<strong>Interactive Beginner Onboarding Guide:</strong> Step-by-step interactive first-run tutorial teaching lyric review, audio import, synchronization, metadata, and testing, with movable and tuckable edge docking.
								</Text>
								<Text size="2">
									<strong>Unified Multi-Source Lyrics Importer:</strong> Unified import hub supporting Plain Text, LRCLIB, Lyrically (lyrics.ovh), and Genius with CORS-safe proxying, automated bracket/section filtering, and album art loading.
								</Text>
								<Text size="2">
									<strong>Genius Section Navigator & Tools:</strong> Full bracketed section support ([Chorus], [Verse], etc.) with repeat detection, color-coded categorization, section merging, and repeat-section timing copy.
								</Text>
								<Text size="2">
									<strong>Intelligent Syllabification & Segmentation:</strong> Multi-language syllable splitting engines (English, Spanish, French, Polish, Russian, Japanese, CJK), customizable Auto-Segment keybinding, and learned word splitting rules.
								</Text>
								<Text size="2">
									<strong>Comprehensive Romanization Suite:</strong> Auto-generated Romaji (JA), Pinyin (ZH), Jyutping (YUE), and Romaji (KO) with capsule-aware syllable distribution and batch romanization replacement.
								</Text>
								<Text size="2">
									<strong>High-Precision Timing & Spectrogram Tools:</strong> Drag-and-drop waveform alignment, interactive time-shift toolbar with playhead snap, scoped time stretch tool, millisecond interpolation, and pre-export sync health validation.
								</Text>
								<Text size="2">
									<strong>Integrated Audio Tools & Format Converter:</strong> Built-in 10-band custom audio equalizer with presets, FFmpeg.wasm MP3-to-FLAC converter to eliminate decoding drift, and audio pitch preservation toggle.
								</Text>
								<Text size="2">
									<strong>Native Desktop Integration:</strong> Full native macOS application menu bar with standard shortcuts, native file open/save dialogs, remembered window state/geometry, and multi-platform packages (macOS .dmg/.app, Windows .msi/.exe, Linux Arch PKGBUILD and AppImage).
								</Text>
								<Text size="2">
									<strong>Community WASM Plugin System:</strong> Secure, extensible plugin architecture for custom importers and exporters with SHA-256 integrity verification.
								</Text>
								<Text size="2">
									<strong>Workflow & Editing Polish:</strong> Shift-click fast word combination, non-blocking asynchronous undo/redo stack, compact space chips, inline time-tab double click editing, and TTML sync checklist.
								</Text>
							</Flex>
						</Box>
					</Flex>
				</ScrollArea>
			</Dialog.Content>
		</Dialog.Root>
	);
}
