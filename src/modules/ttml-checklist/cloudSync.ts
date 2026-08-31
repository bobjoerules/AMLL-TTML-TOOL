import { useEffect, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { currentUserAtom } from "$/modules/cloud/states";
import { getFirebaseFirestore, isFirebaseConfigured } from "$/modules/cloud/firebase";
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
): Promise<boolean> {
	if (!isFirebaseConfigured()) return false;

	try {
		const db = getFirebaseFirestore();
		if (!db) return false;

		const targetUid = uid || (await import("firebase/auth").then((m) => m.getAuth()?.currentUser?.uid));
		if (!targetUid) return false;

		const docRef = doc(db, "users", targetUid, "userData", "checklist");
		const data: CloudChecklistData = {
			entries,
			updatedAt: Date.now(),
		};
		await setDoc(docRef, data, { merge: true });
		return true;
	} catch (err) {
		console.warn("Failed to save checklist to Firebase:", err);
		return false;
	}
}

export async function loadChecklistFromCloud(
	uid: string,
): Promise<TTMLChecklistEntry[] | null> {
	if (!isFirebaseConfigured()) return null;

	try {
		const db = getFirebaseFirestore();
		if (!db) return null;

		const docRef = doc(db, "users", uid, "userData", "checklist");
		const snap = await getDoc(docRef);
		if (snap.exists()) {
			const data = snap.data() as Partial<CloudChecklistData>;
			if (Array.isArray(data.entries)) {
				return normalizeChecklistEntries(data.entries);
			}
		}
		return null;
	} catch (err) {
		console.warn("Failed to load checklist from Firebase:", err);
		return null;
	}
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
