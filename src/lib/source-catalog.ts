export const sourceIds = [
  "hn",
  "github",
  "reddit",
  "stackexchange",
  "gitlab",
  "discourse",
  "rss",
  "csv",
] as const;
export type SourceId = (typeof sourceIds)[number];
export const sourceNames: Record<SourceId, string> = {
  hn: "Hacker News",
  github: "GitHub Issues",
  reddit: "Reddit",
  stackexchange: "Stack Exchange",
  gitlab: "GitLab Issues",
  discourse: "Discourse",
  rss: "RSS / Atom",
  csv: "CSV import",
};
export const sourceFields: Record<Exclude<SourceId, "csv">, string> = {
  hn: "keywords",
  github: "repositories",
  reddit: "subreddits",
  stackexchange: "tags",
  gitlab: "projects",
  discourse: "forums",
  rss: "feeds",
};
export const sourceHints: Record<Exclude<SourceId, "csv">, string> = {
  hn: "Keywords, separated by commas",
  github: "GitHub projects: owner/repository",
  reddit: "Reddit community names without r/",
  stackexchange: "Tags, separated by commas (one tag per search)",
  gitlab: "GitLab.com projects: group/project or group/subgroup/project",
  discourse: "Public Discourse forum base URLs (HTTPS)",
  rss: "Public RSS or Atom feed URLs (HTTPS)",
};
export const sourceDescriptions: Record<SourceId, string> = {
  hn: "Public stories and comments through the Algolia API.",
  github: "Public issues in explicitly configured repositories.",
  reddit:
    "Public posts in configured communities, using authorized Reddit API access.",
  stackexchange:
    "Questions from a selected Stack Exchange site, with author attribution and source links.",
  gitlab: "Public issues in selected GitLab.com projects.",
  discourse: "Public posts from configured Discourse forums.",
  rss: "Published entries from configured RSS and Atom feeds. Feed coverage depends on the publisher.",
  csv: "Administrator imports of authorized data. Imported records enter the same analysis queue.",
};
