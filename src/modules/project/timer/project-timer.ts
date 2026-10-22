import { globalStore } from "$/states/store";
import {
	averageTTMLTimeSecondsAtom,
	currentProjectTimeSecondsAtom,
	fastestTTMLRecordAtom,
} from "./states";
import type { CompletedTTMLRecord } from "./types";

export const PROJECT_ACTIVE_TIMES_KEY = "amll_ttml_active_times";
export const COMPLETED_TTML_RECORDS_KEY = "amll_ttml_completed_records";
export const FASTEST_RECORD_KEY = "amll_ttml_fastest_record";
export const AVERAGE_TIME_KEY = "amll_ttml_average_time_seconds";

export function getStoredProjectTimes(): Record<string, number> {
	try {
		const raw = localStorage.getItem(PROJECT_ACTIVE_TIMES_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return typeof parsed === "object" && parsed !== null ? parsed : {};
	} catch {
		return {};
	}
}

export function getProjectActiveTime(projectId: string): number {
	if (!projectId) return 0;
	const map = getStoredProjectTimes();
	return Math.max(0, map[projectId] ?? 0);
}

export function setProjectActiveTime(projectId: string, seconds: number): void {
	if (!projectId) return;
	const map = getStoredProjectTimes();
	map[projectId] = Math.max(0, Math.round(seconds));
	try {
		localStorage.setItem(PROJECT_ACTIVE_TIMES_KEY, JSON.stringify(map));
	} catch {
		// Ignore storage errors
	}
}

export function getStoredCompletedRecords(): CompletedTTMLRecord[] {
	try {
		const raw = localStorage.getItem(COMPLETED_TTML_RECORDS_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export function getAverageTTMLTime(): number | null {
	const records = getStoredCompletedRecords();
	const validRecords = records.filter(
		(r) => typeof r.timeSpentSeconds === "number" && r.timeSpentSeconds >= 5,
	);
	if (validRecords.length === 0) {
		try {
			const raw = localStorage.getItem(AVERAGE_TIME_KEY);
			if (raw) {
				const num = Number(raw);
				if (!Number.isNaN(num) && num >= 5) return num;
			}
		} catch {
			// fallback
		}
		return null;
	}
	const total = validRecords.reduce((sum, r) => sum + r.timeSpentSeconds, 0);
	return Math.round(total / validRecords.length);
}

export function getFastestRecord(): CompletedTTMLRecord | null {
	try {
		const raw = localStorage.getItem(FASTEST_RECORD_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (parsed && typeof parsed.timeSpentSeconds === "number") {
				return parsed;
			}
		}
	} catch {
		// fallback
	}

	const records = getStoredCompletedRecords();
	if (records.length === 0) return null;
	return records.reduce((fastest, cur) =>
		cur.timeSpentSeconds < fastest.timeSpentSeconds ? cur : fastest,
	);
}

export async function recordTTMLCompletion(info: {
	projectId: string;
	title: string;
	artist: string;
	lineCount: number;
	explicitTimeSpent?: number;
}): Promise<CompletedTTMLRecord | null> {
	const timeSpent =
		info.explicitTimeSpent ??
		globalStore.get(currentProjectTimeSecondsAtom) ??
		getProjectActiveTime(info.projectId);

	// Guard: TTML must have at least minimal timed content and a non-zero duration
	// (at least 5 seconds and 1 line) so empty files don't register 0s records.
	if (timeSpent < 5 || info.lineCount < 1) {
		return null;
	}

	const cleanTitle = (info.title || "Untitled").trim();
	const cleanArtist = (info.artist || "Unknown Artist").trim();
	const seconds = Math.round(timeSpent);

	const newRecord: CompletedTTMLRecord = {
		projectId: info.projectId,
		title: cleanTitle,
		artist: cleanArtist,
		timeSpentSeconds: seconds,
		completedAt: Date.now(),
		lineCount: info.lineCount,
	};

	// Save into completed records list
	const existingRecords = getStoredCompletedRecords();
	const filtered = existingRecords.filter(
		(r) => r.projectId !== info.projectId,
	);
	filtered.push(newRecord);
	try {
		localStorage.setItem(
			COMPLETED_TTML_RECORDS_KEY,
			JSON.stringify(filtered.slice(-100)), // keep last 100
		);
	} catch {
		// Ignore storage quota
	}

	// Update average time
	const avgTime = getAverageTTMLTime();
	if (avgTime !== null) {
		try {
			localStorage.setItem(AVERAGE_TIME_KEY, String(avgTime));
		} catch {
			// ignore
		}
		globalStore.set(averageTTMLTimeSecondsAtom, avgTime);
	}

	// Update fastest record if applicable
	const currentFastest = getFastestRecord();
	const isNewFastest =
		!currentFastest || seconds < currentFastest.timeSpentSeconds;

	if (isNewFastest) {
		try {
			localStorage.setItem(FASTEST_RECORD_KEY, JSON.stringify(newRecord));
		} catch {
			// ignore
		}
		globalStore.set(fastestTTMLRecordAtom, newRecord);
	}

	// Synchronize time stats to Firestore user profile if logged in
	try {
		const { getFirebaseAuth, getFirebaseFirestore } = await import(
			"$/modules/cloud/firebase"
		);
		const auth = getFirebaseAuth();
		const db = getFirebaseFirestore();
		if (auth.currentUser && db) {
			const { doc, setDoc } = await import("firebase/firestore");
			const userDocRef = doc(db, "users", auth.currentUser.uid);
			const payload: Record<string, unknown> = {
				updatedAt: Date.now(),
			};
			if (avgTime !== null) {
				payload.averageTimeSeconds = avgTime;
			}
			if (isNewFastest) {
				payload.fastestTimeSeconds = seconds;
				payload.fastestSongTitle = `${cleanTitle} - ${cleanArtist}`;
			}
			await setDoc(userDocRef, payload, { merge: true }).catch((err) => {
				console.warn("Could not sync timer stats to Firestore:", err);
			});
		}
	} catch {
		// Cloud sync is best-effort
	}

	return newRecord;
}

export function formatTimerDuration(seconds: number): string {
	const totalSecs = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(totalSecs / 3600);
	const minutes = Math.floor((totalSecs % 3600) / 60);
	const secs = totalSecs % 60;

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	if (minutes > 0) {
		return `${minutes}m ${secs.toString().padStart(2, "0")}s`;
	}
	return `${secs}s`;
}

export function formatTimerClock(seconds: number): string {
	const totalSecs = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(totalSecs / 3600);
	const minutes = Math.floor((totalSecs % 3600) / 60);
	const secs = totalSecs % 60;

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	}
	return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
