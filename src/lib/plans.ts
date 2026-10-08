export const plans = {
  free: {
    name: "Free",
    price: 0,
    radars: 1,
    history: 7,
    opens: 5,
    features: [
      "5 opportunities per day",
      "1 custom radar",
      "7-day history",
      "Original evidence links",
    ],
  },
  pro: {
    name: "Pro",
    price: 29,
    radars: 10,
    history: 90,
    opens: Infinity,
    features: [
      "Unlimited opportunities",
      "10 custom radars",
      "90-day history",
      "CSV exports & email alerts",
    ],
  },
  founder: {
    name: "Founder",
    price: 79,
    radars: 10000,
    history: 365,
    opens: Infinity,
    features: [
      "Unlimited radars",
      "Competitor evidence research",
      "AI MVP generator",
      "API access & reports",
    ],
  },
  agency: {
    name: "Agency",
    price: 199,
    radars: 10000,
    history: 365,
    opens: Infinity,
    features: [
      "1 team, up to 50 members & 100 clients",
      "Shared watchlists & 100 radars per client",
      "White-label reports & scoped API keys",
      "Signed webhooks with delivery retries",
    ],
  },
} as const;
export type Plan = keyof typeof plans;
