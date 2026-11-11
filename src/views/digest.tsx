import type { Night } from '../digest/types.js';

const dash = '—';

export function DigestPage({ night }: { night: Night }) {
  const { rows, badLines } = night;
  return (
    <>
      <h1>digest · {night.night}</h1>
      {rows.length === 0 ? (
        <p>nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const failed = r.lastStatus === 'fail';
              return (
                <tr class={failed ? 'warn' : undefined}>
                  <td>{r.job}</td>
                  <td>{r.owner ?? dash}</td>
                  <td>{r.runs}</td>
                  <td class={r.retries >= 3 ? 'warn' : undefined}>
                    {r.retries >= 3 ? `${r.retries} ⚑` : String(r.retries)}
                  </td>
                  <td>{failed ? 'fail ⚑' : r.lastStatus}</td>
                  <td>{r.lastError ?? dash}</td>
                  <td>{r.firstAt}</td>
                  <td>{r.lastAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {badLines > 0 ? (
        <p class="mute">{badLines === 1 ? '1 line did not parse' : `${badLines} lines did not parse`}</p>
      ) : null}
    </>
  );
}

export function DigestMissing({ night }: { night: string }) {
  return (
    <>
      <h1>digest · {night}</h1>
      <p class="mute">no run log for that night</p>
    </>
  );
}
