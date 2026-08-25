import { Box, Button, Checkbox, Dialog, Flex, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { hideMp3ConversionWarningAtom } from "$/modules/settings/states";
import { mp3ConversionDialogAtom } from "$/states/dialogs";

export const Mp3ConversionDialog = () => {
	const [dialogState, setDialogState] = useAtom(mp3ConversionDialogAtom);
	const [hideWarning, setHideWarning] = useAtom(hideMp3ConversionWarningAtom);
	const { t } = useTranslation();

	const handleConvert = () => {
		dialogState.onConvert();
		setDialogState({ ...dialogState, open: false });
	};

	const handleSkip = () => {
		dialogState.onSkip();
		setDialogState({ ...dialogState, open: false });
	};

	return (
		<Dialog.Root
			open={dialogState.open}
			onOpenChange={(open) => {
				if (!open) {
					handleSkip();
				}
			}}
		>
			<Dialog.Content maxWidth="450px">
				<Dialog.Title>
					{t("dialog.mp3Conversion.title", "Convert MP3 to FLAC?")}
				</Dialog.Title>
				<Text as="p" mb="3">
					{t(
						"dialog.mp3Conversion.description",
						"You are importing an MP3 file: {fileName}",
						{ fileName: dialogState.fileName },
					)}
				</Text>
				<Text as="p" size="2" color="amber" mb="3">
					{t(
						"dialog.mp3Conversion.warning",
						"MP3 files may cause audio desyncing in this app. Converting to FLAC is recommended for better compatibility.",
					)}
				</Text>

				<Box mt="3">
					<Flex align="center" gap="2">
						<Checkbox
							checked={hideWarning}
							onCheckedChange={(checked) => setHideWarning(checked as boolean)}
						/>
						<Text size="2">
							{t(
								"dialog.mp3Conversion.dontShowAgain",
								"Don't show this warning again",
							)}
						</Text>
					</Flex>
				</Box>

				<Flex gap="3" mt="4" justify="end">
					<Button variant="soft" color="gray" onClick={handleSkip}>
						{t("dialog.mp3Conversion.skip", "Use MP3")}
					</Button>
					<Button onClick={handleConvert}>
						{t("dialog.mp3Conversion.convert", "Convert to FLAC")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
