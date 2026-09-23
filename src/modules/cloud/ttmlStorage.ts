import {
	collection,
	deleteDoc,
	deleteField,
	doc,
	getDoc,
	getDocs,
	orderBy,
	query,
	setDoc,
	updateDoc,
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
	publishToCommunity?: boolean;
	isCompleted?: boolean;
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

	const { getStorage, ref, uploadBytesResumable, getDownloadURL } =
		await import("firebase/storage");

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
			reject(
				new Error(
					"Audio upload timed out. Please check your network connection and try again.",
				),
			);
		}, 120000); // 2 minute timeout for large lossless audio files

		uploadTask.on(
			"state_changed",
			(snapshot) => {
				if (snapshot.totalBytes > 0) {
					const pct = Math.round(
						(snapshot.bytesTransferred / snapshot.totalBytes) * 100,
					);
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
	let coverArt: string | null = null;
	const coverMatch =
		input.rawTTML?.match(
			/key=["']cover(?:_art)?["'][^>]*value=["']([^"']+)["']/i,
		) ||
		input.rawTTML?.match(
			/<amll:meta[^>]*key=["']cover(?:_art)?["'][^>]*>([^<]+)<\/amll:meta>/i,
		) ||
		input.rawTTML?.match(/https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|webp)/i);
	if (coverMatch?.[1] || coverMatch?.[0]) {
		coverArt = coverMatch[1] || coverMatch[0];
	}

	const isPublished = Boolean(input.publishToCommunity);
	let isCompleted = Boolean(input.isCompleted);
	if (!isCompleted && !isPublished && input.rawTTML) {
		try {
			const { parseLyric } = await import("$/modules/project/logic/ttml-parser");
			const { isTTML100PercentCompleted } = await import(
				"$/modules/ttml-checklist/logic"
			);
			const parsed = parseLyric(input.rawTTML);
			if (isTTML100PercentCompleted(parsed)) {
				isCompleted = true;
			}
		} catch {
			// ignore
		}
	}
	const isFinished = isPublished || isCompleted;

	const tags: string[] = [];
	if (isFinished) tags.push("finished");
	if (isPublished) tags.push("community");

	const metadata: Omit<CloudTTMLMetadata, "id"> & {
		coverArt?: string | null;
		tags?: string[];
		finished?: boolean;
		publishedToCommunity?: boolean;
	} = {
		title: input.title || "Untitled",
		artist: input.artist || "",
		album: input.album || "",
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
		coverArt,
		tags,
		finished: isFinished,
		publishedToCommunity: isPublished,
	};

	// 1. Save lightweight metadata doc (without rawTTML) so library listings are fast
	await setDoc(docRef, metadata, { merge: true });
	// Remove legacy rawTTML field from the parent metadata doc if present
	await updateDoc(docRef, { rawTTML: deleteField() }).catch(() => {});

	// 2. Save individual rawTTML payload in subcollection so each song's content loads individually on demand
	const payloadDocRef = doc(
		db,
		"users",
		user.uid,
		"ttmls",
		docRef.id,
		"payload",
		"content",
	);
	await setDoc(payloadDocRef, {
		rawTTML: input.rawTTML,
		updatedAt: now,
	});

	// Mirror to or remove from finished_ttmls and public_ttmls collections
	try {
		const finishedDocRef = doc(collection(db, "finished_ttmls"), docRef.id);
		const publicDocRef = doc(collection(db, "public_ttmls"), docRef.id);
		if (isPublished) {
			const communityData = { ...metadata, rawTTML: input.rawTTML };
			await setDoc(finishedDocRef, communityData, { merge: true });
			await setDoc(publicDocRef, communityData, { merge: true }).catch(() => {});
		} else {
			await deleteDoc(finishedDocRef).catch(() => {});
			await deleteDoc(publicDocRef).catch(() => {});
		}
	} catch (err) {
		console.warn("Could not update finished_ttmls / public_ttmls:", err);
	}

	// Refresh the local list
	await fetchUserTTMLList();

	// Auto-link/add with TTML Checklist & update cloud checklist
	try {
		const { linkUploadedTTMLToChecklist } = await import(
			"$/modules/ttml-checklist/logic"
		);
		const { saveChecklistToCloud } = await import(
			"$/modules/ttml-checklist/cloudSync"
		);
		const { ttmlChecklistAtom } = await import(
			"$/modules/ttml-checklist/states"
		);

		const currentChecklist = globalStore.get(ttmlChecklistAtom);
		const linkResult = linkUploadedTTMLToChecklist(currentChecklist, {
			title: metadata.title,
			artist: metadata.artist,
			album: metadata.album,
			coverArt: metadata.coverArt,
			docId: docRef.id,
			rawTTML: input.rawTTML,
			audioUrl,
			isCompleted: metadata.finished,
		});
		globalStore.set(ttmlChecklistAtom, linkResult.entries);
		void saveChecklistToCloud(linkResult.entries, user.uid);
	} catch (err) {
		console.warn("Could not auto-link TTML to checklist:", err);
	}

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

		const list: CloudTTMLMetadata[] = [];
		const legacyDocsToMigrate: Array<{
			id: string;
			rawTTML: string;
			updatedAt: number;
		}> = [];

		for (const docSnap of snapshot.docs) {
			const d = docSnap.data();
			if (d.rawTTML) {
				legacyDocsToMigrate.push({
					id: docSnap.id,
					rawTTML: d.rawTTML,
					updatedAt: d.updatedAt || 0,
				});
			}
			list.push({
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
				coverArt: d.coverArt || null,
				publishedToCommunity: Boolean(d.publishedToCommunity),
				finished: Boolean(
					d.finished ||
					d.completed ||
					d.publishedToCommunity ||
					(Array.isArray(d.tags) &&
						(d.tags.includes("finished") || d.tags.includes("completed"))),
				),
			});
		}

		store.set(cloudTTMLListAtom, list);

		// Cache in localStorage for instant rendering next time
		try {
			localStorage.setItem(
				`amll_cloud_ttmls_${user.uid}`,
				JSON.stringify(list),
			);
		} catch {
			// ignore quota
		}

		// Asynchronously migrate any legacy docs that still contained heavy rawTTML in the parent doc
		if (legacyDocsToMigrate.length > 0) {
			(async () => {
				for (const item of legacyDocsToMigrate) {
					try {
						const payloadRef = doc(
							db,
							"users",
							user.uid,
							"ttmls",
							item.id,
							"payload",
							"content",
						);
						await setDoc(payloadRef, {
							rawTTML: item.rawTTML,
							updatedAt: item.updatedAt,
						});
						const parentRef = doc(db, "users", user.uid, "ttmls", item.id);
						await updateDoc(parentRef, { rawTTML: deleteField() });
					} catch {
						// ignore migration failure
					}
				}
			})();
		}

		return list;
	} finally {
		store.set(cloudTTMLLoadingAtom, false);
	}
}

export async function loadTTMLFromCloud(
	docId: string,
	authorUid?: string,
): Promise<CloudTTMLDocument> {
	const auth = getFirebaseAuth();
	const user = auth.currentUser;
	const targetUid = authorUid || user?.uid;
	if (!targetUid) {
		throw new Error("You must be signed in to load lyrics from the Cloud.");
	}

	const db = getFirebaseFirestore();
	const docRef = doc(db, "users", targetUid, "ttmls", docId);
	const docSnap = await getDoc(docRef);

	if (!docSnap.exists()) {
		throw new Error("The requested cloud TTML document was not found.");
	}

	const d = docSnap.data();
	let rawTTML = d.rawTTML || "";

	// If rawTTML is not in the parent metadata doc, load the individual song payload subdocument
	if (!rawTTML) {
		const payloadRef = doc(
			db,
			"users",
			targetUid,
			"ttmls",
			docId,
			"payload",
			"content",
		);
		const payloadSnap = await getDoc(payloadRef);
		if (payloadSnap.exists()) {
			rawTTML = payloadSnap.data().rawTTML || "";
		}
	} else if (user && user.uid === targetUid) {
		// Migrate legacy doc in background so future library lists don't download this song's rawTTML
		(async () => {
			try {
				const payloadRef = doc(
					db,
					"users",
					targetUid,
					"ttmls",
					docId,
					"payload",
					"content",
				);
				await setDoc(payloadRef, {
					rawTTML,
					updatedAt: d.updatedAt || Date.now(),
				});
				await updateDoc(docRef, { rawTTML: deleteField() });
			} catch {
				// ignore
			}
		})();
	}

	return {
		id: docSnap.id,
		title: d.title || "Untitled",
		artist: d.artist || "",
		album: d.album || "",
		rawTTML,
		lineCount: d.lineCount || 0,
		durationMs: d.durationMs || 0,
		createdAt: d.createdAt || 0,
		updatedAt: d.updatedAt || 0,
		authorUid: d.authorUid || targetUid,
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
	if (
		audioUrl &&
		(audioUrl.startsWith("http") || audioUrl.startsWith("gs://"))
	) {
		try {
			const storageRef = ref(storage, audioUrl);
			const blob = await getBlob(storageRef);
			return blob;
		} catch (urlErr) {
			console.warn(
				"ref(storage, audioUrl) failed, trying fetch fallback:",
				urlErr,
			);
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
	await deleteDoc(
		doc(db, "users", user.uid, "ttmls", docId, "payload", "content"),
	).catch(() => {});

	// Also remove from public/finished collections if present
	try {
		await deleteDoc(doc(db, "finished_ttmls", docId)).catch(() => {});
		await deleteDoc(doc(db, "public_ttmls", docId)).catch(() => {});
	} catch {}

	// Refresh the local list
	await fetchUserTTMLList();
}

export async function updateTTMLFinishedInCloud(
	docId: string,
	finished: boolean,
): Promise<void> {
	const auth = getFirebaseAuth();
	const user = auth.currentUser;
	if (!user) {
		throw new Error("You must be logged in to update lyrics.");
	}

	const db = getFirebaseFirestore();
	const docRef = doc(db, "users", user.uid, "ttmls", docId);
	const docSnap = await getDoc(docRef);
	if (!docSnap.exists()) return;

	const d = docSnap.data();
	const tags = new Set<string>(Array.isArray(d.tags) ? d.tags : []);
	if (finished) {
		tags.add("finished");
	} else {
		tags.delete("finished");
	}

	await updateDoc(docRef, {
		finished,
		tags: Array.from(tags),
		updatedAt: Date.now(),
	});

	await fetchUserTTMLList();
}

export async function batchSaveTTMLsToCloud(
	inputs: SaveCloudTTMLInput[],
	onProgress?: (completed: number, total: number, currentItem: string) => void,
): Promise<{
	successful: number;
	failed: number;
	errors: Array<{ title: string; error: string }>;
}> {
	let successful = 0;
	let failed = 0;
	const errors: Array<{ title: string; error: string }> = [];

	for (let i = 0; i < inputs.length; i++) {
		const input = inputs[i];
		const title = input.title || "Untitled";
		onProgress?.(i, inputs.length, title);
		try {
			await saveTTMLToCloud(input);
			successful++;
		} catch (err: unknown) {
			failed++;
			const errorMsg = (err as Error)?.message || "Failed to save";
			errors.push({ title, error: errorMsg });
			console.error(`[BatchSave] Failed to save "${title}":`, err);
		}
	}

	onProgress?.(inputs.length, inputs.length, "Done");
	await fetchUserTTMLList();

	return { successful, failed, errors };
}

