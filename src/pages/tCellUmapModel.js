export const UMAP_PAYLOAD_COLUMNS = Object.freeze([
  'point_index',
  'umap_RNA_1',
  'umap_RNA_2',
  'subtype',
  'lineage',
  'stage',
  'region',
  'maturation_RNA',
  'maturation_atac',
  'umi',
  'ncre',
  'split',
  'training_status',
  'module_set',
]);

export const MATURATION_ARROW_STYLE = Object.freeze({
  color: '#304B49',
  opacity: 0.72,
  shaftHalfWidth: 0.11,
  headLength: 0.55,
  headHalfWidth: 0.34,
});

const arrowCoordinate = (value) => {
  const rounded = Number(value.toFixed(4));
  return Object.is(rounded, -0) ? 0 : rounded;
};

export const buildSolidArrowPath = (
  arrow,
  geometry = MATURATION_ARROW_STYLE,
) => {
  const dx = arrow.x - arrow.ax;
  const dy = arrow.y - arrow.ay;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 0) return '';

  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;
  const headLength = Math.min(geometry.headLength, length * 0.28);
  const shaftHalfWidth = Math.min(geometry.shaftHalfWidth, length * 0.04);
  const headHalfWidth = Math.min(
    geometry.headHalfWidth,
    Math.max(shaftHalfWidth * 2.7, shaftHalfWidth),
  );
  const shoulderX = arrow.x - ux * headLength;
  const shoulderY = arrow.y - uy * headLength;
  const points = [
    [arrow.ax + px * shaftHalfWidth, arrow.ay + py * shaftHalfWidth],
    [shoulderX + px * shaftHalfWidth, shoulderY + py * shaftHalfWidth],
    [shoulderX + px * headHalfWidth, shoulderY + py * headHalfWidth],
    [arrow.x, arrow.y],
    [shoulderX - px * headHalfWidth, shoulderY - py * headHalfWidth],
    [shoulderX - px * shaftHalfWidth, shoulderY - py * shaftHalfWidth],
    [arrow.ax - px * shaftHalfWidth, arrow.ay - py * shaftHalfWidth],
  ];

  return points.map(([x, y], index) => (
    `${index === 0 ? 'M' : 'L'} ${arrowCoordinate(x)},${arrowCoordinate(y)}`
  )).join(' ') + ' Z';
};

const PAYLOAD_TOP_LEVEL_KEYS = Object.freeze([
  'schema_version',
  'point_count',
  'columns',
]);

const CATEGORICAL_COLUMNS = Object.freeze([
  'subtype',
  'lineage',
  'stage',
  'region',
  'split',
  'training_status',
  'module_set',
]);

export const UMAP_CATEGORY_DOMAINS = Object.freeze({
  subtype: Object.freeze([
    'Naive CD8+ T cell',
    'Memory CD8+ T cell',
    'T Cytotoxic Cell',
    'Naive CD4+ T cell',
    'Memory CD4+ T cell',
    'T Regulatory Cell',
  ]),
  lineage: Object.freeze(['CD4', 'CD8', 'Treg']),
  stage: Object.freeze(['Naive', 'Memory', 'Cytotoxic', 'Regulatory']),
  region: Object.freeze(['pln', 'pln_b', 'pln_h']),
  split: Object.freeze(['train', 'val', 'test', 'ood']),
  training_status: Object.freeze(['held out', 'in training']),
  module_set: Object.freeze(['discovery', 'reserved']),
});

export const UMAP_KG_MATCH_TYPES = Object.freeze([
  'label_match',
  'closest_public_class',
  'related_state',
]);

const SAFE_KG_NODE_ID = /^[A-Za-z0-9_.:@#~-]+$/;
const SAFE_KG_BACK_ROUTE = /^\/T1D_GPS\/v(?:8|9)\/pathways\/[A-Za-z0-9_.~-]+$/;

const assertPublicText = (value, label, { maxLength = 800 } = {}) => {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new Error(`${label} must be a short, non-empty public string.`);
  }
};

