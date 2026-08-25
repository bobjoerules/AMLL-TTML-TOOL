import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth, onAuthStateChanged } from "firebase/auth";
import { type Firestore, getFirestore } from "firebase/firestore";
import { globalStore } from "$/states/store";
import {
	authLoadingAtom,
	currentUserAtom,
	customFirebaseConfigAtom,
	DEFAULT_FIREBASE_CONFIG,
} from "./states";
import type { FirebaseProjectConfig, UserProfile } from "./types";

let currentApp: FirebaseApp | null = null;
let currentAuth: Auth | null = null;
let currentDb: Firestore | null = null;
let authUnsubscribe: (() => void) | null = null;

export function getActiveFirebaseConfig(
	config?: FirebaseProjectConfig,
): FirebaseProjectConfig {
	if (config?.apiKey && config?.projectId) {
		return config;
	}
	const store = globalStore;
	const custom = store.get(customFirebaseConfigAtom);
	if (custom?.apiKey && custom?.projectId) {
		return custom;
	}
	return DEFAULT_FIREBASE_CONFIG;
}

export function isFirebaseConfigured(config?: FirebaseProjectConfig): boolean {
	const cfg = getActiveFirebaseConfig(config);
	return Boolean(cfg?.apiKey && cfg?.projectId);
}

export function initFirebase(config?: FirebaseProjectConfig): {
	app: FirebaseApp | null;
	auth: Auth | null;
	db: Firestore | null;
} {
	const cfg = config || getActiveFirebaseConfig();

	if (!isFirebaseConfigured(cfg)) {
		const store = globalStore;
		store.set(authLoadingAtom, false);
		store.set(currentUserAtom, null);
		return { app: null, auth: null, db: null };
	}

	try {
		if (getApps().length > 0) {
			currentApp = getApps()[0];
		} else {
			currentApp = initializeApp(cfg);
		}

		currentAuth = getAuth(currentApp);
		currentDb = getFirestore(currentApp);

		if (authUnsubscribe) {
			authUnsubscribe();
		}

		const store = globalStore;
		authUnsubscribe = onAuthStateChanged(currentAuth, (user) => {
			if (user) {
				const profile: UserProfile = {
					uid: user.uid,
					displayName: user.displayName || user.email?.split("@")[0] || "User",
					email: user.email,
					photoURL: user.photoURL,
					providerId: user.providerData?.[0]?.providerId || "firebase",
				};
				store.set(currentUserAtom, profile);
			} else {
				store.set(currentUserAtom, null);
			}
			store.set(authLoadingAtom, false);
		});

		return { app: currentApp, auth: currentAuth, db: currentDb };
	} catch (err) {
		console.error("Failed to initialize Firebase", err);
		const store = globalStore;
		store.set(authLoadingAtom, false);
		return { app: null, auth: null, db: null };
	}
}

export function getFirebaseAuth(): Auth {
	if (!currentAuth) {
		const { auth } = initFirebase();
		if (!auth) {
			throw new Error(
				"Firebase Auth is not initialized. Please configure your Firebase credentials.",
			);
		}
		return auth;
	}
	return currentAuth;
}

export function getFirebaseFirestore(): Firestore {
	if (!currentDb) {
		const { db } = initFirebase();
		if (!db) {
			throw new Error(
				"Firebase Firestore is not initialized. Please configure your Firebase credentials.",
			);
		}
		return db;
	}
	return currentDb;
}
