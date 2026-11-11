// Plan morning-digest § 1. The contract every part of § 2 starts against.

/** `status` of one line in `runs/<night>.jsonl`. */
export type RunStatus = 'ok' | 'retry' | 'fail';

/** One line of the run log, after parsing. */
export type RunLine = {
  at: string; // ISO 8601 with the log's own offset; never converted to UTC
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

/** One row per job for the night. */
export type DigestRow = {
  job: string;
  /** `null` stays `null` here; views render it as `—`. Taken from the job's last line. */
  owner: string | null;
  /** Lines for this job. */
  runs: number;
  /** Lines with `status: "retry"`. */
  retries: number;
  /** `status` of the job's last line (by `at`). */
  lastStatus: RunStatus;
  /** `error` of the job's last line that had one, or `null`. */
  lastError: string | null;
  /** `at` of the job's first and last line, as written in the log. */
  firstAt: string;
  lastAt: string;
};

/** Lines per status over the whole night (bad lines not included). */
export type NightCounts = Record<RunStatus, number>;

export type Night = {
  night: string; // YYYY-MM-DD
  /** Sorted by `job`. Empty for an empty file ("nothing ran"). */
  rows: DigestRow[];
  counts: NightCounts;
  /** Lines that did not parse or did not match `RunLine`. Counted, never thrown. Blank lines are not counted. */
  badLines: number;
};

/**
 * Reads `<runsDir>/<night>.jsonl`.
 * Returns `null` when there is no such file, or when `night` is not `YYYY-MM-DD` (callers answer 404).
 * Implemented in `src/digest/read.ts` as `export const readNight: ReadNight`.
 */
export type ReadNight = (runsDir: string, night: string) => Night | null;
