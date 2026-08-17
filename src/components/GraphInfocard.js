import React, { useMemo, useState } from 'react';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Box,
  Chip,
  Collapse,
  Link,
  Typography,
} from '@mui/material';

import graphViewerSchema from '../schema/graph_viewer_schema.json';
import { formatInfocardValue, getInfocardHref } from './graphViewerInfocardValue';

const EMPTY_PROFILE = Object.freeze({});
const EMPTY_ROWS = Object.freeze([]);
const SAFE_PATH = /^[A-Za-z_][A-Za-z0-9_]*(?:(?:\.[A-Za-z_][A-Za-z0-9_]*)|(?:\[[0-9]+\]))*$/;

export const hasInfocardValue = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
};

export const isValidInfocardPath = (path) => typeof path === 'string'
  && SAFE_PATH.test(path)
  && !/(?:^|\.)(?:__proto__|prototype|constructor)(?:\.|$)/.test(path);

export const getInfocardPathValue = (record, path) => {
  if (!isValidInfocardPath(path)) return undefined;
  const parts = path.replace(/\[([0-9]+)\]/g, '.$1').split('.');
  return parts.reduce((value, part) => (value == null ? undefined : value[part]), record);
};

export const firstInfocardValue = (record, paths = []) => {
  const candidates = Array.isArray(paths) ? paths : [paths];
  for (const path of candidates) {
    const value = getInfocardPathValue(record, path);
    if (hasInfocardValue(value)) return { path, value };
  }
  return { path: null, value: undefined };
};

const normaliseLegacyRows = (content) => {
  if (!Array.isArray(content)) return [];
  return content
    .filter((row) => Array.isArray(row) && row.length >= 2)
    .map(([label, path, format]) => ({ label, paths: [path], format }));
};

export const adaptLegacyInfoPanel = (panel) => {
  if (!Array.isArray(panel)) return null;
  const title = panel.find(([label]) => label === 'Title');
  const footer = panel.find(([label]) => label === 'Footer');
  const body = panel.filter(([label]) => !['Title', 'Footer'].includes(label));
  const annotationSection = body.find(([label, content]) => (
    !Array.isArray(content) && /description|annotation|interpretation|biological role/i.test(label)
  ));
  const evidenceSection = body.find(([label]) => /evidence/i.test(label));
  const details = body
    .filter((section) => section !== annotationSection && section !== evidenceSection)
    .map(([titleLabel, content, format]) => ({
      title: titleLabel,
      rows: Array.isArray(content)
        ? normaliseLegacyRows(content)
        : [{ label: titleLabel, paths: [content], format }],
    }));
  return {
    schema_version: '2.0',
    title: { paths: [title?.[1] || 'name', 'name', 'id'] },
    annotation: annotationSection
      ? { label: 'What this means', paths: [annotationSection[1]], format: annotationSection[2] }
      : { label: 'What this means', paths: ['nih_summary', 'description', 'biological_role', 'rationale', 'causal_status', 'evidence_scope'] },
    evidence: evidenceSection ? normaliseLegacyRows(evidenceSection[1]) : EMPTY_ROWS,
    key_statistics: EMPTY_ROWS,
    provenance: footer ? normaliseLegacyRows(footer[1]) : EMPTY_ROWS,
    detail_sections: details,
  };
};

const configuredProfile = (kind, name) => graphViewerSchema.info_panel_v2?.[`${kind}_profiles`]?.[name];

export const resolveInfocardProfile = ({ kind, type, data, overrides = {} }) => {
  const runtime = overrides?.[kind]?.[type];
  if (runtime && !Array.isArray(runtime) && runtime.schema_version) return runtime;
  if (Array.isArray(runtime)) return adaptLegacyInfoPanel(runtime);

  const v2 = graphViewerSchema.info_panel_v2 || {};
  const exactName = v2?.[`${kind}_profile_by_type`]?.[type];
  if (exactName && configuredProfile(kind, exactName)) return configuredProfile(kind, exactName);

  const family = data?.semantic_family;
  const familyName = family && v2?.[`${kind}_profile_by_semantic_family`]?.[family];
  if (familyName && configuredProfile(kind, familyName)) return configuredProfile(kind, familyName);

  const legacyCollection = kind === 'edge' ? graphViewerSchema.edges : graphViewerSchema.nodes;
  if (Array.isArray(legacyCollection?.[type]?.info_panel)) {
    return adaptLegacyInfoPanel(legacyCollection[type].info_panel);
  }
  const legacyMapping = kind === 'edge'
    ? graphViewerSchema.edge_panel_by_type
    : graphViewerSchema.node_panel_by_label;
  const legacyProfiles = kind === 'edge' ? graphViewerSchema.edge_panels : graphViewerSchema.node_panels;
  const legacyName = legacyMapping?.[type];
  if (legacyName && Array.isArray(legacyProfiles?.[legacyName])) {
    return adaptLegacyInfoPanel(legacyProfiles[legacyName]);
  }

  const defaultName = v2?.[`default_${kind}_profile`];
  return configuredProfile(kind, defaultName) || EMPTY_PROFILE;
};

