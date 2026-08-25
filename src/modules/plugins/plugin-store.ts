import { idb } from "$/utils/db";
import type { WASMPlugin } from "./types";

const PLUGIN_STORE = "wasm_plugins";

export async function savePlugin(plugin: WASMPlugin) {
	const db = await idb();
	return db.put(PLUGIN_STORE, plugin);
}

export async function getAllPlugins(): Promise<WASMPlugin[]> {
	const db = await idb();
	return db.getAll(PLUGIN_STORE);
}

export async function deletePlugin(id: string) {
	const db = await idb();
	return db.delete(PLUGIN_STORE, id);
}

export async function togglePlugin(id: string, isEnabled: boolean) {
	const db = await idb();
	const plugin = await db.get(PLUGIN_STORE, id);
	if (plugin) {
		plugin.isEnabled = isEnabled;
		await db.put(PLUGIN_STORE, plugin);
	}
}
