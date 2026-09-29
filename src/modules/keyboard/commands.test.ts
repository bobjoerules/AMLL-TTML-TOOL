import { describe, expect, it } from "vitest";
import { getDefaultStore } from "jotai";
import {
	keyNextTabAtom,
	keyPrevTabAtom,
	keySpotMatchAtom,
	keyTtmlChecklistAtom,
} from "$/states/keybindings";
import {
	cmdNextTab,
	cmdPrevTab,
	cmdSpotMatch,
	cmdTtmlChecklist,
} from "./commands";
import { getCommandById } from "./registry";

describe("SpotMatch keybinding", () => {
	it("registers spotMatch command with Shift+KeyM", () => {
		expect(cmdSpotMatch.id).toBe("spotMatch");
		expect(cmdSpotMatch.defaultKeys).toContain("Shift");
		expect(cmdSpotMatch.defaultKeys).toContain("KeyM");
		expect(cmdSpotMatch.category).toBe("Tools");

		const registered = getCommandById("spotMatch");
		expect(registered).toBeDefined();
		expect(registered?.id).toBe("spotMatch");
	});

	it("keySpotMatchAtom provides default keybinding", () => {
		const store = getDefaultStore();
		const keys = store.get(keySpotMatchAtom);
		expect(keys).toContain("Shift");
		expect(keys).toContain("KeyM");
	});
});

describe("TTML Checklist keybinding", () => {
	it("registers ttmlChecklist command with Shift+KeyC", () => {
		expect(cmdTtmlChecklist.id).toBe("ttmlChecklist");
		expect(cmdTtmlChecklist.defaultKeys).toContain("Shift");
		expect(cmdTtmlChecklist.defaultKeys).toContain("KeyC");
		expect(cmdTtmlChecklist.category).toBe("Tools");

		const registered = getCommandById("ttmlChecklist");
		expect(registered).toBeDefined();
		expect(registered?.id).toBe("ttmlChecklist");
	});

	it("keyTtmlChecklistAtom provides default keybinding", () => {
		const store = getDefaultStore();
		const keys = store.get(keyTtmlChecklistAtom);
		expect(keys).toContain("Shift");
		expect(keys).toContain("KeyC");
	});
});

describe("Mode switch Tab keybindings", () => {
	it("registers nextTab and prevTab commands", () => {
		expect(cmdNextTab.id).toBe("nextTab");
		expect(cmdNextTab.defaultKeys).toEqual(["Tab"]);
		expect(cmdNextTab.category).toBe("View");

		expect(cmdPrevTab.id).toBe("prevTab");
		expect(cmdPrevTab.defaultKeys).toEqual(["Shift", "Tab"]);
		expect(cmdPrevTab.category).toBe("View");

		expect(getCommandById("nextTab")).toBeDefined();
		expect(getCommandById("prevTab")).toBeDefined();
	});

	it("provides default keybinding atoms for Tab switching", () => {
		const store = getDefaultStore();
		expect(store.get(keyNextTabAtom)).toEqual(["Tab"]);
		expect(store.get(keyPrevTabAtom)).toEqual(["Shift", "Tab"]);
	});
});
