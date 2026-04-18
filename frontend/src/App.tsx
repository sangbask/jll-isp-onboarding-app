import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getBundleRunSummary,
  getDashboardSummary,
  getPersonaSummary,
  getRecommendation,
  getRecommendationOptions,
} from "./api";
import {
  bundleFormDefaults,
  navItems,
  provisioningLogs,
  runHistory,
  softwareCatalogue,
} from "./data";
import type {
  BundleRunSummary,
  DashboardSummary,
  PageId,
  PersonaItem,
  PersonaSummary,
  RecommendationOptions,
  RecommendationRequest,
  RecommendationResult,
  SoftwareItem,
} from "./types";

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.filter((value) => value && value.trim() !== ""))];
}

function badgeTone(label: string) {
  if (label === "Confirmed" || label === "Completed" || label === "Validated" || label === "Exact" || label === "Pre-Approved" || label === "High") {
    return "green";
  }
  if (label === "Pending" || label === "Partial" || label === "Nearest" || label === "Manager-Approved" || label === "Medium" || label === "Unvalidated") {
    return "amber";
  }
  if (label === "Finance/SAM-Approved") {
    return "magenta";
  }
  return "grey";
}

function matchLevelTone(matchLevel: string) {
  if (["3a", "3b", "3c"].includes(matchLevel)) {
    return "green";
  }
  if (["3d", "semantic"].includes(matchLevel)) {
    return "amber";
  }
  if (matchLevel === "none") {
    return "red";
  }
  return "grey";
}

