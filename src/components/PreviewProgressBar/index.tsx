import React, { memo, useCallback, useEffect, useRef } from "react";
import classNames from "classnames";
import { useSetAtom } from "jotai";
import { audioEngine } from "$/modules/audio/audio-engine";
import { currentTimeAtom } from "$/modules/audio/states/index.ts";
import styles from "./PreviewProgressBar.module.css";

export const formatTime = (ms: number): string => {
	const totalSecs = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSecs / 3600);
	const mins = Math.floor((totalSecs % 3600) / 60);
	const secs = totalSecs % 60;
	if (hours > 0) {
		return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	}
	return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export interface PreviewProgressBarProps {
	totalDuration: number;
	variant?: "amll" | "spicy";
	className?: string;
}

export const PreviewProgressBar: React.FC<PreviewProgressBarProps> = memo(
	({ totalDuration, variant = "amll", className }) => {
		const setCurrentTime = useSetAtom(currentTimeAtom);
		const timeLabelRef = useRef<HTMLSpanElement>(null);
		const fillRef = useRef<HTMLDivElement>(null);
		const thumbRef = useRef<HTMLDivElement>(null);
		const containerRef = useRef<HTMLDivElement>(null);
		const isDraggingRef = useRef(false);
		const lastDisplaySecRef = useRef(-1);

		const updateProgress = useCallback(
			(timeMs: number) => {
				const clamped = Math.max(0, Math.min(totalDuration || 0, timeMs));
				const pct = totalDuration > 0 ? (clamped / totalDuration) * 100 : 0;

				const sec = Math.floor(clamped / 1000);
				if (sec !== lastDisplaySecRef.current) {
					lastDisplaySecRef.current = sec;
					if (timeLabelRef.current) {
						timeLabelRef.current.textContent = formatTime(clamped);
					}
				}

				if (fillRef.current) {
					fillRef.current.style.width = `${pct}%`;
				}
				if (thumbRef.current) {
					thumbRef.current.style.left = `${pct}%`;
				}
			},
			[totalDuration],
		);

		useEffect(() => {
			let rafId: number | null = null;

			const tick = () => {
				if (!isDraggingRef.current) {
					const currentTimeMs = audioEngine.musicCurrentTime * 1000;
					updateProgress(currentTimeMs);
				}
				if (audioEngine.musicPlaying) {
					rafId = requestAnimationFrame(tick);
				} else {
					rafId = null;
				}
			};

			const handlePlay = () => {
				if (rafId !== null) cancelAnimationFrame(rafId);
				rafId = requestAnimationFrame(tick);
			};

			const handlePauseOrSeek = () => {
				if (!isDraggingRef.current) {
					lastDisplaySecRef.current = -1;
					updateProgress(audioEngine.musicCurrentTime * 1000);
				}
			};

			audioEngine.addEventListener("music-resume", handlePlay);
			audioEngine.addEventListener("music-pause", handlePauseOrSeek);
			audioEngine.addEventListener("music-seeked", handlePauseOrSeek);
			audioEngine.addEventListener("music-timeupdate", handlePauseOrSeek);

			// Initial sync on mount or totalDuration change
			lastDisplaySecRef.current = -1;
			updateProgress(audioEngine.musicCurrentTime * 1000);

			if (audioEngine.musicPlaying) {
				rafId = requestAnimationFrame(tick);
			}

			return () => {
				if (rafId !== null) cancelAnimationFrame(rafId);
				audioEngine.removeEventListener("music-resume", handlePlay);
				audioEngine.removeEventListener("music-pause", handlePauseOrSeek);
				audioEngine.removeEventListener("music-seeked", handlePauseOrSeek);
				audioEngine.removeEventListener("music-timeupdate", handlePauseOrSeek);
			};
		}, [updateProgress]);

		const getTimeFromPointer = (e: React.PointerEvent | PointerEvent) => {
			if (!containerRef.current || totalDuration <= 0) return 0;
			const rect = containerRef.current.getBoundingClientRect();
			if (rect.width <= 0) return 0;
			const ratio = Math.max(
				0,
				Math.min(1, (e.clientX - rect.left) / rect.width),
			);
			return ratio * totalDuration;
		};

		const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
			if (e.button !== 0) return;
			e.stopPropagation();
			isDraggingRef.current = true;
			const targetTime = getTimeFromPointer(e);
			lastDisplaySecRef.current = -1;
			updateProgress(targetTime);

			const handlePointerMove = (moveEvt: PointerEvent) => {
				if (!isDraggingRef.current) return;
				const moveTime = getTimeFromPointer(moveEvt);
				updateProgress(moveTime);
			};

			const handlePointerUp = (upEvt: PointerEvent) => {
				if (isDraggingRef.current) {
					isDraggingRef.current = false;
					const finalTime = getTimeFromPointer(upEvt);
					lastDisplaySecRef.current = -1;
					updateProgress(finalTime);
					setCurrentTime(finalTime);
					audioEngine.resumeOrSeekMusic(finalTime / 1000);
				}
				window.removeEventListener("pointermove", handlePointerMove);
				window.removeEventListener("pointerup", handlePointerUp);
				window.removeEventListener("pointercancel", handlePointerUp);
			};

			window.addEventListener("pointermove", handlePointerMove);
			window.addEventListener("pointerup", handlePointerUp);
			window.addEventListener("pointercancel", handlePointerUp);
		};

		return (
			<div
				className={classNames(
					styles.playbackRow,
					variant === "spicy" && styles.variantSpicy,
					className,
				)}
			>
				<span className={styles.timeLabel} ref={timeLabelRef}>
					{formatTime(audioEngine.musicCurrentTime * 1000)}
				</span>
				<div
					className={styles.scrubberContainer}
					ref={containerRef}
					onPointerDown={handlePointerDown}
				>
					<div className={styles.scrubberTrack}>
						<div
							className={styles.scrubberFill}
							ref={fillRef}
							style={{ width: "0%" }}
						/>
					</div>
					<div
						className={styles.scrubberThumb}
						ref={thumbRef}
						style={{ left: "0%" }}
					/>
				</div>
				<span className={styles.timeLabel}>{formatTime(totalDuration)}</span>
			</div>
		);
	},
);

export default PreviewProgressBar;
