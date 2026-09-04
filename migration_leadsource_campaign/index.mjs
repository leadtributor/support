import axios from 'axios';
import { readFileSync } from 'node:fs';

/**
 * Framework script: migrate existing leads to the new "Leadquelle" (lead source)
 * and "Kampagne" (campaign) form fields.
 *
 * The script iterates over all leads of your account, derives the desired
 * values per lead (see the CUSTOMIZE section below), and writes them via the
 * leadtributor Public API. It is:
 *
 *  - DRY-RUN FIRST: with DRY_RUN=true (the default) nothing is written; the
 *    script only prints what it *would* change. Review the output, then re-run
 *    with DRY_RUN=false.
 *  - IDEMPOTENT: leads that already carry a value in the target fields are
 *    skipped, so the script can be re-run or resumed safely at any time. Set
 *    OVERWRITE=true to replace existing values instead (see below).
 *  - GENTLE: leads are processed sequentially with a small delay to stay far
 *    below the API rate limits.
 */

const LEADTRIBUTOR_URL = process.env['LEADTRIBUTOR_URL'] || 'https://api.leadtributor.cloud';
const API_KEY = process.env['API_KEY'] || '';
const DRY_RUN = process.env['DRY_RUN'] !== 'false';
// Off by default: values already present in the target fields are never touched.
// With OVERWRITE=true a derived value replaces an existing one — use this to repair
// wrong values from an earlier run, and always dry-run it first.
const OVERWRITE = process.env['OVERWRITE'] === 'true';

// ===========================================================================
// CUSTOMIZE HERE — everything below this block is generic plumbing.
// ===========================================================================

// The labels of the target fields, exactly as they appear in YOUR lead form, and
// which of the two field lists carries them — 'prospect' (the contact block) or
// 'interest' (the enquiry block). Each can also be set via an environment variable,
// so a one-off run does not have to edit this file.
const LEADSOURCE_FIELD = process.env['LEADSOURCE_FIELD'] || 'Leadquelle';
const CAMPAIGN_FIELD = process.env['CAMPAIGN_FIELD'] || 'Kampagne';
const TARGET_FIELD_LIST = process.env['FIELD_LIST'] || 'interest';

if (TARGET_FIELD_LIST !== 'prospect' && TARGET_FIELD_LIST !== 'interest') {
    throw new Error(`FIELD_LIST must be 'prospect' or 'interest', got '${TARGET_FIELD_LIST}'`);
}

// Optional: normalize free-text spellings to your canonical values.
// Keys are matched case-insensitively; unmapped values pass through unchanged.
const VALUE_MAP = {
    'website': 'Website',
    'web': 'Website',
    'google': 'Google Ads',
    'messe': 'Messe',
};

/**
 * Strategy A — copy from an existing field ("copy field A to new field B").
 *
 * Use this when your form already carries the information in a plain text
 * field (type 'text:singleline') and you want to move it into the new typed
 * fields. Adapt the field name and the target below.
 */
function copyFromExistingField(lead) {
    const raw = lead.interest?.fields?.['Quelle']?.value;   // <-- your existing field
    if (!raw || typeof raw !== 'string' || raw.trim() === '') return null;
    return { leadSource: normalize(raw) };                  // or: { campaign: normalize(raw) }
}

/**
 * Strategy B — derive from one or more fields, e.g. the creation date.
 *
 * Use this when the value is not stored anywhere yet but can be inferred,
 * e.g. "everything created during the spring campaign belongs to it".
 * `lead.createdAt` is an ISO timestamp; all form fields are available via
 * `lead.prospect.fields` and `lead.interest.fields`.
 */
function deriveFromCreatedAt(lead) {
    const createdAt = new Date(lead.createdAt);
    if (createdAt >= new Date('2026-03-01') && createdAt < new Date('2026-06-01')) {
        return { leadSource: 'Google Ads', campaign: 'Frühjahrsaktion 2026' };
    }
    return null;
}

