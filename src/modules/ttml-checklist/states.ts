import { atomWithStorage } from "jotai/utils";
import type { ChecklistTombstones, TTMLChecklistEntry } from "./logic";

export const ttmlChecklistAtom = atomWithStorage<TTMLChecklistEntry[]>(
	"ttmlChecklist",
	[],
);

export const checklistShowUploadedToDbAtom = atomWithStorage<boolean>(
	"checklistShowUploadedToDb",
	false,
);

export const checklistDeletedTombstonesAtom =
	atomWithStorage<ChecklistTombstones>("checklistDeletedTombstones", {
		ids: [],
		cloudDocIds: [],
		songKeys: [],
	});
