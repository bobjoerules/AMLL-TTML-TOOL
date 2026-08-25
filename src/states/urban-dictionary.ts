import { atom } from "jotai";

export interface UrbanDictionaryDialogState {
	open: boolean;
	word: string;
}

export const urbanDictionaryDialogAtom = atom<UrbanDictionaryDialogState>({
	open: false,
	word: "",
});
