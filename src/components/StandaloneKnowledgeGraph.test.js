import {
  getCanonicalNodeLabel,
  getGenomeLaneModelYs,
  isOverflowId,
  mergeExploreNeighborsCypher,
  restoreAdjacentDeletedIds,
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
