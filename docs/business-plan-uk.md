# cre8: lightweight UK business plan

**Prepared:** 11 November 2026  
**Stage:** founder-led validation; proposed UK-first launch  
**Status:** working assumptions, not an investment forecast or legal advice  
**PDF edition:** [Download PDF](./business-plan-uk.pdf).  
**Supporting documents:** [market research and positioning](./market-research-positioning.md), [monetization](./monetization-strategy.md), [UK legal checklist](./uk-licensing-and-payments.md), [AWS cost model](./aws-whole-stack-cost-model.md), [production spike](./backend-production-spike.md).

## 1. The business in one paragraph

cre8 is a music community for producers and DJs to discover and share dubs and
samples, publish ordered packs, manage release access and build relationships.
Launch as a focused UK community rather than a general streaming competitor.
Keep listening and ordinary community participation free; test a **GBP 9/month
Creator Pro** workflow subscription. Validate repeat value with a small creator
cohort, then consider curated, rights-cleared paid Sample Packs at a proposed
15% commission. Stay on Render while demand, rights and unit economics are
uncertain. The first commercial objective is sustainable operating costs,
not immediate founder income.

## 2. Customer, problem and positioning

| Segment | Problem hypothesis | cre8 proposition |
| --- | --- | --- |
| Independent producers | Releases/files scattered across chat and file links | A persistent release/profile with pack ordering, sharing and access controls |
| DJs and trusted supporters | Finding and organizing relevant permitted releases | Dub/Sample Vaults, crates, pack playback and community relationships |
| Small collectives/labels, later | Coordinating several artists and release recipients | Future team workflows, only after shared ownership/roles are built |

Differentiate through release workflow and a trusted niche community, not
"unlimited storage", exclusive rights cre8 does not own, or guaranteed promotion.
Alternatives include general creator/audio platforms, file-sharing links, chat
communities and sample shops. This is a positioning hypothesis, not a verified
competitive benchmark or market-size claim.

Initial planning envelope: **100 registered users, 1,000 files (~25 GB originals)**.
For cost comparison only, proportionally scale the spike to 10 concurrent
listeners for eight hours/day, ~346 GB/month at 320 kbit/s and ~2 API requests/
second. These are not measurements. Authenticated original/lossless playback
and downloads can be much larger; measure source bitrates before budget approval.

## 3. Offer and revenue sequence

1. **Free community:** preserve existing playback, discovery, messaging, crates,
   sharing, basic statistics and security controls, subject to permissions/limits.
2. **Creator Pro:** GBP 9 total monthly consumer price, including VAT if applicable.
   Start with a genuinely useful delivered workflow bundle, not just a badge.
   Test higher upload allowance, historical analytics/export, bulk templates and
   branded sharing; scheduling is future scope.
3. **Optional supporter:** GBP 5/month, clearly commercial support, not Gift Aid.
   Do not include it in base revenue projections or sell A-List approval.
4. **Curated paid packs, later:** price/licence agreed with sellers; test 15%
   platform commission only after rights, tax, payouts and entitlements work.

No marketplace sales, tips, sponsorship, annual prepayments or team subscriptions
are assumed in the first-year base cash model. No paid benefit is implemented
merely because it appears in this plan.

## 4. Acquisition and validation

Use founder-led outreach to a narrow producer/DJ scene, with permission:

- Interview 10 active creators and 5 listeners about real workflow problems.
- Recruit 5-10 anchor creators with cleared content; ask them to invite relevant
  collaborators/listeners, not to mass-message strangers.
- Run practical pack-sharing demos and opt-in release showcases.
- Seek introductions through collectives and production communities; any paid
  placement or affiliate relationship must be disclosed.
- Ask for paid pilot commitments at the shown price; avoid a fake checkout.

Do not spend heavily on acquisition until repeat use and renewals are visible.
Treat 100 registrations as a recruitment milestone, not 100 active customers.
If only 20 are active creators, 10 Pro subscribers requires 50% conversion of
that segment. Do not describe that as an easy 10% conversion.

## 5. Product and operating model

The current monorepo has React web/admin apps, shared UI and a framework-free
Node HTTP/WebSocket API. The deployment serves frontend/admin with the API.
Media remains on disk; PostgreSQL compatibility is opt-in. The spike demonstrates
separate durability/media concepts, not a fully deployed commerce/worker system.

