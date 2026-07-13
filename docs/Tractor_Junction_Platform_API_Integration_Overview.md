# Tractor Junction — Platform API & Integration Overview

| Field | Value |
|-------|--------|
| **Document owner** | Backend / Platform (Tech Lead) |
| **Audience** | Engineering, QA, SRE, Product, Partner integrations |
| **Scope** | Tractor Junction web + mobile backend (`tractorjunction` repo) |
| **Source of truth date** | 2026-07-13 |
| **Primary API surface** | API V3 (`/api/v3/{locale}/…`) |
| **Docs UI** | `/api/v3/documentation` (basic auth in production) |

---

## 0. Executive summary (Tech Lead)

This repository is the **public marketplace + mobile API backend**. It is **not** the CRM application itself. CRM is integrated as:

1. A **separate MySQL database** (`CRMDB` → `leads` table via `App\Model\CRMLead`)
2. An **outbound HTTP CRM service** (`CRMS_URL` / `UPDATE_CRMS_URL`)

**BMS** is **not present** in this codebase. If stakeholders refer to “BMS”, confirm whether they mean **CRMS** (CRM service) or another internal system outside this repo.

**Postman collections are not checked into git.** The maintained machine-readable catalog is **OpenAPI V3** (Swagger), generated from route catalogs. Teams should export Postman from OpenAPI or maintain collections in a shared Postman workspace and link them here.

**Production response times (p50/p95/p99) are not stored in this repository.** Section 2 includes module inventories and a **measurement backlog** for SRE/APM to fill.

---

## 1. Postman / API collections

### 1.1 Current state

| Asset | Location | Status |
|-------|----------|--------|
| Postman collection (`.postman_collection.json`) | — | **Not in repo** |
| Insomnia / Hoppscotch exports | — | **Not in repo** |
| OpenAPI route catalog (locale) | `app/Swagger/V3/routes-catalog.php` | **Canonical** (~338 operations) |
| OpenAPI route catalog (global) | `app/Swagger/V3/routes-catalog-global.php` | **Canonical** (7 operations) |
| Generator | `scripts/generate-v3-openapi.php` | `composer swagger:generate` |
| Generated OpenAPI JSON | `storage/api-docs/v3-api-docs.json` | Runtime / committed publish copy under `public/api-docs/` (direct public access blocked via `.htaccess`) |
| Swagger UI | `GET /api/v3/documentation` | Production: HTTP Basic Auth (`LOGVIEWER_USERNAME` / `LOGVIEWER_PASSWORD`) |
| OpenAPI JSON (Laravel) | `GET /api/v3/docs` | Same basic auth in production |

### 1.2 Recommended Postman operating model

1. Treat **Swagger OpenAPI** as source of truth for V3.
2. After each API change:
   - Update `routes/api.php` (or `routes/services.php` / `central_api.php` as applicable)
   - Add/update entry in `routes-catalog.php` or `routes-catalog-global.php`
   - Run `composer swagger:generate`
   - Commit updated `public/api-docs/v3-api-docs.json` (if still used as artifact)
3. Import OpenAPI into Postman:
   - Postman → Import → `v3-api-docs.json` **or** URL `https://<host>/api/v3/docs` (auth required on prod)
4. Maintain **workspace collections** (not git) for:
   - Mobile App (V3)
   - Partner Services (TractorBazzi / Escort / FinJ / VMS)
   - Central / Location masters
   - Legacy V1 / V2 (if still used by clients)

### 1.3 Collection inventory (to be maintained by team)

| Collection name | Consumers | Base path | Source | Owner | Last verified |
|-----------------|-----------|-----------|--------|-------|---------------|
| TJ Mobile API V3 | Android / iOS | `/api/v3/{locale}` | OpenAPI / Swagger | Backend | _TBD — export from OpenAPI_ |
| TJ Partner Services | TractorBazzi, Escort, FinJ, VMS | `/api/service/…` | `routes/services.php` | Backend | _TBD_ |
| TJ Central Location API | Internal / shared masters | `/central_api/…` | `routes/central_api.php` | Backend | _TBD_ |
| TJ API V1 (legacy) | Older clients | `/api/v1/…` | `routes/api.php` | Backend | _TBD_ |
| TJ API V2 (legacy) | Locale clients | `/api/v2/{locale}/…` | `routes/api.php` | Backend | _TBD_ |
| TJ TVF | TVF integration | `/api/tvf/…` | `routes/tvf.php` | Backend | _TBD_ |
| Credit Score (web package) | Web flows | `/check-credit-score/…` | `packages/creditscore` | Creditscore | _TBD_ |

