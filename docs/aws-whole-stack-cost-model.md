# cre8: whole-stack AWS cost model

**Prepared:** 11 November 2026  
**Status:** planning estimate, not a deployment approval or capacity guarantee  
**Decision unchanged:** stay on Render now; AWS remains later scope.

**PDF edition:** [Download PDF](./aws-whole-stack-cost-model.pdf).  
**UK planning context:** see the [UK business plan](./business-plan-uk.md) and
[licensing/payment checklist](./uk-licensing-and-payments.md). At the explicit
planning assumption of USD 1 = GBP 0.80, the USD 600/825 budgets translate to
GBP 480/660. This is not a live exchange rate or a London/Ireland-region quote.
UK consumer VAT, cloud invoice taxes and music licensing need separate treatment.

## Executive summary

At the [production spike's proposed launch envelope](./backend-production-spike.md#2-proposed-launch-envelope-and-recovery-objectives),
allow **US$600/month for a lean AWS stack**, including a small staging environment
and approximately 20% contingency. A future two-AZ application/database topology
needs approximately **US$825/month** on the assumptions below. Neither figure
includes tax, paid support, engineering time or a warm disaster-recovery region.

| Option | Modelled recurring subtotal | Subtotal + 20% | Recommended monthly budget |
| --- | ---: | ---: | ---: |
| Lean, one API instance, single-AZ database | $479.96 | $575.95 | **$600** |
| Resilient target, two API instances, Multi-AZ database | $671.52 | $805.82 | **$825** |

These are complete planning budgets rather than the earlier conversation's
$300-450 application-hosting estimate. They explicitly add private-subnet
networking, staging, backup copies, monitoring, build delivery and operational
allowances. Some rows are calculated from published rates; others are deliberately
labelled allowances pending an AWS Calculator quote and measured workloads.

The resilient option is a **future architecture**, not something the current
PostgreSQL compatibility backend can safely enable merely by adding replicas.
Paying for redundancy does not establish the spike's availability or recovery
objectives.

## 1. Scope and pricing basis

- Currency: USD, before VAT/sales tax. No exchange-rate assumption.
- Reference region: US East (N. Virginia), `us-east-1`; audience mainly Europe/US.
  Requote regional services for London/Ireland before choosing a region.
- Billing: 730 hours/month for always-on resources; 30 days for workload maths.
- On-demand Linux/x86 Fargate; no Spot, Savings Plans, reserved instances,
  promotional credits or new-account free-trial assumptions.
- One production CloudFront distribution and root domain; small staging is not
  given its own paid CloudFront subscription.
- Frontend, PWA, admin and guides share the web/API delivery infrastructure.
  There is no separate per-user React hosting or admin licence charge.
- PostgreSQL remains the source of truth for metadata, sessions and durable jobs.
  No Redis, OpenSearch, Kubernetes, Aurora, RDS Proxy or SQS is assumed.
- Private S3 holds media and static assets; temporary work uses task-local disk.
  No EFS or permanent media disk is included.
- Public HTTPS ALB in two AZs; private API/worker tasks and a private database.
  S3 gateway endpoints keep S3 traffic off NAT. No paid interface endpoints are
  assumed; adding those requires a separate quote.

## 2. Workload inherited from the spike

These are **unapproved planning/test inputs**, not observed production traffic.

| Input | Assumption |
| --- | --- |
| Community | 1,000 registered users; 100 active sessions/sockets |
| Catalogue | 10,000 files, 1,000 packs, 100,000 messages |
| Original media | 25 MB average per file: approximately 250 GB |
| Ingest | 20 uploads/day at 25 MB: approximately 15 GB/month |
| Listening | 100 simultaneous listeners at 320 kbit/s for 8 hours/day |
| Metadata traffic | 20 requests/second sustained; short bursts to 50/second |
| Recovery targets | Metadata RPO <=15 minutes; independent-original-backup RPO <=24 hours; RTO <=4 hours |
| Reliability objective | 99.9% successful non-user-error requests; not an established SLA |

Listening calculation, using decimal network units:

```text
100 listeners x 320,000 bits/second / 8 = 4,000,000 bytes/second
4 MB/second x 3,600 = 14.4 GB/hour
14.4 GB/hour x 8 hours/day x 30 days = 3,456 GB/month

20 metadata requests/second x 86,400 x 30 = 51,840,000 requests/month
```

Budget roughly 55-65 million total monthly viewer requests after frontend, audio
range requests, artwork and reconnects. That request estimate needs measurement:
audio delivery does not necessarily mean one GET per track, and WebSocket frames
must not be counted as individual HTTP requests.

Downloads, repeat downloads and ZIP archives are **additional to** the 3.46 TB
listening calculation. Previews and downloads must be measured independently.

## 3. Proposed stack being priced

```text
Browser / PWA / admin / guides
  -> CloudFront Business: TLS, CDN, WAF, DNS
     -> private S3: static assets and explicitly authorized media
     -> HTTPS ALB
        -> private Fargate Node API: HTTP + WebSockets
           -> private RDS PostgreSQL
           -> private S3
        -> private Fargate media worker
           -> PostgreSQL durable job leases
           -> private S3

Separate backup account/region:
  immutable/versioned media copies + protected database recovery copies

Delivery/operations:
  ECR + CI builds + Secrets Manager + KMS + CloudWatch + small staging
```

Keep `/api`, session cookies, pack/share URLs and `/admin` stable. Cache public
static assets separately from personalized API responses. Private media needs
explicit authorization and appropriately scoped signed delivery; an opaque S3
key or a public CDN URL is not an access check.

### Compute assumptions

- Lean API: one task, 1 vCPU / 2 GiB, always on.
- Resilient API: two such tasks across two AZs.
- Lean worker: one task, 0.5 vCPU / 1 GiB, always on.
- Resilient worker: one task, 1 vCPU / 2 GiB, restartable with durable jobs.
  This is not a redundant pair of workers; queued work must survive restart.
- Lean database allowance targets a `db.t4g.medium`-class PostgreSQL instance
  with 20 GB gp3, single-AZ. Resilient allowance targets a primary/standby
  Multi-AZ instance deployment, not a three-instance Multi-AZ DB cluster.
- Staging uses synthetic, much smaller fixtures and a smaller separate database.
  It is not a second production-sized load-test environment.

The API and worker allocations are starting points, not proof of capacity.
Five concurrent ffmpeg processes are not assumed safe at these sizes: queue the
five-upload burst and enforce measured worker concurrency/RSS/temp limits.
RDS burst CPU-credit charges and sustained database pressure require monitoring.

## 4. Complete recurring monthly estimate

**C** = calculated from quantities/rates; **A** = planning allowance, not a fixed
service quote. AWS regional/SKU prices must be checked before provisioning.

| Component | Basis | Lean | Resilient |
| --- | --- | ---: | ---: |
| API Fargate compute | C: 1 or 2 x 1 vCPU / 2 GiB x 730 hours | $36.04 | $72.08 |
| Media worker compute | C: 0.5 vCPU / 1 GiB, or 1 vCPU / 2 GiB | $18.02 | $36.04 |
| RDS PostgreSQL + 20 GB gp3 | A: single-AZ or primary/standby Multi-AZ; verify engine/region quote | $60.00 | $120.00 |
| CloudFront Business | C: one plan, 50 TB and 125M requests/month | $200.00 | $200.00 |
| ALB base + LCU usage | C/A: $16.43 base plus metadata/upload processing headroom | $22.00 | $25.00 |
| ALB public IPv4 | C: two addresses x $0.005/hour x 730 | $7.30 | $7.30 |
| NAT gateways + their IPv4 | C: one AZ or two AZs; $32.85 + $3.65 each | $36.50 | $73.00 |
| NAT data + inter-AZ transfer | A: low-volume control traffic; media uses S3 gateway endpoints | $2.00 | $4.00 |
| Primary S3 storage | C: 400 GB x $0.023/GB-month | $9.20 | $9.20 |
| Independent media backup storage | C: 300 GB x $0.023/GB-month at a similarly priced destination | $6.90 | $6.90 |
| S3 requests + incremental backup transfer | A: GET/PUT/LIST, lifecycle/inventory and 15 GB/month cross-region additions | $3.00 | $5.00 |
| Extra database backup/copy storage | A: beyond included RDS automated-backup allowance | $5.00 | $10.00 |
| KMS keys and requests | A: few customer-managed keys; S3 Bucket Keys where compatible | $3.00 | $4.00 |
| Application logs, metrics, alarms, checks | A: bounded logging, retention and querying | $15.00 | $22.00 |
| Secrets Manager | A: few secrets, cached retrieval; not per-request fetching | $2.00 | $3.00 |
| ECR image retention | A: small image history with lifecycle cleanup | $1.00 | $2.00 |
| CI build execution | A: modest build minutes; use existing CI or CodeBuild, not both | $5.00 | $8.00 |
| Transactional email reserve | A: optional low-volume SES; not currently a newly implemented feature | $1.00 | $2.00 |
| Domain registration amortization | A: renewal spread monthly; actual TLD/registrar varies | $2.00 | $2.00 |
| Small staging environment | A: breakdown below; shares production networking capacity, not data | $45.00 | $60.00 |
| **Total before contingency** | | **$479.96** | **$671.52** |
| **20% contingency** | Covers normal usage/price uncertainty, not unlimited growth | **$95.99** | **$134.30** |
| **Total with contingency** | | **$575.95** | **$805.82** |
| **Rounded monthly budget** | | **$600** | **$825** |

Fargate rate calculation: approximately $0.0404784/vCPU-hour and
$0.004446/GiB-hour from AWS's Linux/x86 Northern Virginia pricing example.
One 1-vCPU/2-GiB task costs approximately
`730 x (0.0404784 + 2 x 0.004446) = $36.04`.
The included default 20 GiB ephemeral storage is sufficient only if admission and
cleanup keep scratch use within it; larger allocations add cost.

### Staging allowance

The lean $45 consists of approximately $9 for a 0.25-vCPU/0.5-GiB task, $26
for a small separate PostgreSQL database/storage, $3 for logs, $2 for synthetic
media/backups, $1 for secrets and $4 for incremental networking/operations.
The resilient column adds $15 for more test-runtime headroom.

Use the existing ALB with a separate target group and protected staging hostname,
and shared NAT capacity; isolate database, buckets/prefix permissions and secrets.
These are separate environments but **not separate VPC/account isolation**.
A dedicated staging ALB, NAT, account or CloudFront plan is not included.
Protect direct staging ingress; do not make test data/admin endpoints public.
Large load tests and temporary restore environments are extra.

### Avoid double counting

- CloudFront Business includes WAF capabilities, DNS, edge TLS and certain
  delivery/WAF log ingestion. Those are not charged a second time here.
  Additional WAF products, premium rules and application logging can still cost.
- ACM-managed public certificates for the ALB are assumed without a separate
  certificate fee; paid certificate products are not included.
- Business advertises **1 TB of S3 Standard storage credits**. The table
  conservatively charges all 700 GB of primary/backup storage anyway.
  If the full credit applies, it could remove up to **$16.10/month** here.
  Do not assume a credit in the production account pays the separate backup
  account's bill; confirm scope and eligibility.
- Transfer from supported AWS origins to CloudFront is not also billed as normal
  internet egress. S3 GET requests, backup replication and NAT processing remain
  separate where applicable.
- IAM roles, VPC/security groups, ECS orchestration on Fargate and PostgreSQL
  software do not add separate licence/subscription lines.

## 5. Why CloudFront Business is the baseline

Current published flat-rate plans list:

| Plan | Monthly fee | Viewer requests | Transfer |
| --- | ---: | ---: | ---: |
| Pro | $15 | 10 million | 50 TB |
| Business | $200 | 125 million | 50 TB |

The spike's sustained API load alone is approximately 51.84M requests/month,
so Pro is not the whole-application budget. Business also includes custom cache
and origin-request policies needed for a controllable API/private-media design.
Confirm exact support for signed delivery, cookie/header forwarding, range
requests and cache-disabled API behaviors before committing to this plan.
Never weaken authorization or cache private responses just to fit a cheaper tier.

Allowances are plan boundaries, not a promise of unlimited capacity: monitor
usage and AWS's current plan terms. Do not rely on free-tier eligibility.
If the required configuration is incompatible with a flat-rate plan, price
pay-as-you-go CDN/WAF/DNS/logging together; **this model must then be revised**.
No new pay-as-you-go transfer quote is silently substituted here.

## 6. Storage, backups and growth

The primary 400 GB allowance comprises 250 GB originals plus approximately
150 GB for previews, artwork, static assets, retained versions and short-lived
archives. The independent backup allowance is 250 GB originals plus 50 GB for
retained changes. These are storage budgets, not measured encoding ratios.

- Use lifecycle rules and bounded ZIP retention; do not retain every archive
  indefinitely or copy regenerable archives into disaster backups.
- Originals add approximately 15 GB/month. At the reference storage rate,
  a primary and independent copy add roughly **$0.69/month of recurring storage
  for each month's new uploads**, before previews, versions and transfer.
- At 12 months of that ingest, originals alone add 180 GB per copy. Primary
  storage and backup allowances must grow or be repriced; the opening-month
  table is not a fixed twelve-month storage bill.
- An independent, separately administered backup account/region with restricted
  deletion and tested retention is assumed. S3 versioning in the primary account
  alone is not that backup.
- Daily incremental media copies target the accepted <=24-hour original RPO.
  RDS PITR supports metadata recovery, but remote/cross-account snapshot copies
  do not automatically provide a <=15-minute regional-disaster RPO.
- Achieving a <=15-minute RPO after loss of the primary region may require
  continuous cross-region replication and additional database/transfer spend,
  **not included**. Recovery objectives must state which failure domains apply.
- Retain 30 days of operational backups initially and run restore drills.
  Retention churn, lock duration, full-copy behavior and restored resources can
  exceed these small allowances; measure them before making recovery promises.

## 7. Sensitivity and budget risks

| Change | Effect |
| --- | --- |
| Listening is only 10 concurrent users for 8 hours/day | About 346 GB/month; infrastructure/Business plan remain mostly fixed at the modelled request load |
| 100 listeners run 24 hours/day at 320 kbit/s | About 10.37 TB/month, before downloads |
| Streams average 1.411 Mbit/s instead of 320 kbit/s | About 15.24 TB/month at 8 hours/day |
| Streams average 10 Mbit/s at that utilization | About 108 TB/month; exceeds the assumed 50-TB plan |
| API averages 50 requests/second all month | About 129.6M API requests before media/static requests; exceeds Business's 125M allowance |
| Add one 1-vCPU/2-GiB API task | Approximately $36/month compute plus traffic/database effects |
| Add one NAT gateway with its public IPv4 | Approximately $36.50/month before processed data |
| A small RDS instance cannot sustain the workload | Requote the next size/class; CPU-credit and storage growth charges are additional risks |
| Each of 51.84M API requests logs 1 KB | Roughly 52 GB of logs before worker/access/error logs; verbose logging can exceed the observability allowance |

The current implementation serves original audio to authenticated listeners.
Do not silently treat every full stream as a 320-kbit/s preview. Real source
bitrates and download behavior are the largest workload uncertainties.
Similarly, full community snapshots and collection rewrites can make 20 API
requests/second much more expensive than 20 small indexed reads.

## 8. What is implemented versus still required

Current deployment configuration is a single Render service with a 1-GB disk.
The opt-in PostgreSQL compatibility layer preserves existing API contracts, but
reads full state, rewrites changed collections, serializes work and keeps
WebSocket/push dispatch process-local. Stage A/B proofs are not automatically
the production media pipeline.

Before either priced AWS option can be called deployment-ready:

1. Implement and verify private S3 upload/read/delete, quarantine, media
   validation, preview and archive lifecycles; preserve all access rules.
2. Wire durable processing and commit-safe dispatch into the real API, rather
   than assuming the Stage B harness is already its production worker.
3. Configure ECS, ALB, task roles, private networking, verified database TLS,
   secrets, WAF and correctly separated cache behaviors.
4. Load-test actual full-state PostgreSQL/API behavior, source audio bitrates,
   100 sockets/listeners and the five-upload burst. Adjust compute/DB budgets.
5. Before multiple APIs: remove unsafe per-process state assumptions, implement
   cross-instance realtime delivery and durable effects, and verify ordering,
   idempotency, session behavior and pool limits under failover.
6. Rehearse guarded import, backup/restore, rollback, key recovery and deployment
   shutdown. Measure the accepted RPO/RTO and define maintenance windows.

The lean option has API/database single points of failure. The resilient option
reduces those only after this work; neither topology alone proves 99.9%.

## 9. Exclusions and spending controls

Not included: migration/build engineering, on-call labour, paid AWS technical
support, taxes, payment-provider fees, SMS, marketing email, third-party analytics,
large guide-video distribution, dedicated security products, warm DR compute,
regional database replica, premium database IOPS, long-term audit retention,
unexpected abuse at origins, or duplicate live Render hosting during migration.
Small guide/static assets are within the storage/request allowances; large
videos must be added to transfer. Web Push uses existing browser push services,
not a per-subscriber SNS bill.

Set cost alerts at 50%, 80% and 100% of the chosen budget plus anomaly detection.
Billing alerts are **not a hard spending cap**. Enforce upload/download quotas,
job concurrency, scratch limits, archive TTLs and log retention in the product.
Monitor CloudFront requests/bytes, S3 version growth, NAT bytes, RDS CPU credits,
database latency, worker queue age and actual restore costs.

**Recommendation:** retain Render for the current phase. For AWS approval, carry
**$600/month lean** or **$825/month resilient**, then replace allowances with a
saved regional AWS Calculator estimate and measured staging results. Provision
nothing solely on the strength of this document.

## 10. Sources and estimate confidence

Public pricing/features checked on 11 November 2026. Dynamic pricing tables,
account eligibility and negotiated pricing were not verified in an AWS account.

| Source | Used for |
| --- | --- |
| [Production spike](./backend-production-spike.md) | Workload, Render-first decision, media/recovery requirements |
| [Current Render configuration](../render.yaml), [container](../Dockerfile) | Current single-service/disk topology and shared frontend/admin hosting |
| [PostgreSQL compatibility storage](../apps/api/src/communityPostgres.mjs) | Current compatibility limits; not a normalized multi-instance backend |
| [AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/) | CPU/memory calculation and scratch-storage basis |
| [RDS PostgreSQL pricing](https://aws.amazon.com/rds/postgresql/pricing/) | Instance/storage/backup/transfer billing; exact SKU allowance still needs a quote |
| [CloudFront plan prices](https://docs.aws.amazon.com/PricingPlanManager/latest/UserGuide/plans.html) | $15/$200 plans, request and transfer allowances |
| [CloudFront plan features](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html) | Custom policies, included services, S3 storage credits and plan restrictions |
| [CloudFront pay-as-you-go](https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/) | AWS origin-to-CloudFront transfer treatment |
| [ALB pricing](https://aws.amazon.com/elasticloadbalancing/pricing/) | $0.0225/hour base and $0.008/LCU-hour reference example |
| [VPC pricing](https://aws.amazon.com/vpc/pricing/) | NAT $0.045/hour, $0.045/GB reference and public IPv4 charges |
| [S3 pricing](https://aws.amazon.com/s3/pricing/) | Standard storage/request/replication charging; $0.023/GB-month reference |
| [KMS](https://aws.amazon.com/kms/pricing/), [Secrets Manager](https://aws.amazon.com/secrets-manager/pricing/) | Key and secret operational allowances |
| [CloudWatch](https://aws.amazon.com/cloudwatch/pricing/), [ECR](https://aws.amazon.com/ecr/pricing/) | Observability and image-retention allowances |
| [SES](https://aws.amazon.com/ses/pricing/) | Optional low-volume transactional email reserve |

**Confidence:** medium for an opening-month financial envelope; low for capacity
until real load tests. Calculated prices are not fixed quotes, and allowances
must not be presented as benchmark results.
