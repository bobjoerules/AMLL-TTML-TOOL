export interface FirebaseProjectConfig {
	apiKey: string;
	authDomain: string;
	projectId: string;
	storageBucket?: string;
	messagingSenderId?: string;
	appId: string;
}

export interface CloudTTMLMetadata {
	id: string;
	title: string;
	artist: string;
	album: string;
	lineCount: number;
	durationMs: number;
	createdAt: number;
	updatedAt: number;
	authorUid: string;
	authorName?: string;
	hasAudio?: boolean;
	audioUrl?: string | null;
	audioStoragePath?: string | null;
	audioFileName?: string | null;
	audioSize?: number | null;
}

export interface CloudTTMLDocument extends CloudTTMLMetadata {
	rawTTML: string;
}

export interface UserProfile {
	uid: string;
	displayName: string | null;
	email: string | null;
	photoURL: string | null;
	providerId: string;
}