### Launch architecture

- Retain one Render API/web service and a suitably sized managed PostgreSQL
  database. Validate TLS/import/restore before switching production storage.
- Initially cap disk/media use; the checked-in 1-GB disk is not sufficient for
  the opening 25-GB catalogue plus working space and backups.
- Evaluate private R2 object storage after implementing authorization, lifecycle,
  backups and delivery. It is a cost option, not currently wired production code.
- Use hosted payment checkout/billing; process signed webhooks transactionally
  into a separate entitlement ledger, not directly into arbitrary pack grants.
- Keep A-List approval, audience, sample classification and purchases independent.
- Use bounded processing and tested backups; do not promise high availability
  from a single service or assume 512 MB can handle the intended workload.

At launch the founder owns product, engineering, support and moderation. Use a
UK accountant and suitable music/technology legal advisers for specialist work.
These external roles are costed as allowances, not hired staff or confirmed quotes.
Set a supported contact route and response policy; do not promise 24/7 human support.

## 6. Monthly cash budget

All amounts are **GBP planning allowances**, not supplier quotes. Assume no VAT
input recovery; confirm invoiced cloud taxes/FX and fit them inside the allowance
or reforecast. The cloud estimate depends on sizing, media delivery and backups.

| Item | Monthly cash allowance | Basis |
| --- | ---: | --- |
| Hosting, database, media, backups, basic monitoring/domain | 60 | Central small-launch assumption within a GBP 40-80 infrastructure sensitivity band |
| Business/admin software | 15 | Minimal tools; avoid overlapping subscriptions |
| Bookkeeping/accounting | 40 | Provision pending quote and legal structure |
| Legal/compliance/incident reserve | 50 | Cash set aside; not a quote or a substitute for licences |
| Community/marketing experiments | 25 | Small opt-in outreach/event allowance |
| **Monthly cash requirement** | **190** | No founder pay, music royalties or tax provision included |
| **Twelve-month requirement** | **2,280** | Assumes unchanged costs; reforecast with growth |

The GBP 60 infrastructure line is intentionally not called a verified Render
quote. Get actual database/instance/disk/object-storage and transfer prices first.
The legal reserve is a cash earmark, not automatically an accounting expense.
This plan describes **cash headroom**, not statutory profit.

The [larger AWS model](./aws-whole-stack-cost-model.md) budgets USD 600 lean or
USD 825 resilient, including staging/contingency, at the larger spike envelope.
At **USD 1 = GBP 0.80 solely for planning**, that is GBP 480/660, not live FX or
a London-region quote. Substituting those for the GBP 60 line takes total
monthly cash allowance to **GBP 610/790**, before tax/royalties/founder pay.
There is no reason to adopt that stack for the first 100 users solely to launch.

## 7. Unit economics and break-even

At GBP 9/month, illustrative standard UK card Payments (1.5% + GBP 0.20),
pay-as-you-go Billing (0.7%) and a 5% refund/dispute cash reserve leave:

- **GBP 8.152 per subscriber** if not VAT-registered.
- **GBP 6.652 per subscriber** if the same GBP 9 includes standard-rate 20% VAT,
  assuming no input recovery and fees calculated on gross receipts.

