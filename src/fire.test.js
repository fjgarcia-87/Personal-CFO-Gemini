import test from 'node:test';
import assert from 'node:assert/strict';
import { FIRE_DEFAULTS, dateAfterMonths, effectiveAnnualRate, estimatePortfolioContribution, portfolioAssets, portfolioHistory, projectFire, readFireSettings, weightedReturns } from './fire.js';

const plan = overrides => projectFire({ ...FIRE_DEFAULTS, currentAge: 40, startingBalance: 500_000, monthlyContribution: 2_000, ...overrides });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-8, `${actual} != ${expected}`);
const columns = [{ id: 'stocks', name: 'Brokerage', type: 'equity' }, { id: 'cd', name: 'CD', type: 'fixed' }, { id: 'bank', name: 'Savings', type: 'cash' }, { id: 'car', name: 'Car', type: 'other' }, { id: 'loan', name: 'Loan', type: 'liability' }];

test('defaults preserve the requested retirement goal and require the user age', () => {
  assert.equal(FIRE_DEFAULTS.targetAge, 55);
  assert.equal(FIRE_DEFAULTS.fireGoal, 2_000_000);
  assert.equal(FIRE_DEFAULTS.currentAge, '');
});

test('zero return uses linear contributions and zero contributions preserve principal', () => {
  const result = plan({ annualReturn: 0, inflation: 0 });
  close(result.atTarget.continuing, 500_000 + 180 * 2_000);
  close(result.atTarget.coast, 500_000);
  assert.equal(result.fireMonth, null);
  assert.equal(result.coastMonth, null);
});

test('annual effective growth and inflation are compounded consistently', () => {
  const result = plan({ monthlyContribution: 0 });
  close(result.atTarget.coast, 500_000 * (1.07 / 1.025) ** 15);
  close(result.nominalGoalAtTarget, 2_000_000 * 1.025 ** 15);
  close(result.coastRequiredNow, 2_000_000 * (1.025 / 1.07) ** 15);
  close(result.atTarget.continuing, result.atTarget.coast);
});

test('fixed income grows at its own reinvested rate in both scenarios', () => {
  const assets = [{ name: 'Stocks', balance: 300_000, annualReturn: 10, weight: 0.6 }, { name: 'CD', balance: 200_000, annualReturn: 4, weight: 0.4 }];
  const result = plan({ assets, monthlyContribution: 0, inflation: 0 });
  const expected = 300_000 * 1.1 ** 15 + 200_000 * 1.04 ** 15;
  close(result.atTarget.coast, expected);
  close(result.atTarget.continuing, expected);
  assert.ok(Math.abs(result.atTarget.coast - 500_000 * 1.076 ** 15) > 10_000, 'Do not compound at a blended rate');
});

test('mixed accounts allocate nominal contributions by latest balance weights', () => {
  const assets = [{ name: 'Stocks', balance: 250_000, annualReturn: 12, weight: 0.5 }, { name: 'Fixed', balance: 250_000, annualReturn: 0, weight: 0.5 }];
  const result = plan({ assets, targetAge: 41, inflation: 0 });
  const rate = 1.12 ** (1 / 12) - 1;
  const expected = 250_000 * 1.12 + 1_000 * (1.12 - 1) / rate + 250_000 + 12_000;
  close(result.atTarget.continuing, expected);
  close(result.atTarget.coast, 530_000);
});

test('COAST is reached before FIRE with exact monthly precision', () => {
  const result = plan({ currentAge: 40, targetAge: 50, startingBalance: 0, monthlyContribution: 1_000, fireGoal: 100_000, annualReturn: 12, inflation: 0 });
  const rate = 1.12 ** (1 / 12) - 1;
  const expectedCoastMonth = Math.ceil(-Math.log(1 - 100_000 * rate / (1_000 * (1 + rate) ** 120)) / Math.log(1 + rate));
  assert.equal(result.coastMonth, expectedCoastMonth);
  assert.ok(result.coastMonth < result.fireMonth);
  assert.ok(result.fireMonth < 120);
});

test('COAST discounts mixed account growth to the same inflation-adjusted deadline', () => {
  const assets = [{ name: 'Stock', balance: 100_000, annualReturn: 10, weight: 0.5 }, { name: 'CD', balance: 100_000, annualReturn: 4, weight: 0.5 }];
  const exactGoal = (100_000 * 1.1 ** 15 + 100_000 * 1.04 ** 15) / 1.025 ** 15;
  const result = plan({ assets, startingBalance: 200_000, fireGoal: exactGoal, monthlyContribution: 0 });
  assert.equal(result.coastMonth, 0);
  close(result.coastRequiredNow, 200_000);
  assert.equal(result.coastFireMonth, 180);
});

test('already achieved and present-age goals have no extra month', () => {
  const result = plan({ startingBalance: 2_000_000, targetAge: 40 });
  assert.equal(result.fireMonth, 0);
  assert.equal(result.coastFireMonth, 0);
  assert.equal(result.coastMonth, 0);
  assert.equal(result.series.length, 1);
  close(result.atTarget.continuing, 2_000_000);
});