const resolveRows = (record, rows = [], limit = Infinity) => rows
  .map((definition) => {
    const resolved = firstInfocardValue(record, definition.paths || definition.path);
    return hasInfocardValue(resolved.value)
      ? { ...definition, path: resolved.path, value: resolved.value }
      : null;
  })
  .filter(Boolean)
  .slice(0, limit);

const evidenceBadge = (data) => {
  if (data?.generated === true) {
    return { label: 'Generated fallback — not evidence', tone: 'warning' };
  }
  if (data?.not_evidence === true) return { label: 'Context only — not evidence', tone: 'warning' };
  const human = data?.human_evidence_only === true
    || /human|homo sapiens/i.test(String(data?.species_scope || data?.evidence_species || data?.species || data?.organism || ''));
  if (human) return { label: 'Human evidence', tone: 'human' };
  if (/mouse|NOD/i.test(String(data?.model_support_scope || data?.species_scope || data?.evidence_species || ''))) {
    return { label: 'Model-supported', tone: 'model' };
  }
  return { label: 'Curated annotation', tone: 'curated' };
};

const collectSupportingSourceCount = (record) => {
  const records = record?.supporting_expression_records;
  if (!Array.isArray(records)) return 0;
  const identities = new Set(records.map((entry) => [
    entry?.data_source,
    entry?.data_version,
    entry?.source_record_id,
  ].filter(Boolean).join('|')).filter(Boolean));
  return Math.max(0, identities.size - 1);
};

export const buildInfocardModel = ({ data = {}, kind, type, overrides = {} }) => {
  const profile = resolveInfocardProfile({ kind, type, data, overrides });
  const title = firstInfocardValue(data, profile.title?.paths || ['name', 'id']).value || type || 'Graph record';
  const annotation = firstInfocardValue(data, profile.annotation?.paths || [
    'nih_summary', 'description', 'biological_role', 'rationale', 'causal_status', 'evidence_scope',
  ]);
  const limitation = firstInfocardValue(data, ['evidence_limitation']);
  const evidence = resolveRows(data, profile.evidence);
  const keyStatistics = resolveRows(data, profile.key_statistics, 2);
  const provenance = resolveRows(data, profile.provenance);
  const detailSections = (profile.detail_sections || []).map((section) => ({
    ...section,
    rows: resolveRows(data, section.rows),
  })).filter((section) => section.rows.length > 0);
  const additionalSources = collectSupportingSourceCount(data);

  return {
    schema_version: '2.0',
    title: String(title).replace(/_/g, ' '),
    semantic_type: type || data?.type || (kind === 'edge' ? 'Relationship' : 'Entity'),
    badges: [evidenceBadge(data)],
    annotation: hasInfocardValue(annotation.value)
      ? { label: profile.annotation?.label || 'What this means', value: annotation.value, path: annotation.path }
      : null,
    evidence,
    key_statistics: keyStatistics,
    provenance,
    detail_sections: detailSections,
    evidence_limitation: hasInfocardValue(limitation.value) ? limitation.value : null,
    additional_source_count: additionalSources,
  };
};

const formatNumber = (value, digits = 2) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : formatInfocardValue(value);
};

export const formatNihInfocardValue = (value, format) => {
  if (!hasInfocardValue(value)) return '—';
  if (format === 'scientific') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toExponential(2) : formatInfocardValue(value);
  }
  if (format === 'signed_decimal') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? `${parsed > 0 ? '+' : ''}${parsed.toFixed(2)}` : formatInfocardValue(value);
  }
  if (format === 'decimal') return formatNumber(value, 2);
  if (format === 'percentage') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? `${parsed.toFixed(1)}%` : formatInfocardValue(value);
  }
  if (format === 'count') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed).toLocaleString() : formatInfocardValue(value);
  }
  if (format === 'identifier') return String(value);
  if (format === 'list') return Array.isArray(value) ? value.map(String).join('; ') : formatInfocardValue(value);
  return formatInfocardValue(value);
};

