import type { AdUser, SoftwareUsage, TaxonomyEntry } from "../types";

export const adUsers: AdUser[] = [
  {
    email: "fm01@company.test",
    title: "Facilities Manager",
    role: "Manager",
    function: "Facilities Management",
    businessCategory: "Work Dynamics",
    region: "APAC",
    account: "Corporate",
    department: "Facilities Management",
  },
  {
    email: "fm02@company.test",
    title: "Facilities Manager",
    role: "Manager",
    function: "Facilities Management",
    businessCategory: "Work Dynamics",
    region: "APAC",
    account: "Corporate",
    department: "Facilities Management",
  },
  {
    email: "pm01@company.test",
    title: "Senior Project Manager",
    role: "Manager",
    function: "Project Management",
    businessCategory: "Project Services",
    region: "APAC",
    account: "Corporate",
    department: "Project Management",
  },
  {
    email: "fa01@company.test",
    title: "Financial Analyst",
    role: "Analyst",
    function: "Finance",
    businessCategory: "Corporate",
    region: "EMEA",
    account: "Corporate",
    department: "Finance",
  },
  {
    email: "sa01@company.test",
    title: "Solutions Architect",
    role: "Architect",
    function: "Technology",
    businessCategory: "Corporate",
    region: "AMER",
    account: "Corporate",
    department: "IT",
  },
];

export const softwareUsage: SoftwareUsage[] = [
  { email: "fm01@company.test", software: "Microsoft Office 365" },
  { email: "fm01@company.test", software: "Slack" },
  { email: "fm01@company.test", software: "Zoom Workplace" },
  { email: "fm01@company.test", software: "Adobe Acrobat Pro DC" },
  { email: "fm02@company.test", software: "Microsoft Office 365" },
  { email: "fm02@company.test", software: "Slack" },
  { email: "fm02@company.test", software: "Zoom Workplace" },
  { email: "fm02@company.test", software: "AutoCAD" },
  { email: "pm01@company.test", software: "Microsoft Project" },
  { email: "pm01@company.test", software: "Microsoft Visio" },
  { email: "pm01@company.test", software: "Slack" },
  { email: "fa01@company.test", software: "Adobe Acrobat Pro DC" },
  { email: "fa01@company.test", software: "Tableau Desktop" },
  { email: "sa01@company.test", software: "Visual Studio Code" },
  { email: "sa01@company.test", software: "Slack" },
];

export const taxonomyEntries: TaxonomyEntry[] = [
  {
    businessTitle: "Facilities Manager",
    subgroup: "Facility Ops",
    subSubGroup: "Facilities Manager",
    consolidatedGroup: "Facilities Operations",
    tier: "Tier 1 - Core Operations",
  },
  {
    businessTitle: "Senior Project Manager",
    subgroup: "Project Delivery",
    subSubGroup: "Not Subdivided",
    consolidatedGroup: "Project Management",
    tier: "Tier 1 - Core Operations",
  },
  {
    businessTitle: "Financial Analyst",
    subgroup: "Financial Planning",
    subSubGroup: "Not Subdivided",
    consolidatedGroup: "Finance",
    tier: "Tier 2 - Corporate",
  },
  {
    businessTitle: "Solutions Architect",
    subgroup: "Architecture",
    subSubGroup: "Solutions Architect",
    consolidatedGroup: "Technology",
    tier: "Tier 2 - Corporate",
  },
];