test('missing the target age reports a later FIRE age without false COAST', () => {
  const result = plan({ startingBalance: 0, annualReturn: 0, inflation: 0, fireGoal: 100_000, monthlyContribution: 1_000, targetAge: 45 });
  assert.equal(result.coastMonth, null);
  assert.equal(result.fireMonth, 100);
  assert.equal(result.continuingMeetsTarget, false);
  assert.equal(result.series.at(-1).month, 60);
});

test('negative real returns cannot turn a sub-goal portfolio into COAST', () => {
  const result = plan({ annualReturn: 2, inflation: 5, monthlyContribution: 0 });
  assert.equal(result.fireMonth, null);
  assert.equal(result.coastMonth, null);
  assert.ok(result.atTarget.coast < 500_000);
});

test('negative contributions are retained; depleted investments do not become debt', () => {
  const result = plan({ startingBalance: 1_000, annualReturn: 0, inflation: 0, monthlyContribution: -100 });
  assert.equal(result.depletionMonth, 11);
  close(result.atTarget.continuing, 0);
  close(result.atTarget.coast, 1_000);
});

test('invalid inputs return errors rather than NaN or fictional milestone dates', () => {
  for (const overrides of [{ currentAge: '' }, { targetAge: 39 }, { targetAge: 101 }, { currentAge: 40.5 }, { fireGoal: 0 }, { inflation: '' }, { annualReturn: -100 }, { startingBalance: -1 }, { monthlyContribution: undefined }, { monthlyContribution: Infinity }, { assets: [] }]) {
    assert.ok(plan(overrides).errors.length > 0, JSON.stringify(overrides));
  }
});

test('portfolio includes savings, excludes car/debt and deduplicates months', () => {
  const records = [
    { date: new Date(2026, 2, 1), stocks: 110, cd: 50, bank: 500, car: 40_000, loan: 30_000 },
    { date: new Date(2026, 0, 31), stocks: 100, cd: 50 },
    { date: new Date(2026, 0, 1), stocks: 90, cd: 50 },
  ];
  const history = portfolioHistory(records, columns);
  assert.deepEqual(history.snapshots.map(item => item.balance), [150, 660]);
  assert.equal(history.snapshots[0].date.getDate(), 31);
  close(portfolioHistory(records, columns, ['Savings']).snapshots.at(-1).balance, 500);
  close(portfolioHistory(records, columns, ['Loan']).snapshots.at(-1).balance, 0);
});

test('per-account rates override defaults and can include savings interest', () => {
  const history = portfolioHistory([{ date: new Date(2026, 0, 1), stocks: 100, cd: 100, bank: 200 }], columns, ['Brokerage', 'CD', 'Savings']);
  const assets = portfolioAssets(history.selected, history.snapshots[0], { ...FIRE_DEFAULTS, accountReturns: { CD: 5.2, Savings: 3.5 } });
  assert.deepEqual(assets.map(asset => asset.annualReturn), [7, 5.2, 3.5]);
  assert.deepEqual(assets.map(asset => asset.weight), [0.25, 0.25, 0.5]);
});

test('irregular intervals use elapsed months rather than the number of records', () => {
  const snapshots = [
    { date: new Date(2024, 0, 1), month: 0, balance: 10_000, balances: { fixed: 10_000 } },
    { date: new Date(2024, 3, 1), month: 3, balance: 13_000, balances: { fixed: 13_000 } },
    { date: new Date(2025, 0, 1), month: 12, balance: 22_000, balances: { fixed: 22_000 } },
  ];
  const estimate = estimatePortfolioContribution(snapshots, [{ id: 'fixed', annualReturn: 0, weight: 1 }]);
  close(estimate.monthly, 1_000);
  assert.equal(estimate.months, 12);
  assert.equal(estimatePortfolioContribution(snapshots.slice(0, 1), [{ annualReturn: 0 }]), null);
});

test('fixed interest and stock gains are removed from inferred contributions', () => {
  const history = portfolioHistory([
    { date: new Date(2025, 0, 1), stocks: 100_000, cd: 100_000 },
    { date: new Date(2026, 0, 1), stocks: 110_000, cd: 104_000 },
  ], columns);
  const assets = portfolioAssets(history.selected, history.snapshots.at(-1), { ...FIRE_DEFAULTS, annualReturn: 10 });
  close(estimatePortfolioContribution(history.snapshots, assets).monthly, 0);
});

test('storage tolerates corruption and reloads individual account rates', () => {
  for (const raw of ['null', '{broken', '[]', '42']) assert.deepEqual(readFireSettings({ getItem: () => raw }), FIRE_DEFAULTS);
  assert.deepEqual(readFireSettings({ getItem: () => { throw new Error('Blocked'); } }), FIRE_DEFAULTS);
  const settings = readFireSettings({ getItem: () => JSON.stringify({ currentAge: 39, targetAge: 55, accountReturns: { CD: 4.75 }, accountNames: ['CD'] }) });
  assert.equal(settings.currentAge, 39);
  assert.equal(settings.accountReturns.CD, 4.75);
  assert.deepEqual(settings.accountNames, ['CD']);
});

