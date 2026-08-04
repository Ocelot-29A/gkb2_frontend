import {
  buildPreviousLayout,
  edgeLabelToCytoscapeData,
  edgeRouteToCytoscapeData,
  getCanonicalNodeLabel,
  getGenomeLaneModelYs,
  getNodeBodyPreviewData,
  getNodePrimaryAction,
  isOverflowId,
  mergeExploreNeighborsCypher,
  resolvePreviewAssetUrl,
  restoreAdjacentDeletedIds,
} from './StandaloneKnowledgeGraph';
import graphViewerSchema from '../schema/graph_viewer_schema.json';

const genomeRegion = {
  lanes: [
    { name: 'Gene', y: 0 },
    { name: 'Transcript', y: 78 },
    { name: 'other coordinate features', y: 468 },
  ],
};

const genomeTracks = { min_y: 0, max_y: 468 };

describe('getGenomeLaneModelYs', () => {
  test('uses backend lane coordinates without inferring axis direction from nodes', () => {
    const lanes = getGenomeLaneModelYs(genomeRegion, genomeTracks);

    expect(lanes.map(({ name, modelY }) => [name, modelY])).toEqual([
      ['Gene', 0],
      ['Transcript', 78],
      ['other coordinate features', 468],
    ]);
  });

  test('uses top-level backend lanes once instead of repeating group lanes', () => {
    const lanes = getGenomeLaneModelYs({
      lanes: [
        { name: 'Gene', y: 0 },
        { name: 'Exon', y: 78 },
      ],
      groups: [
        {
          genome_assembly: 'GRCh38.p14',
          chr: '7',
          lanes: [
            { name: 'Gene', y: 0 },
            { name: 'Transcript', y: 78 },
          ],
        },
        {
          genome_assembly: 'GRCh38.p14',
          chr: '8',
          lanes: [
            { name: 'Gene', y: 588 },
            { name: 'Transcript', y: 666 },
          ],
        },
      ],
    }, genomeTracks);

    expect(lanes.map(({ name, modelY }) => [name, modelY])).toEqual([
      ['Gene', 0],
      ['Exon', 78],
    ]);
  });
});

describe('getCanonicalNodeLabel', () => {
  test('uses the complete label set instead of depending on Neo4j label order', () => {
    expect(getCanonicalNodeLabel({ '~labels': ['Coding_element', 'Gene'] })).toBe('Gene');
    expect(getCanonicalNodeLabel({ '~labels': ['Gene', 'Coding_element'] })).toBe('Gene');
    expect(
      getCanonicalNodeLabel({ '~labels': ['Ontology', 'Transcript', 'Coding_element'] }),
    ).toBe('Transcript');
  });

  test('preserves unknown domain labels when no canonical label exists', () => {
    expect(getCanonicalNodeLabel({ '~labels': ['Coding_element', 'Custom_feature'] }))
      .toBe('Custom_feature');
  });

  test('selects GKB 07-18 leaf labels over hierarchy labels', () => {
    expect(getCanonicalNodeLabel({ '~labels': ['Variant', 'Sequence_variant', 'SNP', 'SNV'] }))
      .toBe('SNP');
    expect(getCanonicalNodeLabel({ '~labels': ['ThreeD_structure', 'Loop'] })).toBe('Loop');
    expect(getCanonicalNodeLabel({ '~labels': ['Epigenomic_feature', 'ENCODE_feature'] }))
      .toBe('ENCODE_feature');
  });
});