const readableLabel = (key) => String(key || '')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase());

const StructuredValue = ({ value }) => {
  if (Array.isArray(value)) {
    return (
      <Box component="ul" sx={{ margin: 0, paddingLeft: '18px' }}>
        {value.map((item, index) => (
          <Box component="li" key={index} sx={{ marginBottom: '5px' }}>
            <StructuredValue value={item} />
          </Box>
        ))}
      </Box>
    );
  }
  if (value && typeof value === 'object') {
    return (
      <Box sx={{ display: 'grid', gap: '6px' }}>
        {Object.entries(value).map(([key, nested]) => (
          <Box key={key} sx={{ display: 'grid', gridTemplateColumns: 'minmax(100px, .8fr) minmax(0, 1.2fr)', gap: '8px' }}>
            <Typography sx={{ color: '#667780', fontSize: '12px', lineHeight: '16px', fontWeight: 600 }}>
              {readableLabel(key)}
            </Typography>
            <Box sx={{ color: '#263238', fontSize: '12px', lineHeight: '16px', overflowWrap: 'anywhere' }}>
              <StructuredValue value={nested} />
            </Box>
          </Box>
        ))}
      </Box>
    );
  }
  return <>{formatInfocardValue(value)}</>;
};

const Value = ({ row }) => {
  const href = ['link', 'doi', 'pubmed'].includes(row.format)
    ? getInfocardHref(row.value, row.format)
    : null;
  if (href) {
    return (
      <Link href={href} target="_blank" rel="noopener noreferrer" sx={{ color: '#225E78', fontWeight: 700, overflowWrap: 'anywhere' }}>
        Open source ↗
      </Link>
    );
  }
  if (row.value && typeof row.value === 'object') return <StructuredValue value={row.value} />;
  return <>{formatNihInfocardValue(row.value, row.format)}</>;
};

const SectionTitle = ({ children }) => (
  <Typography sx={{ color: '#53656D', fontSize: '11px', lineHeight: '14px', fontWeight: 800, letterSpacing: '.055em', textTransform: 'uppercase' }}>
    {children}
  </Typography>
);

