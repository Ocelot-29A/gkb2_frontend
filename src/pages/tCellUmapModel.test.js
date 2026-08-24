import {
  buildKgFocusRoute,
  buildMaturationTrace,
  buildSolidArrowPath,
  buildSubtypeTraces,
  buildTrendShapes,
  MATURATION_ARROW_STYLE,
  normalizeUmapPayload,
  resolveManifestFileUrl,
  UMAP_PAYLOAD_COLUMNS,
  validateUmapKgContext,
  validateUmapManifest,
} from './tCellUmapModel';

const publishedManifest = require('../../public/t1d-gps-v8/embeddings/scfm-t-cell-differentiation/manifest.json');

const publicMappings = [
  ['Naive CD8+ T cell', 'label_match', 'CL:0000900'],
  ['Memory CD8+ T cell', 'label_match', 'CL:0000909'],
  ['T Cytotoxic Cell', 'closest_public_class', 'CL:0000794'],
  ['Naive CD4+ T cell', 'label_match', 'CL:0000895'],
  ['Memory CD4+ T cell', 'label_match', 'CL:0000897'],
  ['T Regulatory Cell', 'closest_public_class', 'CL:0000792'],
].map(([subtype, matchType, id]) => ({
  subtype,
  match_type: matchType,
  confidence: matchType === 'closest_public_class' ? 'moderate' : 'high',
  equivalence_asserted: false,
  not_process_evidence: true,
  primary_concept: { id, label: `${subtype} pathway concept` },
  refinements: subtype.startsWith('Memory')
    ? [{ id: `${id}:refinement`, label: `${subtype} refinement` }]
    : [],
  related_states: subtype === 'T Regulatory Cell'
    ? [{ id: 'T1DGPS:CS:000008', label: 'FOXP3-low Treg state' }]
    : [],
  note: 'Public crosswalk only; no ontology equivalence or process evidence is asserted.',
}));

const manifest = {
  schema_version: '1.0.0',
  cell_count: 2,
  donor_count: 1,
  files: {
    points: { path: 'points.abc.json.gz', sha256: 'a'.repeat(64) },
    preview: { path: 'preview.abc.png' },
  },
  categories: {
    subtype: [
      'Naive CD8+ T cell',
      'Memory CD8+ T cell',
      'T Cytotoxic Cell',
      'Naive CD4+ T cell',
      'Memory CD4+ T cell',
      'T Regulatory Cell',
    ],
    lineage: ['CD4', 'CD8', 'Treg'],
    stage: ['Naive', 'Memory', 'Cytotoxic', 'Regulatory'],
    region: ['pln', 'pln_b', 'pln_h'],
    split: ['train', 'val', 'test', 'ood'],
    training_status: ['held out', 'in training'],
    module_set: ['discovery', 'reserved'],
  },
  subtype_order: ['Naive CD8+ T cell', 'Memory CD8+ T cell'],
  subtype_colors: {
    'Naive CD8+ T cell': '#2878D0',
    'Memory CD8+ T cell': '#ED6A2C',
  },
  subtype_counts: {
    'Naive CD8+ T cell': 1,
    'Memory CD8+ T cell': 1,
  },
  maturation_range: [-0.201, 1.207],
  arrows: [
    {
      id: 'cd8',
      label: 'schematic maturation direction',
      ax: 0,
      ay: 1,
      x: 2,
      y: 3,
    },
    {
      id: 'cd4',
      label: 'schematic maturation direction',
      ax: -1,
      ay: 2,
      x: 3,
      y: -2,
    },
  ],
  kg_context: {
    back_route: '/T1D_GPS/v8/pathways/human-alpha-beta-t-cell-differentiation-and-regulation',
    equivalence_asserted: false,
    not_process_evidence: true,
    relationship: {
      display_label: '6 UMAP cell labels map to KG concepts',
      link_reason: 'Six public T-cell labels crosswalk to concepts in the pathway.',
      link_basis: 'curated_subtype_crosswalk',
      mapped_subtype_count: 6,
      evidence_boundary: 'Context only; not differentiation or mechanism evidence.',
    },
    mappings: publicMappings,
    arrow_coverage: {
      cd8: {
        status: 'partial',
        label: 'CD8 maturation direction',
        detail: 'Downstream memory transitions remain symbolic.',
        not_process_evidence: true,
      },
      cd4: {
        status: 'not_represented',
        label: 'CD4/Treg maturation direction',
        detail: 'Not represented as differentiation.',
        not_process_evidence: true,
      },
    },
  },
};

