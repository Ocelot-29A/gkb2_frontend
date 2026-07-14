import { getGenomeLaneModelYs } from './StandaloneKnowledgeGraph';

const genomeRegion = {
  lanes: [
    { name: 'Gene', y: 0 },
    { name: 'Transcript', y: 78 },
    { name: 'other coordinate features', y: 468 },
  ],
};

const genomeTracks = { min_y: 0, max_y: 468 };
const geneGraph = {
  nodes: [{ '~id': 'gene-1', '~labels': ['Coding_element', 'Gene'] }],
};

describe('getGenomeLaneModelYs', () => {
  test('keeps lane coordinates when node and metadata use the same y axis', () => {
    const lanes = getGenomeLaneModelYs(genomeRegion, genomeTracks, geneGraph, {
      'gene-1': { start_xy: [0, 12], end_xy: [100, -12] },
    });

    expect(lanes.map(({ name, modelY }) => [name, modelY])).toEqual([
      ['Gene', 0],
      ['Transcript', 78],
      ['other coordinate features', 468],
    ]);
  });

  test('inverts lane coordinates when live node rectangles use the opposite y axis', () => {
    const lanes = getGenomeLaneModelYs(genomeRegion, genomeTracks, geneGraph, {
      'gene-1': { start_xy: [0, 480], end_xy: [100, 456] },
    });

    expect(lanes.map(({ name, modelY }) => [name, modelY])).toEqual([
      ['Gene', 468],
      ['Transcript', 390],
      ['other coordinate features', 0],
    ]);
  });
});