describe('GKB 07-18 viewer schema', () => {
  test('covers every live Neo4j and curated T1D node label and relationship type', () => {
    expect(Object.keys(graphViewerSchema.nodes).sort()).toEqual([
      'AB_compartment', 'Anatomy', 'Antibody', 'CDS_segments', 'Cell', 'CellType',
      'Cell_or_tissue', 'Chemical', 'Chemokine', 'ChromHMM_state', 'ClinicalStage', 'Coding_element', 'Cytokine',
      'Deletion', 'ENCODE_feature', 'Enhancer', 'Epigenomic_feature', 'Exon', 'ExternalFactor',
      'FIRE_region', 'GO_term', 'Gene', 'GeneratedFallback', 'Genomic_feature', 'HLA_allele',
      'HLA_allele_group', 'Insertion', 'Intervention', 'Loop', 'LoopAnchor', 'Non_coding_RNA',
      'Non_coding_element', 'Ontology', 'Ontology_term', 'Outcome', 'Pathology', 'Pathway',
      'Peptide', 'Process', 'Promoter', 'Protein', 'Replication_timing', 'SNP', 'SNV',
      'Sequence_variant', 'Structural_variant', 'Super_enhancer', 'TF_binding_motif', 'TSS_segment',
      'ThreeD_structure', 'Transcript', 'UTR_segments', 'Variant', 'cCRE',
    ].sort());
    expect(Object.keys(graphViewerSchema.edges).sort()).toEqual([
      'ACTS_ON', 'ASSOCIATED_WITH_GO', 'BINDS', 'COMPETES_WITH', 'CONFERS_RISK',
      'CONTRIBUTES_TO', 'CO_STIMULATES', 'DIFFERENTIATES_INTO', 'DRAINS_TO', 'ENCODED_BY',
      'ENCODES', 'EQTL_OF', 'EXPRESSES', 'EXPRESS_IN', 'FEEDS_BACK_TO', 'FUNCTION_ANNOTATE',
      'GENERATES', 'GENETIC_INTERACTION', 'GWAS_ASSOCIATION', 'HAS_ANCHOR_A', 'HAS_ANCHOR_B',
      'HAS_CDS_SEGMENT', 'HAS_EXON', 'HAS_STATE', 'HAS_TRANSCRIPT', 'HAS_TSS',
      'HAS_UTR_SEGMENT', 'INDUCES', 'INFECTS', 'INFILTRATES', 'INHIBITS', 'KILLS',
      'LIGAND_RECEPTOR_PAIR', 'LOCATED_IN', 'MAPPING_MAPPING', 'MIGRATES_TO', 'MODIFIES',
      'PHYSICAL_INTERACTION', 'PRESENTS_TO', 'PROVIDES_HELP_TO', 'RECOGNIZES', 'RECRUITS',
      'REGULATE', 'REPLACED_BY', 'RESULTS_IN', 'SECRETES', 'SENSED_BY', 'SUBCLASS_OF',
      'TRANSLATES_TO', 'UNDERGOES', 'UPREGULATES',
    ].sort());
  });
});

describe('interaction query helpers', () => {
  test('merges repeated explores of the same node by adding limits', () => {
    const firstQuery = mergeExploreNeighborsCypher([], 'node-1');
    const mergedQuery = mergeExploreNeighborsCypher(firstQuery, 'node-1');

    expect(mergedQuery).toHaveLength(1);
    expect(mergedQuery[0].query).toContain('LIMIT 20');
  });

  test('restores adjacent nodes and edges only when edge endpoints are visible', () => {
    const graphData = {
      nodes: [{ '~id': 'node-1' }, { '~id': 'node-2' }, { '~id': 'node-3' }],
      edges: [
        { '~id': 'edge-1', '~start': 'node-1', '~end': 'node-2' },
        { '~id': 'edge-2', '~start': 'node-1', '~end': 'node-3' },
      ],
    };

    expect(Array.from(restoreAdjacentDeletedIds(
      graphData,
      'node-1',
      new Set(['node-2', 'edge-1', 'edge-2', 'node-3']),
      true,
    ))).toEqual([]);
    expect(Array.from(restoreAdjacentDeletedIds(
      graphData,
      'node-1',
      new Set(['edge-1', 'edge-2', 'node-3']),
      false,
    ))).toEqual(['edge-2', 'node-3']);
  });

  test('recognizes overflow placeholder ids', () => {
    expect(isOverflowId('overflow:node-1')).toBe(true);
    expect(isOverflowId('node-1')).toBe(false);
  });
});

