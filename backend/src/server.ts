import cors from "cors";
import express from "express";
import {
  getWorkbookStats,
  loadWorkbookData,
} from "./services/excelLoader";
import {
  getBundleRunSummaryFromStorage,
  getDashboardSummaryFromStorage,
  getPersistenceStatus,
  getPersonaSummaryFromStorage,
  getRecommendationOptionsFromStorage,
  loadSourceData,
  saveBundleRun,
  syncWorkbookToDatabase,
} from "./services/persistence";
import { recommendBundleFromData } from "./services/recommendation";
import { getStorageStrategy } from "./services/storageStrategy";
import type { RecommendationRequest } from "./types";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const corsOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors(
  corsOrigins.length > 0
    ? {
        origin(origin, callback) {
          if (!origin || corsOrigins.includes(origin)) {
            callback(null, true);
            return;
          }

          callback(new Error("Origin not allowed by CORS"));
        },
      }
    : undefined
));
app.use(express.json());

app.get("/", (_request, response) => {
  response.json({
    status: "ok",
    service: "jll-isp-backend",
    message: "Backend is running. Use /api/health for diagnostics.",
  });
});

app.get("/api/health", (_request, response) => {
  let workbookStats: ReturnType<typeof getWorkbookStats> | null = null;

  try {
    workbookStats = getWorkbookStats();
  } catch {
    workbookStats = null;
  }

  response.json({
    status: "ok",
    service: "jll-isp-backend",
    workbookStats,
  });
});

app.get("/api/storage-strategy", (_request, response) => {
  response.json(getStorageStrategy());
});

app.get("/api/storage/status", async (_request, response) => {
  response.json(await getPersistenceStatus());
});

app.post("/api/storage/sync", async (_request, response) => {
  response.json(await syncWorkbookToDatabase());
});

app.get("/api/dashboard/summary", async (_request, response) => {
  response.json(await getDashboardSummaryFromStorage());
});

app.get("/api/dashboard/bundle-runs", async (_request, response) => {
  response.json(await getBundleRunSummaryFromStorage());
});

app.get("/api/bundle/options", async (_request, response) => {
  response.json(await getRecommendationOptionsFromStorage());
});

app.get("/api/personas", async (_request, response) => {
  response.json(await getPersonaSummaryFromStorage());
});

app.post("/api/bundle/recommend", async (request, response) => {
  const payload = request.body as Partial<RecommendationRequest>;
  if (!payload.title || !payload.function || !payload.businessCategory || !payload.region || !payload.account) {
    response.status(400).json({
      error: "title, function, businessCategory, region, and account are required",
    });
    return;
  }

  const result = recommendBundleFromData(await loadSourceData(), {
      title: payload.title,
      function: payload.function,
      businessCategory: payload.businessCategory,
      region: payload.region,
      account: payload.account,
    });

  await saveBundleRun(
    {
      title: payload.title,
      function: payload.function,
      businessCategory: payload.businessCategory,
      region: payload.region,
      account: payload.account,
    },
    result
  );

  response.json(result);
});

app.listen(port, async () => {
  try {
    await getPersistenceStatus();
  } catch (error) {
    console.warn("Persistence layer initialization skipped:", error);
  }
  console.log(`JLL ISP backend listening on http://localhost:${port}`);
});
