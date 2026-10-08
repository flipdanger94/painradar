// Product taxonomy v1. Labels remain stable in filters, radars and AI output.
export const industries = [
  "Developer tools",
  "Business operations",
  "Marketing",
  "Sales",
  "Customer support",
  "Finance",
  "Healthcare",
  "Education",
  "E-commerce",
  "Human resources",
  "Legal",
  "Real estate",
  "Travel",
  "Logistics",
  "Media",
  "Other / unclear",
] as const;
export const industryAliases: Record<string, (typeof industries)[number]> = {
  devtools: "Developer tools",
  "developer tooling": "Developer tools",
  "software development": "Developer tools",
  "инструменты разработчика": "Developer tools",
  operations: "Business operations",
  productivity: "Business operations",
  "бизнес-процессы": "Business operations",
  маркетинг: "Marketing",
  продажи: "Sales",
  "поддержка клиентов": "Customer support",
  "customer service": "Customer support",
  финансы: "Finance",
  fintech: "Finance",
  здравоохранение: "Healthcare",
  медицина: "Healthcare",
  health: "Healthcare",
  образование: "Education",
  edtech: "Education",
  ecommerce: "E-commerce",
  "электронная коммерция": "E-commerce",
  hr: "Human resources",
  кадры: "Human resources",
  юриспруденция: "Legal",
  недвижимость: "Real estate",
  туризм: "Travel",
  логистика: "Logistics",
  медиа: "Media",
};
export function canonicalIndustry(value: string) {
  const key = value.trim().replace(/\s+/g, " ").toLowerCase();
  return (
    industries.find((label) => label.toLowerCase() === key) ||
    industryAliases[key] ||
    "Other / unclear"
  );
}

export function industryMatches(value: string, filter: string) {
  const canonical = canonicalIndustry(filter);
  return canonical === "Other / unclear" &&
    filter.trim().toLowerCase() !== "other / unclear"
    ? value.trim().toLowerCase() === filter.trim().toLowerCase()
    : canonicalIndustry(value) === canonical;
}
