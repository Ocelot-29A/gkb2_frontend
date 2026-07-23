import {
  buildPreviousLayout,
  edgeRouteToCytoscapeData,
  getCanonicalNodeLabel,
  getGenomeLaneModelYs,
  isOverflowId,
  mergeExploreNeighborsCypher,
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
  test('covers every live Neo4j node label and relationship type', () => {
    expect(Object.keys(graphViewerSchema.nodes).sort()).toEqual([
      'AB_compartment', 'CDS_segments', 'Cell_or_tissue', 'ChromHMM_state', 'Coding_element',
      'Deletion', 'ENCODE_feature', 'Enhancer', 'Epigenomic_feature', 'Exon', 'FIRE_region',
      'GO_term', 'Gene', 'Genomic_feature', 'Insertion', 'Loop', 'LoopAnchor', 'Non_coding_RNA',
      'Non_coding_element', 'Ontology', 'Ontology_term', 'Promoter', 'Protein', 'Replication_timing',
      'SNP', 'SNV', 'Sequence_variant', 'Structural_variant', 'Super_enhancer', 'TF_binding_motif',
      'TSS_segment', 'ThreeD_structure', 'Transcript', 'UTR_segments', 'Variant', 'cCRE',
    ].sort());
    expect(Object.keys(graphViewerSchema.edges).sort()).toEqual([
      'ASSOCIATED_WITH_GO', 'ENCODES', 'EQTL_OF', 'EXPRESS_IN', 'FUNCTION_ANNOTATE',
      'GENETIC_INTERACTION', 'GWAS_ASSOCIATION', 'HAS_ANCHOR_A', 'HAS_ANCHOR_B',
      'HAS_CDS_SEGMENT', 'HAS_EXON', 'HAS_TRANSCRIPT', 'HAS_TSS', 'HAS_UTR_SEGMENT',
      'LIGAND_RECEPTOR_PAIR', 'MAPPING_MAPPING', 'PHYSICAL_INTERACTION', 'REGULATE',
      'REPLACED_BY', 'SUBCLASS_OF', 'TRANSLATES_TO',
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

describe('optimized edge routing', () => {
  test('converts model-space bezier and polyline points for Cytoscape', () => {
    expect(edgeRouteToCytoscapeData({
      route_type: 'bezier',
      control_points: [[100, 20]],
    }, { x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({
      routeCurveStyle: 'unbundled-bezier',
      curveDistance: '20',
      curveWeight: '0.5',
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
