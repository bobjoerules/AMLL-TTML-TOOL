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
import { globalStore } from "$/states/store";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";
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
		if (payload.providerId === "google.com" && (payload.idToken || payload.accessToken)) {
			const credential = GoogleAuthProvider.credential(payload.idToken, payload.accessToken);
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

export async function uploadProfilePhoto(file: Blob | File): Promise<string> {
	const auth = getFirebaseAuth();
	const user = auth.currentUser;
	const store = globalStore;
	const localUser = store.get(currentUserAtom);
	const uid = user?.uid || localUser?.uid;

	if (!uid) {
		throw new Error("You must be logged in to update your profile photo.");
	}

	let downloadUrl = "";

	// 1. Try Firebase Storage first
	try {
		const { app } = initFirebase();
		if (app) {
			const { getStorage, ref, uploadBytes, getDownloadURL } = await import(
				"firebase/storage"
			);
			const storage = getStorage(app);
			const ext =
				file.type === "image/png"
					? "png"
					: file.type === "image/gif"
						? "gif"
						: "jpg";
			const storageRef = ref(storage, `avatars/${uid}/${Date.now()}.${ext}`);
			const snapshot = await uploadBytes(storageRef, file);
			downloadUrl = await getDownloadURL(snapshot.ref);
		}
	} catch (storageErr) {
		console.warn(
			"Firebase Storage upload failed, falling back to Imgur upload...",
			storageErr,
		);
	}

	// 2. Fallback to Imgur if Firebase Storage failed or not configured
	if (!downloadUrl) {
		try {
			const formData = new FormData();
			formData.append("image", file);
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
			} else {
				throw new Error(result?.data?.error || "Image upload failed");
			}
		} catch (imgurErr) {
			console.error("Imgur upload failed:", imgurErr);
			throw new Error(
				"Failed to upload avatar image. Please check your network connection or try providing a direct image URL.",
			);
		}
	}

	// Update Firebase Auth profile if currentUser exists
	if (user) {
		try {
			await updateProfile(user, { photoURL: downloadUrl });
		} catch (err) {
			console.warn("Failed to update Firebase Auth user photoURL:", err);
		}
	}

	// Update global currentUserAtom
	if (localUser) {
		store.set(currentUserAtom, {
			...localUser,
			photoURL: downloadUrl,
		});
	}

	return downloadUrl;
}

export async function updateUserProfileDetails(updates: {
	displayName?: string;
	photoURL?: string;
}) {
	const auth = getFirebaseAuth();
	const user = auth.currentUser;
	const store = globalStore;
	const localUser = store.get(currentUserAtom);

	if (user) {
		await updateProfile(user, updates);
	}

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