> **Action:** Attach Postman workspace links / collection UIDs in the table above once exported.

---

## 2. APIs by module (master + application surfaces)

### 2.1 How routes are mounted

| Route file | Prefix | Middleware | Status |
|------------|--------|------------|--------|
| `routes/api.php` | `/api` | `api` | **Active** |
| `routes/services.php` | `/api` | `api` | **Active** |
| `routes/tvf.php` | `/api` | `api` | **Active** |
| `routes/central_api.php` | `/central_api` | (namespace only) | **Active** |
| `routes/web.php` | `/` | `web` | **Active** |
| `routes/admin.php` | intended `/{locale}/manage/` | — | **Registration commented out** in `RouteServiceProvider` — confirm per environment |
| `routes/dealer.php`, `routes/manufacturer.php` | — | — | Mapping commented out |

Registration: `app/Providers/RouteServiceProvider.php`.

### 2.2 API generations

| Generation | Pattern | Auth | Notes |
|------------|---------|------|-------|
| **V3 (primary)** | `/api/v3/{locale}/…` (`en\|hi\|te\|ta\|mr`) | `X-API-KEY` (+ Passport `auth:api` on user routes) | Mobile app; documented in Swagger |
| **V3 global** | `/api/v3/…` (no locale) | `X-API-KEY` | Search, FinJ candidate, brochure, legacy geo fallbacks |
| **V2** | `/api/v2/{locale}/…` | Mix of key / Passport | Legacy locale API |
| **V1** | `/api/v1/…` | App-level checks | Legacy |
| **Services** | `/api/service/{partner}/…` | Partner-specific (e.g. `vms_service`) | Inbound partner APIs |
| **Central** | `/central_api/…` | As implemented in controller | Location master-style HTTP API |

### 2.3 API V3 modules (from OpenAPI catalog)

Counts = catalog entries (locale + global). **Prod latency columns must be filled from APM** (New Relic / Datadog / CloudWatch / access logs). Values below are placeholders.

| Module (Swagger tag) | Approx. ops | Typical consumers | Master / lookup? | Prod p50 (ms) | Prod p95 (ms) | Notes |
|----------------------|-------------|-------------------|------------------|---------------|---------------|-------|
| Tractors | 37 | App / web | Partial | _TBD_ | _TBD_ | New tractor catalog |
| Community | 33 | App | No | _TBD_ | _TBD_ | Social / Q&A |
| General | 27 | App | **Yes** (lookups) | _TBD_ | _TBD_ | States, districts, tehsils, HP, hours, etc. |
| Used Tractors | 25 | App / web | Partial | _TBD_ | _TBD_ | Inventory + leads |
| News | 19 | App | No | _TBD_ | _TBD_ | |
| Leads | 18 | App / CRM path | No | _TBD_ | _TBD_ | Often fans out to CRMS |
| Certified Dealers | 17 | App | Partial geo | _TBD_ | _TBD_ | Includes geo masters |
| User Account | 17 | App | No | _TBD_ | _TBD_ | Passport |
| Brands | 13 | App | **Yes** | _TBD_ | _TBD_ | |
| Filters | 13 | App | **Yes** | _TBD_ | _TBD_ | |
| Home | 13 | App | No | _TBD_ | _TBD_ | Widgets / home feed |
| Used Products | 13 | App | Partial | _TBD_ | _TBD_ | |
| Auth | 10 | App | No | _TBD_ | _TBD_ | OTP / login |
| Implements | 8 | App | Partial | _TBD_ | _TBD_ | |
| Dealers | 8 | App | Partial | _TBD_ | _TBD_ | On-road price related |
| Referral & Wallet | 7 | App | No | _TBD_ | _TBD_ | May call referral service |
| Tractor Recommendation | 6 | App | **Yes** (crop/budget) | _TBD_ | _TBD_ | |
| Comparison | 5 | App | No | _TBD_ | _TBD_ | |
| Inventory | 5 | App | No | _TBD_ | _TBD_ | Sell forms |
| Payment | 5 | App | No | _TBD_ | _TBD_ | Razorpay |
| Score Game | 5 | App | No | _TBD_ | _TBD_ | |
| Search | 5 | App | No | _TBD_ | _TBD_ | |
| Tyres | 5 | App | Partial | _TBD_ | _TBD_ | |
| Brand Series | 4 | App | **Yes** | _TBD_ | _TBD_ | |
| E-Commerce | 3 | App | No | _TBD_ | _TBD_ | |
| Favourites | 3 | App | No | _TBD_ | _TBD_ | |
| FCM | 3 | App | No | _TBD_ | _TBD_ | Push tokens |
| Mandi Price | 3 | App | No | _TBD_ | _TBD_ | |
| Showrooms | 3 | App | Partial | _TBD_ | _TBD_ | |
| EMI Calculator | 2 | App | No | _TBD_ | _TBD_ | |
| Listings | 2 | App | No | _TBD_ | _TBD_ | |
| Reviews | 2 | App / web | No | _TBD_ | _TBD_ | |
| Tracking | 2 | App | No | _TBD_ | _TBD_ | |
| Analytics | 1 | App | No | _TBD_ | _TBD_ | |
| Deep Linking | 1 | App | No | _TBD_ | _TBD_ | |
| Geo Location | 1 | App | Partial | _TBD_ | _TBD_ | |
| Static Data | 1 | App | **Yes** | _TBD_ | _TBD_ | |
| **Total (catalog)** | **~345** | | | | | Locale 338 + global 7 |