describe('cached pathway previews', () => {
  test('resolves content-addressed preview assets against the fixture root', () => {
    const cacheKey = 'a'.repeat(64);
    expect(resolvePreviewAssetUrl(
      `pathway-cache/${cacheKey}.svg`,
      'https://pank-s3-to-share.s3.us-east-1.amazonaws.com/t1d-gps-v5/',
    )).toBe(`https://pank-s3-to-share.s3.us-east-1.amazonaws.com/t1d-gps-v5/pathway-cache/${cacheKey}.svg`);
    expect(resolvePreviewAssetUrl(`pathway-cache/${cacheKey}.svg`, '/t1d-gps-v5'))
      .toBe(`/t1d-gps-v5/pathway-cache/${cacheKey}.svg`);
  });

  test('rejects graph-controlled external or malformed preview references', () => {
    expect(resolvePreviewAssetUrl('https://example.org/preview.svg', '/t1d-gps-v5')).toBe('');
    expect(resolvePreviewAssetUrl('data:image/svg+xml,<svg/>', '/t1d-gps-v5')).toBe('');
    expect(resolvePreviewAssetUrl('pathway-cache/abc.svg', '/t1d-gps-v5')).toBe('');
  });

  test('opens a preview before navigation when both contracts are present', () => {
    const cacheKey = 'b'.repeat(64);
    expect(getNodePrimaryAction({
      preview_image_path: `pathway-cache/${cacheKey}.svg`,
      graph_link: '/T1D_GPS/v5/details/example',
    })).toBe('preview');
    expect(getNodePrimaryAction({
      preview_image_path: 'https://example.org/untrusted.svg',
      graph_link: '/T1D_GPS/v5/details/example',
    })).toBe('navigate');
    expect(getNodePrimaryAction({ graph_link: '/T1D_GPS/v5/details/example' }))
      .toBe('navigate');
    expect(getNodePrimaryAction({ id: 'node-with-menu' })).toBe('menu');
  });

  test('places trusted cached previews in Process and Pathway node bodies only when enabled', () => {
    const cacheKey = 'c'.repeat(64);
    const properties = { preview_image_path: `pathway-cache/${cacheKey}.svg` };
    const config = {
      enabled: true,
      fit: 'contain',
      background_color: '#FAF4EB',
      border_color: '#A96B64',
      border_width: 4,
    };
    expect(getNodeBodyPreviewData('Process', properties, '/t1d-gps-v5', config)).toEqual({
      previewNodeImageUrl: `/t1d-gps-v5/pathway-cache/${cacheKey}.svg`,
      previewNodeImageFit: 'contain',
      previewNodeImageBackground: '#FAF4EB',
      previewNodeImageBorderColor: '#A96B64',
      previewNodeImageBorderWidth: 4,
    });
    expect(getNodeBodyPreviewData('Pathway', properties, '/t1d-gps-v5', config))
      .toHaveProperty('previewNodeImageUrl');
    expect(getNodeBodyPreviewData('Gene', properties, '/t1d-gps-v5', config)).toEqual({});
    expect(getNodeBodyPreviewData('Anatomy', properties, '/t1d-gps-v5', config)).toEqual({});
  });

  test('does not create a node-body image from disabled, malformed, or external preview data', () => {
    const enabled = { enabled: true };
    expect(getNodeBodyPreviewData('Process', {
      preview_image_path: 'https://example.org/untrusted.svg',
    }, '/t1d-gps-v5', enabled)).toEqual({});
    expect(getNodeBodyPreviewData('Process', {
      preview_image_path: 'pathway-cache/not-a-hash.svg',
    }, '/t1d-gps-v5', enabled)).toEqual({});
    expect(getNodeBodyPreviewData('Process', {
      preview_image_path: `pathway-cache/${'d'.repeat(64)}.svg`,
    }, '/t1d-gps-v5', { enabled: false })).toEqual({});
  });
});

describe('optimized edge routing', () => {
  test('converts model-space bezier and polyline points for Cytoscape', () => {
    expect(edgeRouteToCytoscapeData({
      route_type: 'bezier',
      control_points: [[35, 20], [65, 20]],
    }, { x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({
      routeCurveStyle: 'unbundled-bezier',
      curveDistance: '20 20',
      curveWeight: '0.175 0.325',
    });
    expect(edgeRouteToCytoscapeData({
      route_type: 'polyline',
      waypoints: [[100, 20]],
    }, { x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({
      routeCurveStyle: 'segments',
      segmentDistances: '20',
      segmentWeights: '0.5',
    });
  });

  test('uses rounded safe corridors for bezier controls beyond either endpoint', () => {
    expect(edgeRouteToCytoscapeData({
      route_type: 'bezier',
      control_points: [[-40, 20], [60, 20]],
    }, { x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({
      routeCurveStyle: 'round-segments',
      segmentDistances: '20 20',
      segmentWeights: '-0.2 0.3',
      segmentRadii: '36 36',
    });
  });

  test('uses route label visibility and safe anchor offsets when supplied', () => {
    expect(edgeLabelToCytoscapeData({
      label_visible: false,
    }, { x: 0, y: 0 }, { x: 100, y: 0 }, 'related to')).toEqual({
      displayLabel: '', labelMarginX: '0', labelMarginY: '0',
    });
    expect(edgeLabelToCytoscapeData({
      label_visible: true,
      label_anchor: [50, 20],
    }, { x: 0, y: 0 }, { x: 100, y: 0 }, 'related to')).toEqual({
      displayLabel: 'related to', labelMarginX: '-25', labelMarginY: '20',
    });
  });

  test('packages compatible optimized state for incremental expansion', () => {
    const coords = { node: { start_xy: [0, 22], end_xy: [120, -22] } };
    expect(buildPreviousLayout(coords, {}, {
      layout: {
        engine: 'optimized_v1',
        version: 1,
        config_fingerprint: 'abc',
      },
    })).toEqual({
      version: 1,
      config_fingerprint: 'abc',
      xy_json: coords,
      edge_routes: {},
    });
    expect(buildPreviousLayout(coords, {}, { layout: { engine: 'legacy' } })).toBeNull();
  });
});
