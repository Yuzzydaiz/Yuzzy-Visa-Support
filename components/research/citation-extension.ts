import { Node, mergeAttributes } from "@tiptap/core";

export type CitationOptions = {
  // Turns stored reference ids into the reader-facing in-text citation, e.g.
  // "(Smith, 2020)" or "[3]". Ids are internal and never shown as-is.
  formatLabel: (refIds: string[]) => string;
};

export const Citation = Node.create<CitationOptions>({
  name: "citation",
  addOptions() {
    return {
      formatLabel: (refIds) => (refIds.length ? "[citation]" : ""),
    };
  },
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      refIds: {
        default: [],
        parseHTML: (element) =>
          (element.getAttribute("data-ref-ids") ?? "")
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean),
        renderHTML: (attributes) => ({
          "data-ref-ids": (attributes.refIds as string[] | undefined)?.join(",") ?? "",
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-citation]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const ids = (node.attrs.refIds as string[] | undefined) ?? [];
    const label = this.options.formatLabel(ids);
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-citation": "",
        class:
          "citation-node cursor-pointer rounded-sm bg-muted px-1 py-0.5 text-sm font-medium",
      }),
      label,
    ];
  },
});