const payload = {
  schema_version: '1.0.0',
  point_count: 2,
  columns: {
    point_index: [0, 1],
    umap_RNA_1: [0.5, 1.5],
    umap_RNA_2: [2.5, 3.5],
    subtype: [0, 1],
    lineage: [1, 1],
    stage: [0, 1],
    region: [0, 0],
    maturation_RNA: [-0.201, 1.207],
    maturation_atac: [0.2, 0.8],
    umi: [1200, 1800],
    ncre: [400, 700],
    split: [2, 2],
    training_status: [0, 0],
    module_set: [1, 1],
  },
};

describe('scFM UMAP public data model', () => {
  test('accepts the published manifest and its six safe KG correspondences', () => {
    expect(validateUmapManifest(publishedManifest)).toBe(publishedManifest);
    expect(publishedManifest.kg_context.mappings).toHaveLength(6);
    expect(publishedManifest.kg_context.mappings.every((mapping) => (
      mapping.equivalence_asserted === false && mapping.not_process_evidence === true
    ))).toBe(true);
    expect(publishedManifest.kg_context.relationship).toEqual(expect.objectContaining({
      display_label: '6 UMAP cell labels map to KG concepts',
      link_basis: 'curated_subtype_crosswalk',
      mapped_subtype_count: 6,
    }));
  });

  test('accepts the canonical manifest and decodes categorical columns', () => {
    expect(validateUmapManifest(manifest)).toBe(manifest);
    const model = normalizeUmapPayload(payload, manifest);
    expect(model.pointCount).toBe(2);
    expect(model.columns.subtype).toEqual(manifest.categories.subtype.slice(0, 2));
    expect(Object.keys(payload.columns)).toEqual(UMAP_PAYLOAD_COLUMNS);
  });

  test('rejects extra fields, schema drift, and non-sequential point indices', () => {
    expect(() => normalizeUmapPayload({ ...payload, donor: ['private'] }, manifest))
      .toThrow(/non-public fields/i);
    expect(() => normalizeUmapPayload({ ...payload, schema_version: '2.0.0' }, manifest))
      .toThrow(/schema version/i);
    expect(() => normalizeUmapPayload({
      ...payload,
      columns: { ...payload.columns, point_index: [1, 2] },
    }, manifest)).toThrow(/zero-based and sequential/i);
  });

  test('rejects identifier-like category drift before it can reach hover data', () => {
    expect(() => validateUmapManifest({
      ...manifest,
      categories: {
        ...manifest.categories,
        region: ['pln', 'pln_b', 'donor_001'],
      },
    })).toThrow(/locked public domain for region/i);
  });

  test('rejects category-dictionary schema expansion with a donor key', () => {
    expect(() => validateUmapManifest({
      ...manifest,
      categories: {
        ...manifest.categories,
        donor: ['donor_001'],
      },
    })).toThrow(/forbidden fields: donor/i);
  });

  test('rejects forbidden identity or clinical keys anywhere in the manifest', () => {
    expect(() => validateUmapManifest({ ...manifest, donor: 'private' }))
      .toThrow(/manifest contains forbidden fields: donor/i);
    expect(() => validateUmapManifest({
      ...manifest,
      files: {
        ...manifest.files,
        preview: { ...manifest.files.preview, Diagnosis: 'T1D' },
      },
    })).toThrow(/manifest contains forbidden fields: Diagnosis/i);
    expect(() => validateUmapManifest(manifest)).not.toThrow();
    expect(manifest.donor_count).toBe(1);
  });

  test('validates the non-equivalent KG crosswalk and builds safe focus routes', () => {
    expect(validateUmapKgContext(manifest.kg_context, manifest)).toBe(manifest.kg_context);
    expect(buildKgFocusRoute(manifest.kg_context, 'CL:0000909')).toBe(
      '/T1D_GPS/v8/pathways/human-alpha-beta-t-cell-differentiation-and-regulation?focus=CL%3A0000909',
    );
    expect(buildKgFocusRoute(manifest.kg_context, '../private')).toBe('');
    expect(buildKgFocusRoute({ ...manifest.kg_context, back_route: 'https://example.org' }, 'CL:1'))
      .toBe('');
  });

  test('rejects incomplete, identity-bearing, or process-evidence crosswalk drift', () => {
    expect(() => validateUmapManifest({
      ...manifest,
      kg_context: {
        ...manifest.kg_context,
        mappings: manifest.kg_context.mappings.slice(0, 5),
      },
    })).toThrow(/map each public subtype exactly once/i);

    expect(() => validateUmapManifest({
      ...manifest,
      kg_context: {
        ...manifest.kg_context,
        mappings: manifest.kg_context.mappings.map((mapping, index) => (
          index === 0 ? { ...mapping, donor: 'private' } : mapping
        )),
      },
    })).toThrow(/forbidden fields: donor/i);

    expect(() => validateUmapManifest({
      ...manifest,
      kg_context: {
        ...manifest.kg_context,
        arrow_coverage: {
          ...manifest.kg_context.arrow_coverage,
          cd8: { ...manifest.kg_context.arrow_coverage.cd8, not_process_evidence: false },
        },
      },
    })).toThrow(/must be marked not process evidence/i);

    expect(() => validateUmapManifest({
      ...manifest,
      kg_context: {
        ...manifest.kg_context,
        mappings: manifest.kg_context.mappings.map((mapping, index) => (
          index === 0 ? { ...mapping, equivalence_asserted: true } : mapping
        )),
      },
    })).toThrow(/must remain non-equivalent and not process evidence/i);
  });

  test('builds ordered subtype and unclipped maturation scattergl traces', () => {
    const model = normalizeUmapPayload(payload, manifest);
    const subtypeTraces = buildSubtypeTraces(model, manifest);
    expect(subtypeTraces).toHaveLength(2);
    expect(subtypeTraces.every((trace) => trace.type === 'scattergl')).toBe(true);
    expect(subtypeTraces.map((trace) => trace.name)).toEqual([
      'Naive CD8+ T cell (n = 1)',
      'Memory CD8+ T cell (n = 1)',
    ]);

    const maturationTrace = buildMaturationTrace(model, manifest)[0];
    expect(maturationTrace.marker.cmin).toBe(-0.201);
    expect(maturationTrace.marker.cmax).toBe(1.207);
    expect(maturationTrace.marker.colorbar).toMatchObject({
      title: {
        text: 'RNA maturation',
        font: { color: '#243E3A', size: 15 },
      },
      tickfont: { color: '#304B49', size: 12 },
      thickness: 22,
      outlinewidth: 1,
    });
    expect(maturationTrace.customdata[0]).toEqual([
      0, 'Naive CD8+ T cell', 'CD8', 'Naive', 'pln', -0.201, 0.2, 1200, 400,
    ]);
  });

  test('uses filled block-arrow trend shapes and refuses cross-origin asset URLs', () => {
    const trendShapes = buildTrendShapes(manifest);
    expect(trendShapes).toHaveLength(2);
    expect(trendShapes[0]).toMatchObject({
      type: 'path',
      xref: 'x',
      yref: 'y',
      fillcolor: MATURATION_ARROW_STYLE.color,
      opacity: MATURATION_ARROW_STYLE.opacity,
      line: { color: MATURATION_ARROW_STYLE.color, width: 0 },
      layer: 'above',
    });
    expect(MATURATION_ARROW_STYLE.opacity).toBeGreaterThan(0);
    expect(MATURATION_ARROW_STYLE.opacity).toBeLessThan(1);
    trendShapes.forEach((shape) => {
      expect(shape.path).toMatch(/^M .+ Z$/);
      expect(shape.path.match(/\b[ML]\b/g)).toHaveLength(7);
    });

    const horizontalPath = buildSolidArrowPath({ ax: 0, ay: 0, x: 10, y: 0 });
    const horizontalPoints = Array.from(
      horizontalPath.matchAll(/[ML] (-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g),
      (match) => [Number(match[1]), Number(match[2])],
    );
    expect(horizontalPoints).toHaveLength(7);
    expect(horizontalPoints[3]).toEqual([10, 0]);
    const shaftWidth = Math.abs(horizontalPoints[0][1] - horizontalPoints[6][1]);
    const headWidth = Math.abs(horizontalPoints[2][1] - horizontalPoints[4][1]);
    expect(shaftWidth).toBeGreaterThan(0);
    expect(headWidth).toBeGreaterThan(shaftWidth * 2.5);
    expect(resolveManifestFileUrl('/t1d-gps-v8/embeddings/view/manifest.json', 'preview.abc.png'))
      .toBe('http://localhost/t1d-gps-v8/embeddings/view/preview.abc.png');
    expect(() => resolveManifestFileUrl(
      '/t1d-gps-v8/embeddings/view/manifest.json',
      'https://third-party.example/points.json.gz',
    )).toThrow(/same origin/i);
  });
});
