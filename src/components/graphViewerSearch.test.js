import {
  hydrateAiSearchCandidates,
  normalizeBiomedicalText,
  preferredSearchLocation,
  searchGraphIndex,
} from './graphViewerSearch';

const index = {
  index_checksum: 'search-checksum',
  records: [
    {
      search_id: 'ENSG00000254647',
      canonical_id: 'ENSG00000254647',
      name: 'INS',
      symbol: 'INS',
      entity_type: 'Gene',
      aliases: ['insulin', 'IDDM1'],
      cross_references: ['HGNC:6081'],
      description: 'Insulin gene expressed by pancreatic beta cells.',
      provenance_status: 'source_backed',
      generated: false,
      default_location_id: 'ins-detail',
      locations: [
        { location_id: 'ins-overview', view_id: 'overview', route: '/T1D_GPS/v7', node_id: 'INS@overview', layer: 1 },
        { location_id: 'ins-detail', view_id: 'details/beta', route: '/T1D_GPS/v7/details/beta', node_id: 'ENSG00000254647', layer: 3 },
      ],
    },
    {
      search_id: 'T1D:PATHWAY:glucose',
      canonical_id: 'T1D:PATHWAY:glucose',
      name: 'Glucose homeostasis and beta-cell reserve',
      entity_type: 'Pathway',
      aliases: [],
      cross_references: ['WP661'],
      description: 'Glucose sensing and insulin secretion.',
      provenance_status: 'curated',
      generated: false,
      locations: [{ location_id: 'glucose', view_id: 'pathways/glucose', route: '/T1D_GPS/v7/pathways/glucose', node_id: 'T1D:PATHWAY:glucose', layer: 2 }],
    },
    {
      search_id: 'CD8',
      canonical_id: 'CL:0000625',
      name: 'CD8 T cell',
      entity_type: 'Cell type',
      aliases: ['cytotoxic T lymphocyte'],
      locations: [{ location_id: 'cd8', view_id: 'details/cd8', route: '/T1D_GPS/v7/details/cd8', node_id: 'CD8@cell', layer: 3 }],
    },
    {
      search_id: 'CD80',
      canonical_id: 'T1D:P_CD80_86',
      name: 'CD80',
      entity_type: 'Protein',
      aliases: [],
      locations: [{ location_id: 'cd80', view_id: 'details/costim', route: '/T1D_GPS/v7/details/costim', node_id: 'CD80', layer: 3 }],
    },
    {
      search_id: 'T1D:PATHWAY:t_cell_differentiation',
      canonical_id: 'T1D:PATHWAY:t_cell_differentiation',
      name: 'Human alpha-beta T-cell differentiation and regulation in T1D',
      entity_type: 'Pathway',
      aliases: ['T cell differentiation', 'T cell regulation'],
      child_search: [
        {
          search_id: 'T1DGPS:CS:000002',
          canonical_id: 'T1DGPS:CS:000002',
          name: 'TCF7-high stem-like autoreactive CD8 state',
          entity_type: 'State',
          aliases: ['CELLSTATE_CD8_TCF1HI_STEMLIKE'],
          identifiers: ['CL:0000625', 'T1DGPS:CS:000002'],
          match_explanation: 'Matched through child state: TCF7-high stem-like autoreactive CD8 state',
        },
      ],
      locations: [{
        location_id: 't-cell-pathway',
        view_id: 'pathways/human-alpha-beta-t-cell-differentiation-and-regulation',
        route: '/T1D_GPS/v8/pathways/human-alpha-beta-t-cell-differentiation-and-regulation',
        node_id: 'T1D:PATHWAY:t_cell_differentiation',
        layer: 2,
      }],
    },
  ],
};

test('normalizes biomedical Greek and punctuation consistently', () => {
  expect(normalizeBiomedicalText('β-cell stimulus–secretion')).toBe('beta cell stimulus secretion');
});

test('ranks exact symbols and stable identifiers before descriptive matches', () => {
  expect(searchGraphIndex(index, 'INS')[0].search_id).toBe('ENSG00000254647');
  expect(searchGraphIndex(index, 'WP661')[0].search_id).toBe('T1D:PATHWAY:glucose');
  expect(searchGraphIndex(index, 'beta cell reserve')[0].search_id).toBe('T1D:PATHWAY:glucose');
});

test('does not treat CD8 as a prefix match for CD80', () => {
  const resultIds = searchGraphIndex(index, 'CD8').map((record) => record.search_id);
  expect(resultIds[0]).toBe('CD8');
  expect(resultIds).not.toContain('CD80');
});

test('returns an auditable parent-pathway match through a child state', () => {
  const result = searchGraphIndex(index, 'T1DGPS:CS:000002', { category: 'Pathway' })[0];
  expect(result.search_id).toBe('T1D:PATHWAY:t_cell_differentiation');
  expect(result.search_match.matched_via).toBe('child_entity');
  expect(result.search_match.matched_child).toMatchObject({
    canonical_id: 'T1DGPS:CS:000002',
    entity_type: 'State',
  });
  expect(result.search_match.reasons).toContain(
    'Matched through child state: TCF7-high stem-like autoreactive CD8 state',
  );
});

test('ranks the T-cell pathway directly for its explicit human-readable aliases', () => {
  const result = searchGraphIndex(index, 'T cell differentiation')[0];
  expect(result.search_id).toBe('T1D:PATHWAY:t_cell_differentiation');
  expect(result.search_match.matched_via).toBe('record');
});

test('prefers the current view before the default location', () => {
  const record = index.records[0];
  expect(preferredSearchLocation(record, 'overview').location_id).toBe('ins-overview');
  expect(preferredSearchLocation(record, 'other').location_id).toBe('ins-detail');
});

test('accepts only AI candidates from the exact static index checksum', () => {
  const accepted = hydrateAiSearchCandidates(index, {
    ranker: 'ai-rerank-v1',
    index_checksum: 'search-checksum',
    candidates: [
      { search_id: 'ENSG00000254647', score: 0.95, reason_code: 'gene_symbol' },
      { search_id: 'hallucinated', score: 1 },
    ],
  });
  expect(accepted.accepted).toBe(true);
  expect(accepted.results.map((record) => record.search_id)).toEqual(['ENSG00000254647']);
  expect(hydrateAiSearchCandidates(index, { index_checksum: 'stale', candidates: [] }).accepted).toBe(false);
});