test('month-end milestone dates stay in the intended month', () => {
  const result = dateAfterMonths(new Date(2024, 0, 31), 1);
  assert.equal(result.getMonth(), 1);
  assert.equal(result.getDate(), 29);
});

test('a monthly HYSA rate converts to effective APY through compounding', () => {
  close(effectiveAnnualRate(0.3, 'monthly'), (1.003 ** 12 - 1) * 100);
  assert.notEqual(effectiveAnnualRate(0.3, 'monthly'), 3.6);
  close(effectiveAnnualRate(4, 'annual'), 4);
  assert.ok(Number.isNaN(effectiveAnnualRate('', 'monthly')));
});

test('default HYSA selection includes named savings but not ordinary checking', () => {
  const bankColumns = [
    { id: 'hysa', name: 'HYSA', type: 'cash' }, { id: 'marcus', name: 'Marcus', type: 'cash' },
    { id: 'yield', name: 'High Yield Savings', type: 'cash' }, { id: 'checking', name: 'Checking', type: 'cash' },
  ];
  const history = portfolioHistory([{ date: new Date(2026, 0, 1), hysa: 100, marcus: 200, yield: 300, checking: 900 }], bankColumns);
  close(history.snapshots[0].balance, 600);
  assert.deepEqual(history.selected.map(column => column.id), ['hysa', 'marcus', 'yield']);
  const explicit = portfolioHistory([{ date: new Date(2026, 0, 1), hysa: 100 }], bankColumns, []);
  assert.equal(explicit.selected.length, 0, 'Existing explicit selections are preserved');
});

test('weighted fixed and HYSA rates use account balances and consistent periods', () => {
  const annualHysa = (1.003 ** 12 - 1) * 100;
  const assets = [{ balance: 100_000, annualReturn: 5 }, { balance: 300_000, annualReturn: annualHysa }];
  const summary = weightedReturns(assets);
  close(summary.annual, (5 + 3 * annualHysa) / 4);
  close(summary.monthlyInterest, 100_000 * (1.05 ** (1 / 12) - 1) + 300_000 * 0.003);
  close(summary.monthly, summary.monthlyInterest / 400_000 * 100);
  assert.notEqual(summary.annual, (5 + annualHysa) / 2);
  assert.equal(weightedReturns([]), null);
  assert.equal(weightedReturns([{ balance: 0, annualReturn: 5 }]), null);
  assert.equal(weightedReturns([{ balance: 100, annualReturn: NaN }]), null);
});

test('HYSA compounds monthly in both paths and earned interest is not a contribution', () => {
  const history = portfolioHistory([
    { date: new Date(2025, 0, 1), bank: 100_000 },
    { date: new Date(2026, 0, 1), bank: 100_000 * 1.003 ** 12 },
  ], columns, ['Savings']);
  const assets = portfolioAssets(history.selected, history.snapshots.at(-1), { ...FIRE_DEFAULTS, hysaReturn: 0.3, hysaReturnPeriod: 'monthly' });
  close(estimatePortfolioContribution(history.snapshots, assets).monthly, 0);
  const result = plan({ assets, startingBalance: assets[0].balance, monthlyContribution: 0, inflation: 0, targetAge: 41 });
  close(result.atTarget.coast, 100_000 * 1.003 ** 24);
  close(result.atTarget.continuing, result.atTarget.coast);
});

test('HYSA APY entry and account overrides are not mistaken for monthly percentages', () => {
  const history = portfolioHistory([{ date: new Date(2026, 0, 1), bank: 100_000 }], columns, ['Savings']);
  const settings = { ...FIRE_DEFAULTS, hysaReturn: 4.5, hysaReturnPeriod: 'annual' };
  close(portfolioAssets(history.selected, history.snapshots[0], settings)[0].annualReturn, 4.5);
  close(portfolioAssets(history.selected, history.snapshots[0], { ...settings, accountReturns: { Savings: 5 } })[0].annualReturn, 5);
});

test('stored settings retain HYSA units and migrate plans with no HYSA rate', () => {
  const saved = readFireSettings({ getItem: () => JSON.stringify({ hysaReturn: 4.2, hysaReturnPeriod: 'annual' }) });
  assert.equal(saved.hysaReturn, 4.2);
  assert.equal(saved.hysaReturnPeriod, 'annual');
  const old = readFireSettings({ getItem: () => JSON.stringify({ currentAge: 39, accountNames: ['CD'] }) });
  assert.equal(old.hysaReturn, 0);
  assert.equal(old.hysaReturnPeriod, 'monthly');
  assert.deepEqual(old.accountNames, ['CD']);
});
