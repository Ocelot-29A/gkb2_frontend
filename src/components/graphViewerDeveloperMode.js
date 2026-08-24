import graphViewerSchema from '../schema/graph_viewer_schema.json';

export const PROTECTED_NODE_PATHS = [
  '~id', '~properties.id', '~properties.canonical_id', '~properties.display_instance_id',
  '~properties.source_file', '~properties.source_record_id', '~properties.data_source_url',
];

export const PROTECTED_EDGE_PATHS = [
  '~id', '~start', '~end', '~properties.id', '~properties.canonical_id',
  '~properties.canonical_source_id', '~properties.canonical_target_id',
  '~properties.source_file', '~properties.source_record_id', '~properties.data_source_url',
];

const valueAt = (value, path) => path.split('.').reduce(
  (current, part) => (current == null ? undefined : current[part]),
  value,
);

export const validateRawGraphRecord = (original, edited) => {
  const errors = [];
  if (!edited || typeof edited !== 'object' || Array.isArray(edited)) {
    return ['Record must be a JSON object.'];
  }
  const isEdge = original?.['~entityType'] === 'relationship' || original?.['~start'] !== undefined;
  const protectedPaths = isEdge ? PROTECTED_EDGE_PATHS : PROTECTED_NODE_PATHS;
  protectedPaths.forEach((path) => {
    if (JSON.stringify(valueAt(original, path)) !== JSON.stringify(valueAt(edited, path))) {
      errors.push(`${path} is protected and cannot be changed.`);
    }
  });
  if (isEdge) {
    if (!edited['~type'] || !graphViewerSchema.edges?.[edited['~type']]) {
      errors.push('~type must be a relationship type declared by the graph viewer schema.');
    }
  } else {
    if (!Array.isArray(edited['~labels']) || edited['~labels'].length === 0) {
      errors.push('~labels must contain at least one node label.');
    } else {
      const known = edited['~labels'].some((label) => graphViewerSchema.nodes?.[label]);
      if (!known) errors.push('~labels must include a node label declared by the graph viewer schema.');
    }
  }
  if (!edited['~properties'] || typeof edited['~properties'] !== 'object' || Array.isArray(edited['~properties'])) {
    errors.push('~properties must be a JSON object.');
  }
  return errors;
};

const ALLOWED_FORMATS = new Set([
  undefined, 'string', 'list', 'int', 'link',
  'float', 'float(1)', 'float(2)', 'float(3)',
  'scientific', 'signed_decimal', 'decimal', 'percentage', 'count', 'identifier',
  'doi', 'pubmed',
]);

