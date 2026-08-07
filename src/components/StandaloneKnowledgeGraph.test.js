import {
  buildPreviousLayout,
  edgeRouteToCytoscapeData,
  getCanonicalNodeLabel,
  getGenomeLaneModelYs,
} from './StandaloneKnowledgeGraph';

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
});

describe('optimized edge route adapter', () => {
  test('converts model-space bezier points to Cytoscape distance and weight', () => {
    expect(edgeRouteToCytoscapeData({
      route_type: 'bezier',
      source_port: [0, 0],
      target_port: [200, 0],
      control_points: [[100, 20]],
    }, { x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({
      routeCurveStyle: 'unbundled-bezier',
      curveDistance: '20',
      curveWeight: '0.5',
    });
  });

  test('converts polyline waypoints and rejects malformed routes', () => {
    expect(edgeRouteToCytoscapeData({
      route_type: 'polyline',
      source_port: [0, 0],
      target_port: [200, 0],
      waypoints: [[100, 20]],
    }, { x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({
      routeCurveStyle: 'segments',
      segmentDistances: '20',
      segmentWeights: '0.5',
    });
    expect(edgeRouteToCytoscapeData({ route_type: 'unknown' }, { x: 0, y: 0 }, { x: 1, y: 1 }))
      .toBeNull();
  });

  test('packages compatible previous layout state only for optimized results', () => {
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