/**
 * Strategy C — bulk enrichment via CSV ("export → enrich in Excel → write back").
 *
 * Use this when the mapping lives in people's heads rather than in rules:
 * export your leads, let marketing/sales fill in the values in Excel, save as
 * a semicolon-separated CSV with the columns
 *
 *     leadId;leadSource;campaign
 *
 * (header row required, empty cells are ignored) and pass the file via the
 * CSV_FILE environment variable, e.g. CSV_FILE=./mapping.csv.
 */
const CSV_FILE = process.env['CSV_FILE'] || null;
const csvMapping = CSV_FILE ? loadCsvMapping(CSV_FILE) : null;

function mapFromCsvFile(lead) {
    return csvMapping?.get(lead.leadId) ?? null;
}

/**
 * Pick your strategy (or combine several — later entries win per property).
 * Return null (or omit a property) to leave the lead untouched.
 */
function deriveValues(lead) {
    return {
        ...deriveFromCreatedAt(lead),
        ...copyFromExistingField(lead),
        ...mapFromCsvFile(lead),
    };
}

// ===========================================================================
// Generic plumbing — no changes needed below.
// ===========================================================================

function normalize(value) {
    const trimmed = value.trim();
    return VALUE_MAP[trimmed.toLowerCase()] ?? trimmed;
}

/** Read a 'leadId;leadSource;campaign' CSV into a Map(leadId -> values). */
function loadCsvMapping(file) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/).filter((line) => line.trim() !== '');
    const header = lines.shift().split(';').map((column) => column.trim());
    const leadIdIdx = header.indexOf('leadId');
    const leadSourceIdx = header.indexOf('leadSource');
    const campaignIdx = header.indexOf('campaign');
    if (leadIdIdx < 0 || (leadSourceIdx < 0 && campaignIdx < 0)) {
        throw new Error(`${file}: expected a header row with 'leadId' and at least one of 'leadSource'/'campaign'`);
    }
    const mapping = new Map();
    for (const line of lines) {
        const cells = line.split(';').map((cell) => cell.trim());
        const leadId = cells[leadIdIdx];
        if (!leadId) continue;
        const values = {};
        if (leadSourceIdx >= 0 && cells[leadSourceIdx]) values.leadSource = cells[leadSourceIdx];
        if (campaignIdx >= 0 && cells[campaignIdx]) values.campaign = cells[campaignIdx];
        if (Object.keys(values).length > 0) mapping.set(leadId, values);
    }
    console.log(`Loaded ${mapping.size} mappings from ${file}`);
    return mapping;
}

const http = axios.create({
    baseURL: LEADTRIBUTOR_URL,
    headers: { Authorization: API_KEY },
});

/** Iterate through all leads using the continuation mechanism. */
async function* listLeads() {
    let continuation = null;
    do {
        const response = await http.get('/leads', { params: { continuation } });
        continuation = response.headers['x-continuation'];
        for (const entry of response.data) yield entry.lead;
    } while (continuation);
}

function currentValue(fieldList, fieldName) {
    const value = fieldList?.fields?.[fieldName]?.value;
    return Array.isArray(value) ? value[0] : value;
}

/**
 * Merge the derived values into the lead's target field list.
 *
 * The Public API modifies a field list AS A WHOLE, so the returned object is
 * the complete list from the lead plus the new/updated fields — never just the
 * two fields alone (that would drop all other fields of that list).
 */
