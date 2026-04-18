import { loadWorkbookData } from "./excelLoader";
import type {
  AdUser,
  MatchedUser,
  RecommendationItem,
  RecommendationRequest,
  RecommendationResult,
  TaxonomyEntry,
  WorkbookData,
} from "../types";

function canonicalTitle(title: string) {
  return title
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.sort()
    .join(" ") ?? "";
}

function similarity(a: string, b: string) {
  const first = canonicalTitle(a).split(" ").filter(Boolean);
  const second = canonicalTitle(b).split(" ").filter(Boolean);
  const secondSet = new Set(second);
  const overlap = first.filter((token) => secondSet.has(token)).length;
  const total = new Set([...first, ...second]).size || 1;
  return Math.round((overlap / total) * 100);
}

function normalizeValue(value: string | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function isMissingValue(value: string | undefined) {
  const normalized = normalizeValue(value);
  return normalized === "" || ["na", "n/a", "none", "nan", "not available"].includes(normalized);
}

function normalizeTitle(title: string, users: AdUser[]) {
  let bestMatch = title;
  let bestScore = 0;

  for (const user of users) {
    const score = similarity(title, user.title);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = user.title;
    }
  }

  return { normalizedTitle: bestMatch, score: bestScore };
}

function parseTitle(title: string) {
  const lowered = title.toLowerCase();

  return {
    role: lowered.includes("director") ? "Operations Director" : lowered.includes("manager") ? "Manager" : "",
    function: lowered.includes("pds") ? "Project & Development Services" : "",
    territory: lowered.includes("australia") ? "Australia" : "",
  };
}

function getTaxonomyKey(title: string, entries: TaxonomyEntry[]) {
  const exact = entries.find((entry) => entry.businessTitle.toLowerCase() === title.toLowerCase());
  if (exact) {
    if (exact.subSubGroup.toLowerCase() !== "not subdivided") {
      return exact.subSubGroup;
    }
    return exact.subgroup;
  }

  const fuzzy = entries
    .map((entry) => ({ entry, score: similarity(title, entry.businessTitle) }))
    .sort((left, right) => right.score - left.score)[0];

  if (!fuzzy || fuzzy.score < 80) {
    return null;
  }

  return fuzzy.entry.subSubGroup.toLowerCase() !== "not subdivided"
    ? fuzzy.entry.subSubGroup
    : fuzzy.entry.subgroup;
}

function derivePersona(title: string, taxonomyEntries: TaxonomyEntry[]) {
  const taxonomyKey = getTaxonomyKey(title, taxonomyEntries);
  if (!taxonomyKey) {
    return "Unknown Persona";
  }

  return taxonomyKey;
}

function getSoftware(users: AdUser[], softwareUsage: Array<{ email: string; software: string }>): RecommendationItem[] {
  const emails = new Set(users.map((user) => user.email));
  const records = softwareUsage.filter((item) => emails.has(item.email));
  const counts = new Map<string, number>();

  for (const record of records) {
    counts.set(record.software, (counts.get(record.software) ?? 0) + 1);
  }

  const totalUsers = Math.max(users.length, 1);

  return [...counts.entries()]
    .map(([name, count]) => {
      const frequency = Math.round((count / totalUsers) * 100);
      return {
        name,
        frequency,
        recommendation: frequency >= 50 ? "Recommended" : "Optional",
      } satisfies RecommendationItem;
    })
    .sort((left, right) => right.frequency - left.frequency);
}

function toMatchedUserRows(users: AdUser[]): MatchedUser[] {
  return users.slice(0, 50).map((user) => ({
    email: user.email,
    title: user.title,
    region: user.region,
    businessCategory: user.businessCategory,
  }));
}

function pickTopSemanticTitles(normalizedTitle: string, users: AdUser[]) {
  const scoredTitles = [...new Set(users.map((user) => user.title))]
    .map((title) => ({
      title,
      score: similarity(normalizedTitle, title),
    }))
    .sort((left, right) => right.score - left.score);

  if (scoredTitles.length === 0) {
    return [];
  }

  const maxScore = scoredTitles[0].score;
  const window = 3;
  const minResults = 2;

  let topTitles = scoredTitles
    .filter((entry) => entry.score >= maxScore - window)
    .map((entry) => entry.title);

  if (topTitles.length < minResults) {
    topTitles = scoredTitles.slice(0, minResults).map((entry) => entry.title);
  }

  return topTitles;
}

