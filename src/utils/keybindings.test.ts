import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock window and document before importing
class MockElement {
	tagName = "DIV";
	isContentEditable = false;
}

const listeners = new Map<string, Set<Function>>();
(globalThis as any).window = {
	addEventListener: (type: string, cb: Function) => {
		if (!listeners.has(type)) listeners.set(type, new Set());
		listeners.get(type)!.add(cb);
	},
	removeEventListener: (type: string, cb: Function) => {
		listeners.get(type)?.delete(cb);
	},
	dispatchEvent: (evt: any) => {
		const set = listeners.get(evt.type);
		if (set) {
			for (const cb of set) cb(evt);
		}
	},
};
class MockKeyboardEvent {
	type: string;
	code: string;
	metaKey: boolean;
	ctrlKey: boolean;
	altKey: boolean;
	shiftKey: boolean;
	target: any;
	srcElement: any;
	timeStamp = Date.now();
	preventDefault = vi.fn();
	stopPropagation = vi.fn();
	stopImmediatePropagation = vi.fn();
	constructor(type: string, init?: any) {
		this.type = type;
		this.code = init?.code || "";
		this.metaKey = !!init?.metaKey;
		this.ctrlKey = !!init?.ctrlKey;
		this.altKey = !!init?.altKey;
		this.shiftKey = !!init?.shiftKey;
		this.target = (globalThis as any).document.body;
		this.srcElement = this.target;
	}
}
(globalThis as any).document = {
	body: new MockElement(),
	activeElement: new MockElement(),
};
(globalThis as any).KeyboardEvent = MockKeyboardEvent;

Object.defineProperty(globalThis.navigator, "userAgent", {
	value: "Macintosh",
	configurable: true,
});

const { registerKeyBindings } = await import("./keybindings");

describe("keybindings system", () => {
	it("triggers space keybinding", () => {
		const cb = vi.fn();
		const unreg = registerKeyBindings(["Space"], cb);

		window.dispatchEvent(
			new KeyboardEvent("keydown", { code: "Space", bubbles: true }),
		);
		expect(cb).toHaveBeenCalledTimes(1);

		window.dispatchEvent(
			new KeyboardEvent("keyup", { code: "Space", bubbles: true }),
		);
		unreg();
	});

	it("triggers Meta+KeyZ keybinding", () => {
		const cb = vi.fn();
		const unreg = registerKeyBindings(["Meta", "KeyZ"], cb);

		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				code: "MetaLeft",
				metaKey: true,
				bubbles: true,
			}),
		);
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				code: "KeyZ",
				metaKey: true,
				bubbles: true,
			}),
		);
		expect(cb).toHaveBeenCalledTimes(1);

		window.dispatchEvent(
			new KeyboardEvent("keyup", {
				code: "KeyZ",
				metaKey: true,
				bubbles: true,
			}),
		);
		window.dispatchEvent(
			new KeyboardEvent("keyup", {
				code: "MetaLeft",
				metaKey: false,
				bubbles: true,
			}),
		);
		unreg();
	});

	it("what happens if Meta keyup was missed?", () => {
		const cbUndo = vi.fn();
		const cbSpace = vi.fn();
		registerKeyBindings(["Meta", "KeyZ"], cbUndo);
		registerKeyBindings(["Space"], cbSpace);

		// Press Cmd+Z
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				code: "MetaLeft",
				metaKey: true,
				bubbles: true,
			}),
		);
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				code: "KeyZ",
				metaKey: true,
				bubbles: true,
			}),
		);
		expect(cbUndo).toHaveBeenCalledTimes(1);

		// KeyUp for Z, but Meta keyup was missed! (Typical in Mac/WebKit)
		window.dispatchEvent(
			new KeyboardEvent("keyup", {
				code: "KeyZ",
				metaKey: true,
				bubbles: true,
			}),
		);

		// Now user presses Space, metaKey is false in the event!
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				code: "Space",
				metaKey: false,
				bubbles: true,
			}),
		);
		console.log("cbSpace called:", cbSpace.mock.calls.length);
		// If pressingKeys kept Meta, cbSpace will NOT be called!
	});
});
