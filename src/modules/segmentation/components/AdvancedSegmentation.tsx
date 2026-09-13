/**
 * @description 高级分词组件
 */

import {
	DeleteRegular,
	EditRegular,
	Info16Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Callout,
	Checkbox,
	Dialog,
	Flex,
	IconButton,
	RadioGroup,
	Select,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	segmentationCustomRulesAtom,
	segmentationEngineAtom,
	segmentationIgnoreListTextAtom,
	segmentationPunctuationModeAtom,
	segmentationPunctuationWeightAtom,
	segmentationRangeEndAtom,
	segmentationRangeStartAtom,
	segmentationRemoveEmptySegmentsAtom,
	segmentationScopeAtom,
	segmentationSplitCJKAtom,
	segmentationSplitEnglishAtom,
} from "$/modules/segmentation/states";
import { segmentLyricLines } from "$/modules/segmentation/utils/segmentation.ts";
import { SYLLABIFICATION_ENGINES } from "$/modules/segmentation/utils/syllabification-engines";
import { advancedSegmentationDialogAtom } from "$/states/dialogs.ts";
import { lyricLinesAtom } from "$/states/main.ts";
import { type LyricWord, newLyricLine, newLyricWord } from "$/types/ttml";
import { useSegmentationConfig } from "../utils/useSegmentationConfig";
import styles from "./AdvancedSegmentation.module.css";
import { ManualWordSplitter } from "./ManualWordSplitter";

