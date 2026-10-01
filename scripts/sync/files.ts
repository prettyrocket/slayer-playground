import { writeFile as fsWriteFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/** Writes `data` to `file`, creating folders, but leaves the file untouched when it's unchanged. */
export async function writeFile(file: string, data: string | Buffer): Promise<void> {
  const old = await readFile(file).catch(() => null);
  if (old?.equals(Buffer.from(data))) return;
  await mkdir(path.dirname(file), { recursive: true });
  await fsWriteFile(file, data);
}

/** Pretty-printed with a trailing newline, so commits show line-level diffs. */
export function writeJson(file: string, data: unknown): Promise<void> {
  return writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}
