import { execFile } from "child_process";
import { createWriteStream } from "fs";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { UPLOAD_DIR } from "@/lib/uploads";
import { BACKUP_APP_ID, BACKUP_FORMAT } from "@/lib/backup-shared";

export {
  BACKUP_APP_ID,
  BACKUP_FORMAT,
  MAX_BACKUP_BYTES,
  RESTORE_CONFIRM_PHRASE,
  looksLikeRejectedUpload,
} from "@/lib/backup-shared";

const execFileAsync = promisify(execFile);

const PG_TIMEOUT_MS = 10 * 60 * 1000;
const ZIP_TIMEOUT_MS = 10 * 60 * 1000;

export type BackupToolStatus = {
  pgDump: boolean;
  pgRestore: boolean;
  zip: boolean;
  unzip: boolean;
};

export type BackupManifest = {
  app: string;
  label: string;
  format: number;
  createdAt: string;
  dump: string;
  dumpFormat: "custom" | "sql";
  uploads: string;
};

type PgConn = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
};

const SECRET_ENV_KEYS = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
  "POSTGRES_PASSWORD",
  "WHATSAPP_API_TOKEN",
] as const;

export function publicErrorMessage(err: unknown, fallback: string): string {
  let message = fallback;
  if (err instanceof Error && err.message) message = err.message;
  else if (typeof err === "string" && err.trim()) message = err;

  if (isErrno(err) && err.code === "ENOENT") {
    const bin = err.path || "required tool";
    if (bin.includes("pg_dump")) {
      message = "pg_dump is not installed on this server. Install postgresql-client and try again.";
    } else if (bin.includes("pg_restore") || bin.includes("psql")) {
      message = "pg_restore is not installed on this server. Install postgresql-client and try again.";
    } else if (bin === "zip" || bin.includes("/zip")) {
      message = "The zip tool is not installed on this server.";
    } else if (bin === "unzip" || bin.includes("/unzip")) {
      message = "The unzip tool is not installed on this server.";
    }
  }

  for (const key of SECRET_ENV_KEYS) {
    const val = process.env[key];
    if (val && val.length > 4 && message.includes(val)) {
      message = message.split(val).join("[redacted]");
    }
  }
  message = message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]");
  message = message.replace(/password\s*[=:]\s*\S+/gi, "password=[redacted]");
  return message.replace(/\s+/g, " ").trim() || fallback;
}

function isErrno(err: unknown): err is NodeJS.ErrnoException {
  return typeof err === "object" && err !== null && "code" in err;
}

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execFileAsync("which", [cmd]);
    return true;
  } catch {
    return false;
  }
}

export async function getBackupToolStatus(): Promise<BackupToolStatus> {
  const [pgDump, pgRestore, zip, unzip] = await Promise.all([
    commandExists("pg_dump"),
    commandExists("pg_restore"),
    commandExists("zip"),
    commandExists("unzip"),
  ]);
  return { pgDump, pgRestore, zip, unzip };
}

function parseDatabaseUrl(): PgConn {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("The database is not configured.");
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("The database is not configured.");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, "")).split("/")[0];
  if (!url.hostname || !url.username || !database) {
    throw new Error("The database is not configured.");
  }
  return {
    host: url.hostname,
    port: url.port || "5432",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password || ""),
    database,
  };
}

function pgEnv(conn: PgConn): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PGPASSWORD: conn.password,
    PGCONNECT_TIMEOUT: "15",
    PGCLIENTENCODING: "UTF8",
  };
}

