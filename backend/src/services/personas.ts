import { loadWorkbookData } from "./excelLoader";
import type { PersonaRecord, PersonaSummary, TaxonomyEntry, WorkbookData } from "../types";

const BASE_SOFTWARE = [
  "Windows 11 Enterprise",
  "Microsoft Edge",
  "Microsoft Defender",
];

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

function findTaxonomyEntry(title: string, entries: TaxonomyEntry[]) {
  const exact = entries.find(
    (entry) => entry.businessTitle.toLowerCase() === title.toLowerCase()
  );

  if (exact) {
    return exact;
  }

  const best = entries
    .map((entry) => ({ entry, score: similarity(title, entry.businessTitle) }))
    .sort((left, right) => right.score - left.score)[0];

  if (!best || best.score < 80) {
    return null;
  }

  return best.entry;
}

function derivePersonaName(entry: TaxonomyEntry | null) {
  if (!entry) {
    return "Unknown Persona";
  }

  if (entry.subSubGroup && entry.subSubGroup.toLowerCase() !== "not subdivided") {
    return entry.subSubGroup;
  }

  if (entry.subgroup) {
    return entry.subgroup;
  }

  if (entry.consolidatedGroup) {
    return entry.consolidatedGroup;
  }

  if (entry.tier) {
    return entry.tier;
  }

  return "Unknown Persona";
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";
}

function getConfidence(userCount: number): "High" | "Medium" | "Low" {
  if (userCount >= 20) {
    return "High";
  }
  if (userCount >= 5) {
    return "Medium";
  }
  return "Low";
}

function buildBundle(emailSet: Set<string>, softwareUsage: Array<{ email: string; software: string }>) {
  const counts = new Map<string, number>();

  for (const item of softwareUsage) {
    if (!emailSet.has(item.email) || !item.software) {
      continue;
    }

    counts.set(item.software, (counts.get(item.software) ?? 0) + 1);
  }

  const totalUsers = Math.max(emailSet.size, 1);
  const ranked = [...counts.entries()]
    .map(([name, count]) => ({
      name,
      frequency: count / totalUsers,
    }))
    .sort((left, right) => right.frequency - left.frequency);

  const standard = ranked
    .filter((item) => item.frequency >= 0.8)
    .slice(0, 8)
    .map((item) => item.name);
  const recommended = ranked
    .filter((item) => item.frequency >= 0.5 && item.frequency < 0.8)
    .slice(0, 8)
    .map((item) => item.name);
  const optional = ranked
    .filter((item) => item.frequency >= 0.2 && item.frequency < 0.5)
    .slice(0, 10)
    .map((item) => item.name);

  return {
    base: BASE_SOFTWARE,
    standard,
    recommended,
    optional,
  };
}

export function buildPersonaSummary({ adUsers, softwareUsage, taxonomyEntries }: WorkbookData): PersonaSummary {
  const groups = new Map<
    string,
    {
      users: typeof adUsers;
      taxonomyEntry: TaxonomyEntry | null;
    }
  >();

  for (const user of adUsers) {
    const taxonomyEntry = findTaxonomyEntry(user.title, taxonomyEntries);
    const personaName = derivePersonaName(taxonomyEntry);

    if (!groups.has(personaName)) {
      groups.set(personaName, {
        users: [],
        taxonomyEntry,
      });
    }

    groups.get(personaName)?.users.push(user);
  }

  const personas = [...groups.entries()]
    .map(([personaName, group], index) => {
      const emailSet = new Set(group.users.map((user) => user.email));
      const confidence = getConfidence(group.users.length);
      const taxonomyEntry = group.taxonomyEntry;

      return {
        id: `P${String(index + 1).padStart(3, "0")}`,
        department: mostCommon(group.users.map((user) => user.department || user.businessCategory)),
        title: mostCommon(group.users.map((user) => user.title)),
        standardTitle: personaName,
        role: mostCommon(group.users.map((user) => user.role || user.function)),
        subgroup: taxonomyEntry?.subgroup ?? "",
        family: taxonomyEntry?.consolidatedGroup ?? "",
        users: group.users.length,
        confidence,
        bundleStatus: confidence === "Low" ? "Unvalidated" : "Validated",
        modifiedAt: "Live workbook data",
        bundle: buildBundle(emailSet, softwareUsage),
      } satisfies PersonaRecord;
    })
    .filter((persona) => persona.standardTitle && persona.standardTitle !== "Unknown Persona")
    .sort((left, right) => right.users - left.users);

  return {
    totalPersonas: personas.length,
    validated: personas.filter((persona) => persona.bundleStatus === "Validated").length,
    lowConfidence: personas.filter((persona) => persona.confidence === "Low").length,
    personas,
  };
}

export function getPersonaSummary(): PersonaSummary {
  return buildPersonaSummary(loadWorkbookData());
}