These are before delivery/overhead; actual fee rounding, card mix and extra
products can change them. See [Stripe's UK fees](https://stripe.com/gb/pricing)
and the [monetization strategy](./monetization-strategy.md).

| Paying Pro users | Monthly gross receipts | Contribution, not registered | Cash headroom after GBP 190 allowance |
| --- | ---: | ---: | ---: |
| 5 | 45 | 40.76 | -149.24 |
| 10 | 90 | 81.52 | -108.48 |
| 20 | 180 | 163.04 | -26.96 |
| 30 | 270 | 244.56 | +54.56 |

Infrastructure-only break-even at GBP 60 is **8 Pro members**, or **10** when
VAT-registered at the same price. Whole operating-allowance break-even is
**24**, or **29** when registered. Neither includes founder remuneration,
income/corporation tax, licence fees or higher variable costs at scale.
Registered does not mean VAT registration is expected at these revenue levels.

### Illustrative first-year subscription ramp

Assume average paying members of 5, 10, 20 and 30 in successive quarters, already
net of churn. There is no evidence yet that the last target is achievable from
100 registrations; it requires substantial creator adoption or audience growth.

| Quarter | Average paid members | Member-months | Gross receipts | Contribution, not registered |
| --- | ---: | ---: | ---: | ---: |
| Q1 | 5 | 15 | 135 | 122.28 |
| Q2 | 10 | 30 | 270 | 244.56 |
| Q3 | 20 | 60 | 540 | 489.12 |
| Q4 | 30 | 90 | 810 | 733.68 |
| **Year** | | **195** | **1,755** | **1,589.64** |

Against GBP 2,280 annual operating allowances, this leaves a **GBP 690.36 cash
shortfall before setup, tax, royalties and founder pay**. It is a validation
business, not yet a full-time income forecast. With no sales, the operating
shortfall is the full GBP 2,280.

## 8. Setup funding and exclusions

| One-off preparation | Allowance |
| --- | ---: |
| UK legal/music-rights and contract review | GBP 1,500-3,500 |
| Accounting/tax setup | GBP 100-300 |
| Entity/domain/admin setup | GBP 100-250 |
| Pilot testing/accessibility/operational work cash spend | GBP 0-300 |
| **Setup total** | **GBP 1,700-4,350** |

These are non-binding allowances; professional quotes may exceed them.
Add three months' operating buffer of **GBP 570**.
Setup + the illustrative year's GBP 690.36 shortfall + buffer implies roughly
**GBP 3,000-5,700** initial cash (rounded up). With zero revenue for the year,
allow **GBP 4,550-7,200** instead.

**Not included:** founder/developer labour, collective/direct music licence
fees or royalties, international expansion, paid marketplace implementation,
staff, insurance premiums, substantial disputes, unexpected tax and major
security/recovery events. These can materially change viability. Obtain a rights
quote and add its minima/usage royalties **before treating the funding figure
as sufficient**. Do not claim that a GBP 50 reserve clears music rights.

## 9. Milestones and go/no-go gates

Timings are indicative sequencing, not promised delivery dates.

| Phase | Goal | Gate |
| --- | --- | --- |
| Weeks 1-2 | Interviews, catalogue/rights audit, real hosting/provider quotes | Five credible paid pilot commitments; unresolved rights isolated |
| Weeks 3-6 | Safe infrastructure, delivered Pro bundle, billing/terms | Legal/tax/safety checks, permissions, restore and webhook tests pass |
| Next two billing cycles | 5-10 paying pilot creators, useful repeat usage | At least four of the first five renew; no unresolved billing/access-loss incident |
| Months 3-6 | Improve retention and approach operating break-even | Actual costs/renewals support the offer; otherwise revise or pause |
| Later, separately approved | Three vetted sellers, curated paid packs | Rights, versioned purchase licences, marketplace VAT, money-flow and refunds/payouts approved |

Do not expand paid features just to mask weak renewal. Do not provision AWS or
build a general marketplace before confirming a genuine constraint/demand.

## 10. Principal risks and controls

| Risk | Control and decision |
| --- | --- |
| Unlicensed recordings/samples or publishing | Document grants, obtain expert/service-specific licences; no affected content launch without clearance |
| Billing/consumer-law failures | Clear GBP total prices, correct cancellation/refund flows, subscription-law recheck before launch |
| Seller money/VAT obligations | Defer marketplace; regulated provider plus specialist legal/accounting review |
| Slow paid adoption | Small cohort, monthly billing, renewal measurement; preserve runway |
| Audio/processing costs exceed model | Enforce quotas, measure originals/egress/ffmpeg, reprice before broad release |
| Single-service outage/data loss | Disclosed limits, tested restore, independent backups and bounded jobs |
| Unsafe messages/content or child access | Ofcom scope/risk assessments, reporting/moderation, age/privacy review |
| Founder support burden | Narrow scope, supported response policy, measure hours per paid creator |

## Decision requested

Approve a **UK-first validation phase**, not full commercialization: GBP 9
monthly Pro hypothesis, a provisional GBP 190 monthly cash allowance and
professional rights/payment/tax review within separately confirmed quotes.
Stay Render-first. Revisit funding after licence quotes and the first two
renewal cycles. See the [UK legal checklist](./uk-licensing-and-payments.md)
for primary sources and mandatory launch gates.
