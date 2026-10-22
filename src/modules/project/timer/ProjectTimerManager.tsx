import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { audioPlayingAtom } from "$/modules/audio/states";
import { projectIdAtom } from "$/states/main";
import { getProjectActiveTime, setProjectActiveTime } from "./project-timer";
import {
	currentProjectTimeSecondsAtom,
	isTimerInactiveAtom,
	totalActiveSecondsAtom,
} from "./states";

const INACTIVITY_TIMEOUT_MS = 60 * 1000; // 60 seconds

export function ProjectTimerManager() {
	const projectId = useAtomValue(projectIdAtom);
	const isAudioPlaying = useAtomValue(audioPlayingAtom);
	const [currentTime, setCurrentTime] = useAtom(currentProjectTimeSecondsAtom);
	const setIsInactive = useSetAtom(isTimerInactiveAtom);
	const setTotalActiveSeconds = useSetAtom(totalActiveSecondsAtom);

	// Ref to store current time so interval always sees the latest without re-subscribing
	const currentTimeRef = useRef(currentTime);
	currentTimeRef.current = currentTime;

	const projectIdRef = useRef(projectId);
	projectIdRef.current = projectId;

	const isAudioPlayingRef = useRef(isAudioPlaying);
	isAudioPlayingRef.current = isAudioPlaying;

	const isUserInactiveRef = useRef(false);
	const lastActivityTimeRef = useRef(Date.now());

	// When project changes, load saved active time
	useEffect(() => {
		if (!projectId) {
			setCurrentTime(0);
			return;
		}
		const initialTime = getProjectActiveTime(projectId);
		setCurrentTime(initialTime);
	}, [projectId, setCurrentTime]);

	// Inactivity listener
	useEffect(() => {
		const onActivity = () => {
			lastActivityTimeRef.current = Date.now();
			if (isUserInactiveRef.current) {
				isUserInactiveRef.current = false;
				setIsInactive(false);
			}
		};

		const activityEvents = [
			"pointerdown",
			"pointermove",
			"keydown",
			"wheel",
			"touchstart",
		] as const;

		for (const evt of activityEvents) {
			window.addEventListener(evt, onActivity, { passive: true });
		}

		return () => {
			for (const evt of activityEvents) {
				window.removeEventListener(evt, onActivity);
			}
		};
	}, [setIsInactive]);

	// Timer ticking interval
	useEffect(() => {
		const interval = setInterval(() => {
			const currentPid = projectIdRef.current;
			if (!currentPid) return;

			const now = Date.now();
			const idleDuration = now - lastActivityTimeRef.current;
			const isHidden =
				typeof document !== "undefined" &&
				document.visibilityState === "hidden";
			const playingAudio = isAudioPlayingRef.current;

			// If user has been idle for > 60s and music isn't playing, or document is hidden and not playing
			const isInactive =
				(idleDuration >= INACTIVITY_TIMEOUT_MS || isHidden) && !playingAudio;

			if (isInactive !== isUserInactiveRef.current) {
				isUserInactiveRef.current = isInactive;
				setIsInactive(isInactive);
			}

			if (!isInactive) {
				const nextTime = (currentTimeRef.current || 0) + 1;
				currentTimeRef.current = nextTime;
				setCurrentTime(nextTime);
				setTotalActiveSeconds((prev) => (prev || 0) + 1);

				// Persist every 5 seconds
				if (nextTime % 5 === 0) {
					setProjectActiveTime(currentPid, nextTime);
				}
			}
		}, 1000);

		const handleFlush = () => {
			const currentPid = projectIdRef.current;
			if (currentPid && currentTimeRef.current) {
				setProjectActiveTime(currentPid, currentTimeRef.current);
			}
		};

		window.addEventListener("beforeunload", handleFlush);
		window.addEventListener("pagehide", handleFlush);

		return () => {
			clearInterval(interval);
			window.removeEventListener("beforeunload", handleFlush);
			window.removeEventListener("pagehide", handleFlush);
			handleFlush();
		};
	}, [setCurrentTime, setIsInactive, setTotalActiveSeconds]);

	return null;
}
export default ProjectTimerManager;
