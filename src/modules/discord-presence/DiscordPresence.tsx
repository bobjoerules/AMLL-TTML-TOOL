import { invoke } from "@tauri-apps/api/core";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import { audioPlayingAtom, playbackRateAtom } from "$/modules/audio/states";
import {
	discordDetailsTemplateAtom,
	discordIdleTimeoutMinutesAtom,
	discordPlaybackTimelineAtom,
	discordProjectElapsedAtom,
	discordRepositoryButtonAtom,
	discordRichPresenceEnabledAtom,
	discordStateTemplateAtom,
	discordBottomLineTemplateAtom,
	discordStatusBadgeAtom,
	discordPrivacyPresetAtom,
	discordLargeImageModeAtom,
	discordSmallImageModeAtom,
	discordIdleLargeImageModeAtom,
	discordIdleSmallImageModeAtom,
	discordIdleBottomTextAtom,
	discordGeneralActivityTextAtom,
	discordShowProgressTimerAtom,
	discordActivityTypeAtom,
} from "$/modules/settings/states";
import { currentUserAtom } from "$/modules/cloud/states";
import { ttmlChecklistAtom } from "$/modules/ttml-checklist/states";
import {
	lyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	toolModeAtom,
} from "$/states/main";
import { log } from "$/utils/logging";
import { InactivityTimer, shouldResetInactivity } from "./inactivity";
import {
	createDiscordTemplateContext,
	createInactiveDiscordActivity,
	createPresenceSnapshot,
	DEFAULT_DISCORD_DETAILS_TEMPLATE,
	DEFAULT_DISCORD_STATE_TEMPLATE,
	DEFAULT_DISCORD_BOTTOM_LINE_TEMPLATE,
	formatNativeDiscordActivity,
	PRESENCE_META_NAME,
	validateDiscordTemplate,
} from "./presence";
import { ProjectTimeTracker } from "./project-time";

const isTauri = Boolean(import.meta.env.TAURI_ENV_PLATFORM);

