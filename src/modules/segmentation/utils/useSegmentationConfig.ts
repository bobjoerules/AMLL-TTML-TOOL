import { useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import {
	segmentationCustomRulesAtom,
	segmentationEngineAtom,
	segmentationIgnoreListTextAtom,
	segmentationLearnedRulesAtom,
	segmentationPunctuationModeAtom,
	segmentationPunctuationWeightAtom,
	segmentationRemoveEmptySegmentsAtom,
	segmentationResplitWordsAtom,
	segmentationSplitCJKAtom,
	segmentationSplitEnglishAtom,
} from "../states";
import type { HyphenatorFunc, SegmentationConfig } from "../types";
import { loadHyphenator } from "../utils/hyphen-loader";
import { parseIgnoreList } from "./segmentation";
import { getHyphenationLanguage } from "./syllabification-engines";

export const useSegmentationConfig = () => {
	const splitCJK = useAtomValue(segmentationSplitCJKAtom);
	const splitEnglish = useAtomValue(segmentationSplitEnglishAtom);
	const resplitWords = useAtomValue(segmentationResplitWordsAtom);
	const engine = useAtomValue(segmentationEngineAtom);
	const punctuationMode = useAtomValue(segmentationPunctuationModeAtom);
	const punctuationWeightStr = useAtomValue(segmentationPunctuationWeightAtom);
	const removeEmptySegments = useAtomValue(segmentationRemoveEmptySegmentsAtom);
	const ignoreListText = useAtomValue(segmentationIgnoreListTextAtom);
	const customRules = useAtomValue(segmentationCustomRulesAtom);
	const learnedRules = useAtomValue(segmentationLearnedRulesAtom);

	const [hyphenator, setHyphenator] = useState<HyphenatorFunc | undefined>();
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		let isMounted = true;
		const fetchHyphenator = async () => {
			const language = getHyphenationLanguage(engine);
			if (!splitEnglish || !language) {
				setHyphenator(undefined);
				return;
			}
			setIsLoading(true);
			const func = await loadHyphenator(language);
			if (isMounted) {
				setHyphenator(() => func || undefined);
				setIsLoading(false);
			}
		};
		fetchHyphenator();
		return () => {
			isMounted = false;
		};
	}, [engine, splitEnglish]);

	const config = useMemo((): SegmentationConfig => {
		const weight = parseFloat(punctuationWeightStr);
		const finalPunctuationWeight = Number.isNaN(weight) ? 0.2 : weight;

		const ignoreList = parseIgnoreList(ignoreListText);

		return {
			engine,
			resplitWords,
			splitCJK,
			splitEnglish,
			punctuationMode,
			punctuationWeight: finalPunctuationWeight,
			removeEmptySegments,
			ignoreList,
			customRules,
			learnedRules,
			hyphenator,
		};
	}, [
		engine,
		resplitWords,
		splitCJK,
		splitEnglish,
		punctuationMode,
		punctuationWeightStr,
		removeEmptySegments,
		ignoreListText,
		customRules,
		learnedRules,
		hyphenator,
	]);

	return {
		config,
		isLoading,
	};
};
