import { CITE_TOKEN, parseCiteIds } from "@/lib/research/citations/tokens";

export type TiptapMark = { type: string; attrs?: Record<string, unknown> };

export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
};

export type TiptapDoc = {
  type: "doc";
  content: TiptapNode[];
};

const SUPPORTED_NODES = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "citation",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
]);

const SUPPORTED_MARKS = new Set(["bold", "italic", "strike", "code"]);
const MAX_NODES = 4_000;
const MAX_TEXT_CHARS = 200_000;

export type EditorSectionInput = {
  sectionId: string;
  title: string;
  paragraphs?: Array<{ text: string }>;
  plainText?: string;
};

export function inlineNodesFromTokenText(text: string): TiptapNode[] {
  const nodes: TiptapNode[] = [];
  const pattern = new RegExp(CITE_TOKEN.source, "g");
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > last) {
      nodes.push({ type: "text", text: text.slice(last, match.index) });
    }
    nodes.push({
      type: "citation",
      attrs: { refIds: parseCiteIds(match[1] ?? "") },
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    nodes.push({ type: "text", text: text.slice(last) });
  }
  return nodes.length ? nodes : [{ type: "text", text: "" }];
}

export function tokenTextFromInline(nodes: TiptapNode[] | undefined): string {
  if (!nodes?.length) {
    return "";
  }
  return nodes
    .map((node) => {
      if (node.type === "text") {
        return node.text ?? "";
      }
      if (node.type === "citation") {
        const ids = (node.attrs?.refIds as string[] | undefined) ?? [];
        return `[CITE:${ids.join(";")}]`;
      }
      if (node.content) {
        return tokenTextFromInline(node.content);
      }
      return "";
    })
    .join("");
}

function plainTextFromNode(node: TiptapNode): string {
  if (node.type === "text") {
    return node.text ?? "";
  }
  if (node.type === "citation") {
    const ids = (node.attrs?.refIds as string[] | undefined) ?? [];
    return `[CITE:${ids.join(";")}]`;
  }
  if (node.type === "hardBreak") {
    return "\n";
  }
  return (node.content ?? []).map(plainTextFromNode).join("");
}

function paragraphsFromBlock(node: TiptapNode): string[] {
  if (node.type === "paragraph") {
    const text = plainTextFromNode(node).trim();
    return text ? [text] : [];
  }
  if (node.type === "codeBlock") {
    const text = plainTextFromNode(node).trim();
    return text ? [text] : [];
  }
  if (node.type === "blockquote") {
    return (node.content ?? [])
      .flatMap(paragraphsFromBlock)
      .map((line) => `> ${line}`);
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    let index = 1;
    return (node.content ?? []).flatMap((child) => {
      const marker = node.type === "orderedList" ? `${index++}. ` : "- ";
      const lines = paragraphsFromBlock(child);
      return lines.map((line, lineIndex) =>
        lineIndex === 0 ? `${marker}${line}` : `  ${line}`,
      );
    });
  }
  if (node.type === "listItem") {
    return (node.content ?? []).flatMap(paragraphsFromBlock);
  }
  return [];
}

export function sectionsToTiptapDoc(sections: EditorSectionInput[]): TiptapDoc {
  const content: TiptapNode[] = [];
  for (const section of sections) {
    content.push({
      type: "heading",
      attrs: { level: 2, sectionId: section.sectionId },
      content: [{ type: "text", text: section.title }],
    });
    const paragraphs =
      section.paragraphs?.map((paragraph) => paragraph.text) ??
      (section.plainText ? section.plainText.split(/\n+/) : [""]);
    for (const paragraph of paragraphs) {
      content.push({
        type: "paragraph",
        content: inlineNodesFromTokenText(paragraph),
      });
    }
  }
  return { type: "doc", content };
}

