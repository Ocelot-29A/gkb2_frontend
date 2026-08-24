import React from 'react';

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import EmbeddingPortalCard from './EmbeddingPortalCard';

describe('EmbeddingPortalCard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('loads only the manifest and links the fingerprinted preview to the Layer-3 route', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        cell_count: 32952,
        donor_count: 22,
        files: { preview: { path: 'scfm-t-cell.abc123.png' } },
      }),
    });

    render(
      <MemoryRouter>
        <EmbeddingPortalCard
          assetBaseUrl="/t1d-gps-v8"
          embeddingView={{
            title: 'scFM T-cell differentiation',
            manifest_path: 'embeddings/scfm-t-cell-differentiation/manifest.json',
            target_route: '/T1D_GPS/v8/details/scfm-t-cell-differentiation',
          }}
          linkage={{
            edgeCount: 2,
            sourceName: 'CD4-positive T cell + CD8-positive T cell',
            targetName: 'scFM T-cell RNA-side UMAP',
            displayLabel: 'CD4 labels map to KG concepts · CD8 labels map to KG concepts',
            reason: 'CD4 subtype crosswalk. CD8 subtype crosswalk.',
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /open scFM T-cell differentiation/i }).getAttribute('href'))
      .toBe('/T1D_GPS/v8/details/scfm-t-cell-differentiation');
    await waitFor(() => expect(screen.getByAltText(/RNA-side UMAP preview/i).getAttribute('src'))
      .toBe('http://localhost/t1d-gps-v8/embeddings/scfm-t-cell-differentiation/scfm-t-cell.abc123.png'));
    expect(screen.getByText('32,952 cells')).not.toBeNull();
    expect(screen.getByText('22 donors')).not.toBeNull();
    expect(screen.getByTestId('resource-linkage-context')).not.toBeNull();
    expect(screen.getByText(/Linked KG context · 2 connections/i)).not.toBeNull();
    expect(screen.getByText(/CD4-positive T cell \+ CD8-positive T cell/i)).not.toBeNull();
    expect(screen.getByText('CD4 labels map to KG concepts · CD8 labels map to KG concepts')).not.toBeNull();
    expect(screen.getByText('CD4 subtype crosswalk. CD8 subtype crosswalk.')).not.toBeNull();
    expect(screen.getByText(/context only, not biological process evidence/i)).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/t1d-gps-v8/embeddings/scfm-t-cell-differentiation/manifest.json');

    const portalLink = screen.getByRole('link', { name: /open scFM T-cell differentiation/i });
    const minimizeButton = screen.getByRole('button', { name: /minimize scFM T-cell UMAP data view/i });
    expect(within(portalLink).queryByRole('button')).toBeNull();

    fireEvent.click(minimizeButton);
    const restoreButton = screen.getByRole('button', { name: /restore scFM T-cell UMAP data view/i });
    expect(screen.getByTestId('embedding-portal-card').getAttribute('data-state')).toBe('minimized');

    fireEvent.click(restoreButton);
    screen.getByRole('button', { name: /minimize scFM T-cell UMAP data view/i });
    expect(screen.getByTestId('embedding-portal-card').getAttribute('data-state')).toBe('expanded');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('shows compact linkage summaries while retaining full multi-source context', () => {
    render(
      <MemoryRouter>
        <EmbeddingPortalCard
          embeddingView={{
            title: 'scFM T-cell differentiation',
            target_route: '/T1D_GPS/v8/details/scfm-t-cell-differentiation',
          }}
          linkage={{
            edgeCount: 4,
            sourceNameSummary: 'Mapped cell 1 + Mapped cell 2 + 2 more',
            sourceNameFull: 'Mapped cell 1 + Mapped cell 2 + Mapped cell 3 + Mapped cell 4',
            targetName: 'scFM T-cell RNA-side UMAP',
            displayLabelSummary: 'Mapping 1 · Mapping 2 · 2 more',
            displayLabelFull: 'Mapping 1 · Mapping 2 · Mapping 3 · Mapping 4',
            reason: 'Four concrete cell concepts have curated data-view mappings.',
          }}
        />
      </MemoryRouter>,
    );

    const source = screen.getByTestId('resource-linkage-source');
    expect(source.textContent).toBe('Mapped cell 1 + Mapped cell 2 + 2 more → UMAP data view');
    expect(source.getAttribute('title')).toBe(
      'Mapped cell 1 + Mapped cell 2 + Mapped cell 3 + Mapped cell 4 → scFM T-cell RNA-side UMAP',
    );
    const label = screen.getByTestId('resource-linkage-label');
    expect(label.textContent).toBe('Mapping 1 · Mapping 2 · 2 more');
    expect(label.getAttribute('title')).toBe('Mapping 1 · Mapping 2 · Mapping 3 · Mapping 4');
  });

  test('uses generic KG wording when a linked source name is unavailable', () => {
    render(
      <MemoryRouter>
        <EmbeddingPortalCard
          embeddingView={{
            title: 'scFM T-cell differentiation',
            target_route: '/T1D_GPS/v8/details/scfm-t-cell-differentiation',
          }}
          linkage={{
            edgeCount: 1,
            targetName: 'scFM T-cell RNA-side UMAP',
            displayLabel: 'Associated data view',
            reason: 'Curated KG linkage.',
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('resource-linkage-source').textContent)
      .toBe('Linked KG context → UMAP data view');
    expect(screen.queryByText(/T-cell pathway/i)).toBeNull();
  });
});
