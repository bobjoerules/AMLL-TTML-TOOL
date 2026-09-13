import { ErrorCircle16Regular, Info16Regular } from "@fluentui/react-icons";
import {
	Box,
	Button,
	Callout,
	Checkbox,
	Dialog,
	Flex,
	RadioGroup,
	Text,
	TextArea,
	TextField,
	VisuallyHidden,
} from "@radix-ui/themes";
import type { TFunction } from "i18next";
import { atom, useAtom, useAtomValue, useStore } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { memo, useCallback, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import {
	allowConsecutiveBackgroundLinesAtom,
	generateNameFromMetadataAtom,
	hideSubmitAMLLDBWarningAtom,
	lyricTextNormalizationOptionsAtom,
} from "$/modules/settings/states";
import { submitToAMLLDBDialogAtom } from "$/states/dialogs.ts";
import { lyricLinesAtom } from "$/states/main";
import type { TTMLMetadata } from "$/types/ttml";

enum UploadDBType {
	Official = "official",
	User = "user",
	Both = "both",
}

const uploadDbTypeAtom = atomWithStorage("uploadDbType", UploadDBType.Official);
const metadataAtom = atom((get) => get(lyricLinesAtom).metadata);
const issuesAtom = atom((get) => {
	const result: string[] = [];
	const metadatas = get(metadataAtom);

	if (
		metadatas.findIndex((m) => m.key === "musicName" && m.value.length > 0) ===
		-1
	)
		result.push("元数据缺少音乐名称");

	if (
		metadatas.findIndex((m) => m.key === "artists" && m.value.length > 0) === -1
	)
		result.push("元数据缺少音乐作者");

	if (
		metadatas.findIndex((m) => m.key === "album" && m.value.length > 0) === -1
	)
		result.push("元数据缺少音乐专辑名称");

	const platforms = new Set([
		"ncmMusicId",
		"qqMusicId",
		"spotifyId",
		"appleMusicId",
	]);

	if (
		metadatas.findIndex((m) => platforms.has(m.key) && m.value.length > 0) ===
		-1
	)
		result.push("元数据缺少音乐平台对应歌曲 ID");

	return result;
});

const validateMetadata = (
	metadatas: TTMLMetadata[],
	t: TFunction,
): string[] => {
	const result: string[] = [];
	const musicName = metadatas.find((m) => m.key === "musicName");
	if (!musicName?.value?.length) {
		result.push(
			t(
				"submitToAMLLDB.validation.missingMusicName",
				"Metadata missing track name",
			),
		);
	}

	const artists = metadatas.find((m) => m.key === "artists");
	if (!artists?.value?.length) {
		result.push(
			t(
				"submitToAMLLDB.validation.missingArtists",
				"Metadata missing track artists",
			),
		);
	}

	const album = metadatas.find((m) => m.key === "album");
	if (!album?.value?.length) {
		result.push(
			t(
				"submitToAMLLDB.validation.missingAlbum",
				"Metadata missing album name",
			),
		);
	}

	const musicIds = [
		metadatas.find((m) => m.key === "ncmMusicId"),
		metadatas.find((m) => m.key === "qqMusicId"),
		metadatas.find((m) => m.key === "spotifyId"),
		metadatas.find((m) => m.key === "appleMusicId"),
		metadatas.find((m) => m.key === "isrc"),
	];

	if (!musicIds.some((id) => id?.value?.length)) {
		result.push(
			t(
				"submitToAMLLDB.validation.missingMusicId",
				"Metadata missing platform track ID",
			),
		);
	}

	return result;
};

export const SubmitToAMLLDBDialog = memo(() => {
	const { t } = useTranslation();
	const [uploadDbType, setUploadDbType] = useAtom(uploadDbTypeAtom);
	const [dialogOpen, setDialogOpen] = useAtom(submitToAMLLDBDialogAtom);
	const [hideWarning, setHideWarning] = useAtom(hideSubmitAMLLDBWarningAtom);
	const [genNameFromMetadata, setGenNameFromMetadata] = useAtom(
		generateNameFromMetadataAtom,
	);
	const metadatas = useAtomValue(metadataAtom);
	const issues = useAtomValue(issuesAtom);
	const [name, setName] = useState("");
	const [comment, setComment] = useState("");
	const [processing, setProcessing] = useState(false);
	const [submitReason, setSubmitReason] = useState(
		t("submitToAMLLDB.defaultReason", "New lyrics submission"),
	);
	const store = useStore();

	const onSubmit = useCallback(async () => {
		if (processing) return;
		setProcessing(true);
		try {
			const errors = validateMetadata(metadatas, t);
			if (errors.length > 0) {
				toast.error(
					t(
						"submitToAMLLDB.errors.validation",
						"Submission validation failed:\n{errors}",
						{
							errors: errors.join("\n"),
						},
					),
				);
				return;
			}

			if (store.get(lyricLinesAtom).lyricLines.length === 0) {
				toast.error(
					t("submitToAMLLDB.errors.noLyrics", "There's no lyrics content yet?"),
				);
				return;
			}

			const ttmlText = exportTTMLText(
				store.get(lyricLinesAtom),
				store.get(lyricTextNormalizationOptionsAtom),
				{
					allowConsecutiveBackgroundLines: store.get(
						allowConsecutiveBackgroundLinesAtom,
					),
				},
			);
			const ttmlBlob = new Blob([ttmlText], { type: "text/xml" });

			const formData = new FormData();
			formData.append("file", ttmlBlob, "lyrics.ttml");

			const uploadResp = await fetch(
				"https://amll-ttml-db.stevexmh.com/api/upload",
				{
					method: "POST",
					body: formData,
				},
			);

			if (!uploadResp.ok) {
				throw new Error(
					t(
						"submitToAMLLDB.errors.uploadFailed",
						"发送上传歌词文件请求失败：{status} {statusText}",
						{
							status: uploadResp.status,
							statusText: uploadResp.statusText,
						},
					),
				);
			}

			const uploadResult = await uploadResp.json();

			const issueUrl = new URL(
				"https://github.com/amll-dev/amll-ttml-lyrics/issues/new",
			);

			issueUrl.searchParams.append(
				"labels",
				t("submitToAMLLDB.labels.submit", "Lyrics Submit/Correction"),
			);
			issueUrl.searchParams.append(
				"title",
				t("submitToAMLLDB.issueTitle", "[Lyrics Submit/Fix] {name}", { name }),
			);
			issueUrl.searchParams.append(
				"body",
				`${submitReason}

${comment}

<!-- AMLL TTML DB File ID: ${uploadResult.id} -->`,
			);

			open(issueUrl.toString());
			setDialogOpen(false);
		} catch (err) {
			console.error(err);
			toast.error(
				t(
					"submitToAMLLDB.errors.submitFailed",
					"Submission failed, check console for reason!",
				),
			);
		}
		setProcessing(false);
	}, [
		store,
		name,
		submitReason,
		comment,
		setDialogOpen,
		t,
		metadatas,
		processing,
	]);

	useLayoutEffect(() => {
		if (genNameFromMetadata) {
			const name =
				metadatas.find((m) => m.key === "musicName")?.value?.join(", ") ??
				t("submitToAMLLDB.unknownTitle", "Unknown Title");
			const artists =
				metadatas.find((m) => m.key === "artists")?.value?.join(", ") ??
				t("submitToAMLLDB.unknownArtist", "Unknown Artist");
			setName(`${artists} - ${name}`);
		}
	}, [genNameFromMetadata, metadatas, t]);

	return (
		<Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
			<Dialog.Content>
				<VisuallyHidden>
					<Dialog.Description>
						{t(
							"submitToAMLLDB.description",
							"Submit lyrics to AMLL Lyrics Database",
						)}
					</Dialog.Description>
				</VisuallyHidden>
				<Dialog.Title>
					{t(
						"submitToAMLLDB.title",
						"Submit lyrics to AMLL Lyrics Database (Simplified Chinese users only)",
					)}
				</Dialog.Title>
				<Flex direction="column" gap="4">
					{!hideWarning && (
						<>
							<Callout.Root color="orange">
								<Callout.Icon>
									<ErrorCircle16Regular />
								</Callout.Icon>
								<Callout.Text>
									{t(
										"submitToAMLLDB.chineseOnlyWarning",
										"本功能仅使用 AMLL 歌词数据库的简体中文用户可用，如果您是为了在其他软件上使用歌词而编辑歌词的话，请参考对应的软件提交歌词的方式来提交歌词哦！",
									)}
								</Callout.Text>
							</Callout.Root>
							<Callout.Root color="blue">
								<Callout.Icon>
									<Info16Regular />
								</Callout.Icon>
								<Callout.Text>
									<p>
										{t(
											"submitToAMLLDB.thankYou",
											"首先，感谢您的慷慨歌词贡献！",
										)}
										<br />
										{t(
											"submitToAMLLDB.cc0Agreement",
											"By submitting you agree to",
										)}{" "}
										<Text weight="bold" color="orange">
											{t(
												"submitToAMLLDB.cc0Rights",
												"use the CC0 license and fully waive ownership of the lyrics",
											)}
										</Text>
										{t(
											"submitToAMLLDB.andSubmit",
											"and submit to the lyrics database!",
										)}
										<br />
										{t(
											"submitToAMLLDB.futureUse",
											"And the lyrics will be used as default TTML source by AMLL systems in the future!",
										)}
										<br />
										{t(
											"submitToAMLLDB.rightsWarning",
											"If you value retaining ownership, please do NOT submit!",
										)}
										<br />
										{t(
											"submitToAMLLDB.submitInstructions",
											"Enter the following info then jump to the GitHub issue submission page!",
										)}
									</p>
								</Callout.Text>
							</Callout.Root>
							<Button
								variant="soft"
								size="1"
								onClick={() => setHideWarning(true)}
							>
								{t("submitToAMLLDB.closeWarning", "Close warning message")}
							</Button>
						</>
					)}
					<Flex justify="between" gap="4" align="center">
						<Box flexShrink="0">
							<Text as="label" size="2">
								<Flex direction="column" gap="2">
									{t("submitToAMLLDB.uploadDbType", "Lyrics Database Type")}
									<RadioGroup.Root
										value={uploadDbType}
										onValueChange={(v) => setUploadDbType(v as UploadDBType)}
									>
										<RadioGroup.Item value={UploadDBType.Official}>
											{t(
												"submitToAMLLDB.uploadDbTypeOfficial",
												"Official Database",
											)}
										</RadioGroup.Item>
										<RadioGroup.Item value={UploadDBType.User}>
											{t("submitToAMLLDB.uploadDbTypeUser", "User Database")}
										</RadioGroup.Item>
										<RadioGroup.Item value={UploadDBType.Both}>
											{t("submitToAMLLDB.uploadDbTypeBoth", "Both Databases")}
										</RadioGroup.Item>
									</RadioGroup.Root>
								</Flex>
							</Text>
						</Box>

						<Flex direction="column">
							{uploadDbType === UploadDBType.Official && (
								<Callout.Root color="grass">
									<Callout.Text size="1">
										{t(
											"submitToAMLLDB.officialDesc",
											"提交到官方歌词库，需要进行人工审核，确保歌词满足基本要求以及时间轴和效果后方可加入词库。\n此举可以把关你的歌词质量，让你的歌词能以足够好的演出效果呈现，推荐提交到此处。",
										)}
									</Callout.Text>
								</Callout.Root>
							)}
							{uploadDbType === UploadDBType.User && (
								<Callout.Root color="orange">
									<Callout.Text size="1">
										{t(
											"submitToAMLLDB.userDesc",
											"提交到用户歌词库，仅需通过机器人审核没有严重问题后即可加入词库，无需人工审核。\n但是如果出现歌词内容以及呈现效果的问题则只能通过重新提交覆盖，无法进行人工核对保证质量。",
										)}
									</Callout.Text>
								</Callout.Root>
							)}
							{uploadDbType === UploadDBType.Both && (
								<Callout.Root color="orange">
									<Callout.Text size="1">
										{t(
											"submitToAMLLDB.bothDesc",
											"两个都要也不坏，知晓情况即可\n上传后将会分别打开每个仓库对应的提交页面，请手动分别按下创建议题即可提交。",
										)}
									</Callout.Text>
								</Callout.Root>
							)}
						</Flex>
					</Flex>

					<Text as="label" size="2">
						<Flex gap="2">
							<Checkbox
								checked={genNameFromMetadata}
								onCheckedChange={(v) => setGenNameFromMetadata(!!v)}
							/>
							{t("submitToAMLLDB.genFromName", "Generate from metadata")}
						</Flex>
					</Text>
					<Text as="label" size="2">
						<Flex direction="column" gap="2">
							{t("submitToAMLLDB.musicName", "Track Title")}
							<TextField.Root
								value={name}
								disabled={genNameFromMetadata}
								onChange={(e) => setName(e.currentTarget.value)}
							/>
							{t(
								"submitToAMLLDB.musicNameDesc",
								"Recommended format: Artist - Song Title",
							)}
						</Flex>
					</Text>
					<Text as="label" size="2">
						<Flex direction="column" gap="2">
							{t("submitToAMLLDB.submitReason", "Reason")}
							<RadioGroup.Root
								value={submitReason}
								onValueChange={setSubmitReason}
							>
								<RadioGroup.Item value="新歌词提交">
									{t("submitToAMLLDB.submitReasonNew", "New lyrics submission")}
								</RadioGroup.Item>
								<RadioGroup.Item value="修正已有歌词">
									{t("submitToAMLLDB.submitReasonFix", "Fix existing lyrics")}
								</RadioGroup.Item>
							</RadioGroup.Root>
						</Flex>
					</Text>
					<Text as="label" size="2">
						<Flex direction="column" gap="2">
							{t("submitToAMLLDB.comment", "Comment")}
							<TextArea
								resize="vertical"
								placeholder={t(
									"submitToAMLLDB.commentPlaceholder",
									"Anything else you want to add?",
								)}
								value={comment}
								onChange={(e) => setComment(e.currentTarget.value)}
							/>
						</Flex>
					</Text>
					{issues.length > 0 && (
						<Callout.Root color="red">
							<Callout.Icon>
								<ErrorCircle16Regular />
							</Callout.Icon>
							<Callout.Text>
								{t(
									"submitToAMLLDB.issueFoundTitle",
									"Please fix the following issues before submitting:",
								)}
								<ul>
									{issues.map((issue) => (
										<li key={issue}>{issue}</li>
									))}
								</ul>
							</Callout.Text>
						</Callout.Root>
					)}
					<Button
						loading={processing}
						disabled={issues.length > 0}
						onClick={onSubmit}
					>
						{t("submitToAMLLDB.submitBtn", "Upload and Create Issue")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
});
