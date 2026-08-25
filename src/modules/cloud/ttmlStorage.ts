import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	orderBy,
	query,
	setDoc,
} from "firebase/firestore";
import { globalStore } from "$/states/store";
import {
	getActiveFirebaseConfig,
	getFirebaseAuth,
	getFirebaseFirestore,
	initFirebase,
} from "./firebase";
import { cloudTTMLListAtom, cloudTTMLLoadingAtom } from "./states";
import type { CloudTTMLDocument, CloudTTMLMetadata } from "./types";

export interface SaveCloudTTMLInput {
	title: string;
	artist: string;
	album: string;
	rawTTML: string;
	lineCount: number;
	durationMs: number;
	docId?: string;
	includeAudio?: boolean;
	audioBlob?: Blob | null;
	audioFileName?: string | null;
	onProgress?: (percent: number) => void;
}

export async function uploadAudioToCloud(
	audioBlob: Blob,
	docId: string,
	fileName?: string,
	onProgress?: (percent: number) => void,
): Promise<{
	audioUrl: string;
	audioStoragePath: string;
	audioFileName: string;
	audioSize: number;
}> {
	const auth = getFirebaseAuth();
	const user = auth.currentUser;
	if (!user) {
		throw new Error("You must be logged in to upload audio to Cloud.");
	}

	const { app } = initFirebase();
	if (!app) {
		throw new Error("Firebase is not initialized.");
	}

	const { getStorage, ref, uploadBytesResumable, getDownloadURL } = await import(
		"firebase/storage"
	);

	const storage = getStorage(app);

	let ext = "mp3";
	if (fileName && fileName.includes(".")) {
		ext = fileName.split(".").pop() || "mp3";
	} else if (audioBlob.type) {
		const subtype = audioBlob.type.split("/")[1];
		if (subtype) ext = subtype.replace("mpeg", "mp3");
	}

	const cleanName = fileName || `audio.${ext}`;
	const storagePath = `users/${user.uid}/audio/${docId}_${Date.now()}.${ext}`;
	const storageRef = ref(storage, storagePath);

	const contentType =
		audioBlob.type ||
		(ext === "flac"
			? "audio/flac"
			: ext === "wav"
				? "audio/wav"
				: ext === "ogg"
					? "audio/ogg"
					: "audio/mpeg");

	const uploadTask = uploadBytesResumable(storageRef, audioBlob, {
		contentType,
	});

	const audioUrl = await new Promise<string>((resolve, reject) => {
		const timeout = setTimeout(() => {
			uploadTask.cancel();
			reject(new Error("Audio upload timed out. Please check your network connection and try again."));
		}, 120000); // 2 minute timeout for large lossless audio files

		uploadTask.on(
			"state_changed",
			(snapshot) => {
				if (snapshot.totalBytes > 0) {
					const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
					onProgress?.(pct);
				}
			},
			(error) => {
				clearTimeout(timeout);
				reject(error);
			},
			async () => {
				clearTimeout(timeout);
				try {
					const url = await getDownloadURL(uploadTask.snapshot.ref);
					resolve(url);
				} catch (err) {
					reject(err);
				}
			},
		);
	});

	return {
		audioUrl,
		audioStoragePath: storagePath,
		audioFileName: cleanName,
		audioSize: audioBlob.size,
	};
}

export async function saveTTMLToCloud(
	input: SaveCloudTTMLInput,
): Promise<string> {
	const auth = getFirebaseAuth();
	const user = auth.currentUser;
	if (!user) {
		throw new Error("You must be signed in to save lyrics to the Cloud.");
	}

	const db = getFirebaseFirestore();
	const collectionRef = collection(db, "users", user.uid, "ttmls");
	const docRef = input.docId
		? doc(collectionRef, input.docId)
		: doc(collectionRef);

	let hasAudio = false;
	let audioUrl: string | null = null;
	let audioStoragePath: string | null = null;
	let audioFileName: string | null = null;
	let audioSize: number | null = null;

	if (input.includeAudio && input.audioBlob && input.audioBlob.size > 0) {
		try {
			const uploadRes = await uploadAudioToCloud(
				input.audioBlob,
				docRef.id,
				input.audioFileName || `${input.title || "audio"}.mp3`,
				input.onProgress,
			);
			hasAudio = true;
			audioUrl = uploadRes.audioUrl;
			audioStoragePath = uploadRes.audioStoragePath;
			audioFileName = uploadRes.audioFileName;
			audioSize = uploadRes.audioSize;
		} catch (uploadErr) {
			console.error("Audio cloud upload failed:", uploadErr);
			throw new Error(
				`Audio upload failed: ${(uploadErr as Error)?.message || "Unknown error"}`,
			);
		}
	}

	const now = Date.now();
	const data: Omit<CloudTTMLDocument, "id"> = {
		title: input.title || "Untitled",
		artist: input.artist || "",
		album: input.album || "",
		rawTTML: input.rawTTML,
		lineCount: input.lineCount,
		durationMs: input.durationMs,
		createdAt: now,
		updatedAt: now,
		authorUid: user.uid,
		authorName: user.displayName || user.email || "Unknown",
		hasAudio,
		audioUrl,
		audioStoragePath,
		audioFileName,
		audioSize,
	};

	await setDoc(docRef, data, { merge: true });

	// Refresh the local list
	await fetchUserTTMLList();

	return docRef.id;
}

