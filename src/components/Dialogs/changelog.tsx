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
								v1.2.0
							</Heading>
							<Text as="p" size="2" color="gray" mb="2">
								September 3, 2026
							</Text>
							<Flex direction="column" gap="2">
								<Text size="2">
									• <b>Apple Music TTML Import:</b> Import pre-existing word-synced and line-synced TTML files directly using Spotify track URLs or IDs, complete with native backend fetching to bypass CORS restrictions.
								</Text>
								<Text size="2">
									• <b>Multi-Window Support:</b> Open and edit multiple songs or projects simultaneously in independent windows via Cmd/Ctrl+Shift+N.
								</Text>
								<Text size="2">
									• <b>TTML Checklist Album Import & Provider Search:</b> Batch import entire albums from Spotify/Genius into the checklist, with quick one-click lyrics downloads and dedicated Apple TTML imports.
								</Text>
								<Text size="2">
									• <b>Fixed Lyrics Search & Checklist Download:</b> Resolved query formatting issues and type errors when downloading song lyrics directly from checklist entries.
								</Text>
							</Flex>
						</Box>
						<Box>
							<Heading size="4" mb="2" color="indigo">
								v1.1.5
							</Heading>
							<Text as="p" size="2" color="gray" mb="2">
								September 3, 2026
							</Text>
							<Flex direction="column" gap="2">
								<Text size="2">
									• <b>Preview Mode Ribbon Layout:</b> Stacked V-Sync and Show FPS controls vertically into a single unified Render section for a cleaner toolbar.
								</Text>
								<Text size="2">
									• <b>Sync Mode Ribbon Layout:</b> Combined Assistant Settings and Display Options into a stacked Options section.
								</Text>
								<Text size="2">
									• <b>Native macOS & Web Menu Alignment:</b> Enhanced Tools and Help menus across desktop and browser with Start Guide, GitHub, What's New, Changelog, About, and Segmentation tools.
								</Text>
								<Text size="2">
									• <b>Community Artwork Uploads:</b> Allowed users to upload album covers directly on the website for tracks with missing artwork.
								</Text>
							</Flex>
						</Box>
						<Box>
							<Heading size="4" mb="2" color="indigo">
								v1.1.4
							</Heading>
							<Text as="p" size="2" color="gray" mb="2">
								September 2, 2026
							</Text>
							<Flex direction="column" gap="2">
								<Text size="2">
									• <b>TTML Checklist Cloud Sync Protection:</b> Prevented data wipeout race conditions when logging in from new devices and locations; local and cloud lists are now seamlessly merged.
								</Text>
								<Text size="2">
									• <b>Finished Cloud TTML Auto-Import:</b> Automatically scans your cloud library on login or sync and integrates any finished TTML lyrics directly into your checklist.
								</Text>
								<Text size="2">
									• <b>Checklist Provider Search Truncation:</b> Long song and artist names now truncate cleanly with ellipsis in search results, keeping the Select button aligned and visible.
								</Text>
								<Text size="2">
									• <b>Website Theme & Mobile Redesign:</b> Removed blue tint across the companion website in favor of sleek Apple Music dark neutral tones and crimson glows; added a fully responsive mobile navigation drawer.
								</Text>
							</Flex>
						</Box>
						<Box>
							<Heading size="4" mb="2" color="indigo">
								v1.1.3
							</Heading>
							<Text as="p" size="2" color="gray" mb="2">
								September 2, 2026
							</Text>
							<Flex direction="column" gap="2">
								<Text size="2">
									• <b>Opt-In Community Library Publishing:</b> Cloud-saved
									lyrics are now kept private by default. Users can explicitly
									opt in via a toggle to publish finished tracks to the website
									community library.
								</Text>
								<Text size="2">
									• <b>Website Song Deduplication:</b> The community library now
									intelligently deduplicates uploads and showcases only the
									latest version of each song.
								</Text>
								<Text size="2">
									• <b>Spectrogram Web Compatibility:</b> Added automatic
									fallback to the serial WebAssembly renderer on web browsers
									when multithreading / SharedArrayBuffer is unavailable.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="indigo">
								v1.1.2
							</Heading>
							<Text as="p" size="2" color="gray" mb="2">
								September 1, 2026
							</Text>
							<Flex direction="column" gap="2">
								<Text size="2">
									• <b>TTML Checklist Deduplication:</b> Automatically detects
									and merges duplicate songs (supporting typographic apostrophes
									and formatting variations) while preserving completion status
									and cloud links.
								</Text>
								<Text size="2">
									• <b>Action Buttons Spacing & Visibility:</b> Added clean
									spacing between song card action buttons, ensured the delete
									button is always comfortably visible, and added margin
									separation before the New Song button.
								</Text>
								<Text size="2">
									• <b>Timing Tools Polish:</b> Improved spacing on the
									single-row Timing Tools toolbar in sync mode.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="indigo">
								v1.1.1
							</Heading>
							<Text as="p" size="2" color="gray" mb="2">
								September 1, 2026
							</Text>
							<Flex direction="column" gap="2">
								<Text size="2">
									• <b>Mac Media Keys & Touch Bar Audio Sync:</b> Fixed
									duplicate / dual audio playback on macOS and fully integrated
									native MediaSession controls for keyboard media keys and Touch
									Bar playback.
								</Text>
								<Text size="2">
									• <b>Compact & Sleek Toolbars:</b> Removed bottom caption
									labels across all mode toolbars, consolidated Assistant
									Settings and Display Options into spacious popover menus, and
									aligned Timing Tools into a single row.
								</Text>
								<Text size="2">
									• <b>Checklist Action Buttons & Empty State Polish:</b>{" "}
									Converted checklist song row actions to compact icon-only
									symbol buttons with consistent styling and tooltips to prevent
									overflow, and fixed search prompt visibility during lyrics
									import.
								</Text>
								<Text size="2">
									• <b>Segmentation Improvements:</b> Guaranteed interjections
									like
									<code>oh</code>, <code>ooh</code>, <code>ah</code>, and{" "}
									<code>yeah</code>
									are never erroneously split by Quick Segment.
								</Text>
								<Text size="2">
									• <b>TitleBar Layout & Height Fix:</b> Corrected vertical
									alignment and explicit height in WindowControls to prevent
									titlebar clipping on macOS.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="indigo">
								v1.1.0
							</Heading>
							<Text as="p" size="2" color="gray" mb="2">
								September 1, 2026
							</Text>
							<Flex direction="column" gap="2">
								<Text size="2">
									• <b>TTML Checklist & Cloud Auto-Sync:</b> Automatic linking
									between uploaded Cloud TTMLs and Checklist songs, auto-marking
									100% completed files, and 1-click Download / Load TTML
									directly from checklist cards.
								</Text>
								<Text size="2">
									• <b>Discord RPC Customization & Checklist Stats:</b> Live
									dynamic RPC preview in settings, customizable idle status with
									rich presets (username, tool name, checklist progress &
									percentage), and avatar image selection.
								</Text>
								<Text size="2">
									• <b>New Global Keyboard Shortcuts:</b> Quick shortcuts added
									for Open from Cloud (<code>Cmd/Ctrl+Shift+O</code>), Save to
									Cloud (<code>Cmd/Ctrl+Shift+S</code>), and TTML Checklist (
									<code>Cmd/Ctrl+Shift+C</code>).
								</Text>
								<Text size="2">
									• <b>Compact & Responsive Workspace:</b> Auto-collapsing
									TitleBar mode tabs, collapsible Cloud user avatar, stacked
									Ribbon Timing Tools and Sync Level buttons to optimize screen
									space on smaller displays.
								</Text>
								<Text size="2">
									• <b>UI & Performance Polish:</b> Single-line ellipsis
									truncation for long song titles in checklist, fixed Timing
									Offset Latency Test translation & keybindings, and window
									initialization safety timeouts.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="indigo">
								v1.0.8
							</Heading>
							<Text as="p" size="2" color="gray" mb="2">
								August 31, 2026
							</Text>
							<Flex direction="column" gap="2">
								<Text size="2">
									• <b>TTML Checklist & Cloud Auto-Sync:</b> When saving or
									uploading a TTML to the cloud, it is automatically linked with
									your TTML Checklist. If the song was not in the checklist, it
									is added automatically.
								</Text>
								<Text size="2">
									• <b>Automatic Completion:</b> Uploaded TTMLs that are 100%
									synchronized and timed are automatically marked as completed
									in the checklist.
								</Text>
								<Text size="2">
									• <b>Checklist Cloud TTML Download Button:</b> Each linked
									checklist song now features a 1-click Download / Load TTML
									button to immediately open the cloud lyric in the editor.
								</Text>
								<Text size="2">
									• <b>Lyrics Import Pre-fill Fixes:</b> Opening lyrics import
									from a checklist item now automatically populates the search
									query and loads provider search results without retyping.
								</Text>
								<Text size="2">
									• <b>Checklist Toolbar & Performance Polish:</b> Modern
									surface styling across all action buttons, native desktop JSON
									export, and deep serialization fixes for Firestore cloud
									synchronization.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="indigo">
								v1.0.7
							</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Line Merging Tools:</strong> Added right-click context
									menu options to merge any lyric line with the previous line,
									next line, multiple selected lines, or any chosen line in the
									song while preserving all individual word timings, line
									bounds, translations, and flags.
								</Text>
								<Text size="2">
									<strong>TTML Checklist Download & Import:</strong> Added
									1-click JSON export/download and file import to easily back
									up, share, or restore your entire checklist.
								</Text>
								<Text size="2">
									<strong>Continuous Checklist Cloud Sync:</strong> Checklist
									sync now runs automatically in the background across web and
									desktop as soon as you sign in, plus dedicated manual Push &
									Pull buttons.
								</Text>
								<Text size="2">
									<strong>Cloudflare Web App & Firestore Rules:</strong> Fixed
									web loading configuration, build settings, and Firestore
									security rules for user checklist data.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="indigo">
								v1.0.6
							</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>TTML Checklist Sorting & Design:</strong> Added
									sorting by Title (A–Z / Z–A) and Artist (A–Z / Z–A), sleek
									icon filter buttons with glowing active indicator bars, and
									fixed-height form view switching.
								</Text>
								<Text size="2">
									<strong>TTML Checklist Cloud Sync:</strong> The TTML Checklist
									connects in real-time to Firebase Firestore when signed in,
									keeping your songs, notes, and cover art synced across
									devices.
								</Text>
								<Text size="2">
									<strong>Seamless 1-Click Lyrics Fetching:</strong> Checklist
									lyric imports immediately fetch the track's lyrics and
									songwriters without prompting for manual re-search.
								</Text>
								<Text size="2">
									<strong>Unified Cloud Account Preferences:</strong>{" "}
									Streamlined all cloud sync, authentication, statistics, and
									profile management directly into Preferences → Account &
									Cloud.
								</Text>
								<Text size="2">
									<strong>Section Review Detailed Notifications:</strong>{" "}
									Section review toasts now display detailed multi-line issue
									descriptions and exact line numbers.
								</Text>
								<Text size="2">
									<strong>Vocal & Sync Editing Controls:</strong> Added
									dedicated Ignore Main Vocals, Duet Vocal, and Ignore Sync
									controls alongside Remembered Background Vocal export
									settings.
								</Text>
								<Text size="2">
									<strong>Discord Activity Type Selection:</strong> Added an
									Activity Type selector (Listening / Playing) in Discord Rich
									Presence settings, applied consistently across all editor
									states.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="indigo">
								v1.0.5
							</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>
										TTML Checklist Provider Search & 1-Click Import:
									</strong>{" "}
									Search and import songs directly from Genius, LRCLIB, and
									Lyrically inside the checklist, complete with cover art, album
									details, and 1-click lyric importing that skips manual search
									retyping.
								</Text>
								<Text size="2">
									<strong>Checklist on Empty State:</strong> Added a
									quick-access "TTML Checklist" button directly to the editor's
									empty state ("No lyric lines") screen.
								</Text>
								<Text size="2">
									<strong>Audio Engine Resiliency & Sleep Recovery:</strong>{" "}
									Proactively refreshes the audio context after system sleep or
									prolonged inactivity, preventing WebKit CoreAudio dropouts.
								</Text>
								<Text size="2">
									<strong>Companion Website:</strong> Added the official
									companion website featuring app showcases, community finished
									TTML downloads via Firebase, and a dedicated Spicy Player hub.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="indigo">
								v1.0.4
							</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Red Tint for Non-Synced Words & Lines:</strong>{" "}
									Untimed words and lines across Standard, Toxi, and SpicyLyrics
									preview modes and Technical Timing Overview now clearly
									display a subtle red tint and glow to quickly identify
									unsynced parts.
								</Text>
								<Text size="2">
									<strong>
										Upgraded TTML Checklist with Cover Art Support:
									</strong>{" "}
									The TTML Checklist now supports song album cover art previews
									and uploads, 1-click import from the current project's
									metadata & audio, search filtering, and progress tracking.
								</Text>
								<Text size="2">
									<strong>Cleaned App & File Menus:</strong> Moved the TTML
									Checklist to the Tools dropdown menu, added Metadata Editor to
									the File menu, and cleaned up unnecessary system window hooks
									from the App menu.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="indigo">
								v1.0.3
							</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Smooth Virtual Scrolling in Timing Copy Mode:</strong>{" "}
									Fixed an issue where the editor could not be scrolled when
									"Copy timings to…" was active by wrapping virtual line items
									in unified DOM containers for accurate virtual height
									measurement.
								</Text>
								<Text size="2">
									<strong>Timing Copy Banner & Escape Key Cancel:</strong> Added
									a sticky top status banner when copying line timings with a
									one-click Cancel action, alongside native <code>Esc</code> key
									dismissal.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="indigo">
								v1.0.2
							</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Dedicated Sync Progress Toolbar Widget:</strong> Added
									an integrated synchronization progress widget directly in the
									main ribbon bar featuring an animated SVG circular progress
									wheel, line sync counter (
									<code>timedLines / totalLines Lines</code>), and word count (
									<code>timedWords / totalWords Words</code>).
								</Text>
								<Text size="2">
									<strong>Discord Rich Presence Status Controls:</strong> Added
									support for switching between <code>Playing</code>{" "}
									(interactive repository button enabled) and{" "}
									<code>Listening</code> activity status types.
								</Text>
								<Text size="2">
									<strong>Performance & Stability Fixes:</strong> Optimized
									component rendering, corrected toolbar import bindings, and
									streamlined RPC activity dispatching.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="indigo">
								v1.0.1
							</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Dedicated Preview Panel Button:</strong> Added an
									easily accessible Preview Panel toggle button directly on the
									right side of the top toolbar for one-click access on both
									desktop and web.
								</Text>
								<Text size="2">
									<strong>New Line Timing Tools:</strong> Added quick-action
									timing tools to Copy line/word timings, Paste timings onto
									selected target lines with proportional word preservation, and
									Snap timings directly to the current audio playhead.
								</Text>
								<Text size="2">
									<strong>Advanced Timing Adjustment:</strong> Moved time and
									commit offset controls into the Advanced options panel for a
									cleaner, streamlined synchronization toolbar.
								</Text>
								<Text size="2">
									<strong>Toolbar Layout & Smooth Scrolling:</strong> Resolved
									container clipping to ensure bottom section labels are never
									cut off, and enhanced native trackpad horizontal scrolling
									with responsive resizing when the preview panel is opened.
								</Text>
								<Text size="2">
									<strong>Streamlined Preview Engines:</strong> Cleaned up
									preview mode options to focus on high-fidelity Standard, Toxi,
									SpicyLyrics, and Timing Overview engines.
								</Text>
								<Text size="2">
									<strong>Dynamic Sync Progress Wheel:</strong> Restored the
									real-time animated circular progress ring in the header status
									badge.
								</Text>
							</Flex>
						</Box>

						<Box>
							<Heading size="4" mb="2" color="indigo">
								v1.0.0
							</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Cloud Account & Cross-Device Sync:</strong> Integrated
									Firebase Cloud accounts with secure Sign In, Sign Up, and
									multi-provider authentication (Google, GitHub, Apple) to
									seamlessly back up, sync, and access TTML lyrics across all
									your devices.
								</Text>
								<Text size="2">
									<strong>Cloud Project Storage Library:</strong> Save, load,
									and manage full TTML projects to your personal cloud library
									with instant metadata tracking, auto-syncing, and cloud lyric
									management.
								</Text>
								<Text size="2">
									<strong>User Profiles & Custom Avatars:</strong> Upload custom
									avatars (PNG, JPG, GIF, WebP) directly from your device or
									link image URLs, with automatic cloud hosting and profile
									customization.
								</Text>
								<Text size="2">
									<strong>Discord Rich Presence 2.0:</strong> Rich status lines
									with project, editor, playback, and timing variables; dynamic
									raw image tab badges (Edit, Sync, Preview); and custom profile
									avatar display on Discord RPC.
								</Text>
								<Text size="2">
									<strong>Spicy Lyrics Preview Mode:</strong> High-fidelity
									Apple Music-style lyric renderer featuring dynamic mesh
									gradients, smooth scrolling, interlude countdown dots,
									CJK/romanized word wrapping, duet/RTL awareness, custom
									backgrounds, and customizable frame rate / V-Sync.
								</Text>
								<Text size="2">
									<strong>Advanced Appearance & Theming System:</strong> Deep
									Intonated Black dark theme, custom gradient designer
									(linear/radial/conic), 40+ granular customization tokens
									(waveform colors, chips, titlebar, dialogs, borders, shadows,
									backdrop blur), Google Fonts gallery (300+ fonts), and custom
									local font (.ttf/.otf/.woff) imports.
								</Text>
								<Text size="2">
									<strong>Sample-Accurate Native Audio Engine:</strong>{" "}
									High-precision Web Audio clock playback via
									AudioBufferSourceNode, eliminating WebKit seek latency and
									desynchronization on macOS and desktop, with automated
									sleep/wake context recovery and audio device change handling.
								</Text>
								<Text size="2">
									<strong>Interactive Beginner Onboarding Guide:</strong>{" "}
									Step-by-step interactive first-run tutorial teaching lyric
									review, audio import, synchronization, metadata, and testing,
									with movable and tuckable edge docking.
								</Text>
								<Text size="2">
									<strong>Unified Multi-Source Lyrics Importer:</strong> Unified
									import hub supporting Plain Text, LRCLIB, Lyrically
									(lyrics.ovh), and Genius with CORS-safe proxying, automated
									bracket/section filtering, and album art loading.
								</Text>
								<Text size="2">
									<strong>Genius Section Navigator & Tools:</strong> Full
									bracketed section support ([Chorus], [Verse], etc.) with
									repeat detection, color-coded categorization, section merging,
									and repeat-section timing copy.
								</Text>
								<Text size="2">
									<strong>Intelligent Syllabification & Segmentation:</strong>{" "}
									Multi-language syllable splitting engines (English, Spanish,
									French, Polish, Russian, Japanese, CJK), customizable
									Auto-Segment keybinding, and learned word splitting rules.
								</Text>
								<Text size="2">
									<strong>Comprehensive Romanization Suite:</strong>{" "}
									Auto-generated Romaji (JA), Pinyin (ZH), Jyutping (YUE), and
									Romaji (KO) with capsule-aware syllable distribution and batch
									romanization replacement.
								</Text>
								<Text size="2">
									<strong>High-Precision Timing & Spectrogram Tools:</strong>{" "}
									Drag-and-drop waveform alignment, interactive time-shift
									toolbar with playhead snap, scoped time stretch tool,
									millisecond interpolation, and pre-export sync health
									validation.
								</Text>
								<Text size="2">
									<strong>Integrated Audio Tools & Format Converter:</strong>{" "}
									Built-in 10-band custom audio equalizer with presets,
									FFmpeg.wasm MP3-to-FLAC converter to eliminate decoding drift,
									and audio pitch preservation toggle.
								</Text>
								<Text size="2">
									<strong>Native Desktop Integration:</strong> Full native macOS
									application menu bar with standard shortcuts, native file
									open/save dialogs, remembered window state/geometry, and
									multi-platform packages (macOS .dmg/.app, Windows .msi/.exe,
									Linux Arch PKGBUILD and AppImage).
								</Text>
								<Text size="2">
									<strong>Community WASM Plugin System:</strong> Secure,
									extensible plugin architecture for custom importers and
									exporters with SHA-256 integrity verification.
								</Text>
								<Text size="2">
									<strong>Workflow & Editing Polish:</strong> Shift-click fast
									word combination, non-blocking asynchronous undo/redo stack,
									compact space chips, inline time-tab double click editing, and
									TTML sync checklist.
								</Text>
							</Flex>
						</Box>
					</Flex>
				</ScrollArea>
			</Dialog.Content>
		</Dialog.Root>
	);
}
