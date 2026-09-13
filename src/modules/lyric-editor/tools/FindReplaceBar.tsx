import {
	ArrowDown16Regular,
	ArrowUp16Regular,
	ChevronDown16Regular,
	ChevronRight16Regular,
	Dismiss16Regular,
	Search16Regular,
} from "@fluentui/react-icons";
import { Button, DropdownMenu, TextField } from "@radix-ui/themes";
import classNames from "classnames";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { type FC, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { findReplaceStateAtom } from "$/states/dialogs";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import {
	findMatches,
	replaceAllMatches,
	replaceCurrentMatch,
	type SearchScope,
} from "../utils/find-replace";
import styles from "./find-replace.module.css";

export const FindReplaceBar: FC = () => {
	const { t } = useTranslation();
	const [state, setState] = useAtom(findReplaceStateAtom);
	const lyricData = useAtomValue(lyricLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setSelectedLines = useSetAtom(selectedLinesAtom);
	const setSelectedWords = useSetAtom(selectedWordsAtom);

	const findInputRef = useRef<HTMLInputElement>(null);
	const replaceInputRef = useRef<HTMLInputElement>(null);

	const matches = useMemo(() => {
		if (!state.open || !state.query) return [];
		return findMatches(lyricData, {
			query: state.query,
			replacement: state.replaceText,
			matchCase: state.matchCase,
			wholeWord: state.wholeWord,
			useRegex: state.useRegex,
			scope: state.scope,
		});
	}, [
		state.open,
		state.query,
		state.replaceText,
		state.matchCase,
		state.wholeWord,
		state.useRegex,
		state.scope,
		lyricData,
	]);

	const activeIndex = useMemo(() => {
		if (matches.length === 0) return -1;
		if (state.activeMatchIndex >= matches.length) {
			return 0;
		}
		if (state.activeMatchIndex < 0) {
			return 0;
		}
		return state.activeMatchIndex;
	}, [matches.length, state.activeMatchIndex]);

	const highlightMatch = useCallback(
		(index: number) => {
			if (index < 0 || index >= matches.length) return;
			const match = matches[index];
			if (!match) return;

			setSelectedLines(new Set([match.lineId]));
			if (match.wordId) {
				setSelectedWords(new Set([match.wordId]));
			} else {
				setSelectedWords(new Set());
			}
		},
		[matches, setSelectedLines, setSelectedWords],
	);

	const goToNext = useCallback(() => {
		if (matches.length === 0) return;
		const nextIndex = (activeIndex + 1) % matches.length;
		setState((prev) => ({ ...prev, activeMatchIndex: nextIndex }));
		highlightMatch(nextIndex);
	}, [activeIndex, matches.length, highlightMatch, setState]);

	const goToPrev = useCallback(() => {
		if (matches.length === 0) return;
		const prevIndex = (activeIndex - 1 + matches.length) % matches.length;
		setState((prev) => ({ ...prev, activeMatchIndex: prevIndex }));
		highlightMatch(prevIndex);
	}, [activeIndex, matches.length, highlightMatch, setState]);

	useEffect(() => {
		if (state.open && matches.length > 0 && activeIndex >= 0) {
			highlightMatch(activeIndex);
		}
	}, [state.open, activeIndex, matches.length, highlightMatch]);

	useEffect(() => {
		if (state.open) {
			requestAnimationFrame(() => {
				if (state.replaceMode && replaceInputRef.current && state.query) {
					replaceInputRef.current.focus();
					replaceInputRef.current.select();
				} else if (findInputRef.current) {
					findInputRef.current.focus();
					findInputRef.current.select();
				}
			});
		}
	}, [state.open, state.replaceMode, state.query]);

	const handleClose = useCallback(() => {
		setState((prev) => ({ ...prev, open: false }));
	}, [setState]);

	const handleReplaceOne = useCallback(() => {
		if (activeIndex < 0 || activeIndex >= matches.length) return;
		const match = matches[activeIndex];
		if (!match) return;

		editLyricLines((draft) => {
			const { nextLyrics, modified } = replaceCurrentMatch(
				draft,
				match,
				state.replaceText,
			);
			if (modified) {
				draft.lyricLines = nextLyrics.lyricLines;
			}
		});

		// Jump to next after replacement
		if (matches.length > 1) {
			goToNext();
		}
	}, [activeIndex, matches, editLyricLines, state.replaceText, goToNext]);

	const handleReplaceAll = useCallback(() => {
		if (!state.query) return;

		editLyricLines((draft) => {
			const { nextLyrics, replacedCount, linesAffected } = replaceAllMatches(
				draft,
				{
					query: state.query,
					replacement: state.replaceText,
					matchCase: state.matchCase,
					wholeWord: state.wholeWord,
					useRegex: state.useRegex,
					scope: state.scope,
				},
			);

			if (replacedCount > 0) {
				draft.lyricLines = nextLyrics.lyricLines;
				toast.success(
					t(
						"findReplace.replacedSummary",
						"Replaced {count} occurrences across {lines} lines",
						{
							count: replacedCount,
							lines: linesAffected,
						},
					),
				);
			} else {
				toast.info(t("findReplace.noMatches", "No matches found"));
			}
		});
	}, [
		state.query,
		state.replaceText,
		state.matchCase,
		state.wholeWord,
		state.useRegex,
		state.scope,
		editLyricLines,
		t,
	]);

	if (!state.open) return null;

	const scopeLabels: Record<SearchScope, string> = {
		all: t("findReplace.scope.all", "All Fields"),
		lyrics: t("findReplace.scope.lyrics", "Main Lyrics"),
		translations: t("findReplace.scope.translations", "Translations"),
		romanizations: t("findReplace.scope.romanizations", "Romanizations"),
	};

	return (
		<div className={styles.findReplacePanel}>
			{/* Row 1: Find Row */}
			<div className={styles.row}>
				<button
					type="button"
					className={styles.iconBtn}
					title={
						state.replaceMode
							? t("findReplace.collapseReplace", "Hide Replace")
							: t("findReplace.expandReplace", "Show Replace")
					}
					onClick={() =>
						setState((prev) => ({ ...prev, replaceMode: !prev.replaceMode }))
					}
				>
					{state.replaceMode ? (
						<ChevronDown16Regular />
					) : (
						<ChevronRight16Regular />
					)}
				</button>

				<div className={styles.inputWrapper}>
					<TextField.Root
						ref={findInputRef}
						size="1"
						value={state.query}
						onChange={(e) =>
							setState((prev) => ({
								...prev,
								query: e.target.value,
								activeMatchIndex: 0,
							}))
						}
						placeholder={t("findReplace.findPlaceholder", "Find...")}
						style={{ width: "100%" }}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								if (e.shiftKey) {
									goToPrev();
								} else {
									goToNext();
								}
							} else if (e.key === "Escape") {
								e.preventDefault();
								handleClose();
							}
						}}
					>
						<TextField.Slot>
							<Search16Regular style={{ color: "var(--gray-9)" }} />
						</TextField.Slot>
						{state.query && (
							<TextField.Slot side="right">
								<span
									className={classNames(
										styles.matchCount,
										matches.length === 0 && styles.matchCountNone,
									)}
								>
									{matches.length === 0
										? t("findReplace.noResults", "No results")
										: `${activeIndex + 1} of ${matches.length}`}
								</span>
							</TextField.Slot>
						)}
					</TextField.Root>
				</div>

				{/* Match Options Toggles */}
				<button
					type="button"
					className={classNames(
						styles.toggleBtn,
						state.matchCase && styles.toggleBtnActive,
					)}
					title={t("findReplace.matchCase", "Match Case (Aa)")}
					onClick={() =>
						setState((prev) => ({
							...prev,
							matchCase: !prev.matchCase,
							activeMatchIndex: 0,
						}))
					}
				>
					Aa
				</button>

				<button
					type="button"
					className={classNames(
						styles.toggleBtn,
						state.wholeWord && styles.toggleBtnActive,
					)}
					title={t("findReplace.matchWholeWord", "Match Whole Word (\\b)")}
					onClick={() =>
						setState((prev) => ({
							...prev,
							wholeWord: !prev.wholeWord,
							activeMatchIndex: 0,
						}))
					}
				>
					\b
				</button>

				<button
					type="button"
					className={classNames(
						styles.toggleBtn,
						state.useRegex && styles.toggleBtnActive,
					)}
					title={t("findReplace.useRegex", "Use Regular Expression (.*)")}
					onClick={() =>
						setState((prev) => ({
							...prev,
							useRegex: !prev.useRegex,
							activeMatchIndex: 0,
						}))
					}
				>
					.*
				</button>

				{/* Navigation buttons */}
				<button
					type="button"
					className={styles.iconBtn}
					disabled={matches.length === 0}
					title={t("findReplace.prevMatch", "Previous Match (Shift+Enter)")}
					onClick={goToPrev}
				>
					<ArrowUp16Regular />
				</button>

				<button
					type="button"
					className={styles.iconBtn}
					disabled={matches.length === 0}
					title={t("findReplace.nextMatch", "Next Match (Enter)")}
					onClick={goToNext}
				>
					<ArrowDown16Regular />
				</button>

				{/* Close Button */}
				<button
					type="button"
					className={styles.iconBtn}
					title={t("common.close", "Close (Esc)")}
					onClick={handleClose}
				>
					<Dismiss16Regular />
				</button>
			</div>

			{/* Row 2: Replace Row (collapsible) */}
			{state.replaceMode && (
				<div className={styles.row} style={{ marginTop: 2 }}>
					<div style={{ width: 26, flexShrink: 0 }} />

					<div className={styles.inputWrapper}>
						<TextField.Root
							ref={replaceInputRef}
							size="1"
							value={state.replaceText}
							onChange={(e) =>
								setState((prev) => ({
									...prev,
									replaceText: e.target.value,
								}))
							}
							placeholder={t("findReplace.replacePlaceholder", "Replace...")}
							style={{ width: "100%" }}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									if (e.shiftKey || e.altKey) {
										handleReplaceAll();
									} else {
										handleReplaceOne();
									}
								} else if (e.key === "Escape") {
									e.preventDefault();
									handleClose();
								}
							}}
						/>
					</div>

					{/* Scope selector dropdown */}
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							<Button
								variant="surface"
								size="1"
								color="gray"
								style={{ fontSize: 11, cursor: "pointer" }}
							>
								{scopeLabels[state.scope]}
								<DropdownMenu.TriggerIcon />
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content size="1">
							<DropdownMenu.RadioGroup
								value={state.scope}
								onValueChange={(v) =>
									setState((prev) => ({
										...prev,
										scope: v as SearchScope,
										activeMatchIndex: 0,
									}))
								}
							>
								<DropdownMenu.RadioItem value="all">
									{scopeLabels.all}
								</DropdownMenu.RadioItem>
								<DropdownMenu.RadioItem value="lyrics">
									{scopeLabels.lyrics}
								</DropdownMenu.RadioItem>
								<DropdownMenu.RadioItem value="translations">
									{scopeLabels.translations}
								</DropdownMenu.RadioItem>
								<DropdownMenu.RadioItem value="romanizations">
									{scopeLabels.romanizations}
								</DropdownMenu.RadioItem>
							</DropdownMenu.RadioGroup>
						</DropdownMenu.Content>
					</DropdownMenu.Root>

					{/* Actions */}
					<div className={styles.replaceActions}>
						<Button
							variant="soft"
							size="1"
							disabled={matches.length === 0}
							onClick={handleReplaceOne}
							title={t("findReplace.replaceOne", "Replace (Enter)")}
							style={{ cursor: "pointer" }}
						>
							{t("findReplace.replace", "Replace")}
						</Button>
						<Button
							variant="solid"
							size="1"
							disabled={matches.length === 0}
							onClick={handleReplaceAll}
							title={t("findReplace.replaceAll", "Replace All")}
							style={{ cursor: "pointer" }}
						>
							{t("findReplace.replaceAll", "Replace All")}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
};
