import { atomWithStorage } from "jotai/utils";
import type { TTMLChecklistEntry } from "./logic";

export const ttmlChecklistAtom = atomWithStorage<TTMLChecklistEntry[]>(
	"ttmlChecklist",
	[],
);

export const checklistShowUploadedToDbAtom = atomWithStorage<boolean>(
	"checklistShowUploadedToDb",
	false,
);