const validateKgConcept = (concept, label) => {
  assertPlainObject(concept, label);
  assertExactKeys(concept, ['id', 'label'], label);
  assertPublicText(concept.id, `${label} id`, { maxLength: 256 });
  if (!SAFE_KG_NODE_ID.test(concept.id) || concept.id.includes('..')) {
    throw new Error(`${label} id is unsafe.`);
  }
  assertPublicText(concept.label, `${label} label`, { maxLength: 240 });
};

export const validateUmapKgContext = (kgContext, manifest) => {
  assertPlainObject(kgContext, 'UMAP KG context');
  assertExactKeys(kgContext, [
    'back_route',
    'equivalence_asserted',
    'not_process_evidence',
    'relationship',
    'mappings',
    'arrow_coverage',
  ], 'UMAP KG context');
  if (typeof kgContext.back_route !== 'string'
    || !SAFE_KG_BACK_ROUTE.test(kgContext.back_route)) {
    throw new Error('UMAP KG context back route is unsafe.');
  }
  if (kgContext.equivalence_asserted !== false || kgContext.not_process_evidence !== true) {
    throw new Error('UMAP KG context must remain non-equivalent and not process evidence.');
  }
  assertPlainObject(kgContext.relationship, 'UMAP KG relationship');
  assertExactKeys(kgContext.relationship, [
    'display_label',
    'link_reason',
    'link_basis',
    'mapped_subtype_count',
    'evidence_boundary',
  ], 'UMAP KG relationship');
  ['display_label', 'link_reason', 'link_basis', 'evidence_boundary'].forEach((field) => {
    assertPublicText(
      kgContext.relationship[field],
      `UMAP KG relationship ${field}`,
      { maxLength: field === 'link_basis' ? 80 : 800 },
    );
  });
  if (kgContext.relationship.link_basis !== 'curated_subtype_crosswalk'
    || kgContext.relationship.mapped_subtype_count !== UMAP_CATEGORY_DOMAINS.subtype.length) {
    throw new Error('UMAP KG relationship must describe the locked six-label subtype crosswalk.');
  }
  if (!Array.isArray(kgContext.mappings)
    || kgContext.mappings.length !== UMAP_CATEGORY_DOMAINS.subtype.length) {
    throw new Error('UMAP KG context must map each public subtype exactly once.');
  }

  const observedSubtypes = new Set();
  kgContext.mappings.forEach((mapping, index) => {
    const label = `UMAP KG mapping ${index}`;
    assertPlainObject(mapping, label);
    assertExactKeys(mapping, [
      'subtype',
      'match_type',
      'confidence',
      'primary_concept',
      'refinements',
      'related_states',
      'note',
      'equivalence_asserted',
      'not_process_evidence',
    ], label);
    if (!UMAP_CATEGORY_DOMAINS.subtype.includes(mapping.subtype)
      || observedSubtypes.has(mapping.subtype)) {
      throw new Error(`${label} has an unknown or duplicate subtype.`);
    }
    observedSubtypes.add(mapping.subtype);
    if (!UMAP_KG_MATCH_TYPES.includes(mapping.match_type)) {
      throw new Error(`${label} has an unsupported match type.`);
    }
    if (mapping.equivalence_asserted !== false || mapping.not_process_evidence !== true) {
      throw new Error(`${label} must remain non-equivalent and not process evidence.`);
    }
    assertPublicText(mapping.confidence, `${label} confidence`, { maxLength: 40 });
    validateKgConcept(mapping.primary_concept, `${label} primary concept`);
    ['refinements', 'related_states'].forEach((field) => {
      if (!Array.isArray(mapping[field]) || mapping[field].length > 8) {
        throw new Error(`${label} ${field} must be a small public concept list.`);
      }
      mapping[field].forEach((concept, conceptIndex) => (
        validateKgConcept(concept, `${label} ${field} ${conceptIndex}`)
      ));
    });
    assertPublicText(mapping.note, `${label} note`);
  });

  assertPlainObject(kgContext.arrow_coverage, 'UMAP KG arrow coverage');
  const arrowIds = (manifest.arrows || []).map((arrow) => arrow.id);
  const coverageIds = Object.keys(kgContext.arrow_coverage);
  if (coverageIds.length !== arrowIds.length
    || coverageIds.some((id) => !arrowIds.includes(id))) {
    throw new Error('UMAP KG arrow coverage must match the manifest arrows exactly.');
  }
  coverageIds.forEach((id) => {
    const coverage = kgContext.arrow_coverage[id];
    assertPlainObject(coverage, `UMAP KG arrow coverage ${id}`);
    assertExactKeys(coverage, [
      'status',
      'label',
      'detail',
      'not_process_evidence',
    ], `UMAP KG arrow coverage ${id}`);
    assertPublicText(coverage.status, `UMAP KG arrow coverage ${id} status`, { maxLength: 64 });
    assertPublicText(coverage.label, `UMAP KG arrow coverage ${id} label`, { maxLength: 160 });
    if (coverage.detail !== undefined) {
      assertPublicText(coverage.detail, `UMAP KG arrow coverage ${id} detail`);
    }
    if (coverage.not_process_evidence !== true) {
      throw new Error(`UMAP KG arrow coverage ${id} must be marked not process evidence.`);
    }
  });
  return kgContext;
};

