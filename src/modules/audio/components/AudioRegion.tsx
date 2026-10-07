import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { msToTimestamp } from "$/utils/timestamp";
import { spectrogramVisibleAtom } from "../states";
import { useAudioRegion } from "../hooks";
import styles from "./AudioSlider.module.css";

interface AudioRegionProps {
	sliderWidthPx: number;
	containerRef: React.RefObject<HTMLDivElement | null>;
	isDraggingRef: React.RefObject<boolean>;
}

export const AudioRegion = ({
	sliderWidthPx,
	containerRef,
	isDraggingRef,
}: AudioRegionProps) => {
	const { t } = useTranslation();
	const spectrogramVisible = useAtomValue(spectrogramVisibleAtom);
	const {
		handleMouseDown,
		rectLeftPx,
		rectWidthPx,
		audioLoaded,
		startTimeS,
		endTimeS,
		durationS,
		viewDurationMs,
		startTimeMs,
		isTrackingOn,
	} = useAudioRegion(sliderWidthPx, containerRef, isDraggingRef);

	if (!spectrogramVisible || !audioLoaded || rectWidthPx <= 0) return null;

	return (
		<div
			className={styles.spectrogramRegion}
			style={{
				left: `${rectLeftPx}px`,
				width: `${rectWidthPx}px`,
			}}
		>
			<div
				role="slider"
				data-drag-type="resizeLeft"
				className={`${styles.regionHandle} ${styles.regionHandleLeft}`}
				onMouseDown={handleMouseDown}
				tabIndex={0}
				aria-valuenow={startTimeS}
				aria-valuemin={0}
				aria-valuemax={durationS}
				aria-valuetext={msToTimestamp(startTimeMs)}
			/>
			<div
				role="slider"
				data-drag-type="drag"
				className={styles.regionBody}
				style={isTrackingOn ? { cursor: "pointer" } : undefined}
				onMouseDown={handleMouseDown}
				tabIndex={0}
				aria-valuenow={startTimeS}
				aria-valuemin={0}
				aria-valuemax={durationS}
				aria-valuetext={msToTimestamp(startTimeMs)}
				title={
					isTrackingOn
						? t(
								"audio.spectrogramBarTrackingHint",
								"Click to seek playhead (playhead tracking active).",
						  )
						: undefined
				}
			/>
			<div
				role="slider"
				data-drag-type="resizeRight"
				className={`${styles.regionHandle} ${styles.regionHandleRight}`}
				onMouseDown={handleMouseDown}
				tabIndex={0}
				aria-valuenow={endTimeS}
				aria-valuemin={0}
				aria-valuemax={durationS}
				aria-valuetext={msToTimestamp(startTimeMs + viewDurationMs)}
			/>
		</div>
	);
};
