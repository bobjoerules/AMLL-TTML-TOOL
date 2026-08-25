import {
	GithubAuthProvider,
	GoogleAuthProvider,
	OAuthProvider,
	createUserWithEmailAndPassword,
	signInWithCredential,
	signInWithEmailAndPassword,
	signInWithPopup,
	signOut,
	updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { globalStore } from "$/states/store";
import {
	getFirebaseAuth,
	getFirebaseFirestore,
	initFirebase,
	isFirebaseConfigured,
} from "./firebase";
import { currentUserAtom } from "./states";
import type { UserProfile } from "./types";

export async function signInWithGoogle() {
	if (!isFirebaseConfigured()) {
		throw new Error(
			"Please configure your Firebase Project credentials in Settings before signing in.",
		);
	}
	const auth = getFirebaseAuth();
	const provider = new GoogleAuthProvider();
	provider.addScope("profile");
	provider.addScope("email");
	provider.setCustomParameters({ prompt: "select_account" });
	const result = await signInWithPopup(auth, provider);
	return result.user;
}

export async function signInWithGitHub() {
	if (!isFirebaseConfigured()) {
		throw new Error(
			"Please configure your Firebase Project credentials in Settings before signing in.",
		);
	}
	const auth = getFirebaseAuth();
	const provider = new GithubAuthProvider();
	provider.addScope("read:user");
	provider.addScope("user:email");
	const result = await signInWithPopup(auth, provider);
	return result.user;
}

export async function signInWithApple() {
	if (!isFirebaseConfigured()) {
		throw new Error(
			"Please configure your Firebase Project credentials in Settings before signing in.",
		);
	}
	const auth = getFirebaseAuth();
	const provider = new OAuthProvider("apple.com");
	provider.addScope("email");
	provider.addScope("name");
	const result = await signInWithPopup(auth, provider);
	return result.user;
}

export async function signInWithEmail(email: string, pass: string) {
	if (!isFirebaseConfigured()) {
		throw new Error(
			"Please configure your Firebase Project credentials in Settings before signing in.",
		);
	}
	const auth = getFirebaseAuth();
	const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
	return result.user;
}

export async function signUpWithEmail(
	email: string,
	pass: string,
	displayName?: string,
) {
	if (!isFirebaseConfigured()) {
		throw new Error(
			"Please configure your Firebase Project credentials in Settings before signing in.",
		);
	}
	const auth = getFirebaseAuth();
	const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
	if (displayName && result.user) {
		await updateProfile(result.user, { displayName: displayName.trim() });
	}
	return result.user;
}

export async function loginWithAuthBridgeToken(rawToken: string) {
	const trimmed = rawToken.trim();
	if (!trimmed) {
		throw new Error("Login token is empty.");
	}

	let payload: any;
	try {
		const jsonStr = decodeURIComponent(escape(atob(trimmed)));
		payload = JSON.parse(jsonStr);
	} catch {
		throw new Error("Invalid token format. Please copy a valid login token.");
	}

	if (payload.type !== "amll-ttml-auth-token" || !payload.uid) {
		throw new Error("Invalid token payload.");
	}

	const auth = getFirebaseAuth();

	// Try Firebase signInWithCredential if provider credential exists
	try {
		if (
			payload.providerId === "google.com" &&
			(payload.idToken || payload.accessToken)
		) {
			const credential = GoogleAuthProvider.credential(
				payload.idToken,
				payload.accessToken,
			);
			const res = await signInWithCredential(auth, credential);
			return res.user;
		}
		if (payload.providerId === "github.com" && payload.accessToken) {
			const credential = GithubAuthProvider.credential(payload.accessToken);
			const res = await signInWithCredential(auth, credential);
			return res.user;
		}
		if (payload.providerId === "apple.com" && payload.idToken) {
			const appleProvider = new OAuthProvider("apple.com");
			const credential = appleProvider.credential({ idToken: payload.idToken });
			const res = await signInWithCredential(auth, credential);
			return res.user;
		}
	} catch (e) {
		console.warn("Credential sign-in failed, setting local user session", e);
	}

	// Session fallback: set atom profile directly
	const profile: UserProfile = {
		uid: payload.uid,
		displayName: payload.displayName || payload.email?.split("@")[0] || "User",
		email: payload.email || null,
		photoURL: payload.photoURL || null,
		providerId: payload.providerId || "google.com",
	};

	const store = globalStore;
	store.set(currentUserAtom, profile);
	return profile;
}

export async function signOutUser() {
	const auth = getFirebaseAuth();
	try {
		await signOut(auth);
	} catch {
		// Ignore if already signed out
	}
	const store = globalStore;
	store.set(currentUserAtom, null);
}

/**
 * Optimizes, crops and compresses avatar image to a lightweight format
 */
export async function optimizeAvatarImage(
	file: Blob | File,
	maxSize = 256,
): Promise<{ blob: Blob; dataUrl: string }> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(objectUrl);
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				resolve({ blob: file, dataUrl: "" });
				return;
			}

			// Center square crop
			const minDimension = Math.min(img.width, img.height);
			const sx = (img.width - minDimension) / 2;
			const sy = (img.height - minDimension) / 2;

			const targetSize = Math.min(maxSize, minDimension);
			canvas.width = targetSize;
			canvas.height = targetSize;

			// Smooth rendering
			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = "high";
			ctx.drawImage(
				img,
				sx,
				sy,
				minDimension,
				minDimension,
				0,
				0,
				targetSize,
				targetSize,
			);

			const dataUrl = canvas.toDataURL("image/webp", 0.85);
			canvas.toBlob(
				(blob) => {
					if (blob) {
						resolve({ blob, dataUrl });
					} else {
						resolve({ blob: file, dataUrl });
					}
				},
				"image/webp",
				0.85,
			);
		};

		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			reject(new Error("Failed to process image file."));
		};

		img.src = objectUrl;
	});
}

