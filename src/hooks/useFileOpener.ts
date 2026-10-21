/**
 * @description Handles file opening logic
 */

import {
	type LyricLine,
	parseEslrc,
	parseLys,
	parseQrc,
	parseYrc,
} from "@applemusic-like-lyrics/lyric";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { uid } from "uid";

import { audioEngine } from "$/modules/audio/audio-engine";
import { getProjectList } from "$/modules/project/autosave/autosave";
import { getSuggestedTtmlFileName } from "$/modules/project/logic/metadata-filename";
import { isProjectMatch } from "$/modules/project/logic/project-match";
import { parseLyric as parseTTML } from "$/modules/project/logic/ttml-parser";
import {
	normalizeApostrophesOnImportAtom,
	normalizeCyrillicEsOnImportAtom,
} from "$/modules/settings/states";
import { confirmDialogAtom } from "$/states/dialogs";
import {
	isDirtyAtom,
	newLyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
} from "$/states/main";
import type { TTMLLyric } from "$/types/ttml";
import { error as logError, log } from "$/utils/logging";
import { parseLrc } from "$/utils/parse-lrc";
import {
	normalizeImportedLyricApostrophes,
	normalizeImportedLyricCyrillicEs,
} from "$/utils/apostrophe-normalization";

const LYRIC_PARSERS: Record<string, (text: string) => LyricLine[]> = {
	lrc: parseLrc,
	eslrc: parseEslrc,
	qrc: parseQrc,
	yrc: parseYrc,
	lys: parseLys,
};

const AUDIO_EXTENSIONS = new Set([
	"opus",
	"flac",
	"webm",
	"weba",
	"wav",
	"ogg",
	"m4a",
	"oga",
	"mid",
	"mp3",
	"aiff",
	"wma",
	"au",
]);

export const useFileOpener = () => {
	const setNewLyricLines = useSetAtom(newLyricLinesAtom);
	const setProjectId = useSetAtom(projectIdAtom);
	const setSaveFileName = useSetAtom(saveFileNameAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const isDirty = useAtomValue(isDirtyAtom);
	const { t } = useTranslation();

	const normalizeApostrophesOnImport = useAtomValue(
		normalizeApostrophesOnImportAtom,
	);
	const normalizeCyrillicEsOnImport = useAtomValue(
		normalizeCyrillicEsOnImportAtom,
	);

	const normalizeLyricLines = useCallback(
		(lyricLines: LyricLine[]): TTMLLyric => {
			return {
				lyricLines: lyricLines.map((line) => ({
					...line,
					words: line.words.map((word) => ({
						...word,
						id: uid(),
						obscene: false,
					})),
					ignoreSync: false,
					id: uid(),
				})),
				metadata: [],
			};
		},
		[],
	);

	const performOpenFile = useCallback(
		async (file: File, forceExt?: string) => {
			const rawExt = file.name.split(".").pop()?.toLowerCase() || "";
			const ext = forceExt ? forceExt.toLowerCase() : rawExt;

			try {
				if (AUDIO_EXTENSIONS.has(ext)) {
					await audioEngine.loadMusic(file);
					return;
				}

				let lyricData: TTMLLyric | null = null;
				const text = await file.text();

				if (ext === "ttml") {
					lyricData = parseTTML(text);
				} else if (ext in LYRIC_PARSERS) {
					const parser = LYRIC_PARSERS[ext];
					const rawLines = parser(text);
					lyricData = normalizeLyricLines(rawLines);
				} else {
					toast.error(
						t("error.unsupportedFileFormat", "Unsupported file format: {ext}", {
							ext,
						}),
					);
					return;
				}

				if (!lyricData) return;
				lyricData = normalizeImportedLyricApostrophes(
					lyricData,
					normalizeApostrophesOnImport,
				);
				lyricData = normalizeImportedLyricCyrillicEs(
					lyricData,
					normalizeCyrillicEsOnImport,
				);

				let resolvedProjectId = uid();

				try {
					if (lyricData.metadata.length > 0) {
						const projects = await getProjectList();
						const matchedProject = projects.find((p) =>
							isProjectMatch(p, lyricData as TTMLLyric),
						);

						if (matchedProject) {
							log(
								`匹配到了已有项目: ${matchedProject.name} (${matchedProject.id})`,
							);
							resolvedProjectId = matchedProject.id;
						} else {
							log("未匹配已有项目");
						}
					}
				} catch (e) {
					logError("解析项目数据时失败", e);
				}

				setProjectId(resolvedProjectId);
				setNewLyricLines(lyricData);
				const suggestedFile = getSuggestedTtmlFileName(lyricData.metadata);
				const nextFileName =
					ext === "ttml" ? file.name : (suggestedFile?.fileName ?? file.name);
				setSaveFileName(nextFileName);
			} catch (e) {
				logError(`Failed to open file: ${file.name}`, e);
				toast.error(t("error.openFileFailed", "Failed to open file"));
			}
		},
		[
			setNewLyricLines,
			setProjectId,
			setSaveFileName,
			normalizeLyricLines,
			t,
			normalizeApostrophesOnImport,
			normalizeCyrillicEsOnImport,
		],
	);

	const openFile = useCallback(
		/**
		 * Open file
		 * @param file
		 * @param forceExt Optional parameter to force parser format, otherwise inferred from file extension
		 */
		(file: File, forceExt?: string) => {
			const run = () => performOpenFile(file, forceExt);

			const rawExt = file.name.split(".").pop()?.toLowerCase() || "";
			const finalExt = forceExt || rawExt;

			if (AUDIO_EXTENSIONS.has(finalExt)) {
				run();
				return;
			}

			if (isDirty) {
				setConfirmDialog({
					open: true,
					title: t("confirmDialog.openFile.title", "Confirm Open File"),
					description: t(
						"confirmDialog.openFile.description",
						"You have unsaved changes. If you proceed, these changes will be lost. Are you sure you want to open a new file?",
					),
					onConfirm: run,
				});
			} else {
				run();
			}
		},
		[isDirty, setConfirmDialog, t, performOpenFile],
	);

	return { openFile };
};
