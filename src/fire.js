export const FIRE_DEFAULTS = {
  currentAge: '',
  targetAge: 55,
  fireGoal: 2_000_000,
  annualReturn: 7,
  fixedReturn: 4,
  inflation: 2.5,
  contributionMode: 'history',
  monthlyContribution: '',
  accountNames: null,
  accountReturns: {},
};

export const FIRE_STORAGE_KEY = 'cfo_fire_settings_v1';
export const MAX_PROJECTION_AGE = 100;

export function readFireSettings(storage) {
  try {
    const saved = JSON.parse(storage.getItem(FIRE_STORAGE_KEY));
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return { ...FIRE_DEFAULTS };
    const settings = { ...FIRE_DEFAULTS };
    for (const key of ['currentAge', 'targetAge', 'fireGoal', 'annualReturn', 'fixedReturn', 'inflation', 'monthlyContribution']) {
      if (saved[key] === '' || (typeof saved[key] === 'number' && Number.isFinite(saved[key]))) settings[key] = saved[key];
    }
    settings.contributionMode = saved.contributionMode === 'manual' ? 'manual' : 'history';
    if (Array.isArray(saved.accountNames) && saved.accountNames.every(name => typeof name === 'string')) {
      settings.accountNames = saved.accountNames;
    }
    if (saved.accountReturns && typeof saved.accountReturns === 'object' && !Array.isArray(saved.accountReturns)) {
      settings.accountReturns = Object.fromEntries(Object.entries(saved.accountReturns).filter(([, rate]) => typeof rate === 'number' && Number.isFinite(rate)));
    }
    return settings;
  } catch {
    return { ...FIRE_DEFAULTS };
  }
}

export const monthlyRate = annualPercent => Math.expm1(Math.log1p(annualPercent / 100) / 12);

// End-of-month contributions, with a stable zero-rate limit.
export function annuityFactor(rate, months) {
  return Math.abs(rate) < 1e-12 ? months : Math.expm1(months * Math.log1p(rate)) / rate;
}

export function portfolioHistory(records, columns, accountNames = null) {
  const selected = columns.filter(column => column.type !== 'liability' && (
    accountNames === null ? ['equity', 'fixed'].includes(column.type) : accountNames.includes(column.name)
  ));
  const byMonth = new Map();
  for (const record of [...records].sort((a, b) => a.date - b.date)) {
    if (!(record.date instanceof Date) || !Number.isFinite(record.date.getTime())) continue;
    const month = record.date.getFullYear() * 12 + record.date.getMonth();
    const balances = {};
    const balance = selected.reduce((sum, column) => {
      const value = Number(record[column.id] ?? 0);
      balances[column.id] = Number.isFinite(value) ? value : 0;
      return sum + balances[column.id];
    }, 0);
    // The app records monthly balances; retain the last snapshot within a month.
    byMonth.set(month, { date: record.date, month, balance, balances });
  }
  return { selected, snapshots: [...byMonth.values()] };
}

export function portfolioAssets(selected, latest, settings) {
  const total = selected.reduce((sum, column) => sum + Math.max(0, latest?.balances[column.id] ?? 0), 0);
  return selected.map(column => {
    const balance = latest?.balances[column.id] ?? 0;
    return {
      id: column.id, name: column.name, balance,
      annualReturn: settings.accountReturns[column.name] ?? (column.type === 'equity' ? settings.annualReturn : column.type === 'fixed' ? settings.fixedReturn : 0),
      weight: total > 0 ? Math.max(0, balance) / total : 1 / selected.length,
    };
  });
}

export function estimatePortfolioContribution(snapshots, assets) {
  const recent = snapshots.slice(-13);
  if (recent.length < 2 || !assets.length || assets.some(asset => typeof asset.annualReturn !== 'number' || !Number.isFinite(asset.annualReturn) || asset.annualReturn <= -100)) return null;
  let residual = 0;
  let weight = 0;
  let months = 0;
  for (let i = 1; i < recent.length; i++) {
    const previous = recent[i - 1];
    const current = recent[i];
    const interval = current.month - previous.month;
    if (interval <= 0) continue;
    let expectedBalance = 0;
    for (const asset of assets) {
      const rate = monthlyRate(asset.annualReturn);
      expectedBalance += (previous.balances[asset.id] ?? 0) * (1 + rate) ** interval;
      weight += asset.weight * annuityFactor(rate, interval);
    }
    residual += current.balance - expectedBalance;
    months += interval;
  }
  if (!weight) return null;
  return { monthly: residual / weight, months, intervals: recent.length - 1, start: recent[0].date, end: recent.at(-1).date };
}

