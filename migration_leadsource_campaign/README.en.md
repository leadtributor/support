# Migrating existing leads to lead source and campaign

The **Lead Performance report** analyses your leads by **lead source** and
**campaign** — from volume and close rate to the rating given by your sales partners.
It is built on two field types that you add to your lead form via the form editor.
Your existing leads naturally don't know these fields yet: in the report they appear
collected in the **"Not specified"** row.

This guide describes how to backfill them. The first part compares the available
approaches and the technical ground rules — those apply no matter which tool you use.
The second part shows concretely how the migration runs with the framework script
`index.mjs` in this directory.

> 🇩🇪 Eine deutsche Fassung dieses Leitfadens finden Sie in
> [README.de.md](README.de.md).

## Prerequisites

1. The fields **Lead source** and **Campaign** have been added to your lead form.
   Both are select fields with fixed values — that keeps the data consistent so the
   report groups cleanly instead of stumbling over spelling variants.
2. An **API key** for the environment you migrate in. Keys are issued in the
   application under **Settings → Connectors**:
   - Live: <https://leadtributor.cloud/#/settings/connectors>
   - Demo: <https://demo.leadtributor.cloud/#/settings/connectors>

   A Live key only authenticates against the Live API, a Demo key only against the
   Demo API.
3. For the framework script, additionally: **Node.js 18 or newer**.

## Which approach fits your data?

