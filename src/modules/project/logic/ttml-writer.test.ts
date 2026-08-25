import { beforeAll, describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord } from "../../../types/ttml";
import exportTTMLText, { shouldExportAsLineSynced } from "./ttml-writer";

class MockNode {
	static TEXT_NODE = 3;
	static ELEMENT_NODE = 1;
	childNodes: (MockNode | MockText)[] = [];
	appendChild(child: MockNode | MockText) {
		this.childNodes.push(child);
		return child;
	}
}

class MockText extends MockNode {
	nodeType = 3;
	constructor(public nodeValue: string) {
		super();
	}
}

class MockElement extends MockNode {
	nodeType = 1;
	attributes: Record<string, string> = {};
	constructor(public tagName: string, public namespaceURI: string | null = null) {
		super();
	}
	setAttribute(name: string, value: string) {
		this.attributes[name] = value;
	}
	getAttribute(name: string) {
		return this.attributes[name] ?? null;
	}
	get firstChild() {
		return this.childNodes[0] ?? null;
	}
	hasChildNodes() {
		return this.childNodes.length > 0;
	}
}

class MockDocument {
	documentElement: MockElement | null = null;
	createElementNS(ns: string, tagName: string) {
		return new MockElement(tagName, ns);
	}
	createTextNode(text: string) {
		return new MockText(text);
	}
	appendChild(child: MockElement) {
		this.documentElement = child;
		return child;
	}
}

class MockXMLSerializer {
	serializeToString(doc: MockDocument): string {
		function serializeNode(node: MockNode | MockText, parentNs: string | null = null): string {
			if (node instanceof MockText) {
				return node.nodeValue;
			}
			const el = node as MockElement;
			let attrs = Object.entries(el.attributes)
				.map(([k, v]) => ` ${k}="${v}"`)
				.join("");
			if (parentNs && el.namespaceURI === null && !el.attributes.xmlns) {
				attrs += ' xmlns=""';
			}
			const children = el.childNodes.map((c) => serializeNode(c, el.namespaceURI || parentNs)).join("");
			return `<${el.tagName}${attrs}>${children}</${el.tagName}>`;
		}
		return serializeNode(doc.documentElement!);
	}
}

beforeAll(() => {
	if (typeof globalThis.document === "undefined") {
		const docImpl = {
			createDocument(ns: string, qualifiedName: string) {
				const doc = new MockDocument();
				const root = new MockElement(qualifiedName, ns);
				doc.documentElement = root;
				return doc;
			},
		};
		(globalThis as any).document = {
			implementation: docImpl,
		};
		(globalThis as any).Node = MockNode;
		(globalThis as any).XMLSerializer = MockXMLSerializer;
	}
});

describe("shouldExportAsLineSynced", () => {
	it("keeps a genuine whole-line lyric line-synced", () => {
		const line = newLyricLine();
		line.isLineSynced = true;
		line.words = [{ ...newLyricWord(), word: "Whole line" }];

		expect(shouldExportAsLineSynced(line)).toBe(true);
	});

	it("preserves word timing when a stale line-synced flag has multiple words", () => {
		const line = newLyricLine();
		line.isLineSynced = true;
		line.words = [
			{ ...newLyricWord(), word: "Timed", startTime: 100, endTime: 400 },
			{ ...newLyricWord(), word: " ", startTime: 0, endTime: 0 },
			{ ...newLyricWord(), word: "words", startTime: 400, endTime: 800 },
		];

		expect(shouldExportAsLineSynced(line)).toBe(false);
	});
});

describe("exportTTMLText", () => {
	it("never generates xmlns=\"\" on child elements", () => {
		const line1 = newLyricLine();
		line1.startTime = 1000;
		line1.endTime = 3000;
		line1.words = [
			{ ...newLyricWord(), word: "Hello", startTime: 1000, endTime: 2000 },
			{ ...newLyricWord(), word: " ", startTime: 0, endTime: 0 },
			{ ...newLyricWord(), word: "world", startTime: 2000, endTime: 3000 },
		];
		const ttml = {
			metadata: [
				{ key: "title", value: ["Test Song"] },
				{ key: "songwriter", value: ["Test Writer"] },
			],
			lyricLines: [line1],
		};

		const xml = exportTTMLText(ttml);
		expect(xml).not.toContain('xmlns=""');
		expect(xml).toContain('<tt xmlns="http://www.w3.org/ns/ttml"');
		expect(xml).toContain("<head>");
		expect(xml).toContain("<body");
		expect(xml).toContain("<div");
		expect(xml).toContain("<p");
		expect(xml).toContain("<span");
	});
});
