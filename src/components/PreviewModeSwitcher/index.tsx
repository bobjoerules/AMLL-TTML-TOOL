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

export const PreviewModeSwitcher = () => {
	const previewModeType = useAtomValue(previewModeTypeAtom);
	const [isFullscreen, setIsFullscreen] = useAtom(previewFullscreenAtom);
	const [controlsVisible, setControlsVisible] = useState(true);
	const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

	const handleMouseMove = useCallback(() => {
		setControlsVisible(true);
		if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
		if (isFullscreen) {
			hideTimerRef.current = setTimeout(() => {
				setControlsVisible(false);
			}, 3000);
		}
	}, [isFullscreen]);

	useEffect(() => {
		if (!isFullscreen) {
			setControlsVisible(true);
			if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
		} else {
			hideTimerRef.current = setTimeout(() => {
				setControlsVisible(false);
			}, 3000);
		}
		return () => {
			if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
		};
	}, [isFullscreen]);

	return (
		<div
			style={{ position: "relative", width: "100%", height: "100%" }}
			onMouseMove={handleMouseMove}
		>
			{isFullscreen && (
				<button
					type="button"
					style={{
						position: "absolute",
						top: 20,
						right: 24,
						zIndex: 9999,
						display: "flex",
						alignItems: "center",
						gap: 6,
						padding: "8px 16px",
						borderRadius: 9999,
						background: "rgba(0, 0, 0, 0.55)",
						backdropFilter: "blur(16px)",
						WebkitBackdropFilter: "blur(16px)",
						border: "1px solid rgba(255, 255, 255, 0.2)",
						color: "rgba(255, 255, 255, 0.95)",
						fontSize: "0.85rem",
						fontWeight: 600,
						cursor: "pointer",
						boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
						transition: "opacity 0.3s ease, transform 0.3s ease",
						opacity: controlsVisible ? 1 : 0,
						pointerEvents: controlsVisible ? "auto" : "none",
						transform: controlsVisible ? "translateY(0)" : "translateY(-8px)",
					}}
					onClick={() => setIsFullscreen(false)}
					title="Exit Fullscreen (Esc)"
				>
					<FullScreenMinimize20Regular />
					<span>Exit Fullscreen (Esc)</span>
				</button>
			)}
			<Suspense fallback={<SuspensePlaceHolder />}>
				{(previewModeType === PreviewModeType.Standard ||
					previewModeType === PreviewModeType.AMLL) && (
					<AMLLWrapper variant="standard" />
				)}
				{previewModeType === PreviewModeType.Toxi && (
					<AMLLWrapper variant="toxi" />
				)}
				{previewModeType === PreviewModeType.Spicy && <SpicyLyrics />}
				{previewModeType === PreviewModeType.Timing && <TimingOverview />}
			</Suspense>
		</div>
	);
};

export default PreviewModeSwitcher;