export const AdvancedSegmentationDialog = memo(() => {
	const [open, setOpen] = useAtom(advancedSegmentationDialogAtom);
	const [scope, setScope] = useAtom(segmentationScopeAtom);
	const { config: segmentationConfig, isLoading: isLoadingLang } =
		useSegmentationConfig();
	const [rangeStart, setRangeStart] = useAtom(segmentationRangeStartAtom);
	const [rangeEnd, setRangeEnd] = useAtom(segmentationRangeEndAtom);
	const [splitCJK, setSplitCJK] = useAtom(segmentationSplitCJKAtom);
	const [splitEnglish, setSplitEnglish] = useAtom(segmentationSplitEnglishAtom);
	const [engine, setEngine] = useAtom(segmentationEngineAtom);
	const [punctuationMode, setPunctuationMode] = useAtom(
		segmentationPunctuationModeAtom,
	);
	const [punctuationWeight, setPunctuationWeight] = useAtom(
		segmentationPunctuationWeightAtom,
	);
	const [removeEmptySegments, setRemoveEmptySegments] = useAtom(
		segmentationRemoveEmptySegmentsAtom,
	);
	const [ignoreListText, setIgnoreListText] = useAtom(
		segmentationIgnoreListTextAtom,
	);
	const [customRules, setCustomRules] = useAtom(segmentationCustomRulesAtom);

	const [testInput, setTestInput] = useState("");
	const [manualWordInput, setManualWordInput] = useState("");
	const [manualSplitIndices, setManualSplitIndices] = useState(
		new Set<number>(),
	);

	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const currentLyric = useAtomValue(lyricLinesAtom);

	const { t } = useTranslation();

	const toggleSplitPoint = useCallback((index: number) => {
		setManualSplitIndices((prev) => {
			const next = new Set(prev);
			if (next.has(index)) {
				next.delete(index);
			} else {
				next.add(index);
			}
			return next;
		});
	}, []);

	const handleAddRule = useCallback(() => {
		if (!manualWordInput) return;

		const parts: string[] = [];
		let lastIndex = 0;
		const sortedIndices = Array.from(manualSplitIndices).sort((a, b) => a - b);

		for (const index of sortedIndices) {
			parts.push(manualWordInput.slice(lastIndex, index));
			lastIndex = index;
		}
		parts.push(manualWordInput.slice(lastIndex));

		const next = new Map(customRules);
		next.set(manualWordInput, parts);
		setCustomRules(next);

		setManualWordInput("");
		setManualSplitIndices(new Set());
	}, [manualWordInput, manualSplitIndices, customRules, setCustomRules]);

	const handleDeleteRule = useCallback(
		(word: string) => {
			const next = new Map(customRules);
			next.delete(word);
			setCustomRules(next);
		},
		[customRules, setCustomRules],
	);

	const handleEditRule = useCallback((word: string, parts: string[]) => {
		setManualWordInput(word);

		const indices = new Set<number>();
		let currentIndex = 0;
		for (let i = 0; i < parts.length - 1; i++) {
			currentIndex += parts[i].length;
			indices.add(currentIndex);
		}
		setManualSplitIndices(indices);
	}, []);

	const testPreview = useMemo(() => {
		if (!testInput.trim()) {
			return;
		}

		const testWord: LyricWord = {
			...newLyricWord(),
			word: testInput,
			startTime: 0,
			endTime: 10000,
		};

		try {
			const tempLine = { ...newLyricLine(), words: [testWord] };
			const processedLines = segmentLyricLines([tempLine], segmentationConfig);
			const resultWords = processedLines[0].words;

			if (resultWords.length === 0) return;

			return (
				<Flex gap="1" wrap="wrap" align="center">
					{resultWords.map((w, i) => (
						<span
							className={styles.previewWord}
							key={`preview-word-${i}-${w.id}`}
						>
							{w.word.trim() === "" ? (
								<Text color="gray" as="span">
									{w.word.length > 0
										? t("splitWordDialog.spaceCount", "Space x{count}", {
												count: w.word.length,
											})
										: t("splitWordDialog.empty", "Empty")}
								</Text>
							) : (
								w.word
							)}
						</span>
					))}
				</Flex>
			);
		} catch (error) {
			console.error("Splitting preview error:", error);
			return (
				<Text color="gray">
					{t(
						"advancedSegmentDialog.test.outputError",
						"Splitting preview error",
					)}
				</Text>
			);
		}
	}, [testInput, t, segmentationConfig]);

	const onApply = useCallback(() => {
		const maxLines = currentLyric.lyricLines.length;
		let startIndex = 0;
		let endIndex = maxLines;

		if (scope === "range") {
			startIndex = (parseInt(rangeStart, 10) || 1) - 1;
			endIndex = parseInt(rangeEnd, 10) || maxLines;
			startIndex = Math.max(0, Math.min(startIndex, maxLines));
			endIndex = Math.max(startIndex, Math.min(endIndex, maxLines));
		}

		editLyricLines((draft) => {
			const linesToProcess = draft.lyricLines.slice(startIndex, endIndex);
			const processedLines = segmentLyricLines(
				linesToProcess,
				segmentationConfig,
			);
			draft.lyricLines.splice(
				startIndex,
				processedLines.length,
				...processedLines,
			);
		});

		setOpen(false);
	}, [
		segmentationConfig,
		scope,
		rangeStart,
		rangeEnd,
		editLyricLines,
		currentLyric.lyricLines.length,
		setOpen,
	]);

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="800px">
				<Dialog.Title>
					{t("advancedSegmentDialog.title", "Advanced Segmentation")}
				</Dialog.Title>

				<Flex direction="column" gap="4">
					<Flex direction="column" gap="2">
						<Text>
							{t("advancedSegmentDialog.scope.title", "Application Scope")}
						</Text>
						<Text as="label" size="2">
							<RadioGroup.Root
								value={scope}
								onValueChange={(value: string) =>
									setScope(value as "all" | "range")
								}
							>
								<Text as="label" size="2">
									<Flex gap="2" align="center">
										<RadioGroup.Item value="all" />
										<Text>
											{t("advancedSegmentDialog.scope.all", "All lyric lines")}
										</Text>
									</Flex>
								</Text>
								<Text as="label" size="2">
									<Flex gap="2" align="center" mt="2">
										<RadioGroup.Item value="range" />
										<Text>
											{t("advancedSegmentDialog.scope.range.from", "From line")}
										</Text>
										<TextField.Root
											type="number"
											value={rangeStart}
											onChange={(e) => setRangeStart(e.target.value)}
											disabled={scope !== "range"}
											style={{ maxWidth: 80 }}
										/>
										<Text>
											{t("advancedSegmentDialog.scope.range.to", "to line")}
										</Text>
										<TextField.Root
											type="number"
											value={rangeEnd}
											onChange={(e) => setRangeEnd(e.target.value)}
											disabled={scope !== "range"}
											style={{ maxWidth: 80 }}
										/>
										<Text>
											{t("advancedSegmentDialog.scope.range.end", "")}
										</Text>
									</Flex>
								</Text>
							</RadioGroup.Root>
						</Text>
					</Flex>
					<Flex direction="column" gap="2">
						<Text>
							{t(
								"advancedSegmentDialog.rules.title",
								"Auto Segmentation Rules",
							)}
						</Text>
						<Text as="label" size="2">
							<Flex gap="2" align="center">
								<Checkbox
									checked={splitCJK}
									onCheckedChange={(c) => setSplitCJK(c as boolean)}
								/>
								{t("advancedSegmentDialog.rules.cjk", "Split CJK characters")}
							</Flex>
						</Text>

						<Flex direction="column" gap="2">
							<Text as="label" size="2">
								<Flex gap="2" align="center">
									<Checkbox
										checked={splitEnglish}
										onCheckedChange={(c) => setSplitEnglish(c as boolean)}
									/>
									{t(
										"advancedSegmentDialog.rules.syllable",
										"Split Western words by syllables",
									)}
								</Flex>
							</Text>

							{splitEnglish && (
								<Flex direction="column" gap="1" ml="5">
									<Text size="2" color="gray">
										{t(
											"advancedSegmentDialog.engine.select",
											"Choose a syllabification engine:",
										)}
									</Text>
									<Select.Root
										value={engine}
										onValueChange={(value) => setEngine(value as typeof engine)}
									>
										<Select.Trigger style={{ width: "100%" }} />
										<Select.Content>
											{SYLLABIFICATION_ENGINES.map((candidate) => (
												<Select.Item key={candidate.id} value={candidate.id}>
													{candidate.name}
												</Select.Item>
											))}
										</Select.Content>
									</Select.Root>
								</Flex>
							)}
						</Flex>

						<Callout.Root color="blue">
							<Callout.Icon>
								<Info16Regular />
							</Callout.Icon>
							<Callout.Text>
								{t(
									"advancedSegmentDialog.tip",
									"After splitting, the original word's total duration will be redistributed based on the number of characters and their weights.",
								)}
							</Callout.Text>
						</Callout.Root>
					</Flex>

					<Flex direction="column" gap="3">
						<Text>
							{t("advancedSegmentDialog.postProcess.title", "Post-processing")}
						</Text>
						<Text as="label" size="2">
							<Flex direction="column" gap="2">
								<Text>
									{t(
										"advancedSegmentDialog.postProcess.punct.caption",
										"Punctuation handling:",
									)}
								</Text>
								<RadioGroup.Root
									value={punctuationMode}
									onValueChange={(value: string) =>
										setPunctuationMode(value as "merge" | "standalone")
									}
								>
									<Text as="label" size="2">
										<Flex gap="2" align="center">
											<RadioGroup.Item value="merge" />
											<Text>
												{t(
													"advancedSegmentDialog.postProcess.punct.merge",
													"Merge to adjacent syllable",
												)}
											</Text>
										</Flex>
									</Text>
									<Text as="label" size="2">
										<Flex gap="2" align="center" mt="2">
											<RadioGroup.Item value="standalone" />
											<Text>
												{t(
													"advancedSegmentDialog.postProcess.punct.standalone",
													"Set as standalone segment",
												)}
											</Text>
										</Flex>
									</Text>
								</RadioGroup.Root>
							</Flex>
						</Text>

						<Text as="label" size="2">
							<Flex direction="column" gap="2">
								<Text>
									{t(
										"advancedSegmentDialog.postProcess.punct.weight",
										"Punctuation time weight:",
									)}
								</Text>
								<TextField.Root
									type="number"
									value={punctuationWeight}
									onChange={(e) => setPunctuationWeight(e.target.value)}
									disabled={punctuationMode !== "standalone"}
									style={{ maxWidth: 100 }}
								/>
							</Flex>
						</Text>

						<Text as="label" size="2">
							<Flex gap="2" align="center">
								<Checkbox
									checked={removeEmptySegments}
									onCheckedChange={(c) => setRemoveEmptySegments(c as boolean)}
								/>
								<Text>
									{t(
										"advancedSegmentDialog.postProcess.empty",
										"Remove empty segments",
									)}
								</Text>
							</Flex>
						</Text>
					</Flex>

					<Flex direction="column" gap="2">
						<Text>
							{t(
								"advancedSegmentDialog.custom.title",
								"Custom Segmentation Rules",
							)}
						</Text>
						<TextField.Root
							placeholder={t(
								"advancedSegmentDialog.custom.input",
								"Enter word for manual splitting...",
							)}
							value={manualWordInput}
							onChange={(e) => {
								setManualWordInput(e.target.value);
								setManualSplitIndices(new Set());
							}}
						/>
						<ManualWordSplitter
							word={manualWordInput}
							splitIndices={manualSplitIndices}
							onSplitIndexToggle={toggleSplitPoint}
						/>
						<Button onClick={handleAddRule} disabled={!manualWordInput}>
							{t("advancedSegmentDialog.custom.add", "Add to custom rules")}
						</Button>
						{customRules.size > 0 && (
							<Flex direction="column" gap="2">
								<Text size="2">
									{t("advancedSegmentDialog.custom.list", "Custom rules list:")}
								</Text>
								<Box className={styles.ruleList}>
									{Array.from(customRules.entries()).map(([word, parts]) => (
										<Flex
											key={word}
											justify="between"
											align="center"
											style={{
												paddingTop: "var(--space-1)",
												paddingBottom: "var(--space-2)",
												marginBottom: "var(--space-2)",
												borderBottom: "3px solid var(--gray-3)",
											}}
										>
											<Flex align="center" gap="2" wrap="wrap">
												<span className={styles.previewWord}>{word}</span>
												<Text color="gray" as="span">
													→
												</Text>
												{parts.map((part, i) => (
													<span
														className={styles.previewWord}
														key={`${word}-${part}-${
															// biome-ignore lint/suspicious/noArrayIndexKey: 这个列表顺序完全不会发生变化
															i
														}`}
													>
														{part.trim() === "" ? (
															<Text color="gray" as="span">
																{part.length > 0
																	? t(
																			"splitWordDialog.spaceCount",
																			"Space x{count}",
																			{
																				count: part.length,
																			},
																		)
																	: t("splitWordDialog.empty", "Empty")}
															</Text>
														) : (
															part
														)}
													</span>
												))}
											</Flex>

											<Flex gap="1">
												<IconButton
													size="1"
													variant="ghost"
													color="gray"
													onClick={() => handleEditRule(word, parts)}
												>
													<EditRegular />
												</IconButton>
												<IconButton
													size="1"
													variant="ghost"
													color="gray"
													onClick={() => handleDeleteRule(word)}
												>
													<DeleteRegular />
												</IconButton>
											</Flex>
										</Flex>
									))}
								</Box>
							</Flex>
						)}
					</Flex>

					<Text as="label" size="2">
						<Flex direction="column" gap="2">
							<Text>
								{t("advancedSegmentDialog.ignore.title", "Ignore List")}
							</Text>
							<TextArea
								placeholder={t(
									"advancedSegmentDialog.ignore.placeholder",
									"One word per line, words in this list will not be auto-segmented",
								)}
								value={ignoreListText}
								onChange={(e) => setIgnoreListText(e.target.value)}
								style={{ minHeight: 100, resize: "vertical" }}
							/>
						</Flex>
					</Text>

					<Text as="label" size="2">
						<Flex direction="column" gap="2">
							<Text>
								{t("advancedSegmentDialog.test.title", "Splitting Test")}
							</Text>
							<TextField.Root
								placeholder={t(
									"advancedSegmentDialog.test.input",
									"Enter a lyric line or word to test...",
								)}
								value={testInput}
								onChange={(e) => setTestInput(e.target.value)}
							/>
							<Text size="2">
								{t("advancedSegmentDialog.test.output", "Preview result:")}
							</Text>
							<Box
								style={{
									backgroundColor: "var(--gray-4)",
									borderRadius: "var(--radius-2)",
									padding: "var(--space-2)",
									minHeight: "4em",
								}}
							>
								{testPreview}
							</Box>
						</Flex>
					</Text>
				</Flex>

				<Flex gap="3" mt="4" justify="end">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.cancel", "Cancel")}
						</Button>
					</Dialog.Close>
					<Button onClick={onApply}>{t("common.apply", "Apply")}</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
});
