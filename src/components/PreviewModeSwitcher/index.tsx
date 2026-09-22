import { useAtom, useAtomValue } from "jotai";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import SuspensePlaceHolder from "$/components/SuspensePlaceHolder";
import {
	PreviewModeType,
	previewModeTypeAtom,
	previewFullscreenAtom,
} from "$/modules/settings/states/preview";
import { FullScreenMinimize20Regular } from "@fluentui/react-icons";
import { lazy } from "$/utils/lazy.ts";

const AMLLWrapper = lazy(() => import("$/components/AMLLWrapper"));
const TimingOverview = lazy(() => import("$/components/TimingOverview"));
const SpicyLyrics = lazy(() => import("$/components/SpicyLyrics"));

export interface PreviewModeSwitcherProps {
	isPanel?: boolean;
}

export const PreviewModeSwitcher: React.FC<PreviewModeSwitcherProps> = ({
	isPanel = false,
}) => {
	const previewModeType = useAtomValue(previewModeTypeAtom);
	const [isFullscreen, setIsFullscreen] = useAtom(previewFullscreenAtom);
	const [controlsVisible, setControlsVisible] = useState(false);
	const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
	const lastPosRef = useRef<{ x: number; y: number } | null>(null);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (isPanel) return;
			if (!isFullscreen) {
				setControlsVisible(true);
				return;
			}

			// Discard synthetic mousemove events dispatched by browsers when DOM elements
			// scroll/animate underneath a stationary cursor
			if (
				lastPosRef.current &&
				lastPosRef.current.x === e.clientX &&
				lastPosRef.current.y === e.clientY
			) {
				return;
			}
			lastPosRef.current = { x: e.clientX, y: e.clientY };

			// Only reveal when user moves up towards the top controls
			if (e.clientY <= 72) {
				setControlsVisible(true);
				if (hideTimerRef.current) {
					clearTimeout(hideTimerRef.current);
					hideTimerRef.current = null;
				}
			} else {
				// Hide when moving down away from top controls
				if (!hideTimerRef.current) {
					hideTimerRef.current = setTimeout(() => {
						setControlsVisible(false);
						hideTimerRef.current = null;
					}, 200);
				}
			}
		},
		[isFullscreen, isPanel],
	);

	useEffect(() => {
		if (isPanel) return;
		if (!isFullscreen) {
			setControlsVisible(true);
			if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
		} else {
			// Briefly show the exit button for 2.5s on entering fullscreen, then hide
			setControlsVisible(true);
			hideTimerRef.current = setTimeout(() => {
				setControlsVisible(false);
				hideTimerRef.current = null;
			}, 2500);
		}
		return () => {
			if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
		};
	}, [isFullscreen, isPanel]);

	return (
		<div
			style={{ position: "relative", width: "100%", height: "100%" }}
			onMouseMove={handleMouseMove}
		>
			{!isPanel && isFullscreen && (
				<button
					type="button"
					style={{
						position: "absolute",
						top: 16,
						right: 20,
						height: 36,
						boxSizing: "border-box",
						zIndex: 9999,
						display: "flex",
						alignItems: "center",
						gap: 6,
						padding: "0 16px",
						borderRadius: 9999,
						background: "rgba(0, 0, 0, 0.45)",
						backdropFilter: "blur(14px)",
						WebkitBackdropFilter: "blur(14px)",
						border: "1px solid rgba(255, 255, 255, 0.2)",
						color: "rgba(255, 255, 255, 0.95)",
						fontSize: "0.85rem",
						fontWeight: 600,
						cursor: "pointer",
						boxShadow: "0 4px 16px rgba(0, 0, 0, 0.35)",
						transition: "opacity 0.25s ease, transform 0.25s ease",
						opacity: controlsVisible ? 1 : 0,
						pointerEvents: controlsVisible ? "auto" : "none",
						transform: controlsVisible ? "translateY(0)" : "translateY(-8px)",
					}}
					onClick={() => setIsFullscreen(false)}
					onMouseEnter={() => {
						if (hideTimerRef.current) {
							clearTimeout(hideTimerRef.current);
							hideTimerRef.current = null;
						}
						setControlsVisible(true);
					}}
					onMouseLeave={() => {
						if (isFullscreen) {
							setControlsVisible(false);
						}
					}}
					title="Exit Fullscreen (Esc)"
				>
					<FullScreenMinimize20Regular />
					<span>Exit Fullscreen (Esc)</span>
				</button>
			)}
			<Suspense fallback={<SuspensePlaceHolder />}>
				{(previewModeType === PreviewModeType.Standard ||
					previewModeType === PreviewModeType.AMLL) && (
					<AMLLWrapper variant="standard" isPanel={isPanel} />
				)}
				{previewModeType === PreviewModeType.Toxi && (
					<AMLLWrapper variant="toxi" isPanel={isPanel} />
				)}
				{previewModeType === PreviewModeType.Spicy && (
					<SpicyLyrics isPanel={isPanel} />
				)}
				{previewModeType === PreviewModeType.Timing && <TimingOverview />}
			</Suspense>
		</div>
	);
};

export default PreviewModeSwitcher;
