import { useAtom } from "jotai";
import { useAtomValue } from "jotai/index";
import { useCallback, useEffect, useRef } from "react";
import { audioBufferAtom, currentTimeAtom } from "$/modules/audio/states";
import {
	spectrogramFollowPlayheadAtom,
	spectrogramScrollLeftAtom,
	spectrogramZoomAtom,
} from "$/modules/spectrogram/states";

const clampZoom = (z: number) => Math.max(50, Math.min(z, 10000));

export function useSpectrogramInteraction(
	scrollContainerRef: React.RefObject<HTMLDivElement | null>,
	containerWidth: number,
) {
	const audioBuffer = useAtomValue(audioBufferAtom);
	const currentTime = useAtomValue(currentTimeAtom);
	const followPlayhead = useAtomValue(spectrogramFollowPlayheadAtom);
	const [zoom, setZoom] = useAtom(spectrogramZoomAtom);
	const [scrollLeft, setScrollLeft] = useAtom(spectrogramScrollLeftAtom);

	const targetScrollLeftRef = useRef(scrollLeft);
	const targetZoomRef = useRef(zoom);
	const animationFrameRef = useRef<number | null>(null);
	const currentScrollLeftRef = useRef(scrollLeft);
	const currentZoomRef = useRef(zoom);

	const animationLoop = useCallback(() => {
		const targetScroll = targetScrollLeftRef.current;
		const targetZoom = targetZoomRef.current;
		const currentScroll = currentScrollLeftRef.current;
		const currentZoom = currentZoomRef.current;

		const lerpFactor = 0.35;
		const nextScroll =
			(1 - lerpFactor) * currentScroll + lerpFactor * targetScroll;
		const nextZoom = (1 - lerpFactor) * currentZoom + lerpFactor * targetZoom;

		const scrollDiff = Math.abs(nextScroll - targetScroll);
		const zoomDiff = Math.abs(nextZoom - targetZoom);

		if (scrollDiff < 1 && zoomDiff < 2) {
			setScrollLeft(targetScroll);
			setZoom(targetZoom);
			animationFrameRef.current = null;
		} else {
			setScrollLeft(nextScroll);
			setZoom(nextZoom);
			animationFrameRef.current = requestAnimationFrame(animationLoop);
		}
	}, [setScrollLeft, setZoom]);

	const startAnimation = useCallback(() => {
		if (animationFrameRef.current === null) {
			animationFrameRef.current = requestAnimationFrame(animationLoop);
		}
	}, [animationLoop]);

	const handleWheelScroll = useCallback(
		(event: WheelEvent) => {
			if (!scrollContainerRef.current || !audioBuffer) {
				return;
			}
			event.preventDefault();

			const container = scrollContainerRef.current;
			const rect = container.getBoundingClientRect();
			const mouseX = event.clientX - rect.left;

			if (event.ctrlKey) {
				const currentZoom = targetZoomRef.current;
				const currentScroll = targetScrollLeftRef.current;

				const timeAtCursor = (currentScroll + mouseX) / currentZoom;
				const zoomFactor = event.deltaY < 0 ? 1.15 : 0.85;
				const newZoom = clampZoom(currentZoom * zoomFactor);
				if (newZoom === currentZoom) return;

				const newScrollLeft = timeAtCursor * newZoom - mouseX;

				const totalWidth = audioBuffer.duration * newZoom;
				const maxScrollLeft = Math.max(0, totalWidth - containerWidth);
				const clampedScrollLeft = Math.max(
					0,
					Math.min(newScrollLeft, maxScrollLeft),
				);

				targetZoomRef.current = newZoom;
				targetScrollLeftRef.current = clampedScrollLeft;
			} else {
				const scrollAmount = event.deltaY + event.deltaX;
				if (scrollAmount !== 0) {
					const newScrollLeft = targetScrollLeftRef.current + scrollAmount;

					const totalWidth = audioBuffer.duration * targetZoomRef.current;
					const maxScrollLeft = Math.max(0, totalWidth - containerWidth);
					const clampedScrollLeft = Math.max(
						0,
						Math.min(newScrollLeft, maxScrollLeft),
					);

					targetScrollLeftRef.current = clampedScrollLeft;
				}
			}

			startAnimation();
		},
		[startAnimation, audioBuffer, containerWidth, scrollContainerRef],
	);

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) return;

		container.addEventListener("wheel", handleWheelScroll, { passive: false });

		return () => {
			container.removeEventListener("wheel", handleWheelScroll);
		};
	}, [handleWheelScroll, scrollContainerRef]);

	useEffect(() => {
		currentScrollLeftRef.current = scrollLeft;
		if (animationFrameRef.current === null) {
			targetScrollLeftRef.current = scrollLeft;
		}
	}, [scrollLeft]);

	useEffect(() => {
		currentZoomRef.current = zoom;
		if (animationFrameRef.current === null) {
			targetZoomRef.current = zoom;
		}
	}, [zoom]);

	useEffect(() => {
		if (!audioBuffer) {
			setScrollLeft(0);
			targetScrollLeftRef.current = 0;
			currentScrollLeftRef.current = 0;
		}
	}, [audioBuffer, setScrollLeft]);

	useEffect(() => {
		if (!followPlayhead || !audioBuffer || containerWidth <= 0) return;

		const playheadX = (currentTime / 1000) * zoom;
		const totalWidth = audioBuffer.duration * zoom;
		const maxScrollLeft = Math.max(0, totalWidth - containerWidth);
		const targetScroll = playheadX - containerWidth / 2;
		const clampedScroll = Math.max(0, Math.min(targetScroll, maxScrollLeft));

		if (animationFrameRef.current !== null) {
			cancelAnimationFrame(animationFrameRef.current);
			animationFrameRef.current = null;
		}

		currentScrollLeftRef.current = clampedScroll;
		targetScrollLeftRef.current = clampedScroll;
		setScrollLeft(clampedScroll);
	}, [
		currentTime,
		followPlayhead,
		zoom,
		containerWidth,
		audioBuffer,
		setScrollLeft,
	]);

	return {
		zoom,
		scrollLeft,
		isZooming: Math.abs(zoom - targetZoomRef.current) > 0.01,
		targetZoomRef,
	};
}
