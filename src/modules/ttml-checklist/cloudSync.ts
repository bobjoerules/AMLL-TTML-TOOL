import { useEffect, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { saveFile } from "$/utils/fileSystem";
import { globalStore } from "$/states/store";
import { currentUserAtom } from "$/modules/cloud/states";
import {
	getFirebaseAuth,
	getFirebaseFirestore,
	isFirebaseConfigured,
} from "$/modules/cloud/firebase";
import { normalizeChecklistEntries, type TTMLChecklistEntry } from "./logic";
import { ttmlChecklistAtom } from "./states";

export interface CloudChecklistData {
	entries: TTMLChecklistEntry[];
	updatedAt: number;
	lastUpdatedBy?: string;
}

export async function saveChecklistToCloud(
	entries: TTMLChecklistEntry[],
	uid?: string,
): Promise<{ success: boolean; error?: string }> {
	if (!isFirebaseConfigured()) {
		return { success: false, error: "Firebase is not configured." };
	}

	try {
		const db = getFirebaseFirestore();
		if (!db) {
			return { success: false, error: "Firestore instance is not available." };
		}

		const targetUid =
			uid ||
			globalStore.get(currentUserAtom)?.uid ||
			getFirebaseAuth()?.currentUser?.uid;
		if (!targetUid) {
			return {
				success: false,
				error: "Please sign in to save your checklist to the cloud.",
			};
		}

		const docRef = doc(db, "users", targetUid, "userData", "checklist");
		const rawData = {
			entries: normalizeChecklistEntries(entries),
			updatedAt: Date.now(),
		};
		// Deep clean to strip all undefined fields which cause Firestore setDoc to throw
		const cleanData = JSON.parse(JSON.stringify(rawData));
		await setDoc(docRef, cleanData, { merge: true });
		return { success: true };
	} catch (err: any) {
		console.error("Failed to save checklist to Firebase:", err);
		return {
			success: false,
			error: err?.message || "Failed to write to Firestore.",
		};
	}
}

export async function loadChecklistFromCloud(
	uid?: string,
): Promise<{ entries: TTMLChecklistEntry[] | null; error?: string }> {
	if (!isFirebaseConfigured()) {
		return { entries: null, error: "Firebase is not configured." };
	}

	try {
		const db = getFirebaseFirestore();
		if (!db) {
			return { entries: null, error: "Firestore instance is not available." };
		}

		const targetUid =
			uid ||
			globalStore.get(currentUserAtom)?.uid ||
			getFirebaseAuth()?.currentUser?.uid;
		if (!targetUid) {
			return { entries: null, error: "No user account or UID found." };
		}

		const docRef = doc(db, "users", targetUid, "userData", "checklist");
		const snap = await getDoc(docRef);
		if (snap.exists()) {
			const data = snap.data() as Partial<CloudChecklistData>;
			if (Array.isArray(data.entries)) {
				return { entries: normalizeChecklistEntries(data.entries) };
			}
		}
		return { entries: [] };
	} catch (err: any) {
		console.error("Failed to load checklist from Firebase:", err);
		return {
			entries: null,
			error: err?.message || "Failed to read from Firestore.",
		};
	}
}

export function parseChecklistJson(content: string): TTMLChecklistEntry[] {
	try {
		const parsed = JSON.parse(content);
		if (Array.isArray(parsed)) {
			return normalizeChecklistEntries(parsed);
		}
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			Array.isArray(parsed.entries)
		) {
			return normalizeChecklistEntries(parsed.entries);
		}
		return [];
	} catch {
		return [];
	}
}

export async function exportChecklistToFile(
	entries: TTMLChecklistEntry[],
): Promise<string | null> {
	const normalized = normalizeChecklistEntries(entries);
	const exportData = {
		version: 1,
		exportedAt: new Date().toISOString(),
		entries: normalized,
	};
	const jsonStr = JSON.stringify(exportData, null, 2);
	const filename = `ttml-checklist-${new Date().toISOString().slice(0, 10)}.json`;
	return (await saveFile(jsonStr, {
		suggestedName: filename,
		types: [
			{
				description: "JSON Checklist File",
				accept: { "application/json": [".json"] },
			},
		],
	})) as string | null;
}

export function useChecklistCloudSync() {
	const user = useAtomValue(currentUserAtom);
	const [entries, setEntries] = useAtom(ttmlChecklistAtom);
	const isRemoteUpdateRef = useRef(false);
	const lastUploadedHashRef = useRef("");

	// Realtime listener when logged in
	useEffect(() => {
		if (!user?.uid || !isFirebaseConfigured()) return;

		let unsubscribe: (() => void) | undefined;

		try {
			const db = getFirebaseFirestore();
			if (!db) return;

			const docRef = doc(db, "users", user.uid, "userData", "checklist");

			unsubscribe = onSnapshot(
				docRef,
				(docSnap) => {
					if (docSnap.exists()) {
						const data = docSnap.data() as Partial<CloudChecklistData>;
						if (Array.isArray(data.entries)) {
							const remoteEntries = normalizeChecklistEntries(data.entries);
							const remoteJson = JSON.stringify(remoteEntries);
							const currentJson = JSON.stringify(entries);

							if (remoteJson !== currentJson) {
								isRemoteUpdateRef.current = true;
								lastUploadedHashRef.current = remoteJson;
								setEntries(remoteEntries);
							}
						}
					} else if (entries.length > 0) {
						// Initial push of existing local checklist to newly connected cloud
						void saveChecklistToCloud(entries, user.uid);
					}
				},
				(err) => {
					console.warn("Checklist realtime sync listener error:", err);
				},
			);
		} catch (err) {
			console.warn("Failed to set up checklist cloud sync listener:", err);
		}

		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [user?.uid]);

	// Auto-upload when entries change locally
	useEffect(() => {
		if (!user?.uid || !isFirebaseConfigured()) return;

		if (isRemoteUpdateRef.current) {
			isRemoteUpdateRef.current = false;
			return;
		}

		const json = JSON.stringify(entries);
		if (json === lastUploadedHashRef.current) return;

		lastUploadedHashRef.current = json;
		const timer = setTimeout(() => {
			void saveChecklistToCloud(entries, user.uid);
		}, 300);

		return () => clearTimeout(timer);
	}, [entries, user?.uid]);

	return {
		isLoggedIn: Boolean(user?.uid),
		user,
	};
}

/**
 * Background sync component mounted at app level so checklist sync is active
 * as long as the application is running.
 */
export function ChecklistBackgroundSync() {
	useChecklistCloudSync();
	return null;
}