function buildUpdatedFieldList(fieldList, { leadSource, campaign }) {
    const fields = { ...(fieldList?.fields ?? {}) };
    const fieldOrder = [...(fieldList?.fieldOrder ?? [])];

    // Single-value lists persist as text:singleline on the lead — the selectlist rendering
    // comes from the form definition at display time, and the Lead-Performance report
    // resolves the semantics through the form. Writing the subtype here would only be
    // flattened to this shape by the API anyway.
    const upsert = (name, value) => {
        fields[name] = { type: 'text:singleline', value };
        if (fieldOrder.length > 0 && !fieldOrder.includes(name)) fieldOrder.push(name);
    };

    if (leadSource) upsert(LEADSOURCE_FIELD, leadSource);
    if (campaign) upsert(CAMPAIGN_FIELD, campaign);

    return { ...fieldList, fields, ...(fieldOrder.length > 0 && { fieldOrder }) };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry(fn) {
    for (let attempt = 1; ; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const status = error.response?.status;
            if (attempt < 3 && (status === 429 || status >= 500)) {
                await sleep(2000 * attempt);
                continue;
            }
            throw error;
        }
    }
}

let processed = 0, updated = 0, skipped = 0, failed = 0, protectedLeads = 0, alreadyCorrect = 0;

console.log(`Migrating leads on ${LEADTRIBUTOR_URL} ${DRY_RUN ? '(DRY RUN — nothing will be written)' : '(LIVE RUN)'}${OVERWRITE ? ' (OVERWRITE — existing values will be replaced)' : ''}`);

for await (const { leadId, createdAt } of listLeads()) {
    processed++;
    try {
        const { data: details } = await withRetry(() => http.get(`/leads/${leadId}`));
        const lead = { leadId, createdAt, ...details };

        const derived = deriveValues(lead) ?? {};
        // Idempotency: values already present are kept. With OVERWRITE they are replaced,
        // but only where the derived value actually differs — no pointless updates.
        const present = {
            leadSource: currentValue(lead[TARGET_FIELD_LIST], LEADSOURCE_FIELD),
            campaign: currentValue(lead[TARGET_FIELD_LIST], CAMPAIGN_FIELD),
        };
        const kept = [];
        for (const key of ['leadSource', 'campaign']) {
            if (!present[key]) continue;
            if (OVERWRITE && present[key] !== derived[key]) continue;   // will be replaced below
            if (derived[key] !== undefined && derived[key] !== present[key]) {
                kept.push(`${key} '${present[key]}' kept, mapping proposed '${derived[key]}'`);
            } else if (derived[key] !== undefined) {
                alreadyCorrect++;
            }
            delete derived[key];
        }
        // The audit trail for "existing values must not be overwritten": every case where a
        // mapping value was dropped in favour of what the lead already carries is named, so
        // the run can be shown to have kept them — and so contradictions in the mapping surface.
        if (kept.length > 0) {
            protectedLeads++;
            console.log(`KEEPING existing on lead ${leadId}: ${kept.join('; ')}`);
        }

        if (!derived.leadSource && !derived.campaign) {
            skipped++;
        } else {
            const changes = Object.entries(derived)
                .map(([k, v]) => `${k}=${present[k] ? `'${present[k]}' -> ` : ''}'${v}'`)
                .join(', ');
            console.log(`${DRY_RUN ? 'WOULD update' : 'Updating'} lead ${leadId} (created ${createdAt}): ${changes}`);
            if (!DRY_RUN) {
                const fieldList = buildUpdatedFieldList(lead[TARGET_FIELD_LIST], derived);
                await withRetry(() => http.patch(`/leads/${leadId}`, { [TARGET_FIELD_LIST]: fieldList }));
            }
            updated++;
        }
    } catch (error) {
        failed++;
        console.error(`FAILED lead ${leadId}: ${error.response?.status ?? ''} ${error.message}`);
    }

    if (processed % 100 === 0) console.log(`... ${processed} leads processed`);
    await sleep(100);
}

console.log(`Done. ${processed} processed, ${updated} ${DRY_RUN ? 'would be updated' : 'updated'}, ${skipped} skipped (no value derived or already set), ${failed} failed.`);
console.log(`Of those: ${protectedLeads} lead(s) kept an existing value that differs from the mapping (see the KEEPING lines above), ${alreadyCorrect} field(s) already carried the mapped value.`);
