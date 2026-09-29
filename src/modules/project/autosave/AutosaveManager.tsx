import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { autoSaveProject } from "$/modules/project/autosave/autosave";
import {
	autosaveEnabledAtom,
	autosaveIntervalAtom,
	autosaveLimitAtom,
} from "$/modules/settings/states";
import {
	loadedAudioAtom,
	loadedAudioFileNameAtom,
	loadedAudioPathAtom,
} from "$/modules/audio/states";
import {
	isDirtyAtom,
	lastSavedTimeAtom,
	lyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
	SaveStatus,
	saveStatusAtom,
} from "$/states/main";
import { log, error as logError } from "$/utils/logging";

export const AutosaveManager = () => {
	const lyricLines = useAtomValue(lyricLinesAtom);
	const isDirty = useAtomValue(isDirtyAtom);
	const enabled = useAtomValue(autosaveEnabledAtom);
	const limit = useAtomValue(autosaveLimitAtom);
	const intervalMinutes = useAtomValue(autosaveIntervalAtom);
	const projectId = useAtomValue(projectIdAtom);
	const saveFileName = useAtomValue(saveFileNameAtom);
	const loadedAudioFileName = useAtomValue(loadedAudioFileNameAtom);
	const loadedAudioPath = useAtomValue(loadedAudioPathAtom);
	const loadedAudio = useAtomValue(loadedAudioAtom);

	const setSaveStatus = useSetAtom(saveStatusAtom);
	const setLastSavedTime = useSetAtom(lastSavedTimeAtom);

	useEffect(() => {
		if (!enabled) return;

		if (!isDirty) {
			setSaveStatus(SaveStatus.Saved);
			return;
		}

		if (lyricLines.lyricLines.length === 0) {
			setSaveStatus(SaveStatus.Saved);
			return;
		}

		setSaveStatus(SaveStatus.Pending);

		const timer = setTimeout(() => {
			if (lyricLines.lyricLines.length > 0) {
				setSaveStatus(SaveStatus.Saving);
				log("Auto-saving project...", projectId);

				autoSaveProject(
					projectId,
					lyricLines,
					limit,
					intervalMinutes * 60 * 1000,
					{
						saveFileName,
						audioFileName: loadedAudioFileName,
						audioPath: loadedAudioPath,
						audioBlob: loadedAudio && loadedAudio.size > 0 ? loadedAudio : null,
					},
				)
					.then(() => {
						setSaveStatus(SaveStatus.Saved);
						setLastSavedTime(Date.now());
					})
					.catch((err) => {
						logError("Failed to autosave project", err);
						setSaveStatus(SaveStatus.Pending);
					});
			}
		}, 3000);

		return () => {
			clearTimeout(timer);
		};
	}, [
		lyricLines,
		isDirty,
		enabled,
		limit,
		projectId,
		saveFileName,
		loadedAudioFileName,
		loadedAudioPath,
		loadedAudio,
		setSaveStatus,
		setLastSavedTime,
		intervalMinutes,
	]);

	return null;
};
