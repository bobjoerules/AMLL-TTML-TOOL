import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type {
	CloudTTMLMetadata,
	FirebaseProjectConfig,
	UserProfile,
} from "../types";

export const DEFAULT_FIREBASE_CONFIG: FirebaseProjectConfig = {
	apiKey:
		import.meta.env.VITE_FIREBASE_API_KEY ||
		"AIzaSyBLreHn7aJHItOdp9Sq8EHEf-cQtKIjvus",
	authDomain:
		import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "amll-ttml.firebaseapp.com",
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "amll-ttml",
	storageBucket:
		import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
		"amll-ttml.firebasestorage.app",
	messagingSenderId:
		import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "733113073433",
	appId:
		import.meta.env.VITE_FIREBASE_APP_ID ||
		"1:733113073433:web:37a70a2f3741dd3847cf88",
};

export const customFirebaseConfigAtom = atomWithStorage<FirebaseProjectConfig>(
	"amll-ttml-firebase-config",
	DEFAULT_FIREBASE_CONFIG,
);

export const currentUserAtom = atomWithStorage<UserProfile | null>(
	"amll-ttml-user-profile",
	null,
);
export const authLoadingAtom = atom<boolean>(false);

export const cloudFileManagerOpenAtom = atom<boolean>(false);
export const cloudFileManagerInitialTabAtom = atom<"save" | "open">("open");

export const cloudTTMLListAtom = atom<CloudTTMLMetadata[]>([]);
export const cloudTTMLLoadingAtom = atom<boolean>(false);
