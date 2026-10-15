"use client";

import Heading from "@tiptap/extension-heading";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { NodeSelection } from "@tiptap/pm/state";
import { useRef } from "react";

import { Citation } from "@/components/research/citation-extension";
import type { TiptapDoc } from "@/lib/research/editor/document";

const headingWithSection = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      sectionId: { default: null },
    };
  },
}).configure({ levels: [2] });

export function ResearchEditor({
  doc,
  onChange,
  onSelectCitation,
  formatCitation,
}: {
  doc: TiptapDoc;
  onChange: (doc: TiptapDoc) => void;
  onSelectCitation: (refIds: string[]) => void;
  formatCitation: (refIds: string[]) => string;
}) {
  const skip = useRef(true);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false }),
      headingWithSection,
      Citation.configure({ formatLabel: formatCitation }),
    ],
    content: doc,
    editorProps: {
      attributes: {
        class: "min-h-[24rem] max-w-none text-sm leading-7 outline-none",
      },
    },
    onCreate: () => {
      skip.current = false;
    },
    onUpdate: ({ editor: instance }) => {
      if (skip.current) {
        return;
      }
      onChange(instance.getJSON() as TiptapDoc);
    },
    onSelectionUpdate: ({ editor: instance }) => {
      const selection = instance.state.selection;
      if (
        selection instanceof NodeSelection &&
        selection.node.type.name === "citation"
      ) {
        onSelectCitation((selection.node.attrs.refIds as string[]) ?? []);
        return;
      }
      const $from = selection.$from;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const node = $from.node(depth);
        if (node.type.name === "citation") {
          onSelectCitation((node.attrs.refIds as string[]) ?? []);
          return;
        }
      }
    },
  });

  if (!editor) {
    return <p className="text-sm text-muted-foreground">Loading editor…</p>;
  }

  return <EditorContent editor={editor} />;
}
