import { getGenomeLaneModelYs } from './StandaloneKnowledgeGraph';

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