async function runPg(
  bin: "pg_dump" | "pg_restore" | "psql",
  args: string[],
  conn: PgConn
): Promise<void> {
  try {
    await execFileAsync(bin, args, {
      env: pgEnv(conn),
      timeout: PG_TIMEOUT_MS,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (err) {
    const stderr =
      typeof err === "object" && err && "stderr" in err
        ? String((err as { stderr?: string }).stderr || "")
        : "";
    const combined = `${stderr} ${err instanceof Error ? err.message : ""}`.trim();
    if (/could not connect|connection refused|timeout expired|no route to host/i.test(combined)) {
      throw new Error("Could not reach the database. Check that PostgreSQL is running.");
    }
    if (/authentication failed|no password supplied/i.test(combined)) {
      throw new Error("Could not authenticate to the database.");
    }
    if (isErrno(err) && err.code === "ENOENT") {
      throw err;
    }
    throw new Error(
      publicErrorMessage(combined || err, `${bin} failed. See server logs for details.`)
    );
  }
}

export function backupFilename(at = new Date()): string {
  const y = at.getFullYear().toString().padStart(4, "0");
  const m = (at.getMonth() + 1).toString().padStart(2, "0");
  const d = at.getDate().toString().padStart(2, "0");
  const hh = at.getHours().toString().padStart(2, "0");
  const mm = at.getMinutes().toString().padStart(2, "0");
  return `srms-backup-${y}${m}${d}-${hh}${mm}.zip`;
}

function zipMagicOk(buffer: Uint8Array): boolean {
  if (buffer.length < 4) return false;
  return buffer[0] === 0x50 && buffer[1] === 0x4b;
}

export async function listZipEntries(zipPath: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("unzip", ["-Z", "-1", zipPath], {
      timeout: 60_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (err) {
    if (isErrno(err) && err.code === "ENOENT") throw err;
    throw new Error("This file is not a valid zip archive.");
  }
}

export function assertSrmsBackupEntries(entries: string[]): void {
  if (entries.some((e) => e === "[Content_Types].xml" || e.startsWith("xl/") || e.startsWith("word/"))) {
    throw new Error("That file looks like an Office document, not a Society Records backup.");
  }
  for (const entry of entries) {
    const normalized = entry.replace(/\\/g, "/");
    if (normalized.startsWith("/") || normalized.includes(":") || path.posix.normalize(normalized).startsWith("..")) {
      throw new Error("Backup zip contains invalid paths.");
    }
  }
  const names = new Set(entries.map((e) => e.replace(/\\/g, "/").replace(/^\.\//, "")));
  if (!names.has("manifest.json")) {
    throw new Error("This zip is not a Society Records backup (missing manifest.json).");
  }
  if (!names.has("database.dump") && !names.has("database.sql")) {
    throw new Error("This zip is not a Society Records backup (missing database dump).");
  }
}

function parseManifest(raw: string): BackupManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Backup manifest is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Backup manifest is not valid.");
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.app !== BACKUP_APP_ID) {
    throw new Error("This zip was not produced by Society Records.");
  }
  if (obj.format !== BACKUP_FORMAT) {
    throw new Error("This backup format is not supported by this version of the app.");
  }
  const dump = typeof obj.dump === "string" ? obj.dump : "database.dump";
  const dumpFormat = obj.dumpFormat === "sql" ? "sql" : "custom";
  const uploads = typeof obj.uploads === "string" ? obj.uploads : "uploads/";
  return {
    app: BACKUP_APP_ID,
    label: typeof obj.label === "string" ? obj.label : "Society Records backup",
    format: BACKUP_FORMAT,
    createdAt: typeof obj.createdAt === "string" ? obj.createdAt : "",
    dump,
    dumpFormat,
    uploads,
  };
}

export async function createAppBackup(): Promise<{
  zipPath: string;
  filename: string;
  byteSize: number;
  cleanup: () => Promise<void>;
}> {
  const tools = await getBackupToolStatus();
  if (!tools.pgDump) {
    throw new Error("pg_dump is not installed on this server. Install postgresql-client and try again.");
  }
  if (!tools.zip) {
    throw new Error("The zip tool is not installed on this server.");
  }

  const conn = parseDatabaseUrl();
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "srms-backup-"));
  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    await fs.rm(workDir, { recursive: true, force: true });
  };

  try {
    const dumpPath = path.join(workDir, "database.dump");
    await runPg(
      "pg_dump",
      ["-Fc", "--no-owner", "--no-acl", "-f", dumpPath, "-h", conn.host, "-p", conn.port, "-U", conn.user, "-d", conn.database],
      conn
    );

    const uploadsStaging = path.join(workDir, "uploads");
    await fs.mkdir(uploadsStaging, { recursive: true });
    const uploadRoot = path.resolve(UPLOAD_DIR);
    try {
      const stat = await fs.stat(uploadRoot);
      if (stat.isDirectory()) {
        const entries = await fs.readdir(uploadRoot);
        for (const name of entries) {
          await fs.cp(path.join(uploadRoot, name), path.join(uploadsStaging, name), { recursive: true });
        }
      }
    } catch {
      // Missing uploads dir is fine — backup still includes an empty uploads/ folder.
    }

    const createdAt = new Date();
    const manifest: BackupManifest = {
      app: BACKUP_APP_ID,
      label: "Society Records backup",
      format: BACKUP_FORMAT,
      createdAt: createdAt.toISOString(),
      dump: "database.dump",
      dumpFormat: "custom",
      uploads: "uploads/",
    };
    await fs.writeFile(path.join(workDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const filename = backupFilename(createdAt);
    const zipPath = path.join(workDir, filename);
    await execFileAsync("zip", ["-r", "-q", filename, "manifest.json", "database.dump", "uploads"], {
      cwd: workDir,
      timeout: ZIP_TIMEOUT_MS,
    });

    const byteSize = (await fs.stat(zipPath)).size;
    return { zipPath, filename, byteSize, cleanup };
  } catch (err) {
    await cleanup();
    throw err;
  }
}

export async function inspectBackupZip(zipPath: string): Promise<BackupManifest> {
  const fd = await fs.open(zipPath, "r");
  try {
    const header = Buffer.alloc(8);
    await fd.read(header, 0, 8, 0);
    if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
      throw new Error("PDF files cannot be restored. Choose a .zip downloaded from Settings → Backup & restore.");
    }
    if (!zipMagicOk(header)) {
      throw new Error("This file is not a zip archive. Upload a backup downloaded from this page.");
    }
  } finally {
    await fd.close();
  }

  const entries = await listZipEntries(zipPath);
  assertSrmsBackupEntries(entries);

  const extractDir = await fs.mkdtemp(path.join(os.tmpdir(), "srms-backup-inspect-"));
  try {
    await execFileAsync("unzip", ["-q", "-o", zipPath, "manifest.json", "-d", extractDir], { timeout: 60_000 });
    const raw = await fs.readFile(path.join(extractDir, "manifest.json"), "utf8");
    return parseManifest(raw);
  } finally {
    await fs.rm(extractDir, { recursive: true, force: true });
  }
}

async function emptyDirectory(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir);
  for (const name of entries) {
    await fs.rm(path.join(dir, name), { recursive: true, force: true });
  }
}

async function replaceUploadDir(sourceUploads: string): Promise<void> {
  await emptyDirectory(UPLOAD_DIR);
  try {
    const stat = await fs.stat(sourceUploads);
    if (!stat.isDirectory()) return;
  } catch {
    return;
  }
  const incoming = await fs.readdir(sourceUploads);
  for (const name of incoming) {
    await fs.cp(path.join(sourceUploads, name), path.join(UPLOAD_DIR, name), { recursive: true });
  }
}

/**
 * Replaces the live database and uploaded files. Call only from the restore UI action.
 */
export async function restoreAppBackup(zipPath: string): Promise<BackupManifest> {
  const tools = await getBackupToolStatus();
  if (!tools.pgRestore) {
    throw new Error("pg_restore is not installed on this server. Install postgresql-client and try again.");
  }
  if (!tools.unzip) {
    throw new Error("The unzip tool is not installed on this server.");
  }

  const manifest = await inspectBackupZip(zipPath);
  const conn = parseDatabaseUrl();
  const extractDir = await fs.mkdtemp(path.join(os.tmpdir(), "srms-restore-"));

  try {
    await execFileAsync("unzip", ["-q", "-o", zipPath, "-d", extractDir], { timeout: ZIP_TIMEOUT_MS });

    const dumpName = manifest.dumpFormat === "sql" ? "database.sql" : "database.dump";
    const dumpPath = path.join(extractDir, dumpName);
    try {
      await fs.access(dumpPath);
    } catch {
      throw new Error("This zip is not a Society Records backup (missing database dump).");
    }

    await runPg(
      "psql",
      [
        "-h",
        conn.host,
        "-p",
        conn.port,
        "-U",
        conn.user,
        "-d",
        conn.database,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();",
      ],
      conn
    );

    if (manifest.dumpFormat === "sql") {
      await runPg(
        "psql",
        ["-h", conn.host, "-p", conn.port, "-U", conn.user, "-d", conn.database, "-v", "ON_ERROR_STOP=1", "-f", dumpPath],
        conn
      );
    } else {
      await runPg(
        "pg_restore",
        [
          "--clean",
          "--if-exists",
          "--no-owner",
          "--no-acl",
          "--exit-on-error",
          "-h",
          conn.host,
          "-p",
          conn.port,
          "-U",
          conn.user,
          "-d",
          conn.database,
          dumpPath,
        ],
        conn
      );
    }

    await replaceUploadDir(path.join(extractDir, "uploads"));
    return manifest;
  } finally {
    await fs.rm(extractDir, { recursive: true, force: true });
  }
}

/** Write a file from an uploaded File without keeping the whole zip in a second buffer longer than needed. */
export async function writeUploadedBackup(file: File, destPath: string): Promise<void> {
  const stream = file.stream();
  const writable = createWriteStream(destPath);
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      await new Promise<void>((resolve, reject) => {
        writable.write(Buffer.from(value), (err) => (err ? reject(err) : resolve()));
      });
    }
    await new Promise<void>((resolve, reject) => {
      writable.end((err: Error | null | undefined) => (err ? reject(err) : resolve()));
    });
  } catch (err) {
    writable.destroy();
    throw err;
  }
}