Full path-level detail: `app/Swagger/V3/routes-catalog.php` and Swagger UI.

### 2.4 Master / reference APIs (cross-cutting)

These are the **location & catalog masters** used across CRM flows, app filters, and partner services.

| Master domain | Backend (this app) | Downstream when Elastic enabled | Central API mirror |
|---------------|--------------------|----------------------------------|--------------------|
| States | V1/V2/V3 `states/get`, DB `states` | `{ELASTIC_SEARCH_URL}location-master/api/get_all_states_list` | `POST /central_api/get_all_state_list` |
| Districts | `districts/{stateId}`, DB `districts` | `…/get_all_districts_list(_by_state_id)` | `POST /central_api/get_all_district_list_by_state_id` |
| Tehsils | `getTehsils`, DB `tehsils` | `…/get_all_tehsils_list(_by_district_id|_by_state_id)` | `POST /central_api/get_all_tehsil_list_by_district_id` |
| Keyword location | V3 `/location/search` | `…/get_location_by_keyword` / slug helpers | `GET /central_api/get_location_by_keyword` |
| Brands / models | V3 Brands + partner service brand/model routes | Local DB (`brands`, `tractors`, …) | Partner: TractorBazzi / Escort / FinJ / VMS |
| HP / hours / conditions | General / Filters modules | Local DB | — |

**Feature flag:** `ENABLE_ELASTIC` / `config('app.ENABLE_ELASTIC_SEARCH')` — when not `Y`, code falls back to MySQL masters.

### 2.5 Partner / service APIs (`routes/services.php`)

| Partner | Base path | Key endpoints | Auth |
|---------|-----------|---------------|------|
| TractorBazzi | `/api/service/tractorbazzi` | used-tractor add/update/status; brands; models; states | As implemented in controller |
| Escort | `/api/service/escort` | brands; models; price-valuation | As implemented |
| FinJ | `/api/service/finj` | brands; models; purchase_request add/get | Inbound FinJ |
| VMS | `/api/service/vms` | used-tractors CRUD-ish; centers; model-details; id lookup | `vms_service` middleware + `VMS_SERVICE_API_KEY` |

### 2.6 CRM vs backend — latency ownership

| Surface | System of record | Latency to measure |
|---------|------------------|--------------------|
| Mobile / web APIs | This Laravel app (+ Redis, MySQL, Elastic location-master) | Endpoint p95 on `/api/v3/…` |
| CRM UI / CRM APIs | **Separate CRM stack** (not this repo) | CRM team APM |
| Lead sync from TJ → CRM | Outbound `CRMS_URL` / `UPDATE_CRMS_URL` | Downstream HTTP time inside lead jobs/controllers |
| CRM DB read from TJ | `CRMDB` connection → `leads` | DB query time on CRM MySQL |

### 2.7 How to populate production response times