export async function uploadProfilePhoto(file: Blob | File): Promise<string> {
	const store = globalStore;
	const localUser = store.get(currentUserAtom);
	let authUser = null;
	try {
		const auth = getFirebaseAuth();
		authUser = auth.currentUser;
	} catch {
		// auth not initialized yet
	}

	const uid = authUser?.uid || localUser?.uid;
	if (!uid) {
		throw new Error("You must be logged in to update your profile photo.");
	}

	// Optimize image first for ultra fast, lightweight upload
	const { blob: optimizedBlob, dataUrl } = await optimizeAvatarImage(file, 256);
	let downloadUrl = "";

	// 1. Try Firebase Storage first (if configured and enabled)
	try {
		const { app } = initFirebase();
		if (app) {
			const { getStorage, ref, uploadBytes, getDownloadURL } = await import(
				"firebase/storage"
			);
			const storage = getStorage(app);
			const storageRef = ref(storage, `avatars/${uid}/${Date.now()}.webp`);
			const snapshot = await uploadBytes(storageRef, optimizedBlob);
			downloadUrl = await getDownloadURL(snapshot.ref);
		}
	} catch (storageErr) {
		console.warn("Firebase Storage unavailable, trying fallbacks...", storageErr);
	}

	// 2. Try Litterbox / Catbox (reliable, fast, no CORS issues, no hotlink block)
	if (!downloadUrl) {
		try {
			const formData = new FormData();
			formData.append("reqtype", "fileupload");
			formData.append("time", "72h");
			formData.append("fileToUpload", optimizedBlob, "avatar.webp");

			const res = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
				method: "POST",
				body: formData,
			});
			if (res.ok) {
				const link = (await res.text()).trim();
				if (link.startsWith("http")) {
					downloadUrl = link;
				}
			}
		} catch (catboxErr) {
			console.warn("Litterbox upload failed, trying next fallback...", catboxErr);
		}
	}

	// 3. Try Imgur as next fallback
	if (!downloadUrl) {
		try {
			const formData = new FormData();
			formData.append("image", optimizedBlob);
			const response = await fetch("https://api.imgur.com/3/image", {
				method: "POST",
				headers: {
					Authorization: "Client-ID 761a7a00f279d01",
				},
				body: formData,
			});
			const result = await response.json();
			if (result.success && result.data?.link) {
				downloadUrl = result.data.link;
			}
		} catch (imgurErr) {
			console.warn("Imgur upload failed...", imgurErr);
		}
	}

	// 4. Guaranteed Data URL Fallback (WebP ~10KB, 100% reliable, zero server dependency)
	if (!downloadUrl && dataUrl) {
		downloadUrl = dataUrl;
	}

	if (!downloadUrl) {
		throw new Error("Could not upload profile photo. Please try a direct image URL.");
	}

	// Save to user profile across Firebase Auth, Firestore, and LocalStorage
	await updateUserProfileDetails({ photoURL: downloadUrl });

	return downloadUrl;
}

