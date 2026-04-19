import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
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
const frontendDistDir = path.resolve(__dirname, "../frontend-dist");
const frontendIndexFile = path.join(frontendDistDir, "index.html");
const frontendAssetsDir = path.join(frontendDistDir, "assets");
const hasFrontendBundle = fs.existsSync(frontendIndexFile);

function wrapAsync(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>
) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };
}

app.use(express.json());

app.get("/", (_request, response) => {
  if (hasFrontendBundle) {
    response.sendFile(frontendIndexFile);
    return;
  }

  response.json({
    status: "ok",
    service: "jll-isp-backend",
    message: "Backend is running. Use /api/health for diagnostics.",
  });
});

app.get("/api/health", async (_request, response) => {
  let workbookStats: ReturnType<typeof getWorkbookStats> | null = null;
  let persistenceStatus: Awaited<ReturnType<typeof getPersistenceStatus>> | null = null;
  let persistenceError: string | null = null;

  try {
    workbookStats = getWorkbookStats();
  } catch {
    workbookStats = null;
  }

  try {
    persistenceStatus = await getPersistenceStatus();
  } catch (error) {
    persistenceError = error instanceof Error ? error.message : "Unknown persistence error";
  }

  response.json({
    status: "ok",
    service: "jll-isp-backend",
    workbookStats,
    persistenceStatus,
    persistenceError,
  });
});

app.use("/api", cors(
  corsOrigins.length > 0
    ? {
        origin(origin, callback) {
          if (!origin || corsOrigins.includes(origin)) {
            callback(null, true);
            return;
          }

          callback(null, false);
        },
      }
    : undefined
));

app.get("/api/storage-strategy", (_request, response) => {
  response.json(getStorageStrategy());
});

app.get("/api/storage/status", wrapAsync(async (_request, response) => {
  response.json(await getPersistenceStatus());
}));

app.post("/api/storage/sync", wrapAsync(async (_request, response) => {
  response.json(await syncWorkbookToDatabase());
}));

app.get("/api/dashboard/summary", wrapAsync(async (_request, response) => {
  response.json(await getDashboardSummaryFromStorage());
}));

app.get("/api/dashboard/bundle-runs", wrapAsync(async (_request, response) => {
  response.json(await getBundleRunSummaryFromStorage());
}));

app.get("/api/bundle/options", wrapAsync(async (_request, response) => {
  response.json(await getRecommendationOptionsFromStorage());
}));

app.get("/api/personas", wrapAsync(async (_request, response) => {
  response.json(await getPersonaSummaryFromStorage());
}));

app.post("/api/bundle/recommend", wrapAsync(async (request, response) => {
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
}));

if (hasFrontendBundle) {
  app.use("/assets", express.static(frontendAssetsDir));
  app.use(express.static(frontendDistDir, { index: false }));

  app.get(/^\/(?!api).*/, (request, response, next) => {
    if (path.extname(request.path)) {
      next();
      return;
    }

    response.sendFile(frontendIndexFile);
  });
}

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown server error";
  console.error("Request failed:", error);
  response.status(500).json({
    error: message,
  });
});

app.listen(port, async () => {
  try {
    await getPersistenceStatus();
  } catch (error) {
    console.warn("Persistence layer initialization skipped:", error);
  }
  console.log(`JLL ISP backend listening on http://localhost:${port}`);
});