1. Enable/confirm APM on production PHP (or parse access logs for `/api/v3/`).
2. Export last 7 / 30 days: p50, p95, error rate by route group.
3. Fill Section 2.3 columns; attach dashboard link here: `_TBD_`.
4. For master APIs, also capture **downstream** time (location-master / CRMS) separately from TJ PHP time.

---

## 3. Frequently used backend tables

Core tables inferred from models and high-churn controllers (used inventory, catalog, leads, geo).

| Table | Model (typical) | Connection | Domain |
|-------|-----------------|------------|--------|
| `users` | `App\User` | default | Auth / profile (Passport) |
| `old_tractors` | `App\Model\OldTractor` | default | Used tractor inventory (**highest churn**) |
| `tractors` | `App\Model\Tractor` | default | New tractor catalog |
| `tractors_trans` | (trans) | default | Localized tractor content |
| `brands` / `brands_trans` | `App\Model\Brand` | default | Brand master |
| `states` | `App\Model\State` | default | Geo master (fallback if Elastic off) |
| `districts` | `App\Model\District` | default | Geo master |
| `tehsils` | `App\Model\Tehsil` | default | Geo master |
| `purchaserequest` | `App\Model\PurchaseRequest` | default | Buyer / seller requests |
| `leads` | `App\Model\CRMLead` | **`CRMDB`** | CRM leads |
| `loans` | `App\Model\Loan` | default | Finance leads |
| `dealers` | `App\Model\Dealer` | default | Dealer network |
| `certified_dealers` | `App\Model\CertifiedDealer` | default | Certified network |
| `implements` / `harvesters` | Implement / Harvester models | default | Implements / harvesters |
| `news` (+ trans) | `App\Model\News` | default | Content |
| `community_posts` / `community_topics` (+ related) | Community models | default | Community |
| `ecom_products` / `ecom_orders` (+ related) | E-com models | default | E-commerce |
| `elastic_modules` | (config table) | default | Which modules use Elastic |

**Other DBs (config present):** blog (`tgblog`), LMS (`DB_CONNECTION_LMS`), CRM (`DB_*_CRM`).

> Exact “top N by query volume” requires production slow-query / APM table metrics — not available in git. Prefer measuring `old_tractors`, `users`, geo tables, `purchaserequest`, and CRM `leads` first.

---

## 4. Vendor & internal downstream integrations

### 4.1 Integration map

```text
┌─────────────────────────────────────────────────────────────────┐
│                     Clients (App / Web / Partners)              │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Tractor Junction Laravel 8 (this repo)             │
│  API V1/V2/V3 · Services · Central API · Queues (Redis)         │
└───┬───────────┬───────────┬───────────┬───────────┬─────────────┘
    │           │           │           │           │
    ▼           ▼           ▼           ▼           ▼
 MySQL TJ   CRMDB      location-master   CRMS HTTP   Payments / SMS /
 (default)  (leads)    (Elastic HTTP)    (CRM svc)   Firebase / OLX / …
```

### 4.2 Catalog of integrations

