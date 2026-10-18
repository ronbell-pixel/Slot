// JSON schema for the report Claude submits through the `submit_company_report` tool.
// The same shape drives the on-screen report, the PDF, and (later) batch CSV and CRM push.

import { IDENTIFICATION_FIELDS, PROFILE_FIELDS } from '../public/report-fields.js';

export { IDENTIFICATION_FIELDS, PROFILE_FIELDS };

const sourceIds = {
  type: 'array',
  items: { type: 'integer' },
  description: 'ids from the sources list that support this value',
};

const field = (description) => ({
  type: 'object',
  additionalProperties: false,
  required: ['value', 'source_ids'],
  properties: {
    value: { type: 'string', description: `${description} Empty string when not found.` },
    source_ids: sourceIds,
  },
});

const fieldsObject = (defs) => ({
  type: 'object',
  additionalProperties: false,
  required: defs.map(([key]) => key),
  properties: Object.fromEntries(defs.map(([key, , desc]) => [key, field(desc)])),
});

export const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'input_summary', 'match_status', 'candidates', 'identification', 'profile',
    'business_summary', 'people', 'licenses', 'registry_findings', 'risk_flags',
    'prospecting', 'confidence', 'confidence_rationale', 'notes', 'sources', 'registry_check',
  ],
  properties: {
    input_summary: { type: 'string', description: 'One line summarizing the search terms provided.' },
    match_status: {
      type: 'string',
      enum: ['confident_match', 'probable_match', 'multiple_candidates', 'not_found'],
    },
    candidates: {
      type: 'array',
      description: 'Other plausible entities when the match is not certain (empty when confident).',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'state', 'status', 'reason'],
        properties: {
          name: { type: 'string' },
          state: { type: 'string' },
          status: { type: 'string' },
          reason: { type: 'string', description: 'Why it is or is not the likely match.' },
        },
      },
    },
    identification: fieldsObject(IDENTIFICATION_FIELDS),
    profile: fieldsObject(PROFILE_FIELDS),
    business_summary: { type: 'string', description: '2-4 sentence summary of what the business does.' },
    people: {
      type: 'array',
      description: 'Officers, owners, or key executives listed in public sources. Business contact details only.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'title', 'business_contact', 'source_ids'],
        properties: {
          name: { type: 'string' },
          title: { type: 'string' },
          business_contact: {
            type: 'string',
            description: 'Publicly listed business email/phone only. Never personal contact details.',
          },
          source_ids: sourceIds,
        },
      },
    },
    licenses: {
      type: 'array',
      description: 'Professional or business licenses (medical, legal, real estate, contractor, financial, etc.).',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'issuer', 'number', 'status', 'expiration', 'source_ids'],
        properties: {
          type: { type: 'string' },
          issuer: { type: 'string' },
          number: { type: 'string' },
          status: { type: 'string' },
          expiration: { type: 'string' },
          source_ids: sourceIds,
        },
      },
    },
    registry_findings: { type: 'string', description: 'Summary of the Secretary of State / registry result.' },
    risk_flags: {
      type: 'array',
      description: 'Verification concerns: inactive status, recent formation, name mismatch, address is only a registered agent, lawsuits, sanctions, etc.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'flag', 'detail', 'source_ids'],
        properties: {
          severity: { type: 'string', enum: ['info', 'caution', 'warning'] },
          flag: { type: 'string' },
          detail: { type: 'string' },
          source_ids: sourceIds,
        },
      },
    },
    prospecting: {
      type: 'object',
      additionalProperties: false,
      required: ['recent_news', 'talking_points', 'social_profiles'],
      properties: {
        recent_news: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['date', 'headline', 'source_ids'],
            properties: {
              date: { type: 'string' },
              headline: { type: 'string' },
              source_ids: sourceIds,
            },
          },
        },
        talking_points: { type: 'array', items: { type: 'string' } },
        social_profiles: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['network', 'url'],
            properties: { network: { type: 'string' }, url: { type: 'string' } },
          },
        },
      },
    },
    confidence: { type: 'string', enum: ['High', 'Medium', 'Low'] },
    confidence_rationale: { type: 'string' },
    notes: { type: 'array', items: { type: 'string' }, description: 'Missing fields, conflicts, exceptions.' },
    registry_check: {
      type: 'object',
      additionalProperties: false,
      required: ['method', 'outcome', 'entity_id', 'registry_url'],
      description: 'How the Secretary of State registry was checked.',
      properties: {
        method: { type: 'string', enum: ['registry_api', 'web_search', 'not_checked'] },
        outcome: { type: 'string', enum: ['match', 'no_match', 'unavailable'] },
        entity_id: { type: 'string', description: 'The registry entity / document / file number.' },
        registry_url: { type: 'string', description: 'Official registry page for the entity.' },
      },
    },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'url', 'kind'],
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          url: { type: 'string' },
          kind: { type: 'string', enum: ['official_registry', 'government', 'company', 'third_party'] },
        },
      },
    },
  },
};

// The API caps strict schemas at 16 nullable/union fields, so "unknown" is sent as an
// empty string and turned back into null here. Empty items are dropped from string lists.
export function normalizeReport(value) {
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (Array.isArray(value)) {
    return value.map(normalizeReport).filter((v) => v !== null);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeReport(v)]));
  }
  return value;
}

// Strict tool use guarantees the shape when the model finishes normally, but the input
// can still arrive truncated (max_tokens) or malformed while eager streaming is on.
export function validateReport(report) {
  const problems = [];
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return ['report is not an object'];
  }
  for (const key of REPORT_SCHEMA.required) {
    if (!(key in report)) problems.push(`missing ${key}`);
  }
  for (const [section, defs] of [['identification', IDENTIFICATION_FIELDS], ['profile', PROFILE_FIELDS]]) {
    const obj = report[section];
    if (!obj || typeof obj !== 'object') continue;
    for (const [key] of defs) {
      const f = obj[key];
      if (!f || typeof f !== 'object' || !('value' in f)) problems.push(`missing ${section}.${key}`);
    }
  }
  if (report.sources !== undefined && !Array.isArray(report.sources)) problems.push('sources is not an array');
  if (report.confidence !== undefined && !['High', 'Medium', 'Low'].includes(report.confidence)) {
    problems.push('confidence is not High/Medium/Low');
  }
  return problems;
}
