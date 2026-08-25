import saveFileFromLib from "save-file";
import { error } from "./logging";

export interface SaveFileOptions {
	suggestedName?: string;
	types?: {
		description: string;
		accept: Record<string, string[]>;
	}[];
}

export async function saveFile(
	content: Blob | string,
	options: SaveFileOptions | string,
) {
	const suggestedName =
		typeof options === "string" ? options : options.suggestedName;
	const types = typeof options === "string" ? undefined : options.types;

	if (
		typeof window !== "undefined" &&
		(!!(window as unknown as { __TAURI__?: unknown }).__TAURI__ ||
			!!import.meta.env.TAURI_ENV_PLATFORM)
	) {
		try {
			const { save } = await import("@tauri-apps/plugin-dialog");
			const { writeTextFile, writeFile } = await import(
				"@tauri-apps/plugin-fs"
			);

			const filters = types?.map((t) => {
				const extensions: string[] = [];
				for (const exts of Object.values(t.accept)) {
					for (const ext of exts) {
						extensions.push(ext.startsWith(".") ? ext.slice(1) : ext);
					}
				}
				return {
					name: t.description,
					extensions,
				};
			});

			const filePath = await save({
				defaultPath: suggestedName,
				filters: filters && filters.length > 0 ? filters : undefined,
			});

			if (!filePath) return null;

			if (typeof content === "string") {
				await writeTextFile(filePath, content);
			} else {
				const arrayBuffer = await content.arrayBuffer();
				await writeFile(filePath, new Uint8Array(arrayBuffer));
			}

			const fileName = filePath.split(/[/\\]/).pop() || filePath;
			return fileName;
		} catch (e: unknown) {
			error("Failed to save file in Tauri", e);
			throw e;
		}
	}

	if ("showSaveFilePicker" in window) {
		try {
			// @ts-expect-error
			const handle = await window.showSaveFilePicker({
				suggestedName,
				types,
			});
			const writable = await handle.createWritable();
			await writable.write(content);
			await writable.close();
			return handle.name as string;
		} catch (e: unknown) {
			if ((e as Error)?.name === "AbortError") return null;
			error("Failed to save file via File System Access API", e);
		}
	}

	const b =
		typeof content === "string"
			? new Blob([content], { type: "text/plain" })
			: content;
	await saveFileFromLib(b, suggestedName || "file");
	return suggestedName;
}