export function recommendBundleFromData(
  { adUsers, softwareUsage, taxonomyEntries }: WorkbookData,
  input: RecommendationRequest
): RecommendationResult {
  const exactMatch = adUsers.filter((user) => user.title.toLowerCase() === input.title.toLowerCase());
  if (exactMatch.length > 0) {
    return {
      matchLevel: "3a",
      explanation: "Exact title match",
      persona: derivePersona(input.title, taxonomyEntries),
      matchedUsers: exactMatch.length,
      matchedUserRows: toMatchedUserRows(exactMatch),
      software: getSoftware(exactMatch, softwareUsage),
    };
  }

  const { normalizedTitle, score } = normalizeTitle(input.title, adUsers);
  const sameWords = canonicalTitle(normalizedTitle) === canonicalTitle(input.title);
  if (score > 80 && sameWords) {
    const matchedRow = adUsers.find((user) => user.title === normalizedTitle);

    if (matchedRow) {
      const semanticUsers = adUsers.filter(
        (user) =>
          normalizeValue(user.function) === normalizeValue(matchedRow.function) &&
          normalizeValue(user.businessCategory) === normalizeValue(matchedRow.businessCategory) &&
          normalizeValue(user.region) === normalizeValue(input.region)
      );

      if (semanticUsers.length > 0) {
        const topTitles = pickTopSemanticTitles(normalizedTitle, semanticUsers);
        const preciseUsers = semanticUsers.filter((user) => topTitles.includes(user.title));

        if (preciseUsers.length > 0) {
          return {
            matchLevel: "3b",
            explanation: "Semantic Match (same words, region constrained)",
            persona: derivePersona(normalizedTitle, taxonomyEntries),
            matchedUsers: preciseUsers.length,
            matchedUserRows: toMatchedUserRows(preciseUsers),
            software: getSoftware(preciseUsers, softwareUsage),
          };
        }
      }
    }
  }

  const parsed = parseTitle(input.title);
  const departmentValue = input.department ?? "Not Available";
  if (
    parsed.role &&
    !isMissingValue(parsed.role) &&
    !isMissingValue(departmentValue)
  ) {
    const roleMatches = adUsers.filter(
      (user) =>
        normalizeValue(user.role) === normalizeValue(parsed.role) &&
        normalizeValue(user.department) === normalizeValue(departmentValue)
    );

    if (roleMatches.length > 0) {
      return {
        matchLevel: "3c",
        explanation: "Role + Department Match",
        persona: derivePersona(roleMatches[0].title, taxonomyEntries),
        matchedUsers: roleMatches.length,
        matchedUserRows: toMatchedUserRows(roleMatches),
        software: getSoftware(roleMatches, softwareUsage),
      };
    }
  }

  const taxonomyKey = getTaxonomyKey(input.title, taxonomyEntries);
  if (taxonomyKey) {
    const taxonomyMatches = adUsers.filter(
      (user) => getTaxonomyKey(user.title, taxonomyEntries) === taxonomyKey
    );
    if (taxonomyMatches.length > 0) {
      return {
        matchLevel: "3d",
        explanation: `Taxonomy fallback match (${taxonomyKey})`,
        persona: taxonomyKey,
        matchedUsers: taxonomyMatches.length,
        matchedUserRows: toMatchedUserRows(taxonomyMatches),
        software: getSoftware(taxonomyMatches, softwareUsage),
      };
    }
  }

  const semanticFallback = adUsers
    .map((user) => ({ user, score: similarity(input.title, user.title) }))
    .sort((left, right) => right.score - left.score)[0];

  if (semanticFallback && semanticFallback.score > 80) {
    return {
      matchLevel: "semantic",
      explanation: "Semantic Fallback (last resort)",
      persona: derivePersona(semanticFallback.user.title, taxonomyEntries),
      matchedUsers: 1,
      matchedUserRows: toMatchedUserRows([semanticFallback.user]),
      software: getSoftware([semanticFallback.user], softwareUsage),
    };
  }

  return {
    matchLevel: "none",
    explanation: "No cohort match found in the current fixture set",
    persona: "Unknown Persona",
    matchedUsers: 0,
    matchedUserRows: [],
    software: [],
  };
}

export function recommendBundle(input: RecommendationRequest): RecommendationResult {
  return recommendBundleFromData(loadWorkbookData(), input);
}
