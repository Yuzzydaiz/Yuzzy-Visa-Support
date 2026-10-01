async function main() {
  const id = process.argv[2];
  const apiKey = process.env.BACHS_API_KEY?.trim();
  const apiBaseUrl = process.env.BACHS_API_BASE_URL?.trim()?.replace(/\/$/, "");

  if (!id || !apiKey || !apiBaseUrl) {
    console.error(
      "Usage: BACHS_API_KEY=... BACHS_API_BASE_URL=... pnpm research:bachs-fetch <transactionId>",
    );
    process.exit(1);
  }

  const response = await fetch(`${apiBaseUrl}/v1/charges/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    console.error(`Bachs transaction fetch failed (${response.status})`);
    process.exit(1);
  }
  console.log(JSON.stringify(await response.json(), null, 2));
}

void main();
