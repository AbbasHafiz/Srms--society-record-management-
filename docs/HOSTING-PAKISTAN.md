# Hosting Society Records (SRMS) in Pakistan

Practical guide for a housing-society IT person or developer who will pay in **PKR** where possible, may not have an international credit card, and wants the app reachable in Pakistan on a **`.pk`** (or existing) domain.

Prices below are **approximate as of August 2026**. Confirm on the provider’s checkout page before you pay. USD amounts are converted at roughly **PKR 280 / USD** so you can budget; the rupee moves.

---

## Why not Vercel / “serverless only”?

This app stores **CNIC scans, allotment letters, PoA instruments, payment POs, electricity-bill scans**, and similar files on **local disk** (`UPLOAD_DIR`, default `./uploads`). PostgreSQL holds the records; the files live next to the app.

A **serverless-only Vercel deploy without object storage and without a persistent volume will lose those files** on every deploy and whenever a serverless instance is replaced. The ephemeral filesystem is not a document archive.

| Approach | Files survive deploys? | Use for SRMS? |
| --- | --- | --- |
| Linux VPS + Docker volumes (this guide) | Yes | **Yes — default** |
| Vercel / Railway / Render **without** S3-compatible storage | **No** | Do not use |
| Vercel + S3/R2/MinIO **and** hosted Postgres (Neon / Supabase / RDS) | Yes, if you change the app to talk to object storage | Only if you already have a USD card and will do extra engineering |

SRMS does **not** currently upload to S3. Do not deploy it as a diskless serverless app.

---

## 1. What you need

| Resource | Starting point | Why |
| --- | --- | --- |
| **CPU** | **2 vCPU** | Next.js 16 production server + Prisma + Caddy. 1 vCPU will crawl during `next build` and concurrent transfers. |
| **RAM** | **4 GB** | Node, Postgres 16, and Caddy on one box. 2 GB will OOM during build. 8 GB is more comfortable. |
| **Disk** | **40+ GB SSD**, prefer **80–120 GB** | OS + images + Postgres + growing scans. Each upload is capped at **10 MB** (PDF / JPEG / PNG / WebP). A busy transfer desk adds gigabytes per year. |
| **Postgres volume** | **Separate Docker volume** (`pgdata`) | Never keep the database only inside the app container. |
| **Uploads** | **Bind-mount `/var/srms/uploads`** (or a Docker volume named `uploads`) | Must persist across `docker compose up --build`. |
| **Public ports** | **80 and 443** | Caddy terminates HTTPS. The app stays on **43127 inside Docker**, not on the public internet. |
| **OS** | **Ubuntu 24.04 LTS** (or 22.04) | Full root SSH. **Do not** use shared cPanel hosting — it cannot run this Node + Postgres + volume stack. |
| **Domain** | `.pk` / `.com.pk` or any domain you already own | DNS **A record** → VPS public IPv4. |

**Recommended default:** a **Linux VPS physically in Pakistan** (Lahore / Karachi), **Docker Compose**, **Caddy** (automatic HTTPS), **Postgres on its own volume**, **uploads on disk**, **daily `pg_dump` + upload tarball**.

**Second option** (if the Pakistan VPS is too small, bandwidth-capped, or Docker/Node is painful): a **Mumbai / India KVM VPS** (Hostinger.pk or Contabo). Latency from major Pakistani ISPs is typically **~40–70 ms**, which is fine for a society office app. See the table.

---

## 2. Comparison (Pakistan-relevant, August 2026)

