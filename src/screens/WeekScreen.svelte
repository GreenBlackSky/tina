<!--
  Week: calories per day against the target (a bar chart), four totals, and
  a table of every day. Days with nothing logged stay out of the averages.
-->
<script lang="ts">
  import { addDays, parseDate, today } from '../lib/dates';
  import { fmt, r0 } from '../lib/nutrition';
  import { data, dayTotals, ui } from '../lib/state.svelte';

  const CHART = { width: 360, height: 200, left: 30, right: 4, top: 20, bottom: 24 };
  /** The chart always shows at least 125% of the target. */
  const HEADROOM = 1.25;
  /** More than 5% over (or under) the target is coloured. */
  const TOLERANCE = 0.05;

  const now = today();
  const goals = $derived(data.settings);
  const days = $derived(Array.from({ length: 7 }, (_, i) => addDays(ui.weekStart, i)));
  const rows = $derived(
    days.map((date) => ({
      date,
      values: dayTotals(date),
      logged: Boolean((data.days[date]?.entries ?? []).length),
      future: date > now,
    })),
  );
  const logged = $derived(rows.filter((row) => row.logged));
  const totals = $derived(
    logged.reduce(
      (sum, row) => ({
        kcal: sum.kcal + row.values.kcal,
        p: sum.p + row.values.p,
        c: sum.c + row.values.c,
        f: sum.f + row.values.f,
      }),
      { kcal: 0, p: 0, c: 0, f: 0 },
    ),
  );
  const divisor = $derived(logged.length || 1);
  const elapsed = $derived(rows.filter((row) => !row.future).length);
  const weekBudget = $derived(goals.kcal * 7);
  const netSoFar = $derived(logged.length ? totals.kcal - goals.kcal * logged.length : 0);
  const rangeLabel = $derived(
    parseDate(days[0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
      ' – ' +
      parseDate(days[6]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  );

  /* chart scale: rounded up to the next 500 */
  const top = $derived(
    Math.ceil((Math.max(goals.kcal * HEADROOM, ...rows.map((row) => row.values.kcal)) || 1) / 500) *
      500,
  );
  const gridStep = $derived(top <= 2500 ? 500 : 1000);
  const gridValues = $derived(
    Array.from({ length: Math.floor(top / gridStep) + 1 }, (_, i) => i * gridStep),
  );
  const yOf = (value: number): number =>
    CHART.top + (CHART.height - CHART.top - CHART.bottom) * (1 - value / top);
  const slot = (CHART.width - CHART.left - CHART.right) / 7;

  const weekday = (date: string, options: Intl.DateTimeFormatOptions): string =>
    parseDate(date).toLocaleDateString('en-GB', options);

  function diffClass(difference: number): string {
    if (difference > goals.kcal * TOLERANCE) {
      return 'over';
    }
    return difference < -goals.kcal * TOLERANCE ? 'under' : '';
  }

  const nextDisabled = $derived(addDays(ui.weekStart, 7) > now);
</script>

<div class="datenav">
  <button
    type="button"
    data-act="prevweek"
    aria-label="Previous week"
    onclick={() => (ui.weekStart = addDays(ui.weekStart, -7))}>‹</button
  ><b>{rangeLabel}</b>
  <button
    type="button"
    data-act="nextweek"
    aria-label="Next week"
    disabled={nextDisabled}
    onclick={() => {
      if (!nextDisabled) {
        ui.weekStart = addDays(ui.weekStart, 7);
      }
    }}>›</button
  >
</div>

<div class="chart">
  <svg
    viewBox="0 0 {CHART.width} {CHART.height}"
    role="img"
    aria-label="Calories per day against target"
  >
    {#each gridValues as value (value)}
      <line
        x1={CHART.left}
        x2={CHART.width - CHART.right}
        y1={yOf(value)}
        y2={yOf(value)}
        stroke="var(--line)"
        stroke-width="1"
      />
      <text
        x={CHART.left - 6}
        y={yOf(value) + 4}
        text-anchor="end"
        font-size="10.5"
        fill="var(--muted)">{value >= 1000 ? value / 1000 + 'k' : value}</text
      >
    {/each}
    {#each rows as row, i (row.date)}
      {@const x = CHART.left + i * slot + slot * 0.18}
      {@const width = slot * 0.64}
      {@const isToday = row.date === now}
      {#if row.logged}
        <rect
          {x}
          y={yOf(row.values.kcal)}
          {width}
          height={Math.max(0, yOf(0) - yOf(row.values.kcal))}
          rx="4"
          fill={row.values.kcal > goals.kcal * (1 + TOLERANCE) ? 'var(--over)' : 'var(--accent)'}
          opacity={isToday ? 1 : 0.85}
        />
        <text
          x={x + width / 2}
          y={yOf(row.values.kcal) - 6}
          text-anchor="middle"
          font-size="10.5"
          font-weight="700"
          fill="var(--ink)">{fmt(row.values.kcal)}</text
        >
      {:else if !row.future}
        <rect {x} y={yOf(0) - 3} {width} height="3" rx="1.5" fill="var(--line)" />
      {/if}
      <text
        x={x + width / 2}
        y={CHART.height - 7}
        text-anchor="middle"
        font-size="11"
        font-weight={isToday ? 800 : 500}
        fill={isToday ? 'var(--ink)' : 'var(--muted)'}
        >{weekday(row.date, { weekday: 'short' })}</text
      >
    {/each}
    <line
      x1={CHART.left}
      x2={CHART.width - CHART.right}
      y1={yOf(goals.kcal)}
      y2={yOf(goals.kcal)}
      stroke="var(--ink)"
      stroke-width="1.5"
      stroke-dasharray="5 4"
    /><text
      x={CHART.width - CHART.right}
      y={yOf(goals.kcal) - 5}
      text-anchor="end"
      font-size="10"
      font-weight="700"
      fill="var(--ink)">target {fmt(goals.kcal)}</text
    >
  </svg>
</div>

<div class="stats">
  <div class="stat">
    <div class="l">Week total</div>
    <div class="v num">{fmt(totals.kcal)}</div>
    <div class="s num">of {fmt(weekBudget)} kcal (7 × {fmt(goals.kcal)})</div>
  </div>
  <div class="stat">
    <div class="l">vs target, logged days</div>
    <div class="v num" style="color:{netSoFar > 0 ? 'var(--over)' : 'var(--accent)'}">
      {netSoFar > 0 ? '+' : ''}{fmt(netSoFar)}{#if netSoFar > 0}<small>&nbsp;over</small>{/if}
    </div>
    <div class="s num">
      {logged.length} day{logged.length === 1 ? '' : 's'} logged{elapsed < 7
        ? `, ${fmt(Math.max(0, weekBudget - totals.kcal))} kcal left this week`
        : ''}
    </div>
  </div>
  <div class="stat">
    <div class="l">Avg per day</div>
    <div class="v num">{logged.length ? fmt(totals.kcal / divisor) : '—'}</div>
    <div class="s num">target {fmt(goals.kcal)}</div>
  </div>
  <div class="stat">
    <div class="l">Avg macros</div>
    <div class="v num" style="font-size:17px;padding-block:4px">
      <span style="color:var(--pro)">{r0(totals.p / divisor)}</span> /
      <span style="color:var(--carb)">{r0(totals.c / divisor)}</span> /
      <span style="color:var(--fat)">{r0(totals.f / divisor)}</span>
    </div>
    <div class="s num">P / C / F g · target {r0(goals.p)}/{r0(goals.c)}/{r0(goals.f)}</div>
  </div>
</div>

<div class="tablewrap">
  <table class="num">
    <thead
      ><tr><th>Day</th><th>Target</th><th>Eaten</th><th>Diff</th><th>P</th><th>C</th><th>F</th></tr
      ></thead
    >
    <tbody>
      {#each rows as row (row.date)}
        {@const difference = row.values.kcal - goals.kcal}
        <tr>
          <td>{weekday(row.date, { weekday: 'short', day: 'numeric' })}</td>
          <td>{fmt(goals.kcal)}</td>
          <td>{row.logged ? fmt(row.values.kcal) : ''}</td>
          {#if row.logged}
            <td class={diffClass(difference)}>{difference > 0 ? '+' : ''}{fmt(difference)}</td>
          {:else}
            <td style="color:var(--muted)">{row.future ? '' : '—'}</td>
          {/if}
          <td>{row.logged ? r0(row.values.p) : ''}</td>
          <td>{row.logged ? r0(row.values.c) : ''}</td>
          <td>{row.logged ? r0(row.values.f) : ''}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
<p class="hint">Days with nothing logged are left out of averages and the difference.</p>