export function DiscordPresence() {
	const user = useAtomValue(currentUserAtom);
	const lyrics = useAtomValue(lyricLinesAtom);
	const fileName = useAtomValue(saveFileNameAtom);
	const mode = useAtomValue(toolModeAtom);
	const selectedLineIds = useAtomValue(selectedLinesAtom);
	const selectedWordIds = useAtomValue(selectedWordsAtom);
	const playing = useAtomValue(audioPlayingAtom);
	const playbackRate = useAtomValue(playbackRateAtom);
	const enabled = useAtomValue(discordRichPresenceEnabledAtom);
	const detailsTemplate = useAtomValue(discordDetailsTemplateAtom);
	const stateTemplate = useAtomValue(discordStateTemplateAtom);
	const bottomLineTemplate = useAtomValue(discordBottomLineTemplateAtom);
	const showPlaybackTimeline = useAtomValue(discordPlaybackTimelineAtom);
	const showProjectElapsed = useAtomValue(discordProjectElapsedAtom);
	const showRepositoryButton = useAtomValue(discordRepositoryButtonAtom);
	const showStatusBadge = useAtomValue(discordStatusBadgeAtom);
	const idleTimeoutMinutes = useAtomValue(discordIdleTimeoutMinutesAtom);
	const privacyPreset = useAtomValue(discordPrivacyPresetAtom);
	const largeImageMode = useAtomValue(discordLargeImageModeAtom);
	const smallImageMode = useAtomValue(discordSmallImageModeAtom);
	const idleLargeImageMode = useAtomValue(discordIdleLargeImageModeAtom);
	const idleSmallImageMode = useAtomValue(discordIdleSmallImageModeAtom);
	const idleBottomText = useAtomValue(discordIdleBottomTextAtom);
	const generalActivityText = useAtomValue(discordGeneralActivityTextAtom);
	const showProgressTimer = useAtomValue(discordShowProgressTimerAtom);
	const activityType = useAtomValue(discordActivityTypeAtom);
	const projectId = useAtomValue(projectIdAtom);
	const [inactive, setInactive] = useState(false);
	const trackerRef = useRef<ProjectTimeTracker | null>(null);
	if (!trackerRef.current) {
		trackerRef.current = new ProjectTimeTracker(window.localStorage);
	}
	const tracker = trackerRef.current;
	const checklist = useAtomValue(ttmlChecklistAtom);
	const checklistTotal = checklist?.length ?? 0;
	const checklistCompleted = checklist?.filter((e) => e.completed).length ?? 0;

	useEffect(() => {
		if (!isTauri) return;
		const timeoutMinutes = Math.min(60, Math.max(1, idleTimeoutMinutes));
		const timer = new InactivityTimer(
			timeoutMinutes * 60_000,
			(nextInactive) => {
				tracker.setPaused(nextInactive);
				setInactive(nextInactive);
			},
		);
		const markActivity = (event: Event) => {
			if (!shouldResetInactivity(event.isTrusted, document.visibilityState))
				return;
			timer.reset();
			if (inactive) {
				setInactive(false);
				tracker.setPaused(false);
			}
		};
		window.addEventListener("pointerdown", markActivity, { passive: true });
		window.addEventListener("keydown", markActivity, { passive: true });
		return () => {
			timer.cancel();
			window.removeEventListener("pointerdown", markActivity);
			window.removeEventListener("keydown", markActivity);
		};
	}, [idleTimeoutMinutes, inactive, tracker]);

	useEffect(() => {
		if (!isTauri || !enabled) return;
		const interval = window.setInterval(() => {
			if (!inactive) {
				tracker.touch(projectId);
			}
		}, 1000);
		return () => {
			window.clearInterval(interval);
			tracker.flush();
		};
	}, [projectId, tracker, enabled, inactive]);

	const publish = useCallback(() => {
		const positionSeconds = audioEngine.musicCurrentTime || 0;
		const durationSeconds = audioEngine.musicDuration || 0;
		const projectElapsedSeconds = tracker.getElapsedSeconds(projectId);
		const snapshot = createPresenceSnapshot({
			lyrics,
			fileName,
			mode,
			selectedLineIds,
			playing,
			positionSeconds,
			durationSeconds,
			playbackRate,
			projectElapsedSeconds,
			userProfilePhoto: user?.photoURL,
			userDisplayName: user?.displayName || user?.email?.split("@")[0],
			checklistTotal,
			checklistCompleted,
		});

		let meta = document.head.querySelector<HTMLMetaElement>(
			`meta[name="${PRESENCE_META_NAME}"]`,
		);
		if (!meta) {
			meta = document.createElement("meta");
			meta.name = PRESENCE_META_NAME;
			document.head.append(meta);
		}
		meta.content = JSON.stringify(snapshot);

		if (isTauri && enabled) {
			const safeDetailsTemplate = validateDiscordTemplate(detailsTemplate)
				? DEFAULT_DISCORD_DETAILS_TEMPLATE
				: detailsTemplate;
			const safeStateTemplate = validateDiscordTemplate(stateTemplate)
				? DEFAULT_DISCORD_STATE_TEMPLATE
				: stateTemplate;
			const safeBottomLineTemplate = validateDiscordTemplate(bottomLineTemplate)
				? DEFAULT_DISCORD_BOTTOM_LINE_TEMPLATE
				: bottomLineTemplate;
			const context = createDiscordTemplateContext({
				snapshot,
				lyrics,
				fileName,
				selectedLineIds,
				selectedWordIds,
			});
			const payload = inactive
				? createInactiveDiscordActivity(generalActivityText, activityType, {
						idleLargeImageMode,
						idleSmallImageMode,
						userProfilePhoto: user?.photoURL,
						userDisplayName: user?.displayName || user?.email?.split("@")[0],
						mode,
					})
				: formatNativeDiscordActivity(snapshot, context, {
						detailsTemplate: safeDetailsTemplate,
						stateTemplate: safeStateTemplate,
						bottomLineTemplate: safeBottomLineTemplate,
						showPlaybackTimeline,
						showProjectElapsed,
						showRepositoryButton,
						activityType,
						showStatusBadge,
						privacyPreset,
						largeImageMode,
						smallImageMode,
						idleLargeImageMode,
						idleSmallImageMode,
						idleBottomTextTemplate: idleBottomText,
						generalActivityText,
						showProgressTimer,
					});

			log("Discord RPC Activity Payload:", payload);

			invoke("set_discord_activity", { payload }).catch((error) =>
				log("Unable to update Discord presence", error),
			);
		}
	}, [
		enabled,
		detailsTemplate,
		stateTemplate,
		bottomLineTemplate,
		fileName,
		inactive,
		lyrics,
		mode,
		playbackRate,
		playing,
		projectId,
		selectedLineIds,
		selectedWordIds,
		showPlaybackTimeline,
		showProjectElapsed,
		showRepositoryButton,
		activityType,
		showStatusBadge,
		tracker,
		privacyPreset,
		largeImageMode,
		smallImageMode,
		idleLargeImageMode,
		idleSmallImageMode,
		idleBottomText,
		generalActivityText,
		showProgressTimer,
		user,
		checklistTotal,
		checklistCompleted,
	]);

	useEffect(() => {
		publish();
		if (!playing) return;
		const timer = window.setInterval(publish, 1000);
		return () => window.clearInterval(timer);
	}, [playing, publish]);

	useEffect(() => {
		if (!isTauri || enabled) return;
		invoke("clear_discord_activity").catch((error) =>
			log("Unable to clear Discord presence", error),
		);
	}, [enabled]);

	useEffect(
		() => () => {
			if (isTauri) void invoke("clear_discord_activity");
		},
		[],
	);

	return null;
}