export function replaceSectionInTiptapDoc(
  doc: TiptapDoc,
  sectionId: string,
  paragraphs: string[],
): TiptapDoc {
  const nodes = doc.content ?? [];
  const next: TiptapNode[] = [];
  let replaced = false;
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    next.push(node);
    if (node.type !== "heading" || node.attrs?.sectionId !== sectionId) {
      continue;
    }
    let cursor = index + 1;
    while (cursor < nodes.length && nodes[cursor].type !== "heading") {
      cursor += 1;
    }
    for (const text of paragraphs) {
      next.push({
        type: "paragraph",
        content: inlineNodesFromTokenText(text),
      });
    }
    index = cursor - 1;
    replaced = true;
  }
  return replaced ? { type: "doc", content: next } : doc;
}

export function tiptapDocToSections(
  doc: TiptapDoc,
  fallback: EditorSectionInput[],
): Array<{ sectionId: string; title: string; paragraphs: Array<{ text: string }> }> {
  const result: Array<{
    sectionId: string;
    title: string;
    paragraphs: Array<{ text: string }>;
  }> = [];
  let current: (typeof result)[number] | undefined;
  let fallbackIndex = 0;
  for (const node of doc.content ?? []) {
    if (node.type === "heading") {
      const title = tokenTextFromInline(node.content) || "Section";
      const sectionId =
        (node.attrs?.sectionId as string | undefined) ||
        fallback[fallbackIndex]?.sectionId ||
        `section_${fallbackIndex}`;
      fallbackIndex += 1;
      current = { sectionId, title, paragraphs: [] };
      result.push(current);
      continue;
    }
    if (!current) {
      const first = fallback[0];
      current = {
        sectionId: first?.sectionId ?? "section_0",
        title: first?.title ?? "Section",
        paragraphs: [],
      };
      result.push(current);
    }
    if (node.type !== "heading") {
      for (const text of paragraphsFromBlock(node)) {
        current.paragraphs.push({ text });
      }
    }
  }
  return result.map((section) => ({
    ...section,
    paragraphs: section.paragraphs.length
      ? section.paragraphs
      : [{ text: section.title }],
  }));
}

export function validateTiptapDoc(
  doc: TiptapDoc,
  allowedCitationIds: Set<string>,
): { ok: true } | { ok: false; message: string } {
  let nodeCount = 0;
  let textChars = 0;
  function walk(node: TiptapNode): string | undefined {
    nodeCount += 1;
    if (nodeCount > MAX_NODES) {
      return "Editor document is too large.";
    }
    if (!SUPPORTED_NODES.has(node.type)) {
      return `Unsupported editor content: ${node.type}.`;
    }
    for (const mark of node.marks ?? []) {
      if (!SUPPORTED_MARKS.has(mark.type)) {
        return `Unsupported text formatting: ${mark.type}.`;
      }
    }
    if (node.type === "text") {
      textChars += node.text?.length ?? 0;
      if (textChars > MAX_TEXT_CHARS) {
        return "Editor document is too large.";
      }
    }
    if (node.type === "heading" && node.attrs?.level !== 2) {
      return "Only section headings are supported.";
    }
    if (node.type === "citation") {
      const refIds = node.attrs?.refIds;
      if (!Array.isArray(refIds) || refIds.length === 0) {
        return "Citation nodes must include at least one reference id.";
      }
      for (const id of refIds) {
        if (typeof id !== "string" || !allowedCitationIds.has(id)) {
          return "Citations in the editor must use allowed reference ids.";
        }
      }
    }
    for (const child of node.content ?? []) {
      const error = walk(child);
      if (error) {
        return error;
      }
    }
    return undefined;
  }
  const error = walk(doc);
  return error ? { ok: false, message: error } : { ok: true };
}

export function collectDocCiteIds(doc: TiptapDoc): string[] {
  const ids = new Set<string>();
  function walk(nodes: TiptapNode[] | undefined) {
    for (const node of nodes ?? []) {
      if (node.type === "citation") {
        for (const id of (node.attrs?.refIds as string[] | undefined) ?? []) {
          ids.add(id);
        }
      }
      walk(node.content);
    }
  }
  walk(doc.content);
  return [...ids];
}
