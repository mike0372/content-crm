import "server-only";
import { promises as fs } from "fs";
import path from "path";
import {
  ContentItem,
  CalendarWeek,
  PerformanceRow,
  DAY_KEYS,
  Status,
  Pillar,
  Format,
} from "./types";
import {
  createVideo,
  createIdeaItem,
  defaultScript,
  defaultCaptions,
  defaultChecklist,
} from "./factories";
import { isoWeek } from "./week";

const DATA_DIR = path.join(process.cwd(), "data");
const CONTENT_DIR = path.join(DATA_DIR, "content");
const VIDEOS_DIR = path.join(DATA_DIR, "videos"); // legacy — kept for migration read
const CALENDARS_DIR = path.join(DATA_DIR, "calendars");
const LEGACY_CALENDAR_FILE = path.join(DATA_DIR, "calendar.json");
const PERF_FILE = path.join(DATA_DIR, "performance-log.json");
const IDEAS_FILE = path.join(DATA_DIR, "ideas.json"); // legacy — kept for migration read
const BACKUP_DIR = path.join(DATA_DIR, "_backup");

async function ensureDirs() {
  await Promise.all([
    fs.mkdir(CONTENT_DIR, { recursive: true }),
    fs.mkdir(VIDEOS_DIR, { recursive: true }),
    fs.mkdir(CALENDARS_DIR, { recursive: true }),
  ]);
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

// ---- One-time migration from videos/ + ideas.json → content/ ---------------

let migrating: Promise<void> | null = null;

async function migrateIfNeeded(): Promise<void> {
  if (migrating !== null) return migrating;
  migrating = _runMigration().finally(() => {
    migrating = null;
  });
  return migrating;
}

async function _runMigration(): Promise<void> {
  // Already migrated if content/ has files
  const contentFiles = await fs.readdir(CONTENT_DIR).catch(() => [] as string[]);
  if (contentFiles.some((f) => f.endsWith(".json"))) return;

  const videoFiles = (
    await fs.readdir(VIDEOS_DIR).catch(() => [] as string[])
  ).filter((f) => f.endsWith(".json"));
  const ideasRaw = await fs.readFile(IDEAS_FILE, "utf8").catch(() => null);

  const hasOldData = videoFiles.length > 0 || ideasRaw !== null;
  if (!hasOldData) return; // nothing to migrate — seed will run later

  // --- Backup ---
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  if (videoFiles.length > 0) {
    const backupVid = path.join(BACKUP_DIR, "videos");
    await fs.mkdir(backupVid, { recursive: true });
    await Promise.all(
      videoFiles.map((f) =>
        fs.copyFile(path.join(VIDEOS_DIR, f), path.join(backupVid, f))
      )
    );
  }
  if (ideasRaw) {
    await fs.writeFile(
      path.join(BACKUP_DIR, "ideas.json"),
      ideasRaw,
      "utf8"
    );
  }

  // --- Migrate videos → stage:"production" items ---
  let migratedVideos = 0;
  for (const f of videoFiles) {
    try {
      const raw = await fs.readFile(path.join(VIDEOS_DIR, f), "utf8");
      const v = JSON.parse(raw) as Record<string, unknown>;
      const item: ContentItem = {
        id: String(v.id ?? ""),
        stage: "production",
        status: (v.status as Status) ?? "TO_SHOOT",
        title: String(v.title ?? ""),
        pillar: (v.pillar as Pillar) ?? "Claude Code",
        hookType: "",
        format: (v.format as Format) ?? "Screen recording",
        lengthTarget: String(v.lengthTarget ?? "30s"),
        postingWindow:
          (v.postingWindow as ContentItem["postingWindow"]) ?? "Evening (6-8pm)",
        sourceUrl: String(v.sourceUrl ?? ""),
        demandSignal: (v.demandSignal as ContentItem["demandSignal"]) ?? {
          text: "",
          source: String(v.sourceUrl ?? ""),
          date: "",
        },
        recognitionScore: Number(v.recognitionScore ?? 3),
        hook: (v.hook as ContentItem["hook"]) ?? {
          line1: "",
          line2: "",
          firstTwoSeconds: "",
          scorecard: {
            recognition: false,
            openLoop: false,
            firstTwoS: false,
            specificity: false,
            identity: false,
          },
        },
        script: (v.script as ContentItem["script"]) ?? defaultScript(),
        captions: (v.captions as ContentItem["captions"]) ?? defaultCaptions(),
        engagement: (v.engagement as ContentItem["engagement"]) ?? {
          triggerType: "",
          triggerText: "",
          firstComment: "",
          endCard: "",
        },
        checklist:
          (v.checklist as ContentItem["checklist"]) ?? defaultChecklist(),
        results: (v.results as ContentItem["results"]) ?? {
          viewsIG: null,
          viewsFB: null,
          skipRate: null,
          topSource: "",
          likes: null,
          comments: null,
          saves: null,
          follows: null,
          verdict: "",
          lesson: "",
        },
        seriesName: String(v.seriesName ?? ""),
        partNumber: v.partNumber != null ? Number(v.partNumber) : null,
        statusHistory: (v.statusHistory as ContentItem["statusHistory"]) ?? [
          {
            status: (v.status as Status) ?? "TO_SHOOT",
            timestamp: String(v.createdAt ?? new Date().toISOString()),
          },
        ],
        createdAt: String(v.createdAt ?? new Date().toISOString()),
        updatedAt: String(v.updatedAt ?? new Date().toISOString()),
      };
      if (!item.id) continue;
      await writeJson(path.join(CONTENT_DIR, `${item.id}.json`), item);
      migratedVideos++;
    } catch {
      /* skip corrupt files */
    }
  }

  // --- Migrate ideas.json → stage:"idea" items ---
  let migratedIdeas = 0;
  if (ideasRaw) {
    try {
      const ideas = JSON.parse(ideasRaw) as Array<Record<string, unknown>>;
      if (Array.isArray(ideas)) {
        for (const idea of ideas) {
          const ts = String(idea.createdAt ?? new Date().toISOString());
          const item: ContentItem = {
            id: String(idea.id ?? ""),
            stage: "idea",
            status: "TO_SHOOT",
            title: String(idea.title ?? ""),
            pillar: (idea.pillar as Pillar) ?? "Claude Code",
            hookType: "",
            format: "Talking head",
            lengthTarget: "",
            postingWindow: "",
            sourceUrl: String(idea.sourceUrl ?? ""),
            demandSignal: {
              text: "",
              source: String(idea.sourceUrl ?? ""),
              date: "",
            },
            recognitionScore: Number(idea.recognitionScore ?? 3),
            hook: {
              line1: String(idea.hookDraft ?? ""),
              line2: "",
              firstTwoSeconds: "",
              scorecard: {
                recognition: false,
                openLoop: false,
                firstTwoS: false,
                specificity: false,
                identity: false,
              },
            },
            script: [],
            captions: [],
            engagement: {
              triggerType: "",
              triggerText: "",
              firstComment: "",
              endCard: "",
            },
            checklist: [],
            results: {
              viewsIG: null,
              viewsFB: null,
              skipRate: null,
              topSource: "",
              likes: null,
              comments: null,
              saves: null,
              follows: null,
              verdict: "",
              lesson: "",
            },
            seriesName: "",
            partNumber: null,
            statusHistory: [{ status: "TO_SHOOT", timestamp: ts }],
            createdAt: ts,
            updatedAt: ts,
          };
          if (!item.id) continue;
          await writeJson(path.join(CONTENT_DIR, `${item.id}.json`), item);
          migratedIdeas++;
        }
      }
    } catch {
      /* skip corrupt */
    }
  }

  console.log(
    `[data] Migration complete: ${migratedVideos} videos + ${migratedIdeas} ideas → data/content/`
  );
}

// ---- Seed -------------------------------------------------------------------

let seeding: Promise<void> | null = null;

async function seedIfEmpty(): Promise<void> {
  if (seeding) return seeding;
  seeding = (async () => {
    const files = await fs.readdir(CONTENT_DIR);
    if (files.some((f) => f.endsWith(".json"))) return;

    const { seedVideos, seedIdeas } = await import("./seed");
    const videos = seedVideos();
    for (const v of videos) {
      await writeJson(path.join(CONTENT_DIR, `${v.id}.json`), v);
    }
    const cal = emptyWeek();
    DAY_KEYS.forEach((k, i) => {
      cal.days[k] = videos[i] ? [videos[i].id] : [];
    });
    await writeJson(path.join(CALENDARS_DIR, `${cal.week}.json`), cal);

    const ideas = seedIdeas();
    for (const idea of ideas) {
      await writeJson(path.join(CONTENT_DIR, `${idea.id}.json`), idea);
    }
    await writeJson(PERF_FILE, []);
  })();
  try {
    await seeding;
  } finally {
    seeding = null;
  }
}

async function bootstrap() {
  await ensureDirs();
  await migrateIfNeeded();
  await seedIfEmpty();
}

// ---- Unified Content Store --------------------------------------------------

export async function getAllContent(): Promise<ContentItem[]> {
  await bootstrap();
  const files = await fs.readdir(CONTENT_DIR);
  const items: ContentItem[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(CONTENT_DIR, f), "utf8");
      items.push(JSON.parse(raw) as ContentItem);
    } catch {
      /* skip corrupt */
    }
  }
  return items;
}

