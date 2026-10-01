import mongoose from "mongoose";

const RETENTION_DAYS = Number.parseInt(process.env.RESEARCH_RETENTION_DAYS ?? "", 10) || 365;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

function argValue(prefix: string): string | undefined {
  const hit = process.argv.find((item) => item.startsWith(prefix));
  return hit?.slice(prefix.length) || undefined;
}

const apply = process.argv.includes("--apply");
const expired = process.argv.includes("--expired");
const publicId = argValue("--publicId=");
const uri = process.env.MONGODB_URI?.trim();

if (!uri || (!publicId && !expired)) {
  console.error(
    "Usage: MONGODB_URI=... pnpm research:delete-paper --publicId=pap_… [--apply]\n       MONGODB_URI=... pnpm research:delete-paper --expired [--apply]",
  );
  process.exit(1);
}

await mongoose.connect(uri);
const db = mongoose.connection.db;
if (!db) {
  throw new Error("Mongo connection has no database");
}

const papers = publicId
  ? await db.collection("paper").find({ publicId }).toArray()
  : await db
      .collection("paper")
      .find({ updatedAt: { $lt: new Date(Date.now() - RETENTION_MS) } })
      .toArray();

const report: Array<{ publicId: string; orderPublicIds: string[] }> = [];
for (const paper of papers) {
  const orders = await db
    .collection("orders")
    .find({ paperId: paper._id })
    .toArray();
  const orderPublicIds = orders.map((order) => String(order.publicId));
  report.push({ publicId: String(paper.publicId), orderPublicIds });
  if (!apply) {
    continue;
  }
  if (orderPublicIds.length) {
    await db
      .collection("webhookevents")
      .deleteMany({ orderPublicId: { $in: orderPublicIds } });
  }
  await db.collection("orders").deleteMany({ paperId: paper._id });
  await db.collection("paper").deleteOne({ _id: paper._id });
}

console.log(
  JSON.stringify(
    {
      apply,
      count: report.length,
      papers: report,
    },
    null,
    2,
  ),
);

if (!apply) {
  console.error("Dry run. Pass --apply to delete.");
}

await mongoose.disconnect();
