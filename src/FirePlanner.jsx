import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Target, TrendingUp, Waves } from 'lucide-react';
import {
  FIRE_DEFAULTS, FIRE_STORAGE_KEY, MAX_PROJECTION_AGE, dateAfterMonths,
  accountAnnualRate, effectiveAnnualRate, estimatePortfolioContribution, monthlyRate,
  portfolioAssets, portfolioHistory, projectFire, readFireSettings, weightedReturns,
} from './fire.js';
import './FirePlanner.css';

const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const compactMoney = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);
const monthDate = date => date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
const ageLabel = (age, months) => {
  const total = Math.round(age * 12 + months);
  return `${Math.floor(total / 12)}y${total % 12 ? ` ${total % 12}m` : ''}`;
};

function NumberField({ label, value, onChange, ...props }) {
  return <label className="fire-field"><span>{label}</span><input type="number" value={value} onChange={event => onChange(event.target.value === '' ? '' : Number(event.target.value))} {...props} /></label>;
}

export default function FirePlanner({ records, columns }) {
  const [settings, setSettings] = useState(() => {
    try { return readFireSettings(window.localStorage); } catch { return { ...FIRE_DEFAULTS }; }
  });
  const [storageError, setStorageError] = useState(false);
  const update = (key, value) => setSettings(previous => ({ ...previous, [key]: value }));
  useEffect(() => {
    try {
      localStorage.setItem(FIRE_STORAGE_KEY, JSON.stringify(settings));
      setStorageError(false);
    } catch { setStorageError(true); }
  }, [settings]);

  const history = useMemo(() => portfolioHistory(records, columns, settings.accountNames), [records, columns, settings.accountNames]);
  const latest = history.snapshots.at(-1);
  const assets = useMemo(() => portfolioAssets(history.selected, latest, settings), [history.selected, latest, settings]);
  const estimate = useMemo(() => estimatePortfolioContribution(history.snapshots, assets), [history.snapshots, assets]);
  const fixedAndHysa = assets.filter(asset => ['fixed', 'cash'].includes(asset.type));
  const blendedSafeReturn = weightedReturns(fixedAndHysa);
  const blendedPortfolioReturn = weightedReturns(assets);
  const contribution = settings.contributionMode === 'manual' ? settings.monthlyContribution : estimate?.monthly;
  const projection = useMemo(() => projectFire({
    ...settings, startingBalance: latest?.balance, monthlyContribution: contribution, assets,
  }), [settings, latest, contribution, assets]);
  const valid = projection.errors.length === 0;
  const selectedNames = history.selected.map(column => column.name);
  const toggleAccount = name => update('accountNames', selectedNames.includes(name) ? selectedNames.filter(item => item !== name) : [...selectedNames, name]);
  const rateFor = column => {
    const rate = accountAnnualRate(column, settings);
    return typeof rate === 'number' && Number.isFinite(rate) ? Number(rate.toFixed(6)) : '';
  };
  const changeHysaPeriod = period => setSettings(previous => {
    const annual = effectiveAnnualRate(previous.hysaReturn, previous.hysaReturnPeriod);
    const converted = period === 'monthly' ? monthlyRate(annual) * 100 : annual;
    return { ...previous, hysaReturnPeriod: period, hysaReturn: Number.isFinite(converted) ? Number(converted.toFixed(8)) : '' };
  });
  const setAccountRate = (name, value) => setSettings(previous => {
    const rates = { ...previous.accountReturns };
    if (value === '') delete rates[name]; else rates[name] = value;
    return { ...previous, accountReturns: rates };
  });
  const milestone = months => months === null ? `Not reached by age ${MAX_PROJECTION_AGE}` : months === 0 ? 'Already reached' : `Age ${ageLabel(settings.currentAge, months)}`;
  const milestoneDate = months => months === null ? 'Under the current assumptions' : monthDate(dateAfterMonths(latest.date, months));
  const gapLabel = value => `${money(Math.abs(value - settings.fireGoal))} ${value >= settings.fireGoal ? 'above' : 'below'} goal`;

  return (
    <section className="fire-planner" aria-labelledby="fire-title">
      <header className="fire-header">
        <div><p className="fire-eyebrow">YOUR PATH TO FINANCIAL INDEPENDENCE</p><h2 id="fire-title"><Target size={25} aria-hidden="true" /> FIRE & Coast FIRE</h2><p>One goal. Two paths. See what your current investments can become.</p></div>
        <span className="fire-badge">Inflation adjusted · USD</span>
      </header>

      <div className="fire-goal-fields">
        <NumberField label="Age at latest record" value={settings.currentAge} onChange={value => update('currentAge', value)} min="0" max="100" step="1" placeholder="Your age" />
        <NumberField label="Target age" value={settings.targetAge} onChange={value => update('targetAge', value)} min={settings.currentAge || 0} max="100" step="1" />
        <NumberField label="FIRE goal · today's USD" value={settings.fireGoal} onChange={value => update('fireGoal', value)} min="1" step="10000" />
      </div>
      <p className="fire-note">Starting point: <strong>{latest ? monthDate(latest.date) : 'import a statement'}</strong>, the latest imported record. Enter your age on that date. Here, “today's USD” means that date's purchasing power. Dashboard filters do not change this starting point.</p>

      <div className="fire-assumptions">
        <NumberField label="Stock return default · % / year" value={settings.annualReturn} onChange={value => update('annualReturn', value)} min="-50" max="50" step="0.1" />
        <NumberField label="Fixed income average · % / year" value={settings.fixedReturn} onChange={value => update('fixedReturn', value)} min="-50" max="50" step="0.1" />
        <NumberField label={`HYSA / cash average · % / ${settings.hysaReturnPeriod === 'monthly' ? 'month' : 'year'}`} value={settings.hysaReturn} onChange={value => update('hysaReturn', value)} min="0" max={settings.hysaReturnPeriod === 'monthly' ? '3.4366' : '50'} step="0.01" />
        <label className="fire-field"><span>HYSA rate period</span><select aria-label="HYSA rate period" value={settings.hysaReturnPeriod} onChange={event => changeHysaPeriod(event.target.value)}><option value="monthly">Monthly rate (%)</option><option value="annual">Annual APY (%)</option></select></label>
        <NumberField label="Inflation · % / year" value={settings.inflation} onChange={value => update('inflation', value)} min="0" max="25" step="0.1" />
        <label className="fire-field"><span>Monthly contribution source</span><select aria-label="Monthly contribution source" value={settings.contributionMode} onChange={event => update('contributionMode', event.target.value)}><option value="history">Estimate from history</option><option value="manual">Enter actual contribution</option></select></label>
        {settings.contributionMode === 'manual' && <NumberField label="Monthly contribution · USD" value={settings.monthlyContribution} onChange={value => update('monthlyContribution', value)} step="100" placeholder="0" />}
      </div>

      <div className="fire-input-summary">
        <div><span>Selected investments</span><strong>{money(latest?.balance ?? 0)}</strong></div>
        <div><span>{settings.contributionMode === 'history' ? 'Estimated monthly net contribution' : 'Monthly net contribution'}</span><strong>{typeof contribution === 'number' ? money(contribution) : 'More data needed'}</strong></div>
        <div><span>Fixed income + HYSA / cash</span><strong>{money(fixedAndHysa.reduce((sum, asset) => sum + asset.balance, 0))}</strong></div>
      </div>
      <div className="fire-weighted-rates" aria-live="polite">
        <div><span>Weighted rate · fixed income + HYSA / cash</span><strong data-testid="fire-fixed-hysa-weighted">{blendedSafeReturn ? `${blendedSafeReturn.annual.toFixed(2)}% APY` : 'No funded accounts'}</strong><small>{blendedSafeReturn ? `${blendedSafeReturn.monthly.toFixed(3)}% for the first month · ${money(blendedSafeReturn.monthlyInterest)} estimated interest` : 'Select funded accounts and enter valid rates.'}</small></div>
        <div><span>Weighted rate · all selected investments</span><strong data-testid="fire-portfolio-weighted">{blendedPortfolioReturn ? `${blendedPortfolioReturn.annual.toFixed(2)}% / year` : 'No funded accounts'}</strong><small>Based on the latest balances and each account's effective annual rate.</small></div>
      </div>
      <p className="fire-note">Enter an average rate for fixed income and for HYSA / cash, or override individual accounts below. HYSA starts at 0% until you enter your rate. Interest paid monthly can still be quoted by your bank as an annual APY: choose the matching period. The combined rate is weighted by balance, not a simple average of the two rates.</p>
      <p className="fire-note">{estimate ? `Estimate uses ${estimate.intervals} intervals over ${estimate.months} months (${monthDate(estimate.start)}–${monthDate(estimate.end)}), subtracting each account's assumed growth from balance changes.` : 'At least two different months are needed to estimate contributions. You can enter the actual monthly amount instead.'} Balance changes can include transfers and market gains; this is an estimate, not a recorded contribution.</p>

      <details className="fire-details">
        <summary>Investment accounts & individual interest rates ({history.selected.length} selected)</summary>
        <p className="fire-note">Stocks, fixed income and cash accounts named HYSA, high yield, Marcus or savings are selected by default. Review the selection below and include any other interest-bearing cash accounts. Vehicles, other assets and debts are excluded by default. Individual overrides are effective annual rates (APY), with reinvested returns. The 7% stock and 4% fixed income defaults are assumptions, not rates read from your CSV. Clearing an override restores its group average.</p>
        <div className="fire-account-list">
          {columns.filter(column => column.type !== 'liability').map(column => (
            <div className="fire-account" key={column.id}>
              <label><input type="checkbox" aria-label={`Include ${column.name}`} checked={selectedNames.includes(column.name)} onChange={() => toggleAccount(column.name)} /><span>{column.name}<small>{column.type === 'fixed' ? 'Fixed income' : column.type === 'cash' ? 'HYSA / cash' : column.type}</small></span></label>
              <NumberField label={`${column.name} · annual %`} value={rateFor(column)} onChange={value => setAccountRate(column.name, value)} min="-50" max="50" step="0.1" disabled={!selectedNames.includes(column.name)} />
            </div>
          ))}
        </div>
        <button className="fire-reset" onClick={() => setSettings(previous => ({ ...previous, accountNames: null, accountReturns: {} }))}>Reset account selection & rate overrides</button>
      </details>

      {!valid ? <div className="fire-empty" role="status"><strong>Complete your plan to see the projections</strong><ul>{projection.errors.map(error => <li key={error}>{error}</li>)}</ul></div> : <>
        <div className="fire-results">
          <article className="fire-result fire-result-current"><div className="fire-result-title"><TrendingUp size={19} aria-hidden="true" /><h3>Keep the current trajectory</h3></div><span>At age {settings.targetAge}</span><strong data-testid="fire-continuing-value">{money(projection.atTarget.continuing)}</strong><p className={projection.continuingMeetsTarget ? 'fire-success' : 'fire-shortfall'}>{gapLabel(projection.atTarget.continuing)}</p><small>Keep {money(contribution)} / month, fixed in nominal USD.</small></article>
          <article className="fire-result fire-result-coast"><div className="fire-result-title"><Waves size={19} aria-hidden="true" /><h3>Stop contributing now</h3></div><span>At age {settings.targetAge}</span><strong data-testid="fire-coast-value">{money(projection.atTarget.coast)}</strong><p className={projection.coastMeetsTarget ? 'fire-success' : 'fire-shortfall'}>{gapLabel(projection.atTarget.coast)}</p><small>Zero new contributions or withdrawals; all returns reinvested.</small></article>
        </div>

        <div className="fire-milestones" aria-live="polite">
          <article><h3>Coast FIRE for age {settings.targetAge}</h3><strong data-testid="fire-coast-milestone">{projection.coastMonth === null ? 'Not reached by target age' : milestone(projection.coastMonth)}</strong><p>{projection.coastMonth === null ? 'The current trajectory does not fund the goal by that age.' : `${milestoneDate(projection.coastMonth)} · Earliest point to stop contributing and still meet the goal.`}</p></article>
          <article><h3>FIRE · keep contributing</h3><strong data-testid="fire-continue-milestone">{milestone(projection.fireMonth)}</strong><p>{milestoneDate(projection.fireMonth)}. Contributions continue until FIRE, even if later than your target age.</p></article>
          <article><h3>FIRE · stop contributing now</h3><strong>{milestone(projection.coastFireMonth)}</strong><p>{milestoneDate(projection.coastFireMonth)} · Growth of existing investments only.</p></article>
        </div>

        <div className="fire-chart-heading"><h3>Two paths to age {settings.targetAge}</h3><span>Today's USD · after inflation</span></div>
        <div className="fire-chart" role="img" aria-label={`Inflation-adjusted projections to age ${settings.targetAge}. Keep contributing: ${money(projection.atTarget.continuing)}. Stop now: ${money(projection.atTarget.coast)}. Goal: ${money(settings.fireGoal)}.`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={projection.series} margin={{ top: 15, right: 12, left: 5, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 5" stroke="#263449" vertical={false} />
              <XAxis dataKey="age" type="number" domain={settings.currentAge === settings.targetAge ? [settings.currentAge - 0.5, settings.targetAge + 0.5] : [settings.currentAge, settings.targetAge]} stroke="#94a3b8" tickFormatter={value => `${Math.round(value)}`} tick={{ fontSize: 12 }} minTickGap={30} label={{ value: 'Age', position: 'insideBottom', offset: -8, fill: '#94a3b8' }} />
              <YAxis stroke="#94a3b8" tickFormatter={compactMoney} tick={{ fontSize: 11 }} width={65} domain={[0, 'auto']} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#475569', borderRadius: 12, color: '#f8fafc' }} labelFormatter={age => `Age ${ageLabel(age, 0)} · ${monthDate(dateAfterMonths(latest.date, Math.round((age - settings.currentAge) * 12)))}`} formatter={(value, name) => [money(value), name]} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Line dataKey="goal" name="FIRE goal · today's USD" stroke="#fbbf24" strokeDasharray="5 5" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="continuing" name="Keep contributing" stroke="#a78bfa" strokeWidth={3} dot={projection.targetMonths === 0} isAnimationActive={false} />
              <Line dataKey="coast" name="Stop contributing now" stroke="#2dd4bf" strokeWidth={3} dot={projection.targetMonths === 0} isAnimationActive={false} />
              {projection.coastMonth !== null && <ReferenceLine x={settings.currentAge + projection.coastMonth / 12} stroke="#2dd4bf" strokeDasharray="3 3" label={{ value: 'Coast FIRE', position: 'insideTopRight', fill: '#5eead4', fontSize: 11 }} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="fire-target-detail"><div><span>Coast capital needed at the starting date</span><strong>{money(projection.coastRequiredNow)}</strong><small>With the selected portfolio mix and account rates.</small></div><div><span>Inflation-adjusted goal in future dollars</span><strong>{money(projection.nominalGoalAtTarget)}</strong><small>Equivalent to {money(settings.fireGoal)} today at age {settings.targetAge}.</small></div></div>
        {projection.depletionMonth !== null && <p className="fire-shortfall fire-note">At least one account cannot fund the projected withdrawals from age {ageLabel(settings.currentAge, projection.depletionMonth)}. Its balance is then floored at zero; the plan assumes no borrowing or transfers between accounts.</p>}
        {typeof contribution === 'number' && contribution < 0 && <p className="fire-shortfall fire-note">Your current trajectory implies net withdrawals. The “stop contributing now” scenario also stops those withdrawals.</p>}
      </>}

      <details className="fire-details fire-method"><summary>How the projection works</summary><p>Each account compounds monthly at its own effective annual rate, including fixed income. Interest and returns are reinvested at the same assumed rate throughout the projection; maturities and changes in renewal rates are not modeled. Contributions arrive at month end, stay fixed in nominal USD, and are split using the latest selected account balances. A zero-balance portfolio splits new contributions equally. Existing balances are not rebalanced.</p><p>The goal stays fixed in today's purchasing power. Every future balance is divided by cumulative inflation. Coast FIRE is the first month when the projected portfolio can grow to the goal at your target age with no further contributions or withdrawals. FIRE is the first month the inflation-adjusted portfolio reaches the goal, searched through age 100; the chart ends at your target age.</p><p>These are scenarios under constant assumptions, not guaranteed outcomes. Taxes, fees, pensions and retirement spending are not modeled. Coast still requires another source of income to cover living expenses until retirement.</p><p><a href="https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator" target="_blank" rel="noreferrer">About compound growth · Investor.gov</a></p></details>
      <p className="fire-save-note">{storageError ? 'Settings could not be saved in this browser.' : 'Plan settings are saved in this browser. Account balances continue to come from your imported CSV.'}</p>
    </section>
  );
}