| Integration | Direction | Config / env | Timeout handling (code) | Failure behaviour (observed pattern) |
|-------------|-----------|--------------|-------------------------|--------------------------------------|
| **CRMS (CRM HTTP)** — _not BMS_ | Outbound | `CRMS_URL`, `UPDATE_CRMS_URL`, vehicle/VAHAN: `CRMS_VEHICLE_DETAILS_*`, `CRMS_VAHAN_XAPI_KEY` | Guzzle commonly `timeout=10`, `connect_timeout=5` | Caller-dependent; lead push / vehicle lookup |
| **CRM MySQL** | DB | `DB_*_CRM` → `CRMDB` | DB driver defaults | Eloquent on `leads` |
| **Location master** | Outbound HTTP | `ENABLE_ELASTIC` / `ELASTIC_SEARCH_URL`, index name default `location-master` | curl `CURLOPT_TIMEOUT` **5 / 8 / 15** (helper-specific) | If Elastic disabled → MySQL geo tables |
| **Elasticsearch PHP client** | Outbound | `ELASTICSEARCH_HOST/PORT/SCHEME/USER/PASS` | Client config | Separate from location-master HTTP helpers |
| **Razorpay** | Outbound | `RAZORPAY_TEST_*` / `RAZORPAY_LIVE_*` | SDK defaults | Payment controllers V1/V3 |
| **PayPhi** | Outbound | `PAYPHI_MERCHANT_ID`, `PAYPHI_AGGREGATOR_ID` | Controller-specific | PayPhi controller |
| **Firebase / FCM** | Outbound | `FIREBASE_CREDENTIALS`, `FCM_SERVER_KEY` | SDK / HTTP | Community notifications, FCM token APIs |
| **SMS (Textlocal / MSG91)** | Outbound | `SMS_SERVICE`, `TEXTLOCAL_*`, `MSG91_*` | Job `$timeout` e.g. SendSmsJob **30s** | Queued where configured |
| **OTP service** | Outbound | `OTP_SERVICE_API_KEY`, `OTP_SERVICE_BASE_URL` (default `https://crs.farmjunction.in/api`) | Service client | Auth / OTP flows |
| **Referral API** | Outbound | `REFERRAL_API_URL`, `REFERRAL_API_KEY` | `Http::timeout(10)` | `PushReferralStatus` |
| **OLX** | Outbound | `OLX_*` (`config/services.php`) | `Http::timeout(20|25)` | `App\Services\Olx\OlxClient` |
| **Auction** | Outbound | `AUCTION_TRACTOR_API_URL` | `'timeout' => 15` | Share-to-auction command |
| **Google Geocoding** | Outbound | `GOOGLE_GEOCODING_API_KEY` | Service-specific | `GoogleGeocodingService` |
| **IP geolocation** | Outbound | `ENABLE_IP_API_LOCATION` | `timeout => 1` | Fast-fail in `LocationTrait` |
| **Credit score** | Outbound | `CIBIL_SERVICE`, `INTEGRITY_MASTER_*`, `CREDISURE_*` | Package services | `packages/creditscore` |
| **IFFCO** | Outbound | `IFFCO_*` | Config URLs | Offer / token flows |
| **AWS S3** | Outbound | `AWS_*` | SDK | Media / assets |
| **VMS / FinJ / Escort / TractorBazzi** | **Inbound** | e.g. `VMS_SERVICE_API_KEY` | N/A (we are server) | `routes/services.php` |
| **BMS** | — | — | — | **Not found in this repository** |

### 4.3 Location-master endpoints used from Helpers

Base: `{ELASTIC_SEARCH_URL}location-master/api/…` (see `app/Http/Helpers.php`)

Examples:

- `get_all_states_list`
- `get_all_districts_list` / `get_all_districts_list_by_state_id`
- `get_all_tehsils_list` / `…_by_district_id` / `…_by_state_id`
- `get_location_by_id`
- `get_location_by_keyword` / slug helpers

**Timeout strategy:** per-helper curl timeouts (5–15s). No global circuit breaker in code — failures should degrade to DB masters when Elastic flag is off; when Elastic is on, callers must handle empty/error responses.

### 4.4 CRMS timeout strategy

Common Guzzle pattern in Helpers / lead-related code:

```php
new GuzzleHttp\Client(['timeout' => 10, 'connect_timeout' => 5]);
```

**Guidance:** Treat 10s as soft SLA for CRMS fan-out inside request lifecycle. Prefer queueing lead updates for user-facing APIs that must stay under app UX budgets (~2–3s).

---

## 5. Timeout configuration & architectural overview

### 5.1 Timeout matrix (code-derived)

| Layer | Typical value | Where |
|-------|---------------|--------|
| Guzzle HTTP (CRMS, many helpers) | **10s** total, **5s** connect | `app/Http/Helpers.php`, lead/on-road flows |
| Location-master curl | **5 / 8 / 15s** | `Helpers.php` elastic* functions |
| OLX | **20–25s** | `OlxClient` |
| Referral push | **10s** | `Http::timeout(10)` |
| Auction share | **15s** | command client |
| IP API | **1s** | `LocationTrait` |
| Redis RW | **2s** default | `REDIS_READ_WRITE_TIMEOUT` |
| Queue job | SMS 30s; sitemap 600s; export 7200s | Job `$timeout` |
| CLI `set_time_limit` | 60–600s | various commands/reports |

**Not defined in repo:** Apache/PHP-FPM `max_execution_time` for production workers — confirm on server images (`Dockerfile` uses `php:7.4.30-apache`).

### 5.2 Architectural overview

