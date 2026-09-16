# Personal CFO

React dashboard for imported monthly account balances, with an inflation-adjusted FIRE and Coast FIRE planner.

## Run and verify

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
```

## FIRE and Coast FIRE

Import a CSV with `Year`, `Month` and account-balance columns, then enter your age at the latest record. The default target is age **55**, with a **$2,000,000 goal in starting-date purchasing power**. The latest imported record anchors both the age and the dollars called “today” in the planner; it does not silently advance stale balances to the computer's current date. Dashboard year/quarter/month filters do not affect the projection.

The original dashboard, including its Compound Phase / exponential-growth card, remains intact. The FIRE planner is an optional section at the very bottom of the dashboard, Compare and Data views, **collapsed by default**. Its calculations and settings mount only when opened; reloading collapses it again while retaining saved inputs. It compares:

- **Keep contributing:** maintain a fixed nominal monthly amount, with reinvested growth.
- **Stop contributing now:** no future contributions or withdrawals, with reinvested growth.

It shows each balance at the selected age, the earliest Coast FIRE month for that deadline, and the first month each path reaches full FIRE (searched through age 100). A missed goal is reported explicitly. Reaching the goal is not a withdrawal simulation.

### Accounts, returns and contributions

Equity and fixed income accounts are selected by default according to their dashboard categories. Cash accounts named HYSA, high yield, Marcus, savings or ahorro are also included by default. Other cash accounts and imported assets can be explicitly selected. Existing saved account selections are respected. Debts and the separate car valuation are not projected as investments. Review imported account categories in Account Management.

Each account compounds at its own **effective annual rate**, converted with `monthlyRate = (1 + annualRate)^(1/12) - 1`. Fixed income and HYSA therefore keep earning reinvested interest even in the zero-contribution scenario. Defaults (7% equity, 4% fixed income, 0% HYSA/cash/other, and 2.5% inflation) are editable assumptions, not contracted rates from the CSV. Enter the average rate for fixed income and HYSA/cash, or override individual accounts with their annual APYs. The model assumes unchanged rates and reinvestment at maturity; taxes, fees, renewal-rate changes, pensions and living expenses are not modeled.

The HYSA input accepts either a **monthly percentage** or an **annual APY**. Monthly rates convert with `annualAPY = (1 + monthlyRate)^12 - 1`; switching units preserves the effective rate. Monthly interest payments do not imply that a bank's advertised APY is a monthly percentage. HYSA starts at zero until the user enters a rate. Per-account annual overrides take precedence over the group rate.

Two balance-weighted summaries show fixed income + HYSA/cash together and all selected investments together: `weightedAnnualRate = sum(balance * accountAPY) / sum(balance)`. The first-month interest estimate separately uses each account's monthly equivalent, weighted by the same balances. These are summaries of the starting mix, not unweighted averages or a single blended rate used for long-term compounding; each account continues to grow separately in the forecast.

The history estimate uses up to 13 monthly snapshots / 12 intervals, keeps the last snapshot in duplicate months, and accounts for missing months. For each interval it subtracts the sum of expected growth at each account's rate. The residual is divided by the sum of contribution annuity factors, weighted by the latest selected portfolio mix. This estimates a constant nominal monthly net contribution; balance changes and transfers cannot uniquely identify actual cash flows. Use the manual contribution input when the real amount is known.

Future month-end contributions are split in proportion to the latest selected balances (equally if all are zero), with no rebalancing. Negative contributions represent withdrawals; account balances are floored at zero when exhausted and the UI reports depletion.

### Inflation and COAST

Balances at month `m` are converted to starting-date dollars by dividing by `(1 + inflation)^(m/12)`. The FIRE goal is constant in those dollars; its equivalent future nominal amount increases with inflation. Keeping nominal contributions fixed means their purchasing power gradually declines.

At each month through the target age, Coast FIRE projects every account forward from its current simulated balance with **zero additional contributions**. The first month whose total reaches the inflation-adjusted nominal goal at the deadline is the Coast milestone. The “capital needed now” figure discounts the same goal using each account's growth and the starting portfolio mix, rather than compounding a blended average rate.

Settings, account selections and rate overrides persist in browser local storage. Imported financial balances remain in the existing in-memory CSV workflow; no personal balances are committed to the repository.

Reference: [Investor.gov compound interest calculator](https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator).