function countMatchLevels(summary: BundleRunSummary, matchLevels: string[]) {
  const labels = new Set(matchLevels);
  return summary.matchLevelBreakdown
    .filter((segment) => labels.has(segment.label))
    .reduce((total, segment) => total + segment.count, 0);
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function App() {
  const [page, setPage] = useState<PageId>("overview");
  const [bundleRequest, setBundleRequest] = useState<RecommendationRequest>(bundleFormDefaults);
  const [bundleResult, setBundleResult] = useState<RecommendationResult | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [bundleRunSummary, setBundleRunSummary] = useState<BundleRunSummary | null>(null);
  const [personaSummary, setPersonaSummary] = useState<PersonaSummary | null>(null);
  const [bundleOptions, setBundleOptions] = useState<RecommendationOptions>({
    titles: [bundleFormDefaults.title],
    functions: [bundleFormDefaults.function],
    businessCategories: [bundleFormDefaults.businessCategory],
    regions: [bundleFormDefaults.region],
    accounts: [bundleFormDefaults.account],
  });
  const [bundleOptionsError, setBundleOptionsError] = useState<string | null>(null);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<PersonaItem | null>(null);
  const [selectedSoftware, setSelectedSoftware] = useState<Record<string, boolean>>({
    "Adobe Acrobat Pro DC": true,
    "Microsoft Visio": true,
    "Bluebeam Revu": true,
    "Microsoft Project": true,
    AutoCAD: false,
    "Tableau Desktop": false,
    WinZip: false,
  });

  const totalSelected = useMemo(
    () => Object.values(selectedSoftware).filter(Boolean).length,
    [selectedSoftware]
  );

  useEffect(() => {
    let active = true;

    getDashboardSummary().then((summary) => {
      if (active) {
        setDashboardSummary(summary);
      }
    });

    getBundleRunSummary().then((summary) => {
      if (active) {
        setBundleRunSummary(summary);
      }
    });

    getRecommendationOptions().then((options) => {
      if (active) {
        setBundleOptions(options);
        setBundleOptionsError(null);
      }
    }).catch(() => {
      if (active) {
        setBundleOptionsError("Unable to load the live Excel option lists. Check the backend and refresh.");
      }
    });

    getPersonaSummary().then((summary) => {
      if (active) {
        setPersonaSummary(summary);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  async function submitBundle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBundleLoading(true);
    setBundleError(null);

    try {
      const result = await getRecommendation(bundleRequest);
      setBundleResult(result);
      const nextRunSummary = await getBundleRunSummary();
      setBundleRunSummary(nextRunSummary);
    } catch (error) {
      setBundleResult(null);
      setBundleError(error instanceof Error ? error.message : "Recommendation request failed");
    } finally {
      setBundleLoading(false);
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">JLL</div>
          <div>
            <div className="sidebar-title">Intelligent Software</div>
            <div className="sidebar-subtitle">Provisioning Platform</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {groupNav(navItems).map((group) => (
            <div key={group.section}>
              <div className="nav-section">{group.section}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={classNames("nav-item", page === item.id && "active")}
                  onClick={() => setPage(item.id)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">ISP Platform v1.0 · React starter</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">ISP Platform / {navItems.find((item) => item.id === page)?.label}</div>
          <div className="topbar-right">
            <button className="button button-secondary" type="button">
              Refresh
            </button>
            <div className="user-chip">
              <div className="avatar">AD</div>
              <div>
                <strong>Alex Drummond</strong>
                <span>IT Administrator</span>
              </div>
            </div>
          </div>
        </header>

        <section className="content">
          {page === "overview" ? (
            <OverviewPage
              summary={dashboardSummary}
              bundleRunSummary={bundleRunSummary}
              personaSummary={personaSummary}
            />
          ) : null}
          {page === "workbench" ? (
            <WorkbenchPage
              loading={bundleLoading}
              bundleError={bundleError}
              options={bundleOptions}
              optionsError={bundleOptionsError}
              request={bundleRequest}
              result={bundleResult}
              onChange={setBundleRequest}
              onSubmit={submitBundle}
            />
          ) : null}
          {page === "cleansing" ? <CleansingPage /> : null}
          {page === "personas" ? (
            <PersonasPage
              summary={personaSummary}
              selectedPersona={selectedPersona}
              onBack={() => setSelectedPersona(null)}
              onSelect={setSelectedPersona}
            />
          ) : null}
          {page === "provisioning" ? <ProvisioningPage /> : null}
          {page === "newjoiner" ? (
            <NewJoinerPage selectedSoftware={selectedSoftware} setSelectedSoftware={setSelectedSoftware} totalSelected={totalSelected} />
          ) : null}
          {page === "reports" ? <ReportsPage /> : null}
          {page === "settings" ? <SettingsPage /> : null}
        </section>
      </main>
    </div>
  );
}

function groupNav(items: typeof navItems) {
  return items.reduce<Array<{ section: string; items: typeof navItems }>>((acc, item) => {
    const existing = acc.find((entry) => entry.section === item.section);
    if (existing) {
      existing.items.push(item);
      return acc;
    }
    acc.push({ section: item.section, items: [item] });
    return acc;
  }, []);
}

function OverviewPage({
  summary,
  bundleRunSummary,
  personaSummary,
}: {
  summary: DashboardSummary | null;
  bundleRunSummary: BundleRunSummary | null;
  personaSummary: PersonaSummary | null;
}) {
  if (!summary || !bundleRunSummary || !personaSummary) {
    return (
      <div className="page-grid">
        <section className="hero-card">
          <div>
            <p className="eyebrow">Loading</p>
            <h1>Building your overview dashboard</h1>
            <p>Pulling workbook-backed metrics from the backend.</p>
          </div>
        </section>
      </div>
    );
  }

  const cards = [
    { label: "AD Users", value: summary.stats.totalAdUsers.toLocaleString(), subtext: "Rows loaded from AD export", accent: "var(--red)" },
    { label: "Unique Titles", value: summary.stats.uniqueTitles.toLocaleString(), subtext: "Distinct business titles", accent: "var(--purple)" },
    { label: "Unique Software", value: summary.stats.uniqueSoftware.toLocaleString(), subtext: "Applications seen in usage data", accent: "var(--green)" },
    { label: "Taxonomy Titles", value: summary.stats.taxonomyTitles.toLocaleString(), subtext: "Rows available for persona mapping", accent: "var(--amber)" },
  ];
  const topDepartmentMax = summary.topDepartments[0]?.count ?? 1;
  const topPersonaMax = personaSummary.personas[0]?.users ?? 1;
  const validatedShare = personaSummary.totalPersonas > 0
    ? Math.round((personaSummary.validated / personaSummary.totalPersonas) * 100)
    : 0;
  const mediumConfidence = personaSummary.personas.filter((persona) => persona.confidence === "Medium").length;
  const confidenceSegments = [
    { label: "High", value: personaSummary.personas.filter((persona) => persona.confidence === "High").length, color: "var(--green)" },
    { label: "Medium", value: mediumConfidence, color: "var(--amber)" },
    { label: "Low", value: personaSummary.lowConfidence, color: "var(--red)" },
  ].filter((segment) => segment.value > 0);
  const donutStops = confidenceSegments.reduce<Array<{ color: string; start: number; end: number }>>((acc, segment) => {
    const previousEnd = acc[acc.length - 1]?.end ?? 0;
    const segmentSize = personaSummary.totalPersonas > 0 ? (segment.value / personaSummary.totalPersonas) * 100 : 0;
    acc.push({
      color: segment.color,
      start: previousEnd,
      end: previousEnd + segmentSize,
    });
    return acc;
  }, []);
  const donutStyle = donutStops.length > 0
    ? {
        background: `conic-gradient(${donutStops
          .map((stop) => `${stop.color} ${stop.start}% ${stop.end}%`)
          .join(", ")})`,
      }
    : undefined;
  const runSegments = bundleRunSummary.matchLevelBreakdown.map((segment, index) => ({
    ...segment,
    color: index % 5 === 0
      ? "var(--red)"
      : index % 5 === 1
        ? "var(--purple)"
        : index % 5 === 2
          ? "var(--amber)"
          : index % 5 === 3
            ? "var(--green)"
            : "var(--magenta)",
  }));
  const runDonutStops = runSegments.reduce<Array<{ color: string; start: number; end: number }>>((acc, segment) => {
    const previousEnd = acc[acc.length - 1]?.end ?? 0;
    const segmentSize = bundleRunSummary.totalRuns > 0 ? (segment.count / bundleRunSummary.totalRuns) * 100 : 0;
    acc.push({
      color: segment.color,
      start: previousEnd,
      end: previousEnd + segmentSize,
    });
    return acc;
  }, []);
  const runDonutStyle = runDonutStops.length > 0
    ? {
        background: `conic-gradient(${runDonutStops
          .map((stop) => `${stop.color} ${stop.start}% ${stop.end}%`)
          .join(", ")})`,
      }
    : undefined;

  return (
    <div className="page-grid overview-dashboard">
      <div className="summary-grid">
        {cards.map((card) => (
          <article key={card.label} className="summary-card" style={{ ["--accent" as string]: card.accent }}>
            <div className="summary-label">{card.label}</div>
            <div className="summary-value">{card.value}</div>
            {card.subtext ? <div className="summary-subtext">{card.subtext}</div> : null}
          </article>
        ))}
      </div>

      <div className="two-column">
        <section className="card">
          <div className="card-header">
            <h3>Workbench Run History</h3>
            <span className="badge red">DB-backed</span>
          </div>
          <div className="card-body">
            <div className="stat-grid">
              <div className="stat-box">
                <span>Total Workbench Runs</span>
                <strong>{bundleRunSummary.totalRuns.toLocaleString()}</strong>
              </div>
              <div className="stat-box">
                <span>Low Confidence Runs</span>
                <strong>{bundleRunSummary.lowConfidenceRuns.toLocaleString()}</strong>
              </div>
              <div className="stat-box">
                <span>Unmatched Runs</span>
                <strong>{bundleRunSummary.unmatchedRuns.toLocaleString()}</strong>
              </div>
              <div className="stat-box full">
                <span>Recent Activity</span>
                <strong>
                  {bundleRunSummary.recentRuns[0]
                    ? `${bundleRunSummary.recentRuns[0].requestedTitle} → ${bundleRunSummary.recentRuns[0].personaName}`
                    : "No workbench runs saved yet"}
                </strong>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h3>Match Level Distribution</h3>
            <span className="badge grey">{bundleRunSummary.totalRuns} runs</span>
          </div>
          <div className="card-body dashboard-visual-grid">
            <div className="donut-panel">
              <div className="donut-chart" style={runDonutStyle}>
                <div className="donut-hole">
                  <strong>{bundleRunSummary.totalRuns}</strong>
                  <span>runs</span>
                </div>
              </div>
              <div className="legend-list">
                {runSegments.length > 0 ? (
                  runSegments.map((segment) => (
                    <div key={segment.label} className="legend-item">
                      <span className="legend-swatch" style={{ background: segment.color }} />
                      <span>{segment.label}</span>
                      <strong>{segment.count}</strong>
                    </div>
                  ))
                ) : (
                  <div className="muted">No saved bundle runs are available yet.</div>
                )}
              </div>
            </div>
            <div className="stat-grid">
              <div className="stat-box">
                <span>Exact Matches</span>
                <strong>{countMatchLevels(bundleRunSummary, ["3a"])}</strong>
              </div>
              <div className="stat-box">
                <span>Scoped Matches</span>
                <strong>{countMatchLevels(bundleRunSummary, ["3b", "3c"])}</strong>
              </div>
              <div className="stat-box">
                <span>Fallback Matches</span>
                <strong>{countMatchLevels(bundleRunSummary, ["3d", "semantic"])}</strong>
              </div>
              <div className="stat-box">
                <span>No Match</span>
                <strong>{bundleRunSummary.unmatchedRuns}</strong>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="two-column">
        <section className="card">
          <div className="card-header">
            <h3>Top Departments</h3>
          </div>
          <div className="card-body">
            <div className="mini-bars">
              {summary.topDepartments.length > 0 ? (
                summary.topDepartments.map((item, index) => (
                  <div key={item.label}>
                    <span>{item.label} <strong className="inline-count">{item.count.toLocaleString()}</strong></span>
                    <div className="bar-track">
                      <div
                        className={`bar-fill${index % 3 === 1 ? " purple" : index % 3 === 2 ? " amber" : ""}`}
                        style={{ width: `${Math.max(18, Math.round((item.count / topDepartmentMax) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="muted">No department distribution is available yet.</div>
              )}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h3>Top Regions</h3>
          </div>
          <div className="card-body">
            <table>
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Users</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {summary.topRegions.length > 0 ? (
                  summary.topRegions.map((region) => (
                    <tr key={region.label}>
                      <td><strong>{region.label}</strong></td>
                      <td>{region.count.toLocaleString()}</td>
                      <td>{summary.stats.totalAdUsers > 0 ? Math.round((region.count / summary.stats.totalAdUsers) * 100) : 0}%</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="muted">No regional data is available yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="two-column">
        <section className="card">
          <div className="card-header">
            <h3>Persona Coverage</h3>
            <span className="badge purple">{personaSummary.totalPersonas} personas</span>
          </div>
          <div className="card-body dashboard-visual-grid">
            <div className="donut-panel">
              <div className="donut-chart" style={donutStyle}>
                <div className="donut-hole">
                  <strong>{validatedShare}%</strong>
                  <span>validated</span>
                </div>
              </div>
              <div className="legend-list">
                {confidenceSegments.map((segment) => (
                  <div key={segment.label} className="legend-item">
                    <span className="legend-swatch" style={{ background: segment.color }} />
                    <span>{segment.label}</span>
                    <strong>{segment.value}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="stat-grid">
              <div className="stat-box">
                <span>Total Personas</span>
                <strong>{personaSummary.totalPersonas}</strong>
              </div>
              <div className="stat-box">
                <span>Validated</span>
                <strong>{personaSummary.validated}</strong>
              </div>
              <div className="stat-box">
                <span>Low Confidence</span>
                <strong>{personaSummary.lowConfidence}</strong>
              </div>
              <div className="stat-box full">
                <span>Largest Persona</span>
                <strong>{personaSummary.personas[0]?.standardTitle ?? "Not available"}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h3>Top Persona Cohorts</h3>
          </div>
          <div className="card-body">
            <div className="mini-bars">
              {personaSummary.personas.slice(0, 6).map((persona, index) => (
                <div key={persona.id}>
                  <span>{persona.standardTitle} <strong className="inline-count">{persona.users.toLocaleString()}</strong></span>
                  <div className="bar-track">
                    <div
                      className={`bar-fill${index % 3 === 1 ? " purple" : index % 3 === 2 ? " amber" : ""}`}
                      style={{ width: `${Math.max(18, Math.round((persona.users / topPersonaMax) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="two-column">
        <section className="card">
          <div className="card-header">
            <h3>Most Assigned Software</h3>
          </div>
          <div className="card-body">
            <table>
              <thead>
                <tr>
                  <th>Software</th>
                  <th>Assignments</th>
                </tr>
              </thead>
              <tbody>
                {summary.topSoftware.length > 0 ? (
                  summary.topSoftware.map((item) => (
                    <tr key={item.label}>
                      <td>{item.label}</td>
                      <td>{item.count.toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="muted">No software frequency data is available yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h3>Source File Coverage</h3>
          </div>
          <div className="card-body">
            <div className="source-grid">
              {summary.sourceFiles.length > 0 ? (
                summary.sourceFiles.map((file) => (
                  <div key={file.name} className="source-pill">
                    <strong>{file.rows.toLocaleString()}</strong>
                    <span>{file.name}</span>
                  </div>
                ))
              ) : (
                <div className="muted">No source file metadata is available yet.</div>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <h3>Persona Catalogue Snapshot</h3>
          <span className="badge purple">DB-backed</span>
        </div>
        <div className="card-body">
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th>Standard Title</th>
                <th>Users</th>
                <th>Confidence</th>
                <th>Bundle</th>
              </tr>
            </thead>
            <tbody>
              {personaSummary.personas.slice(0, 8).map((persona) => (
                <tr key={persona.id}>
                  <td>{persona.department}</td>
                  <td>
                    <strong>{persona.standardTitle}</strong>
                    <div className="muted">{persona.title}</div>
                  </td>
                  <td>{persona.users.toLocaleString()}</td>
                  <td><span className={`badge ${badgeTone(persona.confidence)}`}>{persona.confidence}</span></td>
                  <td><span className={`badge ${badgeTone(persona.bundleStatus)}`}>{persona.bundleStatus}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h3>Recent Bundle Runs</h3>
          <span className="badge grey">{bundleRunSummary.recentRuns.length} most recent</span>
        </div>
        <div className="card-body">
          <table>
            <thead>
              <tr>
                <th>Requested Title</th>
                <th>Persona</th>
                <th>Match Level</th>
                <th>Matched Users</th>
                <th>Region</th>
                <th>Account</th>
                <th>Saved At</th>
              </tr>
            </thead>
            <tbody>
              {bundleRunSummary.recentRuns.length > 0 ? (
                bundleRunSummary.recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td><strong>{run.requestedTitle}</strong></td>
                    <td>{run.personaName}</td>
                    <td><span className={`badge ${matchLevelTone(run.matchLevel)}`}>{run.matchLevel}</span></td>
                    <td>{run.matchedUsers.toLocaleString()}</td>
                    <td>{run.requestedRegion}</td>
                    <td>{run.requestedAccount}</td>
                    <td>{formatTimestamp(run.requestedAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="muted">Run a few bundle recommendations and they will appear here.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function WorkbenchPage({
  loading,
  bundleError,
  options,
  optionsError,
  request,
  result,
  onChange,
  onSubmit,
}: {
  loading: boolean;
  bundleError: string | null;
  options: RecommendationOptions;
  optionsError: string | null;
  request: RecommendationRequest;
  result: RecommendationResult | null;
  onChange: (next: RecommendationRequest) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const titleOptions = uniqueNonEmpty([
    ...options.titles,
    request.title,
    bundleFormDefaults.title,
  ]);
  const functionOptions = uniqueNonEmpty([
    ...options.functions,
    request.function,
    bundleFormDefaults.function,
  ]);
  const businessCategoryOptions = uniqueNonEmpty([
    ...options.businessCategories,
    request.businessCategory,
    bundleFormDefaults.businessCategory,
  ]);
  const regionOptions = uniqueNonEmpty([
    ...options.regions,
    request.region,
    bundleFormDefaults.region,
  ]);
  const accountOptions = uniqueNonEmpty([
    ...options.accounts,
    request.account,
    bundleFormDefaults.account,
  ]);

  return (
    <div className="page-grid">
      <section className="card workbench-shell">
        <div className="card-header">
          <div>
            <h3>Bundle Workbench</h3>
            <div className="muted">Select a cohort profile and generate the bundle from your live Excel-backed dataset.</div>
          </div>
        </div>
        <div className="card-body">
          <form className="form-grid workbench-form" onSubmit={onSubmit}>
            {optionsError ? (
              <div className="span-2">
                <div className="badge amber">{optionsError}</div>
              </div>
            ) : null}
            {bundleError ? (
              <div className="span-2">
                <div className="badge red">{bundleError}</div>
              </div>
            ) : null}
            <ComboboxField
              className="span-2"
              label="Title"
              value={request.title}
              options={titleOptions}
              onChange={(value) => onChange({ ...request, title: value })}
            />
            <ComboboxField
              label="Function"
              value={request.function}
              options={functionOptions}
              onChange={(value) => onChange({ ...request, function: value })}
            />
            <ComboboxField
              label="Business Category"
              value={request.businessCategory}
              options={businessCategoryOptions}
              onChange={(value) => onChange({ ...request, businessCategory: value })}
            />
            <ComboboxField
              label="Region"
              value={request.region}
              options={regionOptions}
              onChange={(value) => onChange({ ...request, region: value })}
            />
            <ComboboxField
              label="Account"
              value={request.account}
              options={accountOptions}
              onChange={(value) => onChange({ ...request, account: value })}
            />
            <div className="form-actions span-2">
              <button className="button button-primary" type="submit" disabled={loading}>
                {loading ? "Generating..." : "Generate Recommendation"}
              </button>
            </div>
            <div className="span-2 muted">
              Click into a field or use the arrow to browse the full Excel-backed list. Start typing to narrow it down.
            </div>
          </form>
        </div>
      </section>

      {result ? (
        <section className="card result-shell">
          <div className="result-overview">
            <div>
              <div className="summary-label">Generated Recommendation</div>
              <h2 className="result-title">{result.persona}</h2>
              <p className="muted">{result.explanation}</p>
            </div>
            <div className="result-metrics">
              <div className="stat-box">
                <span>Match Level</span>
                <strong>{result.matchLevel}</strong>
              </div>
              <div className="stat-box">
                <span>Matched Users</span>
                <strong>{result.matchedUsers}</strong>
              </div>
              <div className="stat-box">
                <span>Bundle Items</span>
                <strong>{result.software.length}</strong>
              </div>
            </div>
          </div>
          <div className="card-body result-sections">
            <section className="result-panel">
              <div className="result-panel-header">
                <h3>Recommended Software Bundle</h3>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Software</th>
                      <th>Frequency</th>
                      <th>Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.software.map((item) => (
                      <tr key={item.name}>
                        <td>{item.name}</td>
                        <td>{item.frequency}%</td>
                        <td><span className={`badge ${item.recommendation === "Recommended" ? "green" : "amber"}`}>{item.recommendation}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="result-panel">
              <div className="result-panel-header">
                <h3>Matched Users</h3>
                <span className="badge grey">Showing {result.matchedUserRows.length} rows</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Region</th>
                      <th>Business Category</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.matchedUserRows.map((user) => (
                      <tr key={`${user.email}-${user.title}`}>
                        <td>{user.title}</td>
                        <td>{user.region}</td>
                        <td>{user.businessCategory}</td>
                        <td>{user.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ComboboxField({
  className,
  label,
  value,
  options,
  onChange,
}: {
  className?: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasTyped, setHasTyped] = useState(false);

  const filteredOptions = (
    hasTyped && searchTerm.trim() !== ""
      ? options.filter((option) =>
          option.toLowerCase().includes(searchTerm.trim().toLowerCase())
        )
      : options
  );

  return (
    <label className={className}>
      <span>{label}</span>
      <div className="combobox">
        <input
          className="input combobox-input"
          value={open ? (hasTyped ? searchTerm : value) : value}
          onFocus={() => {
            setOpen(true);
            setHasTyped(false);
            setSearchTerm("");
          }}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            setSearchTerm(nextValue);
            setHasTyped(true);
            onChange(nextValue);
            setOpen(true);
          }}
        />
        <button
          className="combobox-toggle"
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
            setOpen((previous) => !previous);
            setHasTyped(false);
            setSearchTerm("");
          }}
          aria-label={`Toggle ${label} options`}
        >
          ▾
        </button>
        {open ? (
          <div className="combobox-menu">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option}
                  className="combobox-option"
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onChange(option);
                    setSearchTerm("");
                    setHasTyped(false);
                    setOpen(false);
                  }}
                >
                  {option}
                </button>
              ))
            ) : (
              <div className="combobox-empty">No matches found</div>
            )}
          </div>
        ) : null}
      </div>
    </label>
  );
}

function CleansingPage() {
  const pendingItems = softwareCatalogue.filter((item) => item.status === "Pending");

  return (
    <div className="page-grid">
      <div className="summary-grid">
        <article className="summary-card" style={{ ["--accent" as string]: "var(--red)" }}>
          <div className="summary-label">Total Software</div>
          <div className="summary-value">2,363</div>
          <div className="summary-subtext">Target catalogue after ingestion</div>
        </article>
        <article className="summary-card" style={{ ["--accent" as string]: "var(--amber)" }}>
          <div className="summary-label">Pending HITL</div>
          <div className="summary-value">{pendingItems.length}</div>
          <div className="summary-subtext">Awaiting review</div>
        </article>
      </div>

      <section className="card">
        <div className="card-header">
          <h3>Human-In-The-Loop Classification Queue</h3>
          <button className="button button-primary" type="button">Commit to Production</button>
        </div>
        <div className="card-body">
          <table>
            <thead>
              <tr>
                <th>Software</th>
                <th>Publisher</th>
                <th>Deploy Type</th>
                <th>Confidence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {softwareCatalogue.map((item: SoftwareItem) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.publisher}</td>
                  <td><span className={`badge ${badgeTone(item.deploymentType)}`}>{item.deploymentType}</span></td>
                  <td>{item.confidence}%</td>
                  <td><span className={`badge ${badgeTone(item.status)}`}>{item.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h3>Run History</h3>
        </div>
        <div className="card-body">
          <table>
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Type</th>
                <th>Date</th>
                <th>Records</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {runHistory.map((run) => (
                <tr key={run.id}>
                  <td>{run.id}</td>
                  <td><span className={`badge ${run.type === "Full" ? "red" : "purple"}`}>{run.type}</span></td>
                  <td>{run.date}</td>
                  <td>{run.records.toLocaleString()}</td>
                  <td>{run.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PersonasPage({
  summary,
  selectedPersona,
  onBack,
  onSelect,
}: {
  summary: PersonaSummary | null;
  selectedPersona: PersonaItem | null;
  onBack: () => void;
  onSelect: (persona: PersonaItem) => void;
}) {
  if (!summary) {
    return (
      <div className="page-grid">
        <section className="hero-card">
          <div>
            <p className="eyebrow">Loading</p>
            <h1>Building the persona catalogue</h1>
            <p>Pulling the persisted persona snapshot from the backend.</p>
          </div>
        </section>
      </div>
    );
  }

  if (selectedPersona) {
    return (
      <div className="page-grid">
        <button className="button button-secondary inline-button" type="button" onClick={onBack}>
          Back to Personas
        </button>
        <section className="card">
          <div className="card-header">
            <h3>{selectedPersona.standardTitle} Software Deployment</h3>
            <span className={`badge ${badgeTone(selectedPersona.bundleStatus)}`}>{selectedPersona.bundleStatus}</span>
          </div>
          <div className="card-body bundle-columns">
            <BundleColumn title="Base Image Software" tone="grey" items={selectedPersona.bundle.base} />
            <BundleColumn title="Standard Software" tone="purple" items={selectedPersona.bundle.standard} />
            <BundleColumn title="Recommended Software" tone="green" items={selectedPersona.bundle.recommended} />
            <BundleColumn title="Optional Software" tone="amber" items={selectedPersona.bundle.optional} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <div className="summary-grid">
        <article className="summary-card" style={{ ["--accent" as string]: "var(--red)" }}>
          <div className="summary-label">Total Personas</div>
          <div className="summary-value">{summary.totalPersonas}</div>
        </article>
        <article className="summary-card" style={{ ["--accent" as string]: "var(--green)" }}>
          <div className="summary-label">Validated</div>
          <div className="summary-value">{summary.validated}</div>
        </article>
        <article className="summary-card" style={{ ["--accent" as string]: "var(--amber)" }}>
          <div className="summary-label">Low Confidence</div>
          <div className="summary-value">{summary.lowConfidence}</div>
        </article>
      </div>

      <section className="hero-card compact">
        <div>
          <p className="eyebrow">Persona Management</p>
          <h1>Persona catalogue and deployment bundle mapping</h1>
          <p>This page now reads the persisted persona snapshot derived from your synced data.</p>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h3>Persona Catalogue</h3>
          <span className="badge purple">DB Snapshot</span>
        </div>
        <div className="card-body">
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th>Job Title</th>
                <th>Role / Subgroup</th>
                <th>Users</th>
                <th>Confidence</th>
                <th>Bundle</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {summary.personas.map((persona) => (
                <tr key={persona.id} onClick={() => onSelect(persona)} className="clickable-row">
                  <td>{persona.department}</td>
                  <td>
                    <strong>{persona.title}</strong>
                    <div className="muted">{persona.standardTitle}</div>
                  </td>
                  <td>{persona.role} / {persona.subgroup}</td>
                  <td>{persona.users}</td>
                  <td><span className={`badge ${badgeTone(persona.confidence)}`}>{persona.confidence}</span></td>
                  <td><span className={`badge ${badgeTone(persona.bundleStatus)}`}>{persona.bundleStatus}</span></td>
                  <td>{persona.modifiedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function BundleColumn({ title, tone, items }: { title: string; tone: string; items: string[] }) {
  return (
    <div className="bundle-column">
      <div className="bundle-column-header">
        <h4>{title}</h4>
        <span className={`badge ${tone}`}>{items.length} packages</span>
      </div>
      <div className="bundle-column-body">
        {items.map((item) => (
          <div key={item} className="pill-row">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProvisioningPage() {
  return (
    <div className="page-grid">
      <div className="hero-card compact">
        <div>
          <p className="eyebrow">Live Workflow</p>
          <h1>Provisioning operations console</h1>
          <p>Interactive and silent provisioning flows, approval splits, and ServiceNow ticket tracking can live here.</p>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <h3>Provisioning Log</h3>
          <div className="button-group">
            <button className="button button-primary" type="button">Run Demo Provisioning</button>
            <button className="button button-secondary" type="button">Export</button>
          </div>
        </div>
        <div className="card-body">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Match</th>
                <th>Approvals</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {provisioningLogs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td>
                    <strong>{log.user}</strong>
                    <div className="muted">{log.department}</div>
                  </td>
                  <td><span className={`badge ${badgeTone(log.match)}`}>{log.match}</span></td>
                  <td>{log.preApproved} pre / {log.managerApproved} mgr / {log.financeApproved} fin</td>
                  <td><span className={`badge ${badgeTone(log.status)}`}>{log.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function NewJoinerPage({
  selectedSoftware,
  setSelectedSoftware,
  totalSelected,
}: {
  selectedSoftware: Record<string, boolean>;
  setSelectedSoftware: (next: Record<string, boolean>) => void;
  totalSelected: number;
}) {
  const recommended = ["Adobe Acrobat Pro DC", "Microsoft Visio", "Bluebeam Revu", "Microsoft Project"];
  const optional = ["AutoCAD", "Tableau Desktop", "WinZip"];

  function toggleItem(name: string) {
    setSelectedSoftware({
      ...selectedSoftware,
      [name]: !selectedSoftware[name],
    });
  }

  return (
    <div className="portal-wrap">
      <section className="hero-card dark">
        <div>
          <p className="eyebrow">Welcome To JLL</p>
          <h1>Software Selection Portal</h1>
          <p>Review and customize your recommended software before requests are raised.</p>
        </div>
        <div className="hero-metrics">
          <div>
            <span>Name</span>
            <strong>Sarah Mitchell</strong>
          </div>
          <div>
            <span>Department</span>
            <strong>Facilities Management</strong>
          </div>
          <div>
            <span>Persona</span>
            <strong>Facilities Manager</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h3>Recommended Software</h3>
        </div>
        <div className="card-body card-list">
          {recommended.map((item) => (
            <button key={item} type="button" className={classNames("software-card", selectedSoftware[item] && "selected")} onClick={() => toggleItem(item)}>
              <div>
                <strong>{item}</strong>
                <div className="muted">Pre-selected for this persona</div>
              </div>
              <span className="badge green">{selectedSoftware[item] ? "Selected" : "Add"}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h3>Optional Software</h3>
        </div>
        <div className="card-body card-list">
          {optional.map((item) => (
            <button key={item} type="button" className={classNames("software-card", selectedSoftware[item] && "selected")} onClick={() => toggleItem(item)}>
              <div>
                <strong>{item}</strong>
                <div className="muted">Available on request</div>
              </div>
              <span className={`badge ${selectedSoftware[item] ? "green" : "grey"}`}>{selectedSoftware[item] ? "Selected" : "Optional"}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="sticky-submit">
        <span><strong>{totalSelected}</strong> packages selected</span>
        <button className="button button-primary" type="button">Submit Request</button>
      </div>
    </div>
  );
}

function ReportsPage() {
  const exactMatches = provisioningLogs.filter((log) => log.match === "Exact").length;

  return (
    <div className="page-grid">
      <div className="summary-grid">
        <article className="summary-card" style={{ ["--accent" as string]: "var(--red)" }}>
          <div className="summary-label">Profiles Processed</div>
          <div className="summary-value">2,833</div>
        </article>
        <article className="summary-card" style={{ ["--accent" as string]: "var(--green)" }}>
          <div className="summary-label">Joiners Provisioned</div>
          <div className="summary-value">{provisioningLogs.length}</div>
        </article>
        <article className="summary-card" style={{ ["--accent" as string]: "var(--purple)" }}>
          <div className="summary-label">Exact Match Rate</div>
          <div className="summary-value">{Math.round((exactMatches / provisioningLogs.length) * 100)}%</div>
        </article>
      </div>

      <div className="two-column">
        <section className="card">
          <div className="card-header">
            <h3>Department Distribution</h3>
          </div>
          <div className="card-body">
            <div className="mini-bars">
              {["Facilities Management", "IT", "Finance"].map((department, index) => (
                <div key={department}>
                  <span>{department}</span>
                  <div className="bar-track">
                    <div className={classNames("bar-fill", index === 1 && "purple", index === 2 && "amber")} style={{ width: `${72 - index * 18}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h3>Approval Mix</h3>
          </div>
          <div className="card-body stat-grid">
            <div className="stat-box">
              <span>Pre-Approved</span>
              <strong>312</strong>
            </div>
            <div className="stat-box">
              <span>Manager</span>
              <strong>187</strong>
            </div>
            <div className="stat-box">
              <span>Finance/SAM</span>
              <strong>94</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="page-grid narrow">
      <section className="card">
        <div className="card-header">
          <h3>Global Configuration</h3>
        </div>
        <div className="card-body form-grid">
          <label>
            <span>Silent Install Mode</span>
            <select className="input" defaultValue="disabled">
              <option value="disabled">Disabled</option>
              <option value="enabled">Enabled</option>
            </select>
          </label>
          <label>
            <span>Exact-Match Adoption Percentile</span>
            <input className="input" type="number" defaultValue={50} />
          </label>
          <label>
            <span>Nearest-Match Adoption Percentile</span>
            <input className="input" type="number" defaultValue={40} />
          </label>
          <label>
            <span>AD Delta Ingestion Frequency</span>
            <select className="input" defaultValue="monthly">
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Fortnightly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </label>
          <label>
            <span>Auto-Confirm Confidence Threshold</span>
            <input className="input" type="number" defaultValue={95} />
          </label>
          <div className="form-actions">
            <button className="button button-secondary" type="button">Reset</button>
            <button className="button button-primary" type="button">Save Settings</button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h3>System Information</h3>
        </div>
        <div className="card-body stat-grid">
          <div className="stat-box"><span>Last AD Sync</span><strong>2026-03-22 08:00 UTC</strong></div>
          <div className="stat-box"><span>AD Records</span><strong>31,119</strong></div>
          <div className="stat-box"><span>Tanium Records</span><strong>143,405</strong></div>
          <div className="stat-box"><span>Applications</span><strong>2,363</strong></div>
        </div>
      </section>
    </div>
  );
}

export default App;
