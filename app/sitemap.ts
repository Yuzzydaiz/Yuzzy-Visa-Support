import type { MetadataRoute } from "next";

import { getSiteUrl, isResearchPublic } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: getSiteUrl(),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    ...(isResearchPublic()
      ? [
          {
            url: `${getSiteUrl()}/research`,
            lastModified: new Date(),
            changeFrequency: "monthly" as const,
            priority: 0.7,
          },
        ]
      : []),
  ];
}