How you deal with your existing leads depends on your lead volume and your reporting
ambitions. Keep two questions apart: **how do the values get into the leads?** That's
what the five strategies below answer. And: **where do the values come from in the
first place?** From rules you can formulate — or from the knowledge of your business
team, which you collect via a
[CSV roundtrip](#tooling-the-csv-roundtrip-with-your-business-team).

The following strategies have proven themselves — and they can be combined.

**1. Cut-off date strategy (the easiest way).** Add the fields to your form and
maintain the values consistently from a cut-off date onwards. Your existing leads stay
as they are and appear in the report under "Not specified". In parallel, switch over
your lead inflows — web forms, landing pages and integrations deliver the new fields
from now on. That way the unclassified base stops growing, whichever of the other
strategies you choose. *Tip:* pick a reporting period that starts at your cut-off date
— then you're comparing fully maintained leads only.

**2. Manual backfilling.** With a manageable number of existing leads, add source and
campaign directly on the lead page; after updating your form, the fields are available
there. If there are too many for a complete clean-up, it is often enough to backfill
open or active leads and those of the last few months. To avoid a big migration
project, your editors can add the fields whenever an existing lead is touched anyway —
your active base then completes itself step by step.

**3. Automation with Zapier or n8n.** If source or campaign can be derived from
existing data — say, a legacy free-text field, the originating system (do you use
individual API keys for different API consumers?) or campaign parameters — read your
leads via the integration, map the values by rule and write them back automatically.
The rules in
[Technical ground rules](#technical-ground-rules-migrating-via-the-public-api) apply
just as they do to your own script.

**4. Your own migration via the Public API.** For larger datasets, the framework
script in this directory is the way to go: you adapt one function to your data, review
the dry run, and then let it write. The rest of this guide describes exactly that path.

**5. Migration by the leadtributor team.** On request, we take care of migrating your
existing leads for you (subject to individual and contractual agreement). Just contact
our support — together we'll find the approach that fits your data.

### Tooling: the CSV roundtrip with your business team

The CSV roundtrip is not a strategy of its own — it is the means by which you feed
strategies 3 and 4 when the mapping **cannot** be captured in rules: export your leads
as CSV and let marketing or sales add source and campaign in Excel — that's where the
knowledge of which lead belonged to which campaign sits. Afterwards, feed the enriched
file back automatically, via your automation platform or the framework script (see
[strategy C](#strategy-c--taking-values-from-a-csv)).

A clean separation: business knowledge in Excel, technology in the script. And you can
mix — rules cover the bulk, the CSV corrects the cases that follow no rule.

### Choosing an approach

| Situation | Recommended approach |
| --- | --- |
| History is not relevant for your reporting | Cut-off date (1) |
| A few hundred leads, knowledge sits with the editors | Manual backfilling (2) |
| Mapping follows rules (field, period, source system) | Automation (3) or script (4) |
| Mapping lives in people's heads, many leads | Automation (3) or script (4), fed by a CSV roundtrip |
| Very large dataset, no developer capacity of your own | Migration by leadtributor (5) |

In short: you don't have to solve everything at once. Even with the cut-off date
strategy alone, the report delivers reliable insights about your new leads from day
one.

## Technical ground rules: migrating via the Public API

The following rules apply to **every** technical migration — whether you use the
framework script, model it in Zapier/n8n, or implement it yourself.

### Authentication and environment

The API key is sent in the `Authorization` header **without a scheme prefix** — no
`Bearer`, no `ApiKey`:

```
Authorization: <api-key>
```

Base URLs:

| Environment | Base URL |
| --- | --- |
| Live | `https://api.leadtributor.cloud` |
| Demo | `https://api.demo.leadtributor.cloud` |

The two environments are fully separated — accounts, data, and keys do not cross over.
If you have a comparable dataset in Demo, rehearse your migration there first.

### Reading leads

`GET /leads` returns the leads your company owns, in pages. Iteration works through a
**continuation token** that every response carries in the `x-continuation` response
header: append it to your next, otherwise unchanged request, and you are done once you
get an empty result.

The list response does not contain all fields of a lead. To get the field lists (and
with them the check whether lead source/campaign are already set), fetch each lead
individually via `GET /leads/{leadId}`.

### Writing values

Writing happens with `PATCH /leads/{leadId}`. Two properties are decisive:

- **Field lists are replaced as a whole.** Only the field lists present in the request
  body are modified — but a list that *is* present gets replaced entirely. So you
  always send the **complete** `interest` list of the lead (all existing fields plus
  the new values). Sending only the two new fields deletes every other `interest`
  field of that lead.
- **The new values are written as `text:singleline`.** The selectlist semantics (field
  types `text:list:leadsource` / `text:list:campaign`) live in the form definition and
  apply at display time — on the lead, every single-value list value is stored as a
  plain string. Requests declaring the list type with a single-element array are still
  accepted and stored in the same shape.

```json
{
  "interest": {
    "fields": {
      "…your existing fields…": { "type": "text:singleline", "value": "…" },
      "Lead source": { "type": "text:singleline", "value": "Website" },
      "Campaign":    { "type": "text:singleline", "value": "Spring campaign 2026" }
    }
  }
}
```

The keys in `fields` are the **field labels from your form**, not technical IDs. If
your field is called "Leadquelle", that is exactly what the request must carry.

### Idempotency and pace

Two principles make a migration repeatable and low-risk:

- **Never overwrite.** Before writing, check whether the target field already holds a
  value and skip the lead if it does. That lets you re-run as often as you like —
  after an interruption, or after refining your rules.
- **Sequentially, with a small delay.** Process leads one after another with a short
  pause instead of parallelising. That stays far below the API rate limits even for
  large datasets.

## The framework script

`index.mjs` in this directory is a **framework script**, not a finished migration
program: it brings the entire mechanics (pagination, idempotency, correctly assembling
the field list, retries, dry run) and leaves open exactly the one thing only you know
— **which lead gets which value**.

### Installation

```bash
npm install        # or: npm ci  (reproducible, uses package-lock.json)
```

The only dependency is `axios`. No database access, VPN connection, or AWS credentials
are needed — the script talks HTTPS to the Public API and nothing else.

### Configuration via environment variables

The script has **no command line parameters**. Everything runs through the
environment:

| Variable | Default | Effect |
| --- | --- | --- |
| `API_KEY` | *empty* | Your API key. Not validated — without a key the first call fails with an authentication error (`401`/`403`). |
| `DRY_RUN` | `true` | Write protection. **Only exactly `DRY_RUN=false` writes**; `0`, `no` or `FALSE` stay a dry run. |
| `LEADTRIBUTOR_URL` | `https://api.leadtributor.cloud` | Target API. For rehearsals set it to `https://api.demo.leadtributor.cloud`. |
| `CSV_FILE` | *unset* | Path to the mapping CSV; activates strategy C. |
| `OVERWRITE` | `false` | Only with `OVERWRITE=true`: replaces values that are already present — and only where the derived value actually differs. Use it to repair wrong values from an earlier run. |
| `FIELD_LIST` | `interest` | Which field list carries the target fields: `interest` (enquiry block) or `prospect` (contact block). |
| `LEADSOURCE_FIELD` / `CAMPAIGN_FIELD` | `Leadquelle` / `Kampagne` | Override the field labels from the script without editing the file. |

Note the default of `LEADTRIBUTOR_URL`: **without further configuration, the script
runs against Live.**

### Anatomy of the script

The file is deliberately split into two zones:

- **`CUSTOMIZE HERE`** — the field labels, an optional mapping table, and the
  strategies. This is the only place you work in.
- **Generic plumbing** — pagination, field list merge, retry, counters, and output.
  No changes needed there.

The target labels sit at the top and must match the fields in *your* form exactly:

```js
const LEADSOURCE_FIELD = process.env['LEADSOURCE_FIELD'] || 'Leadquelle';
const CAMPAIGN_FIELD = process.env['CAMPAIGN_FIELD'] || 'Kampagne';
const TARGET_FIELD_LIST = process.env['FIELD_LIST'] || 'interest';
```

Optionally, a mapping table normalises free-text spellings to your canonical values.
Keys are matched **case-insensitively**; unmapped values pass through unchanged:

```js
const VALUE_MAP = {
    'website': 'Website',
    'web': 'Website',
    'google': 'Google Ads',
    'messe': 'Messe',
};
```

## The three value sources in the script

Inside the script the only remaining question is **where a lead's value comes from**.
It ships three building blocks for that — called `Strategy A`, `B` and `C` in the code.
Each is a function that, for a given lead, returns either an object with `leadSource`
and/or `campaign` — or `null` if the lead should be left untouched.

### Strategy A — copy from an existing field

For the case where your form already carries the information, e.g. in a free-text
field `Quelle` (type `text:singleline`):

```js
function copyFromExistingField(lead) {
    const raw = lead.interest?.fields?.['Quelle']?.value;   // <-- your existing field
    if (!raw || typeof raw !== 'string' || raw.trim() === '') return null;
    return { leadSource: normalize(raw) };                  // or: { campaign: normalize(raw) }
}
```

Adapt the field name and the target. **Careful with select fields as the source:**
their `value` is an *array*, not a string — the `typeof` check then kicks in and
nothing happens. In that case use the bundled helper
`currentValue(lead.interest, 'Quelle')`, which reduces arrays to their first element.

### Strategy B — derive by rule

For the case where the value is not stored anywhere yet but can be inferred — e.g.
"everything created during the spring campaign belongs to it":

```js
function deriveFromCreatedAt(lead) {
    const createdAt = new Date(lead.createdAt);
    if (createdAt >= new Date('2026-03-01') && createdAt < new Date('2026-06-01')) {
        return { leadSource: 'Google Ads', campaign: 'Frühjahrsaktion 2026' };
    }
    return null;
}
```

`lead.createdAt` is an ISO timestamp; all form fields are available via
`lead.prospect.fields` and `lead.interest.fields`. So you can just as well branch on
region, product interest, or originating system.

### Strategy C — taking values from a CSV

The technical end of the
[CSV roundtrip](#tooling-the-csv-roundtrip-with-your-business-team): the file enriched
in Excel is read once at startup; per lead the script then only looks it up in the
table.

```js
const CSV_FILE = process.env['CSV_FILE'] || null;
const csvMapping = CSV_FILE ? loadCsvMapping(CSV_FILE) : null;

function mapFromCsvFile(lead) {
    return csvMapping?.get(lead.leadId) ?? null;
}
```

There is nothing to adapt in this function — you only supply the file.

### Combining value sources

`deriveValues` bundles the building blocks. Later entries win per property:

```js
function deriveValues(lead) {
    return {
        ...deriveFromCreatedAt(lead),
        ...copyFromExistingField(lead),
        ...mapFromCsvFile(lead),
    };
}
```

In this order the precedence is **CSV > existing field > rule** — a proven pattern:
rules as the baseline, the CSV as a manual correction layer on top. Building blocks you
don't need are simply removed from the list.

The return value also controls the **scope** of the migration: if you only want to
touch part of your data, return `null` (or `{}`) for everything else. That is also how
you run a **pilot** on a handful of leads — for instance by additionally restricting
to a few `leadId`s.

## The CSV format

A **semicolon-separated** file with a header row and the columns `leadId`,
`leadSource` and/or `campaign`:

```csv
leadId;leadSource;campaign
161fe19f-a23d-45cb-8895-41b0bf9f3100;Website;Frühjahrsaktion 2026
0b2f…;Messe;
```

- The **header row is required**, the column order is free. `leadId` and at least one
  of the two value columns must be present, otherwise the script aborts immediately
  with a message.
- **Empty cells are ignored** — in the example above the second lead only gets a lead
  source, its campaign stays untouched.
- Rows without a `leadId` are skipped.
- The parser is deliberately minimal and knows **no CSV quoting**: values must not
  contain a semicolon. Excel exports with a German locale ("CSV separated by
  delimiter") fit; campaign names containing semicolons need cleaning up first.

## Step by step

1. **Prepare.** Add the fields to your form, issue an API key, run `npm install`.
2. **Back up your data.** The script has **no rollback**. Take a full lead export
   first (via the application's lead export, or the `list_all_leads` example in the
   [examples repository](https://github.com/leadtributor/examples)) so you can prove
   the original values.
3. **Adapt.** In the `CUSTOMIZE HERE` block, set the field labels, choose your
   strategy or strategies and wire them up in `deriveValues`, optionally fill
   `VALUE_MAP`.
4. **Dry run, ideally against Demo.** The dry run is the default — nothing is written:

   ```bash
   API_KEY=<your-demo-api-key> LEADTRIBUTOR_URL=https://api.demo.leadtributor.cloud \
     node index.mjs
   ```

5. **Dry run against Live** — again without writing, and this time with the output
   captured. The dry run report is your only record of what is about to change:

   ```bash
   API_KEY=<your-api-key> node index.mjs | tee migration-dryrun.log
   ```

6. **Review the output.** Spot-check `WOULD update …` lines against the leads in the
   application. Does the number of hits match your expectation? Are the `skipped` and
   `failed` counts plausible?
7. **Live run.**

   ```bash
   API_KEY=<your-api-key> DRY_RUN=false node index.mjs | tee migration-live.log
   ```

8. **Verify the result.** In the Lead Performance report, pick a period that covers
   the migrated leads — the "Not specified" row must have shrunk noticeably.
9. **Iterate.** Refine your rules and run again: fields that already carry a value are
   left alone, the run only fills the gaps.

For the CSV roundtrip, add `CSV_FILE` in steps 4/5/7:

```bash
API_KEY=<your-api-key> CSV_FILE=./mapping.csv node index.mjs
```

### Repairing wrong values

Every protected value is logged:

```
KEEPING existing on lead <leadId>: leadSource 'Google Ads' kept, mapping proposed 'Google'
```

Those lines are both the proof that nothing was overwritten and a list of the places where
your mapping contradicts values that are already maintained; the closing line counts them.

If a run wrote a wrong value — say from a CSV with swapped columns — a new run cannot
undo it: the field is no longer empty and is therefore protected. That is what
`OVERWRITE=true` is for. It only replaces values that actually differ, and the output
shows the swap as `campaign='old' -> 'new'`. Dry-run it first:

```bash
API_KEY=<your-api-key> CSV_FILE=./mapping.csv OVERWRITE=true node index.mjs
```

## Reading the output

| Output | Meaning |
| --- | --- |
| `Loaded 42 mappings from ./mapping.csv` | CSV was read — a check that the file was picked up. |
| `Migrating leads on … (DRY RUN — nothing will be written)` | Dry run. With `(LIVE RUN)` the script writes. |
| `WOULD update lead <id> (created …): leadSource='…', campaign='…'` | Planned change in the dry run; `Updating lead …` in the live run. |
| `FAILED lead <id>: 403 …` | This lead was skipped, the run continues. |
| `... 100 leads processed` | Progress, every 100 leads. |
| `Done. 1234 processed, 87 would be updated, 1147 skipped …, 0 failed.` | Final tally. |

`skipped` covers two cases: your strategy produced no value **or** the target field
was already set. A high `skipped` count in the first dry run is therefore normal — it
is only a signal if you expected more hits.

The same explains a line showing only *one* of the two fields although your CSV
supplies both: the other field was already set and stays protected. Check on the lead
whether the existing value is correct — you can fix it with `OVERWRITE=true` (see
[Repairing wrong values](#repairing-wrong-values)).

Expect a pace of roughly **4–5 leads per second**: each lead costs two API calls plus
a 100 ms pause. 10,000 leads thus take a good half hour — per run, so for the dry run
as well.

## Limits and safeguards

- **No backup, no rollback.** The script cannot undo changes. Export beforehand, keep
  the dry run log.
- **The default is Live.** Without `LEADTRIBUTOR_URL` the script runs against
  production. Switch it deliberately for rehearsals.
- **No built-in limit and no filter.** The script always walks *all* leads of your
  account. Scope is restricted exclusively in `deriveValues`.
- **"Repeatable" means: from the top.** There is no stored progress. After an
  interruption the next run starts at the first lead again — harmless thanks to
  idempotency, but with the same runtime.
- **No structured log.** Output goes to stdout/stderr. If you need an audit trail,
  redirect it to a file (see `tee` above).
- **Retries only on `429` and `5xx`.** For those responses the script tries up to
  three times with a growing pause. Other errors (400, 403, 404) and dropped
  connections are not retried but counted as `FAILED`.

## Troubleshooting

| Symptom | Cause and remedy |
| --- | --- |
| Immediate abort on the first call, `401`/`403` | `API_KEY` is missing, invalid, or belongs to the other environment (Live key against the Demo API or vice versa). |
| All leads `FAILED` with `403` on `PATCH` | The key has no write permission, or the leads are not owned by your company. |
| Individual leads `FAILED` with `400` | The field label does not match the form, or more than one value was to be written. Check `LEADSOURCE_FIELD`/`CAMPAIGN_FIELD`. If the message is `Invalid request body`, the API rejected the body before it ever reached the service — inspect the payload with `LOG_PAYLOAD_ON_ERROR=true`. |
| Everything `skipped`, no `WOULD update` line | The strategy yields nothing: wrong source field name, the time window doesn't match, or the source is a select field (array) — then use `currentValue()`. |
| A field is not set although the CSV supplies a value for it | The target field is already filled and therefore protected — even if the existing value is wrong. Fix it with `OVERWRITE=true`. |
| Fewer leads processed than exist in the account | Compare the `processed` count with the total in the `X-Total` header of `GET /leads`. On a mismatch, run again — thanks to idempotency it fills the remaining gaps. |
| `expected a header row with 'leadId' …` | The CSV has no header row, different column names, or a delimiter other than `;`. |
| Values end up truncated in the fields | Semicolon inside a CSV value. The parser knows no quoting — clean the values up. |
| The numbers in the report don't change | Wrong reporting period: the report groups by the lead's **creation date**, not by when it was migrated. |

## Help

You're not alone with this: on request, the leadtributor team takes care of migrating
your existing leads (subject to individual and contractual agreement). Just contact
our support — together we'll find the approach that fits your data.
