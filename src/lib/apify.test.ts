import { describe, expect, it } from "vitest";
import {
  apifyErrorText,
  averageRating,
  g2ReviewsUrl,
  jobItems,
  linkedinCompanyUrl,
  linkedinNews,
  linkedinProfileUrl,
  pickG2Product,
  pickLinkedinCompany,
  postItems,
  reviewItems,
} from "./apify";

describe("LinkedIn links", () => {
  it("normalizes company pages and profiles", () => {
    expect(linkedinCompanyUrl("linkedin.com/company/typeform-?trk=x")).toBe(
      "https://www.linkedin.com/company/typeform-/",
    );
    expect(linkedinCompanyUrl("https://es.linkedin.com/company/acme/posts")).toBe(
      "https://www.linkedin.com/company/acme/",
    );
    expect(linkedinCompanyUrl("https://www.linkedin.com/in/jaychoi/")).toBeNull();
    expect(linkedinCompanyUrl("https://evil.com/company/acme")).toBeNull();
    expect(linkedinProfileUrl("https://www.linkedin.com/in/jaychoi?x=1")).toBe(
      "https://www.linkedin.com/in/jaychoi/",
    );
    expect(
      pickLinkedinCompany([
        { url: "https://acme.com" },
        { url: "https://www.linkedin.com/company/acme" },
      ]),
    ).toBe("https://www.linkedin.com/company/acme/");
  });
});

describe("postItems", () => {
  it("keeps posts with text, newest first, and marks reposts", () => {
    const posts = postItems([
      {
        linkedinUrl: "https://www.linkedin.com/posts/a",
        content: "Viejo",
        postedAt: { date: "2026-08-01T00:00:00Z" },
      },
      {
        linkedinUrl: "https://www.linkedin.com/posts/b",
        content: "Nuevo",
        postedAt: { date: "2026-10-01T00:00:00Z" },
        repostedBy: { name: "X" },
        engagement: { likes: 4 },
      },
      { linkedinUrl: "https://www.linkedin.com/posts/c", content: "" },
    ]);
    expect(posts.map((p) => p.url)).toEqual([
      "https://www.linkedin.com/posts/b",
      "https://www.linkedin.com/posts/a",
    ]);
    expect(posts[0]).toMatchObject({ repost: true, likes: 4 });
  });
});

describe("jobItems", () => {
  const raw = [
    {
      url: "https://www.linkedin.com/jobs/view/1?x",
      title: "Head of Sales",
      companyName: "Typeform",
      companyUrl: "https://www.linkedin.com/company/typeform-?trk=1",
      postedDate: "2026-10-08T00:00:00Z",
    },
    {
      url: "https://www.linkedin.com/jobs/view/2",
      title: "SDR",
      companyName: "Typeform Fans",
      companyUrl: "https://www.linkedin.com/company/other",
    },
    {
      url: "https://www.linkedin.com/jobs/view/3",
      title: "AE",
      companyName: "typeform",
      companyUrl: "https://www.linkedin.com/company/other-typeform",
    },
  ];
  it("keeps only the company's offers: by LinkedIn page when known", () => {
    expect(
      jobItems(raw, "Typeform", "https://www.linkedin.com/company/typeform-/").map((j) => j.title),
    ).toEqual(["Head of Sales"]);
  });
  it("by exact name when the page is unknown", () => {
    expect(jobItems(raw, "Typeform", null).map((j) => j.title)).toEqual(["Head of Sales", "AE"]);
    expect(jobItems(raw, "Typeform", null)[0]!.url).toBe("https://www.linkedin.com/jobs/view/1");
  });
  it("become signal items, reposts left out", () => {
    const items = linkedinNews(
      postItems([
        { linkedinUrl: "https://l/p1", content: "Lanzamos X" },
        { linkedinUrl: "https://l/p2", content: "RT", repostedBy: {} },
      ]),
      jobItems(raw, "Typeform", "https://www.linkedin.com/company/typeform-/"),
    );
    expect(items.map((i) => i.source)).toEqual(["LinkedIn", "LinkedIn Empleo"]);
    expect(items[1]!.title).toBe("Oferta de empleo: Head of Sales");
  });
});

describe("G2", () => {
  it("reads links, picks the product and averages ratings", () => {
    expect(g2ReviewsUrl("https://www.g2.com/products/pipedrive/reviews/123")).toBe(
      "https://www.g2.com/products/pipedrive/reviews",
    );
    expect(g2ReviewsUrl("Pipedrive")).toBeNull();
    expect(
      pickG2Product(
        [
          { name: "Pipedrive Campaigns", slug: "pc" },
          { name: "Pipedrive", slug: "pipedrive" },
        ],
        "pipedrive",
      ),
    ).toEqual({ name: "Pipedrive", url: "https://www.g2.com/products/pipedrive/reviews" });
    expect(pickG2Product([], "x")).toBeNull();
    const reviews = reviewItems([
      { reviewText: "Bien", starRating: "5" },
      { reviewText: "Regular", starRating: 4 },
      { reviewText: "" },
    ]);
    expect(reviews).toHaveLength(2);
    expect(averageRating(reviews)).toBe(4.5);
    expect(averageRating([])).toBeNull();
  });
  it("explains Apify errors in Spanish", () => {
    expect(apifyErrorText(402)).toMatch(/saldo mensual/);
    expect(apifyErrorText(403, "Monthly usage hard limit exceeded")).toMatch(/saldo mensual/);
    expect(apifyErrorText(408)).toMatch(/tardado/);
  });
});
