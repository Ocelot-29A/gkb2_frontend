import React from 'react';

import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import GraphViewerSearchDialog from './GraphViewerSearchDialog';

const index = {
  schema_version: '1.0.0',
  index_checksum: 'fixture-checksum',
  records: [
    {
      search_id: 'ENSG00000254647',
      canonical_id: 'ENSG00000254647',
      name: 'INS',
      symbol: 'INS',
      entity_type: 'Gene',
      aliases: ['insulin'],
      cross_references: ['HGNC:6081'],
      description: 'Insulin gene expressed by pancreatic beta cells.',
      sources: [{ data_source: 'Ensembl' }],
      provenance_status: 'source_backed',
      generated: false,
      default_location_id: 'details/beta::ENSG00000254647',
      locations: [
        {
          location_id: 'details/beta::ENSG00000254647',
          view_id: 'details/beta',
          route: '/T1D_GPS/v7/details/beta',
          node_id: 'ENSG00000254647',
          view_title: 'Beta-cell detail',
          organ: 'Pancreatic islet',
          layer: 3,
          is_primary: true,
        },
      ],
    },
    {
      search_id: 'T1D:STATE:katp',
      canonical_id: 'T1D:STATE:katp',
      name: 'KATP closure and calcium entry',
      entity_type: 'State',
      aliases: [],
      description: 'Generated display scaffold.',
      sources: [{ data_source: 'T1D Immune GPS V7 required-mechanism registry' }],
      provenance_status: 'generated_fallback',
      generated: true,
      generated_reason: 'No exact accepted state node was available.',
      locations: [
        {
          location_id: 'details/beta::state',
          view_id: 'details/beta',
          route: '/T1D_GPS/v7/details/beta',
          node_id: 'T1D:STATE:katp',
          view_title: 'Beta-cell detail',
          organ: 'Pancreatic islet',
          layer: 3,
          is_primary: true,
        },
      ],
    },
  ],
};

test('shows readable provenance and opens the selected graph occurrence', () => {
  const onOpenResult = jest.fn();
  render(
    <GraphViewerSearchDialog
      open
      index={index}
      indexUrl="/t1d-gps-v7/search-index.json"
      currentViewId="overview"
      onClose={jest.fn()}
      onOpenResult={onOpenResult}
    />,
  );
  fireEvent.change(screen.getByPlaceholderText('Search INS, CXCR3, beta-cell killing, WP661…'), {
    target: { value: 'INS' },
  });
  expect(screen.getByText('Source-backed')).toBeTruthy();
  expect(screen.getByText(/Insulin gene expressed/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Machine-readable JSON' }).getAttribute('href'))
    .toBe('/t1d-gps-v7/search-index.json');
  fireEvent.click(screen.getByRole('button', { name: 'Open & focus' }));
  expect(onOpenResult).toHaveBeenCalledWith(
    expect.objectContaining({ search_id: 'ENSG00000254647' }),
    expect.objectContaining({ node_id: 'ENSG00000254647' }),
  );
});

test('marks generated fallbacks as not evidence and supports Enter navigation', () => {
  const onOpenResult = jest.fn();
  render(
    <GraphViewerSearchDialog
      open
      index={index}
      currentViewId="overview"
      onClose={jest.fn()}
      onOpenResult={onOpenResult}
    />,
  );
  const input = screen.getByPlaceholderText('Search INS, CXCR3, beta-cell killing, WP661…');
  fireEvent.change(input, { target: { value: 'KATP' } });
  expect(screen.getByText('Generated fallback — not evidence')).toBeTruthy();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onOpenResult).toHaveBeenCalledWith(
    expect.objectContaining({ search_id: 'T1D:STATE:katp' }),
    expect.objectContaining({ node_id: 'T1D:STATE:katp' }),
  );
});

test('accepts only checksum-matched AI reranking of indexed search IDs', async () => {
  const searchProvider = jest.fn().mockResolvedValue({
    ranker: 'ai-rerank-v1',
    index_checksum: 'fixture-checksum',
    candidates: [
      { search_id: 'T1D:STATE:katp', score: 0.99, explanation: 'Mechanistic phrase match' },
      { search_id: 'invented-entity', score: 1, explanation: 'Must be rejected' },
    ],
  });
  render(
    <GraphViewerSearchDialog
      open
      index={index}
      currentViewId="overview"
      onClose={jest.fn()}
      onOpenResult={jest.fn()}
      searchProvider={searchProvider}
    />,
  );
  fireEvent.change(screen.getByPlaceholderText('Search INS, CXCR3, beta-cell killing, WP661…'), {
    target: { value: 'calcium entry' },
  });
  expect(await screen.findByText(/Mechanistic phrase match/)).toBeTruthy();
  expect(screen.queryByText('invented-entity')).toBeNull();
  expect(searchProvider).toHaveBeenCalledWith(expect.objectContaining({
    schema_version: 't1d-gps-ai-search-request-v1',
    index_checksum: 'fixture-checksum',
  }));
});

test('falls back to lexical matches when an AI response has a stale checksum', async () => {
  const searchProvider = jest.fn().mockResolvedValue({
    ranker: 'ai-rerank-v1',
    index_checksum: 'stale-index',
    candidates: [{ search_id: 'T1D:STATE:katp', score: 1 }],
  });
  render(
    <GraphViewerSearchDialog
      open
      index={index}
      currentViewId="overview"
      onClose={jest.fn()}
      onOpenResult={jest.fn()}
      searchProvider={searchProvider}
    />,
  );
  fireEvent.change(screen.getByPlaceholderText('Search INS, CXCR3, beta-cell killing, WP661…'), {
    target: { value: 'INS' },
  });
  expect(await screen.findByText(/AI ranking did not match this index/)).toBeTruthy();
  expect(screen.getByText(/Insulin gene expressed/)).toBeTruthy();
});