export const buildKgFocusRoute = (kgContext, nodeId) => {
  const route = kgContext?.back_route;
  if (typeof route !== 'string' || !SAFE_KG_BACK_ROUTE.test(route)) return '';
  if (typeof nodeId !== 'string'
    || nodeId.length > 256
    || nodeId.includes('..')
    || !SAFE_KG_NODE_ID.test(nodeId)) return '';
  const parameters = new URLSearchParams();
  parameters.set('focus', nodeId);
  return `${route}?${parameters.toString()}`;
};

const NUMERIC_COLUMNS = Object.freeze([
  'point_index',
  'umap_RNA_1',
  'umap_RNA_2',
  'maturation_RNA',
  'maturation_atac',
  'umi',
  'ncre',
]);

const HOVER_TEMPLATE = [
  '<b>%{customdata[1]}</b>',
  'Point index: %{customdata[0]}',
  'Lineage: %{customdata[2]}',
  'Stage: %{customdata[3]}',
  'Region: %{customdata[4]}',
  'RNA maturation: %{customdata[5]:.3f}',
  'ATAC maturation: %{customdata[6]:.3f}',
  'UMI: %{customdata[7]:,.0f}',
  'nCRE: %{customdata[8]:,.0f}',
  '<extra></extra>',
].join('<br>');

const isAbsoluteUrl = (value) => /^[a-z][a-z\d+.-]*:\/\//i.test(value || '');

export const joinAssetUrl = (baseUrl, path) => {
  if (!path) return '';
  if (isAbsoluteUrl(path)) return path;
  const base = (baseUrl || '').replace(/\/$/, '');
  return `${base}/${String(path).replace(/^\//, '')}`;
};

export const resolveManifestFileUrl = (manifestUrl, path) => {
  if (!path) return '';
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const absoluteManifestUrl = new URL(manifestUrl, origin);
  const resolvedUrl = new URL(path, absoluteManifestUrl);
  if (resolvedUrl.origin !== absoluteManifestUrl.origin) {
    throw new Error('UMAP assets must use the same origin as the manifest.');
  }
  return resolvedUrl.toString();
};

const assertPlainObject = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
};

const assertExactKeys = (value, allowedKeys, label) => {
  const unexpected = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (unexpected.length) {
    throw new Error(`${label} contains non-public fields: ${unexpected.join(', ')}.`);
  }
};

const FORBIDDEN_MANIFEST_KEYS = new Set([
  'key',
  'cell_barcode',
  'dataset_id',
  'donor',
  'Group',
  'Diagnosis',
  'Age',
  'Sex',
  'AAb',
  'nAAb',
]);

const collectForbiddenManifestKeys = (value, found = new Set()) => {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectForbiddenManifestKeys(entry, found));
    return found;
  }
  if (!value || typeof value !== 'object') return found;
  Object.entries(value).forEach(([key, entry]) => {
    if (FORBIDDEN_MANIFEST_KEYS.has(key)) found.add(key);
    collectForbiddenManifestKeys(entry, found);
  });
  return found;
};

