import { open } from "@tauri-apps/plugin-shell";

/**
 * Opens an external URL in the system's default browser.
 * Uses Tauri shell plugin on desktop platforms and falls back to window.open on web.
 */
export async function openExternal(url: string): Promise<void> {
	const isTauri =
		typeof window !== "undefined" &&
		Boolean(
			(window as unknown as { __TAURI__?: unknown }).__TAURI__ ||
				(window as unknown as { __TAURI_INTERNALS__?: unknown })
					.__TAURI_INTERNALS__ ||
				import.meta.env.TAURI_ENV_PLATFORM,
		);

	if (isTauri) {
		try {
			await open(url);
			return;
		} catch (error) {
			console.error("Failed to open external URL via Tauri shell:", error);
		}
	}
	if (typeof window !== "undefined") {
		window.open(url, "_blank", "noopener,noreferrer");
	}
}

export default openExternal;