export async function fetchUserTTMLList(): Promise<CloudTTMLMetadata[]> {
	const store = globalStore;
	const auth = getFirebaseAuth();
	const user = auth.currentUser;
	if (!user) {
		store.set(cloudTTMLListAtom, []);
		return [];
	}

	store.set(cloudTTMLLoadingAtom, true);
	try {
		const db = getFirebaseFirestore();
		const collectionRef = collection(db, "users", user.uid, "ttmls");
		const q = query(collectionRef, orderBy("updatedAt", "desc"));
		const snapshot = await getDocs(q);

		const list: CloudTTMLMetadata[] = snapshot.docs.map((docSnap) => {
			const d = docSnap.data();
			return {
				id: docSnap.id,
				title: d.title || "Untitled",
				artist: d.artist || "",
				album: d.album || "",
				lineCount: d.lineCount || 0,
				durationMs: d.durationMs || 0,
				createdAt: d.createdAt || 0,
				updatedAt: d.updatedAt || 0,
				authorUid: d.authorUid || user.uid,
				authorName: d.authorName,
				hasAudio: !!d.hasAudio,
				audioUrl: d.audioUrl || null,
				audioStoragePath: d.audioStoragePath || null,
				audioFileName: d.audioFileName || null,
				audioSize: d.audioSize || null,
			};
		});

		store.set(cloudTTMLListAtom, list);
		return list;
	} finally {
		store.set(cloudTTMLLoadingAtom, false);
	}
}

export async function loadTTMLFromCloud(
	docId: string,
): Promise<CloudTTMLDocument> {
	const auth = getFirebaseAuth();
	const user = auth.currentUser;
	if (!user) {
		throw new Error("You must be signed in to load lyrics from the Cloud.");
	}

	const db = getFirebaseFirestore();
	const docRef = doc(db, "users", user.uid, "ttmls", docId);
	const docSnap = await getDoc(docRef);

	if (!docSnap.exists()) {
		throw new Error("The requested cloud TTML document was not found.");
	}

	const d = docSnap.data();
	return {
		id: docSnap.id,
		title: d.title || "Untitled",
		artist: d.artist || "",
		album: d.album || "",
		rawTTML: d.rawTTML || "",
		lineCount: d.lineCount || 0,
		durationMs: d.durationMs || 0,
		createdAt: d.createdAt || 0,
		updatedAt: d.updatedAt || 0,
		authorUid: d.authorUid || user.uid,
		authorName: d.authorName,
		hasAudio: !!d.hasAudio,
		audioUrl: d.audioUrl || null,
		audioStoragePath: d.audioStoragePath || null,
		audioFileName: d.audioFileName || null,
		audioSize: d.audioSize || null,
	};
}

export async function downloadCloudAudio(
	audioUrl: string,
	storagePath?: string | null,
): Promise<Blob> {
	const { app } = initFirebase();
	if (!app) {
		throw new Error("Firebase app is not initialized.");
	}

	const { getStorage, ref, getBlob } = await import("firebase/storage");
	const storage = getStorage(app);

	// 1. If we have a relative storage path (e.g. users/<uid>/audio/<file>)
	let relPath = storagePath;
	if (!relPath && audioUrl) {
		if (audioUrl.includes("/o/")) {
			const encoded = audioUrl.split("/o/")[1].split("?")[0];
			relPath = decodeURIComponent(encoded);
		} else if (audioUrl.startsWith("users/")) {
			relPath = audioUrl;
		}
	}

	if (relPath) {
		try {
			const storageRef = ref(storage, relPath);
			const blob = await getBlob(storageRef);
			return blob;
		} catch (relErr) {
			console.warn("getBlob with relative path failed:", relErr);
		}
	}

	// 2. If it's a full URL, try ref(storage, audioUrl)
	if (audioUrl && (audioUrl.startsWith("http") || audioUrl.startsWith("gs://"))) {
		try {
			const storageRef = ref(storage, audioUrl);
			const blob = await getBlob(storageRef);
			return blob;
		} catch (urlErr) {
			console.warn("ref(storage, audioUrl) failed, trying fetch fallback:", urlErr);
		}
	}

	// 3. Fallback to HTTP fetch
	const res = await fetch(audioUrl);
	if (!res.ok) {
		throw new Error(`HTTP ${res.status}: ${res.statusText}`);
	}
	return await res.blob();
}

export async function deleteTTMLFromCloud(docId: string): Promise<void> {
	const auth = getFirebaseAuth();
	const user = auth.currentUser;
	if (!user) {
		throw new Error("You must be signed in to delete lyrics from the Cloud.");
	}

	try {
		const docData = await loadTTMLFromCloud(docId);
		if (docData.audioUrl) {
			const { app } = initFirebase();
			if (app) {
				const { getStorage, ref, deleteObject } = await import(
					"firebase/storage"
				);
				const storage = getStorage(app);
				const storageRef = ref(storage, docData.audioUrl);
				await deleteObject(storageRef).catch(() => {});
			}
		}
	} catch {
		// Ignore storage deletion errors
	}

	const db = getFirebaseFirestore();
	const docRef = doc(db, "users", user.uid, "ttmls", docId);
	await deleteDoc(docRef);

	// Refresh the local list
	await fetchUserTTMLList();
}