export const validateUmapManifest = (manifest) => {
  assertPlainObject(manifest, 'UMAP manifest');
  const forbiddenKeys = Array.from(collectForbiddenManifestKeys(manifest)).sort();
  if (forbiddenKeys.length) {
    throw new Error(`UMAP manifest contains forbidden fields: ${forbiddenKeys.join(', ')}.`);
  }
  assertPlainObject(manifest.files, 'UMAP manifest files');
  assertPlainObject(manifest.files.points, 'UMAP point file');
  assertPlainObject(manifest.files.preview, 'UMAP preview file');

  if (!manifest.files.points.path || !/^[a-f\d]{64}$/i.test(manifest.files.points.sha256 || '')) {
    throw new Error('UMAP point file path or checksum is missing.');
  }
  if (!manifest.files.preview.path) {
    throw new Error('UMAP preview file path is missing.');
  }
  if (!Number.isInteger(manifest.cell_count) || manifest.cell_count <= 0) {
    throw new Error('UMAP manifest cell count is invalid.');
  }
  if (!manifest.categories || typeof manifest.categories !== 'object') {
    throw new Error('UMAP manifest categories are missing.');
  }
  assertExactKeys(manifest.categories, CATEGORICAL_COLUMNS, 'UMAP manifest categories');
  CATEGORICAL_COLUMNS.forEach((field) => {
    const observed = manifest.categories[field];
    const expected = UMAP_CATEGORY_DOMAINS[field];
    if (!Array.isArray(observed)
      || observed.length !== expected.length
      || observed.some((value, index) => value !== expected[index])) {
      throw new Error(`UMAP category dictionary does not match the locked public domain for ${field}.`);
    }
  });
  validateUmapKgContext(manifest.kg_context, manifest);
  return manifest;
};

const decodeCategoryColumn = (codes, labels, field) => codes.map((code) => {
  if (!Number.isInteger(code) || code < 0 || code >= labels.length) {
    throw new Error(`UMAP category code is invalid for ${field}.`);
  }
  return labels[code];
});

export const normalizeUmapPayload = (payload, manifest) => {
  assertPlainObject(payload, 'UMAP payload');
  assertExactKeys(payload, PAYLOAD_TOP_LEVEL_KEYS, 'UMAP payload');
  assertPlainObject(payload.columns, 'UMAP payload columns');
  assertExactKeys(payload.columns, UMAP_PAYLOAD_COLUMNS, 'UMAP payload columns');

  const pointCount = payload.point_count;
  if (!Number.isInteger(pointCount) || pointCount !== manifest.cell_count) {
    throw new Error('UMAP point count does not match the manifest.');
  }
  if (payload.schema_version !== manifest.schema_version) {
    throw new Error('UMAP payload schema version does not match the manifest.');
  }

  UMAP_PAYLOAD_COLUMNS.forEach((field) => {
    if (!Array.isArray(payload.columns[field]) || payload.columns[field].length !== pointCount) {
      throw new Error(`UMAP column ${field} has an invalid length.`);
    }
  });
  NUMERIC_COLUMNS.forEach((field) => {
    if (payload.columns[field].some((value) => !Number.isFinite(value))) {
      throw new Error(`UMAP column ${field} contains a non-finite value.`);
    }
  });
  if (payload.columns.point_index.some((value, index) => !Number.isInteger(value) || value !== index)) {
    throw new Error('UMAP point indices must be zero-based and sequential.');
  }

  const columns = { ...payload.columns };
  CATEGORICAL_COLUMNS.forEach((field) => {
    columns[field] = decodeCategoryColumn(
      payload.columns[field],
      manifest.categories[field],
      field,
    );
  });

  return {
    schemaVersion: payload.schema_version,
    pointCount,
    columns,
  };
};

const hoverDataAt = (columns, index) => [
  columns.point_index[index],
  columns.subtype[index],
  columns.lineage[index],
  columns.stage[index],
  columns.region[index],
  columns.maturation_RNA[index],
  columns.maturation_atac[index],
  columns.umi[index],
  columns.ncre[index],
];

const subsetAt = (values, indices) => indices.map((index) => values[index]);

const countLabel = (count) => Number(count).toLocaleString('en-US');

const subtypeIndices = (columns, subtype) => {
  const indices = [];
  for (let index = 0; index < columns.subtype.length; index += 1) {
    if (columns.subtype[index] === subtype) indices.push(index);
  }
  return indices;
};

