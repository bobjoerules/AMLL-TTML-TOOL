export interface CompletedTTMLRecord {
	projectId: string;
	title: string;
	artist: string;
	timeSpentSeconds: number;
	completedAt: number;
	lineCount: number;
}

export interface ProjectTimerState {
	activeSeconds: number;
	isInactive: boolean;
	projectId: string | null;
}