export async function updateUserProfileDetails(updates: {
	displayName?: string;
	photoURL?: string;
}) {
	const store = globalStore;
	const localUser = store.get(currentUserAtom);
	let authUser = null;
	try {
		const auth = getFirebaseAuth();
		authUser = auth.currentUser;
	} catch {
		// ignore
	}

	const uid = authUser?.uid || localUser?.uid;
	if (!uid) {
		throw new Error("No active user session found.");
	}

	// 1. Update Firebase Auth user (if not data URI or if short enough)
	if (authUser) {
		try {
			const authUpdates: { displayName?: string; photoURL?: string } = {};
			if (updates.displayName !== undefined) {
				authUpdates.displayName = updates.displayName;
			}
			// Only set photoURL in Firebase Auth if it's a standard URL (Firebase Auth limits photoURL to ~2048 chars)
			if (updates.photoURL !== undefined && !updates.photoURL.startsWith("data:")) {
				authUpdates.photoURL = updates.photoURL;
			}
			if (Object.keys(authUpdates).length > 0) {
				await updateProfile(authUser, authUpdates);
			}
		} catch (err) {
			console.warn("Firebase Auth updateProfile error:", err);
		}
	}

	// 2. Persist to Firestore user document for permanent cloud sync
	try {
		const db = getFirebaseFirestore();
		if (db) {
			const userDocRef = doc(db, "users", uid);
			const firestoreData: Record<string, any> = {
				updatedAt: Date.now(),
			};
			if (updates.displayName !== undefined) {
				firestoreData.displayName = updates.displayName;
			}
			if (updates.photoURL !== undefined) {
				firestoreData.photoURL = updates.photoURL;
			}
			await setDoc(userDocRef, firestoreData, { merge: true });
		}
	} catch (dbErr) {
		console.warn("Failed to persist user profile to Firestore:", dbErr);
	}

	// 3. Persist to local storage cache for instant offline restore
	try {
		const cacheKey = `amll_profile_${uid}`;
		const existingCache = localStorage.getItem(cacheKey);
		const parsed = existingCache ? JSON.parse(existingCache) : {};
		const updatedCache = {
			...parsed,
			...updates,
		};
		localStorage.setItem(cacheKey, JSON.stringify(updatedCache));
	} catch {
		// ignore storage quota errors
	}

	// 4. Update global atom state
	if (localUser) {
		store.set(currentUserAtom, {
			...localUser,
			displayName:
				updates.displayName !== undefined
					? updates.displayName
					: localUser.displayName,
			photoURL:
				updates.photoURL !== undefined ? updates.photoURL : localUser.photoURL,
		});
	}
}

export async function fetchUserProfileData(uid: string): Promise<{
	displayName?: string;
	photoURL?: string;
} | null> {
	// 1. Try local cache first for instant render
	let cachedProfile: {
		displayName?: string;
		photoURL?: string;
	} | null = null;
	try {
		const cached = localStorage.getItem(`amll_profile_${uid}`);
		if (cached) {
			cachedProfile = JSON.parse(cached);
		}
	} catch {
		// ignore
	}

	// 2. Fetch from Firestore
	try {
		const db = getFirebaseFirestore();
		if (db) {
			const userDocRef = doc(db, "users", uid);
			const snap = await getDoc(userDocRef);
			if (snap.exists()) {
				const data = snap.data();
				const result = {
					displayName: data.displayName || cachedProfile?.displayName,
					photoURL: data.photoURL || cachedProfile?.photoURL,
				};
				// Update local cache
				localStorage.setItem(`amll_profile_${uid}`, JSON.stringify(result));
				return result;
			}
		}
	} catch (err) {
		console.warn("Failed to fetch Firestore user profile:", err);
	}

	return cachedProfile;
}