| Provider | DC location | PKR billing? | Payment | Good for this app? | Notes |
| --- | --- | --- | --- | --- | --- |
| **Websouls** (Lahore) — **recommended** | Pakistan (Lahore; they also advertise Karachi / Islamabad nodes) | **Yes** (checkout can switch USD / PKR) | **Bank transfer** (HBL, MCB), **EasyPaisa** and other mobile wallets to their HBL account, cash/cheque at Gulberg III office, cards, PayPal | **Yes** | Oldest well-known PK host (since 2002), **PKNIC Gold Partner**, phone support in Lahore. **PK VPS-2: 2 vCPU / 4 GB / 120 GB / 200 GB traffic ~ USD 26/mo (~PKR 7,300).** Full root, Ubuntu, Docker. Bandwidth is the tight item — enough for an office app, not a public media site. |
| **CloudVPS.pk** | Islamabad / Karachi / Lahore | **Yes** | **Meezan Bank, EasyPaisa, JazzCash, SadaPay** | **Yes** | Karachi 4 GB NVMe plan advertised ~**PKR 7,000/mo** (4 GB / 40 GB NVMe / 1 TB traffic). Clear local wallets. Confirm current specs at checkout. |
| **Domain.pk** (Karachi; related to HOST n DOMAIN, a PKNIC Gold Partner) | Pakistan / managed VPS | **Yes** | Local invoice / bank (confirm at order) | **Yes, if you get KVM + root** | **cv Two: 2 CPU / 4 GB / 100 GB ~ PKR 9,999/mo**, 2 TB transfer. Some plans lean cPanel-managed — ask for **Ubuntu + root + Docker**, not OpenVZ-only. `.pk` domains ~ **PKR 4,200** for the registry term they list. |
| **WebAnchor** | Pakistan (plans in PKR) | **Yes** | **Bank transfer, EasyPaisa, JazzCash, card** | **Yes** (size up from entry) | Entry VPS from ~**PKR 2,175/mo** is **1 vCPU / 1 GB** — too small. Pick ~4 GB RAM. Custom PKR calculator. PKNIC reseller. |
| **CreativeON** | Pakistan | **Yes** | Local (PKNIC Gold Partner) | Maybe | Cloud VPS from ~**PKR 3,800** in their own comparison posts. Confirm RAM ≥ 4 GB and root/Docker. |
| **ServerSea** (`serversea.pk`) | Pakistan-oriented | **Yes** | Local sales; PKNIC authorized reseller | Maybe | NVMe VPS, local support. Get a quote for 2 vCPU / 4 GB. |
| **Nayatel / Cybernet colo** | Islamabad / Karachi ISP datacenters | **Yes** (local invoice) | Bank / corporate invoice | Overkill for this app | Makes sense only if the society **already colo’s a server** or needs hardware on a specific PK network. You still run Ubuntu + Docker yourself. |
| **Hostinger.pk** | **India (Mumbai area)** among others — **not a PK datacenter** | **PKR** on [hostinger.pk](https://hostinger.pk) | Official list (Jul 2026): **Visa/Mastercard + JazzCash** + crypto. EasyPaisa is **not** on the official PK methods list — confirm checkout. | **Yes as second option** | **KVM 2: 2 vCPU / 8 GB / 100 GB NVMe / 8 TB**. Intro INR/PKR prices look cheap; **renewal is higher**. No Pakistan DC. |
| **Contabo** | **Mumbai (Navi Mumbai)** | No (EUR / USD / GBP) | **Card, PayPal, bank transfer** — Pakistani cards often fail; PayPal from PK is unreliable | **Yes as second option** if you can pay | Strong specs per euro (often **4 vCPU / 8 GB** in this price band, ~**USD 6–9/mo** + India location fee). Nearest high-spec node to PK. |
| **Hetzner Cloud** | **Singapore**, EU, US — **no Mumbai, no PK** | No | Card / PayPal / SEPA. PK cards often declined | Weak for PK users | Excellent EU VPS; Singapore is farther than Mumbai. Payment friction from Pakistan. |
| **AWS / GCP / Azure** `ap-south-1` (Mumbai) | Mumbai | No (USD) | International card / invoice | Capable, expensive | t3.medium-class VM + RDS + EBS + egress is typically **USD 40–80+/mo** before you add backups. Latency to PK is good; billing is not PKR-friendly. |
| **DigitalOcean / Linode (Akamai)** | Bangalore / others, not PK | No (USD) | **USD card** (PK BINs often blocked) | Capable | Fine technically; bad fit if you cannot hold a USD card. |
| **Vercel / Railway / Render** | Global serverless / containers | No (USD card) | Card | **Not as a default** | **Files vanish** without S3-compatible storage + hosted Postgres. Extra cost and extra code. Use only if you deliberately add object storage. |

**Pick one default:** **Websouls PK VPS-2 (or equivalent 2 vCPU / 4 GB / 80+ GB Linux VPS in Pakistan)** + this repo’s `docker-compose.prod.yml`.

**Second option:** **Hostinger.pk KVM 2 in India** (JazzCash + more RAM/bandwidth) **or Contabo Mumbai** (best specs per dollar if you can pay). Same Docker/Caddy steps.

---

## 3. Recommended path (step by step)

Target: `https://records.yoursociety.pk` (any hostname is fine) served by **Caddy** → **Next.js on 43127** → **Postgres 16**. Uploads on **`/var/srms/uploads`**.

### 3.1 Buy the VPS

1. Open [Websouls PK VPS](https://websouls.com/hosting/pk-vps) (or CloudVPS.pk / Domain.pk if you prefer their payment mix).
2. Choose **PK VPS-2** class: **2 vCPU, 4 GB RAM, 80–120 GB disk**.
3. OS: **Ubuntu 24.04** (or 22.04). **No cPanel** — you do not need it and it fights Docker.
4. Pay in PKR: bank transfer to Websouls HBL/MCB, EasyPaisa to their published HBL account, or card. After a bank/wallet payment, **email/WhatsApp the receipt** as they request.
5. Save the **public IPv4** and the **root SSH password** (or upload your SSH key in their panel).

### 3.2 First login and hardening

From your PC (Windows: PowerShell or PuTTY):

```bash
ssh root@YOUR.VPS.IP
```

```bash
apt-get update && apt-get upgrade -y
adduser srms
usermod -aG sudo srms
# SSH key login for srms, then:
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw deny 43127/tcp
ufw --force enable
```

**Do not** publish port **43127** on the public firewall. Dev uses 43127; production users hit **443** only.

### 3.3 Install Docker

```bash
# Official Docker CE on Ubuntu
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
usermod -aG docker srms
mkdir -p /var/srms/uploads /var/srms/backups /opt/srms
chown -R srms:srms /var/srms /opt/srms
```

Log out and back in as `srms` so the `docker` group applies.

### 3.4 Clone the repo

```bash
sudo -u srms git clone https://github.com/AbbasHafiz/Srms--society-record-management-.git /opt/srms
cd /opt/srms
# production branch or main — use the branch your society tracks
```

### 3.5 Environment file

```bash
cp .env.example .env
nano .env
```

Set **all of these** (names match `.env.example` / Prisma / NextAuth — do not invent extras):

```bash
POSTGRES_USER=society
POSTGRES_PASSWORD=  # long random; same password in DATABASE_URL
POSTGRES_DB=society_records

DATABASE_URL="postgresql://society:THAT_SAME_PASSWORD@db:5432/society_records?schema=public"

AUTH_SECRET=          # `openssl rand -base64 32`
NEXTAUTH_URL="https://records.yoursociety.pk"

UPLOAD_DIR=/app/uploads

MEMBERSHIP_PREFIX=M
ALLOTMENT_PREFIX=AL
TRANSFER_PREFIX=TRD
FILE_PREFIX=PF

# Leave empty unless you already run a WhatsApp Business API gateway
WHATSAPP_API_URL=
WHATSAPP_API_TOKEN=

# Caddy / compose only (not Next.js)
SRMS_DOMAIN=records.yoursociety.pk
ACME_EMAIL=it@yoursociety.pk
```

`trustHost` is **already enabled** in `src/lib/auth.config.ts`. You still set `NEXTAUTH_URL` in production because **QR codes for physical files** (`src/lib/qr.ts`) use it as the public origin. It must be the **https URL people type in the browser**, with no trailing slash.

Generate secrets on the VPS:

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 24   # POSTGRES_PASSWORD
```

### 3.6 DNS first, then Compose

Point the domain **A record** at the VPS IP (section 4) and wait until `ping records.yoursociety.pk` shows that IP. Let’s Encrypt will fail if DNS is wrong.

```bash
cd /opt/srms
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f app
```

First start:

1. Builds the production Next.js image (`BUILD_PRODUCTION=1`).
2. Waits for Postgres.
3. Runs **`npx prisma db push`** (this project does **not** use `prisma migrate` in the entrypoint).
4. If the `User` table is empty, **seeds demo users**.
5. Serves via **Caddy** on 80/443.

Open `https://records.yoursociety.pk/login`.

**Immediately** change `admin@society.local` / `password123` (and every other seeded account), or delete demo users you will not use. Seeded emails are listed in the README.

Local **test** compose (`docker compose up --build`) still binds **43127** and runs the **dev** server — that is for office LAN testing, not the public internet.

### 3.7 Bind address

`package.json` already starts Next with `--hostname 0.0.0.0 --port 43127`. Production Compose **does not publish** 43127 to the host; only Caddy reaches it on the Docker network. That is the correct “0.0.0.0 behind a proxy” setup.

---

## 4. Domain (`.pk`) and DNS

**Registry:** [PKNIC](https://www.pknic.net.pk/) runs `.pk`, `.com.pk`, `.net.pk`, `.org.pk`, `.web.pk`, `.fam.pk`, `.edu.pk`. PKNIC does **not** host websites.

**Price (from 1 August 2026):** PKNIC lists **Rs 2,100 per year** for registrants in Pakistan, billed **two years at a time** (Rs 4,200 for the term). International registrants: **USD 15.99/year**. Websouls announced **Rs 4,299 / USD 14.72 for two years** as the partner pass-through rate from the same date. Confirm at the registrar.

**Buy through a PKNIC partner** (easier invoice in PKR than dealing with the registry directly). Gold partners include **Websouls** (`websouls.pk`), **CreativeON**, **Nexus**, **HOST n DOMAIN**, **Brain**, **COMSATS**. Nayatel is listed as a Bronze partner; Cyber Internet (`cyber.net.pk`) as an authorized reseller. Full list: [PKNIC resellers](https://pk6.pknic.net.pk/pk5/resellers.PK).

If the society already owns `yoursociety.pk`, create a hostname such as `records.yoursociety.pk` — you do not need a new TLD.

### DNS

At the registrar DNS panel:

| Type | Name | Value |
| --- | --- | --- |
| **A** | `records` (or `@` for the apex) | your VPS IPv4 |
| **AAAA** | only if the VPS has IPv6 | that IPv6 |

TTL 300 seconds while you test, then 3600.

### Optional Cloudflare

You do **not** need Cloudflare. Caddy already gets a Let’s Encrypt certificate.

If you use Cloudflare:

- Start with **DNS only** (grey cloud). Simplest; origin HTTPS stays on Caddy.
- If you later **orange-cloud** (proxied): set SSL/TLS to **Full (strict)**, not Flexible (Flexible breaks cookies and mixed content).
- Uploads are max **10 MB** — under Cloudflare’s typical 100 MB proxy limit. Slow office links can still hit **100s timeouts**; grey-cloud avoids that.
- Production Next.js does not need HMR WebSockets. Orange-cloud WebSocket issues matter more in **dev**. QR-code and login cookies need the public host to match `NEXTAUTH_URL`.

---

## 5. Secrets and `NEXTAUTH_URL`

| Variable | Production rule |
| --- | --- |
| `AUTH_SECRET` | Required. Long random string. NextAuth v5 session signing. `NEXTAUTH_SECRET` is an old alias — **this repo documents `AUTH_SECRET`**. |
| `NEXTAUTH_URL` | **Public https origin**, e.g. `https://records.yoursociety.pk`. Used for QR codes. Wrong value → login redirects and phone scans point at localhost. |
| `AUTH_URL` | Optional. Leave unset if `NEXTAUTH_URL` is set. |
| `trustHost` | Already `true` in code. Helps behind Caddy / Cloudflare. Still set `NEXTAUTH_URL` for QR/public links. |
| `DATABASE_URL` | Must use hostname **`db`** inside Compose, user/password matching `POSTGRES_*`. |

Never commit `.env`. Never reuse the Docker **dev** secret (`society-records-docker-dev-secret-change-me`).

---

## 6. File uploads (scans, PoA, POs)

- Code path: `src/lib/uploads.ts` → `process.env.UPLOAD_DIR` (default `./uploads`).
- Production Compose bind-mounts **`/var/srms/uploads` → `/app/uploads`** and sets `UPLOAD_DIR=/app/uploads`.
- Caddy `request_body` max is **15 MB** so the app’s **10 MB** limit is what users hit.

**Back up this directory.** A database restore without the files leaves document rows pointing at missing scans.

```bash
sudo tar -czf /var/srms/backups/uploads-$(date +%F).tar.gz -C /var/srms uploads
```

If you ever switch to a named Docker volume instead of `/var/srms/uploads`, back up with `docker run --rm -v srms_uploads:/data -v /var/srms/backups:/bak alpine tar czf /bak/uploads.tgz -C /data .`

---

## 7. Database backups (`pg_dump` cron)

Postgres data lives in the **`pgdata` volume**. Do **not** copy that folder while Postgres is running. Use `pg_dump`.

A script is in the repo: `docker/backup-srms.sh`.

```bash
sudo cp /opt/srms/docker/backup-srms.sh /usr/local/sbin/backup-srms.sh
sudo chmod +x /usr/local/sbin/backup-srms.sh
sudo crontab -e
```

```
15 2 * * * COMPOSE_FILE=/opt/srms/docker-compose.prod.yml /usr/local/sbin/backup-srms.sh
```

It writes `/var/srms/backups/db-YYYY-MM-DD.sql.gz` and `uploads-YYYY-MM-DD.tar.gz`, and deletes files older than 14 days.

**Copy those files off the VPS weekly** (society NAS, encrypted USB in the office locker, or another cheap PK VPS). A backup that only exists on the same disk as the app is not a backup.

Restore (example):

```bash
gunzip -c /var/srms/backups/db-2026-08-28.sql.gz \
  | docker compose -f docker-compose.prod.yml exec -T db \
    psql -U society -d society_records
```

This project applies schema with **`prisma db push`**, not a migrate history. After restore, start the stack as usual; the entrypoint will `db push` to match the current code (without `--accept-data-loss` when `NODE_ENV=production`).

### In-app backup (Settings)

A Super Admin or GM can also download a zip from **Settings → Backup & restore** (`/settings/backup`). The zip is named `srms-backup-YYYYMMDD-HHMM.zip` and contains:

1. `database.dump` — `pg_dump` custom format of the app database
2. `uploads/` — a copy of `UPLOAD_DIR` (production: `/var/srms/uploads` bind-mounted as `/app/uploads`)
3. `manifest.json` — identifies the file as an SRMS backup (no secrets)

Restore from the same page **replaces** the live database and uploaded files. It is irreversible. Finance Excel import is not a substitute.

Keep the nightly cron above as the off-box copy. The UI is for an authorised person who needs a zip now, or who is restoring onto this server. The app container needs **`postgresql-client`** (`pg_dump` / `pg_restore`) and **`zip`/`unzip`** — the production Dockerfile installs them.

---

## 8. Email and WhatsApp

**SMTP is not required.** The app does not send mail for login (credentials provider) and has no SMTP env vars.

**WhatsApp** is optional. Out of the box, staff get **wa.me deep links**. Set `WHATSAPP_API_URL` and `WHATSAPP_API_TOKEN` only if you already have a Business API / gateway. Leave them empty on first go-live.

---

## 9. Checklist before go-live

- [ ] VPS is **2 vCPU / 4 GB / 40+ GB** (80+ GB preferred) with **Ubuntu** and **root**.
- [ ] UFW: **22, 80, 443** open; **43127 closed** to the world.
- [ ] `SRMS_DOMAIN` A record points at this VPS; `https://` loads with a valid certificate (Caddy).
- [ ] `.env` has unique `AUTH_SECRET` and `POSTGRES_PASSWORD`; `DATABASE_URL` host is **`db`**.
- [ ] `NEXTAUTH_URL` is exactly `https://your-public-host` (no trailing slash, no `:43127`).
- [ ] `/var/srms/uploads` exists, is writable, and is bind-mounted.
- [ ] Logged in as `SUPER_ADMIN`, **changed every seeded password**, removed unused demo users.
- [ ] Uploaded a test PDF on a plot/transfer and confirmed it still opens after `docker compose -f docker-compose.prod.yml restart app`.
- [ ] Nightly **pg_dump + uploads** cron works; one copy stored **off** the VPS.
- [ ] Society knows this is **not** a Vercel static site — disk and Postgres must stay up for records to exist.
- [ ] Optional: Cloudflare grey-cloud only, or Full (strict) if proxied.

---

## 10. Cost ballpark (PKR, approximate)

Assumes ~**PKR 280 / USD**. **Label: approximate — check live checkout.**

| Item | Low (PK, tight) | Typical (recommended) | Notes |
| --- | --- | --- | --- |
| VPS (2 vCPU / 4 GB / ~100 GB) | **PKR 6,000–8,000/mo** Websouls PK VPS-2 / CloudVPS Karachi 4 GB | **PKR 7,000–10,000/mo** | Domain.pk cv Two ~ **PKR 9,999**. Hostinger KVM 2 intro can look cheaper in PKR then **jump on renewal**. |
| VPS upgrade (8 GB) | Websouls PK VPS-3 ~ **USD 44 (~PKR 12,000)/mo** | CloudVPS Karachi 8 GB advertised ~ **PKR 13,000/mo** | When uploads + reports feel slow. |
| `.pk` domain | **PKR 2,100/year** PKNIC list price | **PKR 4,200–4,300 per 2-year term** | Billed biennially. |
| Mumbai alternative | Contabo ~ **USD 7–9 (~PKR 2,000–2,500)/mo** | Hostinger KVM 2 (watch renewal) | Card/PayPal or Hostinger.pk JazzCash. Not a PK datacenter. |
| AWS Mumbai VM + RDS | — | **PKR 15,000–30,000+/mo** | Only if the society already has an AWS account. |
| TLS certificate | **PKR 0** (Let’s Encrypt via Caddy) | — | Paid SSL is unnecessary. |
| Backups (NAS / second disk) | **PKR 0** if copied to office NAS | Cheap extra VPS **PKR 2,000–4,000/mo** | Off-box copy is the important part. |
| **Year-1 typical** | | **~PKR 90,000–130,000** | VPS + domain, excluding staff time. |

**Do not** buy shared “unlimited hosting” for this app. **Do not** put production scans on a laptop in the society office without off-site backups.

---

## Commands cheat sheet

```bash
# Production (VPS)
cd /opt/srms
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml exec app npx prisma db push

# Local test (dev server on 43127 — not for the public internet)
docker compose up --build
# http://localhost:43127
```

Env vars the app actually reads: `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL` / `AUTH_URL`, `UPLOAD_DIR`, `MEMBERSHIP_PREFIX`, `ALLOTMENT_PREFIX`, `TRANSFER_PREFIX`, `FILE_PREFIX`, optional `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN`. Compose/Caddy also use `POSTGRES_*`, `SRMS_DOMAIN`, `ACME_EMAIL`.
