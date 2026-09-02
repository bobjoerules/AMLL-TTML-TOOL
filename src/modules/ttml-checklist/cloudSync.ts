import { useEffect, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
	collection,
	doc,
	getDoc,
	getDocs,
	onSnapshot,
	setDoc,
} from "firebase/firestore";
import { saveFile } from "$/utils/fileSystem";
import { globalStore } from "$/states/store";
import { currentUserAtom } from "$/modules/cloud/states";
import {
	getFirebaseAuth,
	getFirebaseFirestore,
	isFirebaseConfigured,
} from "$/modules/cloud/firebase";
import {
	deduplicateChecklistEntries,
	linkUploadedTTMLToChecklist,
	normalizeChecklistEntries,
	type TTMLChecklistEntry,
} from "./logic";
import { ttmlChecklistAtom } from "./states";

export interface CloudChecklistData {
	entries: TTMLChecklistEntry[];
	updatedAt: number;
	lastUpdatedBy?: string;
}

/**
 * Scans the user's cloud saves (users/{uid}/ttmls) for finished lyrics,
 * and automatically integrates any finished tracks into the checklist.
 */
export async function syncFinishedCloudTTMLsToChecklist(
	currentEntries: TTMLChecklistEntry[],
	uid: string,
): Promise<{ entries: TTMLChecklistEntry[]; importedCount: number }> {
	if (!isFirebaseConfigured()) {
		return { entries: currentEntries, importedCount: 0 };
	}

	try {
		const db = getFirebaseFirestore();
		if (!db) return { entries: currentEntries, importedCount: 0 };

		const collectionRef = collection(db, "users", uid, "ttmls");
		const snap = await getDocs(collectionRef);

		let updatedEntries = [...currentEntries];
		let importedCount = 0;

		snap.forEach((docSnap) => {
			const d = docSnap.data();
			const isFinished =
				d.finished === true ||
				(Array.isArray(d.tags) && d.tags.includes("finished")) ||
				d.publishedToCommunity === true;

			if (isFinished) {
				const linkResult = linkUploadedTTMLToChecklist(updatedEntries, {
					title: d.title || "Untitled",
					artist: d.artist || "",
					album: d.album || undefined,
					coverArt: d.coverArt || null,
					docId: docSnap.id,
					rawTTML: d.rawTTML,
					audioUrl: d.audioUrl || null,
					isCompleted: true,
				});

				if (linkResult.added || linkResult.updated) {
					updatedEntries = linkResult.entries;
					if (linkResult.added) importedCount++;
				}
			}
		});

		return {
			entries: normalizeChecklistEntries(updatedEntries),
			importedCount,
		};
	} catch (err) {
		console.warn("Could not sync finished cloud TTMLs to checklist:", err);
		return { entries: currentEntries, importedCount: 0 };
	}
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

		let baseEntries: TTMLChecklistEntry[] = [];
		const docRef = doc(db, "users", targetUid, "userData", "checklist");
		const snap = await getDoc(docRef);
		if (snap.exists()) {
			const data = snap.data() as Partial<CloudChecklistData>;
			if (Array.isArray(data.entries)) {
				baseEntries = normalizeChecklistEntries(data.entries);
			}
		}

		// Also incorporate any finished cloud TTMLs from user's library
		const finishedSync = await syncFinishedCloudTTMLsToChecklist(
			baseEntries,
			targetUid,
		);
		return { entries: finishedSync.entries };
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

/**
 * Lightweight hook to read cloud checklist auth and user state without
 * creating duplicate sync loops.
 */
export function useChecklistSyncStatus() {
	const user = useAtomValue(currentUserAtom);
	return {
		isLoggedIn: Boolean(user?.uid),
		user,
	};
}

export function useChecklistCloudSync() {
	const user = useAtomValue(currentUserAtom);
	const [entries, setEntries] = useAtom(ttmlChecklistAtom);
	const isRemoteUpdateRef = useRef(false);
	const lastUploadedHashRef = useRef("");
	const isInitialSyncDoneRef = useRef(false);
	const currentSyncedUidRef = useRef<string | null>(null);

	// Realtime listener when logged in
	useEffect(() => {
		if (!user?.uid || !isFirebaseConfigured()) {
			isInitialSyncDoneRef.current = false;
			currentSyncedUidRef.current = null;
			return;
		}

		// Reset sync tracking when a different user logs in
		if (currentSyncedUidRef.current !== user.uid) {
			currentSyncedUidRef.current = user.uid;
			isInitialSyncDoneRef.current = false;
			lastUploadedHashRef.current = "";
		}

		let unsubscribe: (() => void) | undefined;

		try {
			const db = getFirebaseFirestore();
			if (!db) return;

			const docRef = doc(db, "users", user.uid, "userData", "checklist");

			unsubscribe = onSnapshot(
				docRef,
				async (docSnap) => {
					try {
						let remoteEntries: TTMLChecklistEntry[] = [];
						let docExisted = false;

						if (docSnap.exists()) {
							docExisted = true;
							const data = docSnap.data() as Partial<CloudChecklistData>;
							if (Array.isArray(data.entries)) {
								remoteEntries = normalizeChecklistEntries(data.entries);
							}
						}

						// Scan for finished cloud TTMLs and incorporate them
						const finishedSync = await syncFinishedCloudTTMLsToChecklist(
							remoteEntries,
							user.uid,
						);
						remoteEntries = finishedSync.entries;

						const currentEntries = globalStore.get(ttmlChecklistAtom);

						let resolvedEntries: TTMLChecklistEntry[];
						if (!isInitialSyncDoneRef.current) {
							// INITIAL SYNC ON APP BOOT / LOGIN:
							if (currentEntries.length === 0) {
								// Fresh device or empty local state: remote wins, never wipe cloud!
								resolvedEntries = remoteEntries;
							} else if (remoteEntries.length === 0 && !docExisted) {
								// Brand new cloud account with existing local entries: push local to cloud
								resolvedEntries = currentEntries;
								void saveChecklistToCloud(currentEntries, user.uid);
							} else {
								// Both local and remote have entries: merge both without losing anything!
								resolvedEntries = deduplicateChecklistEntries([
									...remoteEntries,
									...currentEntries,
								]);
								if (
									finishedSync.importedCount > 0 ||
									resolvedEntries.length !== remoteEntries.length
								) {
									void saveChecklistToCloud(resolvedEntries, user.uid);
								}
							}
							isInitialSyncDoneRef.current = true;
						} else {
							// Subsequent realtime update pushed from another device:
							resolvedEntries = remoteEntries;
						}

						const resolvedJson = JSON.stringify(resolvedEntries);
						const currentJson = JSON.stringify(currentEntries);

						if (resolvedJson !== currentJson) {
							isRemoteUpdateRef.current = true;
							lastUploadedHashRef.current = resolvedJson;
							setEntries(resolvedEntries);
						} else {
							lastUploadedHashRef.current = resolvedJson;
						}
					} catch (err) {
						console.warn("Error processing checklist snapshot:", err);
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

		// CRITICAL: NEVER auto-upload before initial sync has resolved!
		if (!isInitialSyncDoneRef.current) return;

		if (isRemoteUpdateRef.current) {
			isRemoteUpdateRef.current = false;
			return;
		}

		const json = JSON.stringify(entries);
		if (json === lastUploadedHashRef.current) return;

		// Safeguard: Never overwrite cloud with empty list if the last state wasn't established
		if (entries.length === 0 && !lastUploadedHashRef.current) return;

		lastUploadedHashRef.current = json;
		const timer = setTimeout(() => {
			void saveChecklistToCloud(entries, user.uid);
		}, 400);

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