```text
                    ┌──────────────┐
   Mobile App ─────►│   CDN / DNS  │◄──── Web browsers
   Partners   ─────►└──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Apache + PHP │  Docker: php:7.4-apache
                    │ Laravel 8    │  Docroot: public/
                    └──────┬───────┘
           ┌───────────────┼────────────────┐
           ▼               ▼                ▼
     ┌──────────┐   ┌──────────┐    ┌──────────────┐
     │ MySQL TJ │   │ Redis    │    │ Outbound HTTP│
     │ + CRMDB  │   │ cache/q  │    │ CRMS, LM, …  │
     └──────────┘   └──────────┘    └──────────────┘
```

**Stack highlights**

| Concern | Choice |
|---------|--------|
| Framework | Laravel ^8.65, PHP ^7.3\|^8.0 (Docker PHP 7.4) |
| API auth | `X-API-KEY` (V3) + Laravel Passport (`auth:api`) |
| Locales | `en`, `hi`, `te`, `ta`, `mr` |
| Queue / cache | Redis (`QUEUE_CONNECTION=redis`) |
| Docs | L5-Swagger + custom OpenAPI generator |
| Payments | Razorpay (+ PayPhi) |
| Push | Firebase / FCM |
| Search / geo service | location-master over HTTP (+ ES client package) |
| Packages (path) | `packages/creditscore`, `packages/appsinsight` |

**API V3 request profile**

1. Client → `GET/POST /api/v3/{locale}/…`
2. Middleware `api` (+ route middleware such as `auth:api`, `vms_service`)
3. Many V3 controllers validate `X-API-KEY`
4. Controller / service may hit MySQL, Redis, location-master, CRMS, payment, SMS
5. JSON response to mobile app

**Security note (Tech Lead):** The V3 API key appears in source and frontend assets. Do not treat Swagger key descriptions as the only exposure. Docs UI is basic-auth protected in production; rotate keys via coordinated release if policy requires.

### 5.3 Environments & docs access

| Env | Swagger UI | Basic auth |
|-----|------------|------------|
| Local / non-production | `/api/v3/documentation` | No (middleware no-op) |
| Production | same | Yes — `LOGVIEWER_USERNAME` / `LOGVIEWER_PASSWORD` |
| Static `/api-docs/*.json` | Blocked by `public/api-docs/.htaccess` | Use `/api/v3/docs` instead |

---

## 6. Gaps & follow-up actions (ownership)

| # | Gap | Owner | Priority | Done when |
|---|-----|-------|----------|-----------|
| 1 | Postman collections not in repo / workspace links empty | Backend + Mobile | P1 | Section 1.3 filled with Postman URLs |
| 2 | Production p50/p95 per module unknown | SRE / Backend | P0 | Section 2.3 latency columns populated |
| 3 | Confirm whether “BMS” maps to CRMS or external system | Product + Backend | P1 | Glossary entry updated |
| 4 | Admin routes registration commented — confirm prod admin path | Backend | P2 | Doc updated with live admin entrypoint |
| 5 | Centralize HTTP client timeouts (single config) | Backend | P2 | `config/http_clients.php` (or similar) adopted |
| 6 | Circuit breaker / retry policy for location-master & CRMS | Backend | P2 | Documented + implemented |
| 7 | Top tables by prod query volume | DBA / SRE | P2 | Section 3 rewritten from metrics |

---

## 7. Quick reference — key files

```
routes/api.php
routes/services.php
routes/central_api.php
routes/tvf.php
app/Providers/RouteServiceProvider.php
app/Swagger/V3/routes-catalog.php
app/Swagger/V3/routes-catalog-global.php
scripts/generate-v3-openapi.php
config/l5-swagger.php
config/app.php                 # CRMS, Elastic flags
config/services.php            # OTP, OLX, referral, auction, SSO
config/sms.php
config/elasticsearch.php
config/firebase.php
config/logviewer.php           # Basic auth credentials for Swagger in prod
app/Http/Helpers.php           # location-master + many Guzzle clients
app/Http/Middleware/CustomBasicAuthMiddleware.php
packages/creditscore/
Dockerfile
composer.json
```

---

## 8. Change log

| Date | Author | Change |
|------|--------|--------|
| 2026-07-13 | Tech Lead (engineering) | Initial document from repository audit; Postman/latency marked TBD; BMS noted as absent (CRMS present) |
