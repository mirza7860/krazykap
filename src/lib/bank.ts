"use client";

import { supabase } from "@/lib/rpc";

/**
 * The bank's module index.
 *
 * Modules are never read as a flat list of questions: `question_modules` groups
 * in the database and hands back one page of modules at a time, so a teacher
 * with 100 modules of 100 questions pays for 24 module names — not 10,000 rows.
 *
 * Installations that have not re-run supabase/schema.sql yet fall back to a
 * capped client-side scan of the `set_name` column only (never prompt text),
 * which is cached against the caller's revision stamp so paging stays cheap.
 */

/** Modules returned per page. */
export const MODULE_PAGE = 24;

/** Fallback only: rows read per request while scanning for module names. */
const SCAN_PAGE = 1000;
/** Fallback only: stop scanning after this many questions. */
const SCAN_MAX = 10000;

export interface BankModule {
  name: string | null;
  count: number;
}

interface RpcModuleRow {
  set_name: string | null;
  question_count: number | string;
  total_modules: number | string;
}

let scanCache: { stamp: string; list: BankModule[] } | null = null;

/** Builds the module list by reading `set_name` only — never prompt text. */
async function scanModules(): Promise<BankModule[]> {
  const { count } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true });
  const total = count ?? 0;
  const pages = Math.min(Math.ceil(total / SCAN_PAGE), SCAN_MAX / SCAN_PAGE);
  if (pages === 0) return [];

  const batches = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      supabase
        .from("questions")
        .select("set_name")
        .order("id")
        .range(i * SCAN_PAGE, i * SCAN_PAGE + SCAN_PAGE - 1),
    ),
  );

  const counts = new Map<string, number>();
  let ungrouped = 0;
  for (const batch of batches) {
    for (const row of (batch.data ?? []) as { set_name: string | null }[]) {
      if (row.set_name) counts.set(row.set_name, (counts.get(row.set_name) ?? 0) + 1);
      else ungrouped += 1;
    }
  }

  const list: BankModule[] = Array.from(counts, ([name, n]) => ({ name, count: n })).sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? ""),
  );
  if (ungrouped > 0) list.push({ name: null, count: ungrouped });
  return list;
}

/**
 * Fetches one page of modules.
 *
 * `total` is null when the caller already has a total and this page could not
 * report one — paging past the end must not be mistaken for an empty bank.
 */
export async function fetchModules(
  search: string,
  limit: number,
  offset: number,
  stamp: string,
): Promise<{ rows: BankModule[]; total: number | null }> {
  const term = search.trim();

  const { data, error } = await supabase.rpc("question_modules", {
    p_search: term || null,
    p_limit: limit,
    p_offset: offset,
  });

  if (!error && Array.isArray(data)) {
    const raw = data as RpcModuleRow[];
    const rows = raw.map((r) => ({ name: r.set_name, count: Number(r.question_count) }));
    const total = raw.length > 0 ? Number(raw[0].total_modules) : offset > 0 ? null : 0;
    return { rows, total };
  }

  // Fallback: the function is not deployed yet. Scan once per revision, then
  // page and filter in memory so the UI behaves the same way either way.
  if (!scanCache || scanCache.stamp !== stamp) {
    scanCache = { stamp, list: await scanModules() };
  }
  const needle = term.toLowerCase();
  const matches = needle
    ? scanCache.list.filter((m) => (m.name ?? "").toLowerCase().includes(needle))
    : scanCache.list;
  return { rows: matches.slice(offset, offset + limit), total: matches.length };
}
