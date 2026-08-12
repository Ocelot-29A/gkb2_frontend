import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import GraphViewerDataExportDialog, {
  buildGraphPreviewRows,
  buildVisibleGraphExport,
  GRAPH_DATA_DIALOG_PAPER_SX,
} from './GraphViewerDataExportDialog';

const graphData = {
  release_id: 't1d-v6',
  nodes: [
    {
      '~id': 'cell-1',
      '~labels': ['Cell'],
      '~properties': {
        id: 'CL:0000451',
        name: 'Dendritic cell',
        description: { role: 'Presents antigen', states: ['migratory', 'activated'] },
        data_source: 'Cell Ontology',
      },
    },
    {
      '~id': 'cell-2',
      '~labels': ['Cell'],
      '~properties': {
        id: 'CL:0000625',
        name: 'CD8 T cell',
        description: 'Recognizes peptide–HLA complexes',
        data_source: 'Cell Ontology',
      },
    },
  ],
  edges: [
    {
      '~id': 'edge-1',
      '~start': 'cell-1',
      '~end': 'cell-2',
      '~type': 'PRESENTS_TO',
      '~properties': {
        evidence_strength: { level: 'curated', assay: ['MHC ligand', 'T-cell'] },
        data_source: 'IEDB',
      },
    },
  ],
};

describe('graph data export helpers', () => {
  test('filters deleted records and incident relationships while preserving payload metadata', () => {
    const visible = buildVisibleGraphExport(graphData, new Set(['cell-1']));
    expect(visible.release_id).toBe('t1d-v6');
    expect(visible.nodes.map((node) => node['~id'])).toEqual(['cell-2']);
    expect(visible.edges).toEqual([]);
  });

  test('resolves relationship endpoints and safely formats structured data', () => {
    const rows = buildGraphPreviewRows(graphData);
    expect(rows.nodes[0].description).toContain('Presents antigen');
    expect(rows.nodes[0].description).not.toContain('[object Object]');
    expect(rows.edges[0]).toEqual(expect.objectContaining({
      source: 'Dendritic cell',
      relationship: 'PRESENTS_TO',
      target: 'CD8 T cell',
      dataSource: 'IEDB',
    }));
    expect(rows.edges[0].evidence).toContain('MHC ligand');
  });

  test('uses a majority-screen dialog contract', () => {
    expect(GRAPH_DATA_DIALOG_PAPER_SX).toEqual(expect.objectContaining({
      width: '92vw',
      height: '86vh',
      maxWidth: 'none',
    }));
  });
});

describe('GraphViewerDataExportDialog', () => {
  test('starts with a readable node table and downloads only from the footer action', () => {
    const onDownload = jest.fn();
    render(
      <GraphViewerDataExportDialog
        open
        graphData={graphData}
        onClose={jest.fn()}
        onDownload={onDownload}
        downloadLimit={30}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Graph content' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Nodes (2)' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('table', { name: 'Graph nodes' })).toBeTruthy();
    expect(screen.getByText('Dendritic cell')).toBeTruthy();
    expect(screen.getByText(/Presents antigen/)).toBeTruthy();
    expect(onDownload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Download JSON' }));
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledWith(graphData);
  });

  test('shows relationship names and the complete raw JSON in separate tabs', () => {
    render(
      <GraphViewerDataExportDialog
        open
        graphData={graphData}
        onClose={jest.fn()}
        onDownload={jest.fn()}
        downloadLimit={30}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Relationships (1)' }));
    expect(screen.getByRole('table', { name: 'Graph relationships' })).toBeTruthy();
    expect(screen.getByText('PRESENTS_TO')).toBeTruthy();
    expect(screen.getAllByText('Dendritic cell').length).toBeGreaterThan(0);
    expect(screen.getByText('IEDB')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Raw JSON' }));
    const rawPanel = screen.getByRole('tabpanel');
    expect(rawPanel.textContent).toContain('"~labels": [');
    expect(rawPanel.textContent).toContain('"role": "Presents antigen"');
    expect(rawPanel.textContent).toContain('"release_id": "t1d-v6"');
  });

  test('allows inspection but disables download above the active graph limit', () => {
    render(
      <GraphViewerDataExportDialog
        open
        graphData={graphData}
        onClose={jest.fn()}
        onDownload={jest.fn()}
        downloadDisabled
        downloadLimit={1}
      />,
    );
    expect(screen.getByText(/JSON download is limited to 1 visible nodes/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download JSON' }).disabled).toBe(true);
    expect(screen.getByText('Dendritic cell')).toBeTruthy();
  });

  test('renders all preview tabs without any download control in review mode', () => {
    render(
      <GraphViewerDataExportDialog
        open
        graphData={graphData}
        onClose={jest.fn()}
        onDownload={jest.fn()}
        allowDownload={false}
      />,
    );
    expect(screen.getByText(/read-only content preview/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Download JSON' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Raw JSON' })).toBeTruthy();
    expect(screen.getByText('Dendritic cell')).toBeTruthy();
  });
});
