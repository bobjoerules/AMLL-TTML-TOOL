import {
	Button,
	Dialog,
	Flex,
	RadioGroup,
	ScrollArea,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { lyricLinesAtom } from "$/states/main";
import type { LyricLine } from "$/types/ttml";
import { mergeLyricLines } from "../utils/merge-lines";

interface MergeLineDialogProps {
	sourceLineIndex: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function formatTime(ms: number): string {
	const totalSeconds = ms / 1000;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = (totalSeconds % 60).toFixed(2);
	return `${minutes.toString().padStart(2, "0")}:${seconds.padStart(5, "0")}`;
}

function getLineText(line: LyricLine): string {
	if (line.words && line.words.length > 0) {
		return line.words.map((w) => w.word).join("");
	}
	return "";
}

export const MergeLineDialog = ({
	sourceLineIndex,
	open,
	onOpenChange,
}: MergeLineDialogProps) => {
	const { t } = useTranslation();
	const lyricData = useAtomValue(lyricLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedTargetIndex, setSelectedTargetIndex] = useState<number | null>(
		null,
	);
	const [mergeOrder, setMergeOrder] = useState<"auto" | "before" | "after">(
		"auto",
	);

	const sourceLine = lyricData.lyricLines[sourceLineIndex];
	const sourceText = sourceLine ? getLineText(sourceLine) : "";

	const candidateLines = useMemo(() => {
		return lyricData.lyricLines
			.map((line, idx) => ({
				index: idx,
				line,
				text: getLineText(line),
			}))
			.filter(
				(item) =>
					item.index !== sourceLineIndex &&
					(!searchQuery.trim() ||
						item.text
							.toLowerCase()
							.includes(searchQuery.toLowerCase().trim()) ||
						`line ${item.index + 1}`.includes(
							searchQuery.toLowerCase().trim(),
						)),
			);
	}, [lyricData.lyricLines, sourceLineIndex, searchQuery]);

	const handleMerge = () => {
		if (selectedTargetIndex === null || !sourceLine) return;
		const targetLine = lyricData.lyricLines[selectedTargetIndex];
		if (!targetLine) return;

		editLyricLines((state) => {
			let orderedLines: LyricLine[];
			let insertIndex: number;

			if (mergeOrder === "before") {
				// Target line comes before source line
				orderedLines = [targetLine, sourceLine];
				insertIndex = Math.min(sourceLineIndex, selectedTargetIndex);
			} else if (mergeOrder === "after") {
				// Target line comes after source line
				orderedLines = [sourceLine, targetLine];
				insertIndex = Math.min(sourceLineIndex, selectedTargetIndex);
			} else {
				// Auto by chronological line index in document
				if (sourceLineIndex < selectedTargetIndex) {
					orderedLines = [sourceLine, targetLine];
					insertIndex = sourceLineIndex;
				} else {
					orderedLines = [targetLine, sourceLine];
					insertIndex = selectedTargetIndex;
				}
			}

			const merged = mergeLyricLines(orderedLines);
			if (!merged) return;

			const minIdx = Math.min(sourceLineIndex, selectedTargetIndex);
			const maxIdx = Math.max(sourceLineIndex, selectedTargetIndex);

			// Remove the higher index first, then replace lower index
			state.lyricLines.splice(maxIdx, 1);
			state.lyricLines.splice(minIdx, 1, merged);
		});

		toast.success(
			t(
				"contextMenu.mergeSuccess",
				"Lines merged successfully keeping timings!",
			),
		);
		onOpenChange(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Content style={{ maxWidth: 540, maxHeight: "85vh" }}>
				<Dialog.Title>
					{t("contextMenu.mergeLineTitle", "Merge Line with Another")}
				</Dialog.Title>
				<Dialog.Description size="2" color="gray" mb="3">
					{t(
						"contextMenu.mergeLineDesc",
						"Select another line to merge with the current line while keeping all word timings intact.",
					)}
				</Dialog.Description>

				{/* Source line info box */}
				<Flex
					direction="column"
					gap="1"
					p="3"
					mb="3"
					style={{
						backgroundColor: "var(--accent-a2)",
						borderRadius: "8px",
						border: "1px solid var(--accent-a4)",
					}}
				>
					<Text size="1" weight="bold" color="accent">
						{t("contextMenu.currentLine", "Current Line (Line {num})", {
							num: sourceLineIndex + 1,
						})}
						:
					</Text>
					<Text size="2" weight="medium">
						{sourceText || (
							<Text color="gray">
								{t("contextMenu.emptyLine", "[Empty line]")}
							</Text>
						)}
					</Text>
					{sourceLine && (
						<Text size="1" color="gray">
							{formatTime(sourceLine.startTime)} -{" "}
							{formatTime(sourceLine.endTime)} ({sourceLine.words.length}{" "}
							{t("contextMenu.wordsCount", "words")})
						</Text>
					)}
				</Flex>

				{/* Search candidate lines */}
				<TextField.Root
					placeholder={t(
						"contextMenu.searchTargetLine",
						"Search lines to merge with...",
					)}
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.currentTarget.value)}
					mb="2"
				/>

				{/* Candidate list */}
				<ScrollArea
					type="auto"
					scrollbars="vertical"
					style={{
						height: "180px",
						border: "1px solid var(--gray-a4)",
						borderRadius: "8px",
						padding: "6px",
					}}
				>
					<Flex direction="column" gap="1">
						{candidateLines.length === 0 ? (
							<Flex justify="center" align="center" style={{ height: "140px" }}>
								<Text size="2" color="gray">
									{t("contextMenu.noLinesFound", "No matching lines found")}
								</Text>
							</Flex>
						) : (
							candidateLines.map((item) => {
								const isSelected = selectedTargetIndex === item.index;
								return (
									<Flex
										key={item.index}
										direction="column"
										p="2"
										onClick={() => setSelectedTargetIndex(item.index)}
										style={{
											borderRadius: "6px",
											cursor: "pointer",
											backgroundColor: isSelected
												? "var(--accent-a4)"
												: "transparent",
											border: isSelected
												? "1px solid var(--accent-a8)"
												: "1px solid transparent",
											transition: "background-color 0.15s ease",
										}}
									>
										<Flex justify="between" align="center">
											<Text size="2" weight={isSelected ? "bold" : "regular"}>
												<Text color="accent" mr="1">
													#{item.index + 1}
												</Text>
												{item.text || (
													<Text color="gray">
														{t("contextMenu.emptyLine", "[Empty line]")}
													</Text>
												)}
											</Text>
											<Text size="1" color="gray">
												{formatTime(item.line.startTime)} -{" "}
												{formatTime(item.line.endTime)}
											</Text>
										</Flex>
									</Flex>
								);
							})
						)}
					</Flex>
				</ScrollArea>

				{/* Merge order selection */}
				{selectedTargetIndex !== null && (
					<Flex direction="column" gap="1" mt="3">
						<Text size="1" weight="bold" color="gray">
							{t("contextMenu.mergeOrder", "Merge Order")}:
						</Text>
						<RadioGroup.Root
							value={mergeOrder}
							onValueChange={(val) => setMergeOrder(val as typeof mergeOrder)}
						>
							<Flex gap="4">
								<RadioGroup.Item value="auto">
									{t("contextMenu.orderAuto", "Chronological (In-Order)")}
								</RadioGroup.Item>
								<RadioGroup.Item value="after">
									{t("contextMenu.orderCurrentFirst", "Current Line First")}
								</RadioGroup.Item>
								<RadioGroup.Item value="before">
									{t("contextMenu.orderTargetFirst", "Target Line First")}
								</RadioGroup.Item>
							</Flex>
						</RadioGroup.Root>
					</Flex>
				)}

				<Flex justify="end" gap="2" mt="4">
					<Button
						variant="soft"
						color="gray"
						onClick={() => onOpenChange(false)}
					>
						{t("common.cancel", "Cancel")}
					</Button>
					<Button disabled={selectedTargetIndex === null} onClick={handleMerge}>
						{t("contextMenu.mergeConfirm", "Merge Lines")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
