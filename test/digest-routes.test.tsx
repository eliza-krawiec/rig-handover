import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const NORMAL = '2026-10-28';
const EMPTY = '2026-10-20';
const BAD = '2026-10-21';
const NULL_OWNER = '2026-10-22';
const MISSING = '2026-10-15';

const goodLines = [
  '{"at":"2026-10-21T23:00:02+01:00","job":"zeta/last","status":"ok","owner":"rook"}',
  '{"at":"2026-10-21T23:05:00+01:00","job":"alpha/first","status":"fail","owner":"lane-07","error":"boom"}',
];

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  process.env.LANE_MARKER = 'TEST-MARKER';
  runsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-digest-routes-'));
  // Read the real night, never modify runs/.
  fs.writeFileSync(path.join(runsDir, `${NORMAL}.jsonl`), fs.readFileSync(path.join('runs', `${NORMAL}.jsonl`)));
  fs.writeFileSync(path.join(runsDir, `${EMPTY}.jsonl`), '');
  fs.writeFileSync(path.join(runsDir, `${BAD}.jsonl`), [goodLines[0], 'this is not json', goodLines[1]].join('\n') + '\n');
  fs.writeFileSync(
    path.join(runsDir, `${NULL_OWNER}.jsonl`),
    '{"at":"2026-10-22T01:00:00+01:00","job":"orphan/job","status":"ok","owner":null}\n',
  );
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
});

afterAll(() => {
  fs.rmSync(runsDir, { recursive: true, force: true });
});

type ApiRow = { job: string };
type ApiNight = { night: string; rows: ApiRow[]; counts: Record<string, number>; badLines: number };

describe('GET /digest/:night', () => {
  it('renders a found night with the lane banner and a table', async () => {
    const res = await app.request(`/digest/${NORMAL}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain(`digest · ${NORMAL}`);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('<table');
  });

  it('renders owner null as an em dash', async () => {
    const res = await app.request(`/digest/${NULL_OWNER}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('orphan/job');
    expect(html).toContain('—');
  });

  it('says nothing ran for an empty file', async () => {
    const res = await app.request(`/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still answers 200 and counts one bad line', async () => {
    const res = await app.request(`/digest/${BAD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 line did not parse');
    expect(html).toContain('alpha/first');
    expect(html).toContain('zeta/last');
  });

  it('answers 404 for a night with no file', async () => {
    expect((await app.request(`/digest/${MISSING}`)).status).toBe(404);
  });

  it('answers 404 for a path-traversal or malformed night', async () => {
    expect((await app.request('/digest/..%2Fx')).status).toBe(404);
    expect((await app.request('/digest/not-a-date')).status).toBe(404);
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the night as JSON', async () => {
    const res = await app.request(`/api/digest/${NORMAL}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiNight;
    expect(body.night).toBe(NORMAL);
    expect(body.rows.length).toBeGreaterThan(0);
    expect(body.counts).toEqual(
      expect.objectContaining({ ok: expect.any(Number), retry: expect.any(Number), fail: expect.any(Number) }),
    );
    expect(body.badLines).toBe(0);
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual([...jobs].sort());
  });

  it('answers 404 JSON with an error for a missing night', async () => {
    const res = await app.request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: unknown };
    expect(body.error).toBeTruthy();
  });

  it('answers 404 for a malformed night', async () => {
    expect((await app.request('/api/digest/not-a-date')).status).toBe(404);
    expect((await app.request('/api/digest/..%2Fx')).status).toBe(404);
  });

  it('reports one bad line and keeps the good rows', async () => {
    const res = await app.request(`/api/digest/${BAD}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiNight;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/first', 'zeta/last']);
  });

  it('returns no rows for an empty night', async () => {
    const res = await app.request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiNight;
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });
});

describe('page and JSON agree', () => {
  for (const night of [NORMAL, BAD]) {
    it(`list the same jobs in the same order for ${night}`, async () => {
      const api = (await (await app.request(`/api/digest/${night}`)).json()) as ApiNight;
      const html = await (await app.request(`/digest/${night}`)).text();
      const jobs = api.rows.map((r) => r.job);
      expect(jobs.length).toBeGreaterThan(0);
      const positions = jobs.map((job) => html.indexOf(job));
      expect(positions.every((p) => p >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });
  }
});