export async function getContentItem(id: string): Promise<ContentItem | null> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(
      path.join(CONTENT_DIR, `${id}.json`),
      "utf8"
    );
    return JSON.parse(raw) as ContentItem;
  } catch {
    return null;
  }
}

export async function saveContentItem(item: ContentItem): Promise<ContentItem> {
  await ensureDirs();
  item.updatedAt = new Date().toISOString();
  await writeJson(path.join(CONTENT_DIR, `${item.id}.json`), item);
  if (item.stage === "production") {
    await syncPerformanceRow(item);
  }
  return item;
}

export async function deleteContentItem(id: string): Promise<void> {
  try {
    await fs.unlink(path.join(CONTENT_DIR, `${id}.json`));
  } catch {
    /* ignore */
  }
}

// ---- Videos (backward-compat wrappers) -------------------------------------

export async function getAllVideos(): Promise<ContentItem[]> {
  const all = await getAllContent();
  return all
    .filter((i) => i.stage === "production")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getVideo(id: string): Promise<ContentItem | null> {
  return getContentItem(id);
}

export async function saveVideo(item: ContentItem): Promise<ContentItem> {
  return saveContentItem(item);
}

export async function deleteVideo(id: string): Promise<void> {
  return deleteContentItem(id);
}

// ---- Ideas ------------------------------------------------------------------

export async function getIdeas(): Promise<ContentItem[]> {
  const all = await getAllContent();
  return all
    .filter((i) => i.stage === "idea")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function saveIdeaItem(item: ContentItem): Promise<ContentItem> {
  return saveContentItem(item);
}

// Bulk-save: saves all incoming ideas and deletes idea files not in the list.
export async function saveIdeas(ideas: ContentItem[]): Promise<ContentItem[]> {
  await ensureDirs();
  await migrateIfNeeded();
  const allFiles = await fs.readdir(CONTENT_DIR).catch(() => [] as string[]);
  const currentIdeaIds = new Set(
    allFiles
      .filter((f) => f.startsWith("idea_") && f.endsWith(".json"))
      .map((f) => f.slice(0, -5))
  );
  const incomingIds = new Set(ideas.map((i) => i.id));

  for (const idea of ideas) {
    await saveContentItem(idea);
  }
  for (const id of currentIdeaIds) {
    if (!incomingIds.has(id)) {
      await deleteContentItem(id);
    }
  }
  return ideas;
}

// ---- Calendar ---------------------------------------------------------------

function migrateDays(raw: Record<string, unknown>): CalendarWeek["days"] {
  const days: CalendarWeek["days"] = {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  };
  for (const k of DAY_KEYS) {
    const v = raw[k];
    if (Array.isArray(v)) days[k] = v.filter(Boolean) as string[];
    else if (typeof v === "string") days[k] = [v];
    else days[k] = [];
  }
  return days;
}

export async function getCalendar(week?: string): Promise<CalendarWeek> {
  await ensureDirs();
  const wk = week ?? isoWeek();
  const weekFile = path.join(CALENDARS_DIR, `${wk}.json`);
  try {
    const raw = await fs.readFile(weekFile, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      ...(parsed as unknown as CalendarWeek),
      days: migrateDays(parsed.days as Record<string, unknown>),
    };
  } catch {
    if (!week || week === isoWeek()) {
      try {
        const raw = await fs.readFile(LEGACY_CALENDAR_FILE, "utf8");
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const migrated: CalendarWeek = {
          ...(parsed as unknown as CalendarWeek),
          week: wk,
          days: migrateDays(parsed.days as Record<string, unknown>),
        };
        await writeJson(weekFile, migrated);
        return migrated;
      } catch {
        /* fall through */
      }
    }
    return emptyWeek(wk);
  }
}

export async function saveCalendar(cal: CalendarWeek): Promise<CalendarWeek> {
  await ensureDirs();
  const weekFile = path.join(CALENDARS_DIR, `${cal.week}.json`);
  await writeJson(weekFile, cal);
  return cal;
}

function emptyWeek(week = isoWeek()): CalendarWeek {
  return {
    week,
    days: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
  };
}

// ---- Performance log --------------------------------------------------------

export async function getPerformanceLog(): Promise<PerformanceRow[]> {
  await ensureDirs();
  return readJson<PerformanceRow[]>(PERF_FILE, []);
}

async function syncPerformanceRow(item: ContentItem) {
  const log = await readJson<PerformanceRow[]>(PERF_FILE, []);
  const idx = log.findIndex((r) => r.videoId === item.id);
  if (item.status === "ANALYZED") {
    const row: PerformanceRow = {
      videoId: item.id,
      date: item.updatedAt.slice(0, 10),
      hook: item.hook.line1 || item.title,
      pillar: item.pillar,
      format: item.format,
      views: (item.results.viewsIG ?? 0) + (item.results.viewsFB ?? 0),
      skipRate: item.results.skipRate ?? 0,
      topSource: item.results.topSource,
      verdict: item.results.verdict,
      lesson: item.results.lesson,
    };
    if (idx >= 0) log[idx] = row;
    else log.push(row);
  } else if (idx >= 0) {
    log.splice(idx, 1);
  }
  await writeJson(PERF_FILE, log);
}

// Re-export for routes that import these from here
export { createVideo, createIdeaItem, defaultScript, defaultCaptions, defaultChecklist };
