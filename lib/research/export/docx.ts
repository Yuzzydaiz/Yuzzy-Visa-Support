import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";

import type { NormalizedExport } from "@/lib/research/export/model";

export async function buildDocx(model: NormalizedExport): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: model.title, bold: true })],
    }),
    new Paragraph({
      children: [
        new TextRun(
          model.authors
            .map((author) =>
              author.affiliation
                ? `${author.name} (${author.affiliation})`
                : author.name,
            )
            .join("; "),
        ),
      ],
    }),
  ];
  if (model.keywords.length) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `Keywords: ${model.keywords.join("; ")}` })],
      }),
    );
  }
  for (const section of model.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun(section.title)],
      }),
    );
    for (const paragraph of section.paragraphs) {
      children.push(new Paragraph({ children: [new TextRun(paragraph)] }));
    }
  }
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun("References")],
    }),
  );
  for (const line of model.bibliography) {
    children.push(
      new Paragraph({
        indent: { left: 720, hanging: 360 },
        spacing: { after: 120 },
        children: [new TextRun(line)],
      }),
    );
  }

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: model.title, italics: true, size: 18 })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: [PageNumber.CURRENT] })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  const blob = await Packer.toBuffer(document);
  return Buffer.from(blob);
}
