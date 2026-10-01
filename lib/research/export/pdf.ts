import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { NormalizedExport } from "@/lib/research/export/model";

function winAnsiSafe(text: string): string {
  return [...text]
    .map((char) => (char.charCodeAt(0) <= 255 ? char : "?"))
    .join("");
}

function wrap(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, maxWidth: number): string[] {
  const words = winAnsiSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.length ? lines : [""];
}

export async function buildPdf(model: NormalizedExport): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 72;
  const maxWidth = pageSize[0] - margin * 2;
  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - margin;
  let pageIndex = 1;

  function addPage() {
    page.drawText(String(pageIndex), {
      x: pageSize[0] / 2 - 6,
      y: 36,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    page = pdf.addPage(pageSize);
    pageIndex += 1;
    y = pageSize[1] - margin;
  }

  function ensure(space: number) {
    if (y - space < margin) {
      addPage();
    }
  }

  function write(text: string, size: number, useBold = false) {
    const face = useBold ? bold : font;
    for (const line of wrap(text, face, size, maxWidth)) {
      ensure(size + 6);
      page.drawText(line, { x: margin, y, size, font: face, color: rgb(0, 0, 0) });
      y -= size + 6;
    }
  }

  write(model.title, 18, true);
  y -= 8;
  write(
    model.authors
      .map((author) =>
        author.affiliation ? `${author.name}, ${author.affiliation}` : author.name,
      )
      .join("; ") || " ",
    11,
  );
  y -= 10;
  for (const section of model.sections) {
    y -= 8;
    write(section.title, 14, true);
    for (const paragraph of section.paragraphs) {
      y -= 4;
      write(paragraph, 11);
    }
  }
  y -= 10;
  write("References", 14, true);
  for (const line of model.bibliography) {
    write(line, 10);
    y -= 4;
  }
  page.drawText(String(pageIndex), {
    x: pageSize[0] / 2 - 6,
    y: 36,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