export function validateProjection(inputs) {
  const errors = [];
  const finite = key => typeof inputs[key] === 'number' && Number.isFinite(inputs[key]);
  if (!finite('currentAge') || !Number.isInteger(inputs.currentAge) || inputs.currentAge < 0 || inputs.currentAge > MAX_PROJECTION_AGE) {
    errors.push('Enter your age at the latest record (a whole number from 0 to 100).');
  }
  if (!finite('targetAge') || !Number.isInteger(inputs.targetAge) || inputs.targetAge < inputs.currentAge || inputs.targetAge > MAX_PROJECTION_AGE) {
    errors.push('Target age must be a whole number from your starting age to 100.');
  }
  if (!finite('fireGoal') || inputs.fireGoal <= 0) errors.push('Enter a FIRE goal greater than zero.');
  if (!finite('annualReturn') || inputs.annualReturn < -50 || inputs.annualReturn > 50) errors.push('Expected annual return must be between -50% and 50%.');
  if (!finite('inflation') || inputs.inflation < 0 || inputs.inflation > 25) errors.push('Annual inflation must be between 0% and 25%.');
  if (!finite('startingBalance') || inputs.startingBalance < 0) errors.push('Selected investment balances must total zero or more.');
  if (!finite('monthlyContribution')) errors.push('Enter a monthly contribution, or import at least two months to estimate it.');
  if (inputs.assets) {
    if (!inputs.assets.length) errors.push('Select at least one investment account.');
    for (const asset of inputs.assets) {
      if (!Number.isFinite(asset.balance) || asset.balance < 0) errors.push(`${asset.name}: the starting investment balance must be zero or more.`);
      if (typeof asset.annualReturn !== 'number' || !Number.isFinite(asset.annualReturn) || asset.annualReturn < -50 || asset.annualReturn > 50) errors.push(`${asset.name}: annual return must be between -50% and 50%.`);
      if (!Number.isFinite(asset.weight) || asset.weight < 0) errors.push('Contribution allocation must be non-negative.');
    }
    if (Math.abs(inputs.assets.reduce((sum, asset) => sum + asset.weight, 0) - 1) > 1e-8) errors.push('Contribution allocation must add up to 100%.');
    if (Math.abs(inputs.assets.reduce((sum, asset) => sum + asset.balance, 0) - inputs.startingBalance) > 0.01) errors.push('Account balances must match the starting balance.');
  }
  return errors;
}

export function projectFire(inputs) {
  const errors = validateProjection(inputs);
  if (errors.length) return { errors };
  const { currentAge, targetAge, fireGoal, startingBalance, monthlyContribution, annualReturn, inflation } = inputs;
  const assets = (inputs.assets ?? [{ balance: startingBalance, annualReturn, weight: 1 }]).map(asset => ({ ...asset, rate: monthlyRate(asset.annualReturn) }));
  const inflationRate = monthlyRate(inflation);
  const targetMonths = (targetAge - currentAge) * 12;
  const horizonMonths = (MAX_PROJECTION_AGE - currentAge) * 12;
  const nominalGoalAtTarget = fireGoal * (1 + inflationRate) ** targetMonths;
  const growthFactor = assets.reduce((sum, asset) => sum + asset.weight * (1 + asset.rate) ** targetMonths, 0);
  const coastRequiredNow = nominalGoalAtTarget / growthFactor;
  let continuing = assets.map(asset => asset.balance);
  let coast = assets.map(asset => asset.balance);
  let fireMonth = null;
  let coastFireMonth = null;
  let coastMonth = null;
  let depletionMonth = null;
  let atTarget;
  const series = [];
  // Relative tolerance prevents a floating point rounding error delaying an
  // exact milestone by a month. All comparisons use the same purchasing power.
  const reaches = (balance, goal) => balance >= goal - Math.max(1, goal) * 1e-10;
  for (let month = 0; month <= horizonMonths; month++) {
    const deflator = (1 + inflationRate) ** month;
    const continuingTotal = continuing.reduce((sum, value) => sum + value, 0);
    const coastTotal = coast.reduce((sum, value) => sum + value, 0);
    const continuingReal = continuingTotal / deflator;
    const coastReal = coastTotal / deflator;
    if (fireMonth === null && reaches(continuingReal, fireGoal)) fireMonth = month;
    if (coastFireMonth === null && reaches(coastReal, fireGoal)) coastFireMonth = month;
    const futureWithoutContributions = assets.reduce((sum, asset, index) => sum + continuing[index] * (1 + asset.rate) ** (targetMonths - month), 0);
    if (month <= targetMonths && coastMonth === null && reaches(futureWithoutContributions, nominalGoalAtTarget)) coastMonth = month;
    const point = { month, age: currentAge + month / 12, continuing: continuingReal, coast: coastReal, goal: fireGoal };
    if (month <= targetMonths) series.push(point);
    if (month === targetMonths) atTarget = { ...point, continuingNominal: continuingTotal, coastNominal: coastTotal };
    if (month < horizonMonths) {
      continuing = continuing.map((balance, index) => {
        const asset = assets[index];
        const next = balance * (1 + asset.rate) + monthlyContribution * asset.weight;
        if (next < 0 && depletionMonth === null) depletionMonth = month + 1;
        // A depleted investment account cannot fund further withdrawals.
        return Math.max(0, next);
      });
      coast = coast.map((balance, index) => balance * (1 + assets[index].rate));
    }
  }
  return {
    errors: [], series, atTarget, fireMonth, coastFireMonth, coastMonth, depletionMonth,
    coastRequiredNow, nominalGoalAtTarget, targetMonths,
    continuingMeetsTarget: reaches(atTarget.continuing, fireGoal),
    coastMeetsTarget: reaches(atTarget.coast, fireGoal),
  };
}

export function dateAfterMonths(date, months) {
  // Avoid Jan 31 + one month overflowing into March.
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(date.getDate(), lastDay));
  return result;
}