export const buildSubtypeTraces = (model, manifest) => {
  const { columns } = model;
  const subtypeOrder = Array.isArray(manifest.subtype_order)
    ? manifest.subtype_order
    : manifest.categories.subtype;

  return subtypeOrder.map((subtype) => {
    const indices = subtypeIndices(columns, subtype);
    const expectedCount = manifest.subtype_counts?.[subtype];
    if (Number.isInteger(expectedCount) && expectedCount !== indices.length) {
      throw new Error(`UMAP subtype count does not match for ${subtype}.`);
    }
    return {
      type: 'scattergl',
      mode: 'markers',
      name: `${subtype} (n = ${countLabel(indices.length)})`,
      x: subsetAt(columns.umap_RNA_1, indices),
      y: subsetAt(columns.umap_RNA_2, indices),
      customdata: indices.map((index) => hoverDataAt(columns, index)),
      hovertemplate: HOVER_TEMPLATE,
      marker: {
        color: manifest.subtype_colors?.[subtype] || '#6B8E89',
        opacity: 0.72,
        size: 4,
      },
    };
  });
};

export const buildMaturationTrace = (model, manifest) => {
  const { columns, pointCount } = model;
  const indices = Array.from({ length: pointCount }, (_, index) => index);
  const range = Array.isArray(manifest.maturation_range)
    ? manifest.maturation_range
    : [Math.min(...columns.maturation_RNA), Math.max(...columns.maturation_RNA)];

  return [{
    type: 'scattergl',
    mode: 'markers',
    name: 'RNA maturation coordinate',
    x: columns.umap_RNA_1,
    y: columns.umap_RNA_2,
    customdata: indices.map((index) => hoverDataAt(columns, index)),
    hovertemplate: HOVER_TEMPLATE,
    marker: {
      color: columns.maturation_RNA,
      colorscale: 'Viridis',
      cmin: range[0],
      cmax: range[1],
      colorbar: {
        title: {
          text: 'RNA maturation',
          font: { color: '#243E3A', size: 15 },
          side: 'right',
        },
        tickfont: { color: '#304B49', size: 12 },
        thickness: 22,
        outlinecolor: '#78908A',
        outlinewidth: 1,
      },
      opacity: 0.75,
      size: 4,
    },
    showlegend: false,
  }];
};

export const buildTrendShapes = (manifest) => (manifest.arrows || [])
  .filter((arrow) => [arrow.ax, arrow.ay, arrow.x, arrow.y].every(Number.isFinite))
  .filter((arrow) => arrow.ax !== arrow.x || arrow.ay !== arrow.y)
  .map((arrow) => ({
    type: 'path',
    path: buildSolidArrowPath(arrow),
    xref: 'x',
    yref: 'y',
    fillcolor: MATURATION_ARROW_STYLE.color,
    opacity: MATURATION_ARROW_STYLE.opacity,
    line: { color: MATURATION_ARROW_STYLE.color, width: 0 },
    layer: 'above',
  }));

export const hasWebGlSupport = () => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  if (!window.WebGLRenderingContext && !window.WebGL2RenderingContext) return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch (error) {
    return false;
  }
};

export const sha256Hex = async (bytes) => {
  const subtle = typeof window === 'undefined' ? null : window.crypto?.subtle;
  if (!subtle) throw new Error('Browser checksum validation is unavailable.');
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const decodeMaybeGzip = async (buffer) => {
  const bytes = new Uint8Array(buffer);
  const hasGzipMagic = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!hasGzipMagic) return bytes;
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot decompress the UMAP point bundle.');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

export const parseVerifiedPointBundle = async (buffer, manifest) => {
  const bytes = await decodeMaybeGzip(buffer);
  const actualChecksum = await sha256Hex(bytes);
  if (actualChecksum !== manifest.files.points.sha256.toLowerCase()) {
    throw new Error('UMAP point bundle checksum validation failed.');
  }

  let payload;
  try {
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    throw new Error('UMAP point bundle is not valid UTF-8 JSON.');
  }
  return normalizeUmapPayload(payload, manifest);
};
