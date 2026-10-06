/**
 * Safely converts binary data received from Tauri IPC (ArrayBuffer, Uint8Array, number[])
 * or Web APIs into a standard Blob.
 */
export function binaryToBlob(data: unknown, mime: string): Blob | null {
	if (!data) return null;
	if (data instanceof Blob) return data;
	if (data instanceof ArrayBuffer) {
		return data.byteLength > 0 ? new Blob([data], { type: mime }) : null;
	}
	if (ArrayBuffer.isView(data)) {
		return data.byteLength > 0
			? new Blob([data as Uint8Array], { type: mime })
			: null;
	}
	if (Array.isArray(data) && data.length > 0) {
		return new Blob([new Uint8Array(data)], { type: mime });
	}
	return null;
}