const Row = ({ row }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(118px, .82fr) minmax(0, 1.18fr)', gap: '10px', alignItems: 'start' }}>
    <Typography sx={{ color: '#667780', fontSize: '13px', lineHeight: '18px', fontWeight: 600 }}>
      {row.label}
    </Typography>
    <Typography component="div" sx={{ color: '#263238', fontSize: '13px', lineHeight: '18px', fontWeight: 600, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
      <Value row={row} />
    </Typography>
  </Box>
);

const badgeColors = {
  human: { background: '#DDF0E8', color: '#245C48' },
  model: { background: '#E6E4F4', color: '#504B7B' },
  curated: { background: '#E5EEF2', color: '#365964' },
  warning: { background: '#FFF0C2', color: '#6C4D00' },
};

export const GraphInfocard = ({ hoveredData, infoPanelOverrides = {}, theme = {} }) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isEdge = Boolean(hoveredData?.source && hoveredData?.target);
  const kind = isEdge ? 'edge' : 'node';
  const type = hoveredData?.type || (isEdge ? hoveredData?.relation : undefined);
  const model = useMemo(() => buildInfocardModel({
    data: hoveredData || {}, kind, type, overrides: infoPanelOverrides,
  }), [hoveredData, infoPanelOverrides, kind, type]);

  if (!hoveredData) return null;
  const hasDetails = model.detail_sections.length > 0;
  const colors = {
    surface: theme.surface || '#FFFFFF',
    softSurface: theme.softSurface || '#E6F0F1',
    border: theme.border || '#D5E2E4',
    ink: theme.ink || '#263238',
    mutedInk: theme.mutedInk || '#53656D',
    link: theme.link || '#225E78',
    accentFill: theme.accentFill || theme.softSurface || '#E6F0F1',
    accentBorder: theme.accentBorder || theme.border || '#D5E2E4',
    accentText: theme.accentText || theme.ink || '#263238',
  };

  return (
    <Box data-testid="nih-infocard" sx={{ width: '100%', background: colors.surface, color: colors.ink }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 2, padding: '18px 20px 15px', background: colors.softSurface, borderBottom: `1px solid ${colors.border}`, borderLeft: `6px solid ${colors.accentBorder}` }}>
        <Typography sx={{ fontFamily: 'Open Sans', fontWeight: 800, fontSize: '20px', lineHeight: '24px', textAlign: 'left', overflowWrap: 'anywhere' }}>
          {model.title}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
          <Chip size="small" label={model.semantic_type} sx={{ height: '24px', fontSize: '11px', fontWeight: 700, background: colors.accentFill, color: colors.accentText, border: `1px solid ${colors.accentBorder}` }} />
          {model.badges.map((badge) => (
            <Chip key={badge.label} size="small" label={badge.label} sx={{ height: '24px', fontSize: '11px', fontWeight: 700, ...(badgeColors[badge.tone] || badgeColors.curated) }} />
          ))}
        </Box>
      </Box>

      {model.annotation && (
        <Box sx={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}` }}>
          <SectionTitle>{model.annotation.label}</SectionTitle>
          <Typography component="div" sx={{ marginTop: '8px', fontSize: '14px', lineHeight: '20px', color: colors.ink }}>
            <StructuredValue value={model.annotation.value} />
          </Typography>
        </Box>
      )}

      {model.evidence_limitation && (
        <Box sx={{ padding: '14px 20px', background: '#FFF5D8', borderBottom: '1px solid #E8C870' }}>
          <SectionTitle>Evidence limitation</SectionTitle>
          <Typography sx={{ marginTop: '7px', fontSize: '13px', lineHeight: '18px', color: '#4E3908' }}>
            {formatInfocardValue(model.evidence_limitation)}
          </Typography>
        </Box>
      )}

      {model.evidence.length > 0 && (
        <Box sx={{ display: 'grid', gap: '10px', padding: '16px 20px', borderBottom: `1px solid ${colors.border}` }}>
          <SectionTitle>Evidence</SectionTitle>
          {model.evidence.map((row) => <Row key={`${row.label}-${row.path}`} row={row} />)}
        </Box>
      )}

      {model.key_statistics.length > 0 && (
        <Box sx={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}` }}>
          <SectionTitle>Key statistics</SectionTitle>
          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${model.key_statistics.length}, minmax(0, 1fr))`, gap: '10px', marginTop: '10px' }}>
            {model.key_statistics.map((row) => (
              <Box key={`${row.label}-${row.path}`} sx={{ padding: '10px', borderRadius: '8px', background: colors.softSurface, border: `1px solid ${colors.border}` }}>
                <Typography sx={{ color: '#667780', fontSize: '11px', lineHeight: '14px', fontWeight: 700 }}>{row.label}</Typography>
                <Typography sx={{ marginTop: '4px', color: '#1F3B40', fontSize: '17px', lineHeight: '20px', fontWeight: 800 }}><Value row={row} /></Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {model.provenance.length > 0 && (
        <Box sx={{ display: 'grid', gap: '10px', padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, background: colors.softSurface }}>
          <SectionTitle>Provenance</SectionTitle>
          {model.provenance.map((row) => <Row key={`${row.label}-${row.path}`} row={row} />)}
          {model.additional_source_count > 0 && (
            <Typography sx={{ color: '#53656D', fontSize: '12px', lineHeight: '16px', fontWeight: 700 }}>
              +{model.additional_source_count} supporting source{model.additional_source_count === 1 ? '' : 's'}
            </Typography>
          )}
        </Box>
      )}

      {hasDetails && (
        <Box>
          <Box
            component="button"
            type="button"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
            sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', border: 0, background: colors.surface, color: colors.ink, cursor: 'pointer', fontFamily: 'Open Sans', fontSize: '13px', fontWeight: 800, textAlign: 'left', '&:focus-visible': { outline: `3px solid ${colors.accentBorder}`, outlineOffset: '-3px' } }}
          >
            More details
            <ExpandMoreIcon sx={{ transform: detailsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </Box>
          <Collapse in={detailsOpen}>
            <Box sx={{ display: 'grid', gap: '16px', padding: '4px 20px 18px' }}>
              {model.detail_sections.map((section) => (
                <Box key={section.title} sx={{ display: 'grid', gap: '9px' }}>
                  <SectionTitle>{section.title}</SectionTitle>
                  {section.rows.map((row) => <Row key={`${row.label}-${row.path}`} row={row} />)}
                </Box>
              ))}
            </Box>
          </Collapse>
        </Box>
      )}
    </Box>
  );
};

export default GraphInfocard;
