import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://jeevanya.maharashtra.gov.in";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/terms", "/facility"],
      disallow: ["/api/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