const validFormat = (format) => ALLOWED_FORMATS.has(format)
  || (typeof format === 'string' && /^label_chr\(#[0-9a-fA-F]{6}\)$/.test(format));

export const validateInfoPanel = (panel) => {
  const errors = [];
  if (panel && typeof panel === 'object' && !Array.isArray(panel)) {
    if (!String(panel.schema_version || '').startsWith('2.')) {
      errors.push('V2 info panel schema_version must begin with 2.');
    }
    if (!Array.isArray(panel.title?.paths) || panel.title.paths.length === 0) {
      errors.push('V2 info panel title.paths must contain at least one property path.');
    }
    if ((panel.key_statistics || []).length > 2) {
      errors.push('V2 info panel may declare at most two key statistics.');
    }
    const pathPattern = /^[A-Za-z_][A-Za-z0-9_]*(?:(?:\.[A-Za-z_][A-Za-z0-9_]*)|(?:\[[0-9]+\]))*$/;
    const unsafePathSegment = /(?:^|\.)(?:__proto__|prototype|constructor)(?:\.|$)/;
    const validateDefinition = (definition, location) => {
      const paths = definition?.paths || (definition?.path ? [definition.path] : []);
      if (!Array.isArray(paths) || paths.length === 0) errors.push(`${location} must declare paths.`);
      paths.forEach((path) => {
        if (typeof path !== 'string' || !pathPattern.test(path) || unsafePathSegment.test(path)) {
          errors.push(`${location} has invalid property path ${path}.`);
        }
      });
      if (!validFormat(definition?.format)) errors.push(`${location} uses unsupported format ${definition?.format}.`);
    };
    validateDefinition(panel.title || {}, 'Title');
    if (panel.annotation) validateDefinition(panel.annotation, 'Annotation');
    ['evidence', 'key_statistics', 'provenance'].forEach((key) => {
      if (panel[key] !== undefined && !Array.isArray(panel[key])) errors.push(`${key} must be an array.`);
      (panel[key] || []).forEach((definition, index) => validateDefinition(definition, `${key} row ${index + 1}`));
    });
    if (panel.detail_sections !== undefined && !Array.isArray(panel.detail_sections)) {
      errors.push('detail_sections must be an array.');
    }
    (panel.detail_sections || []).forEach((section, sectionIndex) => {
      if (!section?.title || !Array.isArray(section?.rows)) errors.push(`Detail section ${sectionIndex + 1} requires title and rows.`);
      (section?.rows || []).forEach((definition, rowIndex) => validateDefinition(definition, `Detail section ${sectionIndex + 1} row ${rowIndex + 1}`));
    });
    return errors;
  }
  if (!Array.isArray(panel)) return ['Info panel must be a JSON array or V2 object.'];
  const titles = panel.filter((entry) => Array.isArray(entry) && entry[0] === 'Title');
  const footers = panel.filter((entry) => Array.isArray(entry) && entry[0] === 'Footer');
  if (titles.length !== 1) errors.push('Info panel must contain exactly one Title section.');
  if (footers.length > 1) errors.push('Info panel may contain at most one Footer section.');
  const seen = new Set();
  panel.forEach((entry, sectionIndex) => {
    if (!Array.isArray(entry) || entry.length < 2 || entry.length > 3 || typeof entry[0] !== 'string') {
      errors.push(`Section ${sectionIndex + 1} must be [title, content, optionalFormat].`);
      return;
    }
    if (seen.has(entry[0])) errors.push(`Section title ${entry[0]} is duplicated.`);
    seen.add(entry[0]);
    const content = entry[1];
    if (Array.isArray(content)) {
      content.forEach((row, rowIndex) => {
        if (!Array.isArray(row) || row.length < 2 || row.length > 3
          || typeof row[0] !== 'string' || typeof row[1] !== 'string') {
          errors.push(`${entry[0]} row ${rowIndex + 1} must be [label, property, optionalFormat].`);
        } else if (!validFormat(row[2])) {
          errors.push(`${entry[0]} row ${rowIndex + 1} uses unsupported format ${row[2]}.`);
        }
      });
    } else if (typeof content !== 'string') {
      errors.push(`${entry[0]} content must be a property name or row array.`);
    }
    if (!validFormat(entry[2])) errors.push(`${entry[0]} uses unsupported format ${entry[2]}.`);
  });
  return errors;
};

export const resolveInfoPanelDefinition = (kind, type, overrides = {}) => {
  const collection = kind === 'edge' ? graphViewerSchema.edges : graphViewerSchema.nodes;
  const override = overrides?.[kind]?.[type];
  if (Array.isArray(override) || (override && typeof override === 'object')) return { panel: override, source: 'type override', profile: null, relatedTypes: [] };
  const v2 = graphViewerSchema.info_panel_v2 || {};
  const v2Mapping = v2[`${kind}_profile_by_type`] || {};
  const v2Profiles = v2[`${kind}_profiles`] || {};
  const v2Profile = v2Mapping[type];
  if (v2Profile && v2Profiles[v2Profile]) {
    return {
      panel: v2Profiles[v2Profile],
      source: 'V2 shared profile',
      profile: v2Profile,
      relatedTypes: Object.entries(v2Mapping).filter(([, value]) => value === v2Profile).map(([key]) => key),
    };
  }
  if (Array.isArray(collection?.[type]?.info_panel)) {
    return { panel: collection[type].info_panel, source: 'type override', profile: null, relatedTypes: [] };
  }
  const mapping = kind === 'edge' ? graphViewerSchema.edge_panel_by_type : graphViewerSchema.node_panel_by_label;
  const profiles = kind === 'edge' ? graphViewerSchema.edge_panels : graphViewerSchema.node_panels;
  const profile = mapping?.[type];
  if (profile && Array.isArray(profiles?.[profile])) {
    return {
      panel: profiles[profile],
      source: 'shared profile',
      profile,
      relatedTypes: Object.entries(mapping || {}).filter(([, value]) => value === profile).map(([key]) => key),
    };
  }
  return {
    panel: kind === 'edge' ? graphViewerSchema.default_edge_info_panel : graphViewerSchema.default_node_info_panel,
    source: 'default',
    profile: null,
    relatedTypes: [],
  };
};

export const inverseLayoutPosition = (position, original) => ({
  ...original,
  x: Math.round(position.x / 0.5),
  y: Math.round(position.y / (0.5 * 2)),
});

export const navigationLabel = (data = {}) => {
  const action = String(data.navigation_action || '').toLowerCase();
  const graphLink = String(data.graph_link || '').toLowerCase();
  if (action.includes('data view')) return 'Open data view';
  if (action.includes('detail')) return 'Open detail';
  if (graphLink.includes('/details/')) return 'Open detail';
  if (graphLink.includes('/pathways/')) return 'Open pathway';
  if (data.type === 'Process' || data.type === 'Pathway') return 'Open pathway';
  return 'Open linked graph';
};
