import React from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import StandaloneKnowledgeGraph from '../components/StandaloneKnowledgeGraph';
import TCellUmapPage, {
  RelatedPathwayConcepts,
  roundPlotlyLegendPanel,
  UMAP_LEGEND_VISUAL_STYLE,
} from './TCellUmapPage';
import * as umapModel from './tCellUmapModel';

const mockPlotRender = jest.fn();

jest.mock('plotly.js-strict-dist-min', () => ({ version: 'test' }));
jest.mock('react-plotly.js/factory', () => {
  const ReactModule = require('react');
  return () => ReactModule.forwardRef(function MockPlot(props, ref) {
    mockPlotRender(props);
    return ReactModule.createElement('div', {
      ref,
      'data-testid': 'mock-plotly-scattergl',
    });
  });
}, { virtual: true });
jest.mock('../components/StandaloneKnowledgeGraph', () => jest.fn(() => null));

const manifest = {
  schema_version: '1.0.0',
  title: 'scFM T-cell differentiation',
  cell_count: 2,
  donor_count: 22,
  files: {
    points: { path: 'points.abc.json.gz', sha256: 'a'.repeat(64) },
    preview: { path: 'preview.abc.png' },
  },
  categories: {
    subtype: [
      'Naive CD8+ T cell',
      'Memory CD8+ T cell',
      'T Cytotoxic Cell',
      'Naive CD4+ T cell',
      'Memory CD4+ T cell',
      'T Regulatory Cell',
    ],
    lineage: ['CD4', 'CD8', 'Treg'],
    stage: ['Naive', 'Memory', 'Cytotoxic', 'Regulatory'],
    region: ['pln', 'pln_b', 'pln_h'],
    split: ['train', 'val', 'test', 'ood'],
    training_status: ['held out', 'in training'],
    module_set: ['discovery', 'reserved'],
  },
  subtype_order: ['Naive CD8+ T cell', 'Memory CD8+ T cell'],
  subtype_colors: {
    'Naive CD8+ T cell': '#2878D0',
    'Memory CD8+ T cell': '#ED6A2C',
  },
  subtype_counts: {
    'Naive CD8+ T cell': 1,
    'Memory CD8+ T cell': 1,
  },
  maturation_range: [-0.201, 1.207],
  layout: {
    layout_label: 'RNA-side UMAP',
    x_label: 'UMAP 1',
    y_label: 'UMAP 2',
  },
  arrows: [
    {
      id: 'cd8',
      label: 'schematic maturation direction',
      ax: 0,
      ay: 0,
      x: 1,
      y: 1,
    },
    {
      id: 'cd4',
      label: 'schematic maturation direction',
      ax: -1,
      ay: 1,
      x: 2,
      y: -1,
    },
  ],
  kg_context: {
    back_route: '/T1D_GPS/v8/pathways/human-alpha-beta-t-cell-differentiation-and-regulation',
    equivalence_asserted: false,
    not_process_evidence: true,
    relationship: {
      display_label: '6 UMAP cell labels map to KG concepts',
      link_reason: 'Six public T-cell labels crosswalk to concepts in the pathway.',
      link_basis: 'curated_subtype_crosswalk',
      mapped_subtype_count: 6,
      evidence_boundary: 'Context only; not differentiation or mechanism evidence.',
    },
    mappings: [
      {
        subtype: 'Naive CD8+ T cell',
        match_type: 'label_match',
        confidence: 'high',
        equivalence_asserted: false,
        not_process_evidence: true,
        primary_concept: { id: 'CL:0000900', label: 'naive thymus-derived CD8-positive T cell' },
        refinements: [],
        related_states: [],
        note: 'Direct public-label correspondence without asserting ontology equivalence.',
      },
      {
        subtype: 'Memory CD8+ T cell',
        match_type: 'label_match',
        confidence: 'high',
        equivalence_asserted: false,
        not_process_evidence: true,
        primary_concept: { id: 'CL:0000909', label: 'memory CD8-positive T cell' },
        refinements: [{ id: 'CL:0000907', label: 'central memory CD8-positive T cell' }],
        related_states: [],
        note: 'The UMAP category is broader than the pathway refinements.',
      },
      {
        subtype: 'T Cytotoxic Cell',
        match_type: 'closest_public_class',
        confidence: 'moderate',
        equivalence_asserted: false,
        not_process_evidence: true,
        primary_concept: { id: 'CL:0000794', label: 'CD8-positive cytotoxic T cell' },
        refinements: [],
        related_states: [],
        note: 'Closest public class; exact equivalence is not asserted.',
      },
      {
        subtype: 'Naive CD4+ T cell',
        match_type: 'label_match',
        confidence: 'high',
        equivalence_asserted: false,
        not_process_evidence: true,
        primary_concept: { id: 'CL:0000895', label: 'naive thymus-derived CD4-positive T cell' },
        refinements: [],
        related_states: [],
        note: 'Direct public-label correspondence without asserting ontology equivalence.',
      },
      {
        subtype: 'Memory CD4+ T cell',
        match_type: 'label_match',
        confidence: 'high',
        equivalence_asserted: false,
        not_process_evidence: true,
        primary_concept: { id: 'CL:0000897', label: 'memory CD4-positive T cell' },
        refinements: [{ id: 'CL:0000904', label: 'central memory CD4-positive T cell' }],
        related_states: [],
        note: 'The UMAP category is broader than the pathway refinements.',
      },
      {
        subtype: 'T Regulatory Cell',
        match_type: 'closest_public_class',
        confidence: 'qualified',
        equivalence_asserted: false,
        not_process_evidence: true,
        primary_concept: { id: 'CL:0000792', label: 'CD4-positive CD25-positive regulatory T cell' },
        refinements: [],
        related_states: [{ id: 'T1DGPS:CS:000008', label: 'FOXP3-low Treg state' }],
        note: 'Related regulatory class and T1D state; exact equivalence is not asserted.',
      },
    ],
    arrow_coverage: {
      cd8: {
        status: 'partial',
        label: 'CD8 maturation direction',
        detail: 'Downstream memory transitions remain symbolic in the KG.',
        not_process_evidence: true,
      },
      cd4: {
        status: 'not_represented',
        label: 'CD4/Treg maturation direction',
        detail: 'Not represented as a differentiation edge.',
        not_process_evidence: true,
      },
    },
  },
};

const model = {
  schemaVersion: '1.0.0',
  pointCount: 2,
  columns: {
    point_index: [0, 1],
    umap_RNA_1: [0, 1],
    umap_RNA_2: [0, 1],
    subtype: ['Naive CD8+ T cell', 'Memory CD8+ T cell'],
    lineage: ['CD8', 'CD8'],
    stage: ['Naive', 'Memory'],
    region: ['pln', 'pln'],
    maturation_RNA: [-0.201, 1.207],
    maturation_atac: [0.1, 0.9],
    umi: [1000, 2000],
    ncre: [300, 600],
    split: ['test', 'test'],
    training_status: ['held out', 'held out'],
    module_set: ['reserved', 'reserved'],
  },
};

const manifestResponse = () => ({
  ok: true,
  json: async () => manifest,
});

const pointsResponse = () => ({
  ok: true,
  arrayBuffer: async () => new ArrayBuffer(8),
});

const renderPage = () => render(
  <MemoryRouter initialEntries={['/T1D_GPS/v8/details/scfm-t-cell-differentiation']}>
    <TCellUmapPage />
  </MemoryRouter>,
);

describe('TCellUmapPage Layer-3 acceptance behavior', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    mockPlotRender.mockClear();
    StandaloneKnowledgeGraph.mockClear();
    jest.spyOn(umapModel, 'hasWebGlSupport').mockReturnValue(true);
    jest.spyOn(umapModel, 'parseVerifiedPointBundle').mockResolvedValue(model);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('direct route has fixed Back and defaults to safe subtype scattergl traces', async () => {
    global.fetch
      .mockResolvedValueOnce(manifestResponse())
      .mockResolvedValueOnce(pointsResponse());

    renderPage();

    const backLink = screen.getByRole('link', { name: /Back to T-cell differentiation/i });
    expect(backLink.getAttribute('href'))
      .toBe('/T1D_GPS/v8/pathways/human-alpha-beta-t-cell-differentiation-and-regulation');
    await waitFor(() => expect(mockPlotRender).toHaveBeenCalled());

    const defaultPlot = mockPlotRender.mock.calls.at(-1)[0];
    expect(defaultPlot.layout.showlegend).toBe(true);
    expect(defaultPlot.layout.uirevision).toBe('scfm-rna-umap-v1');
    expect(defaultPlot.className).toBe('scfm-t-cell-umap-plot');
    expect(defaultPlot.layout.margin).toEqual({ l: 84, r: 56, t: 48, b: 78 });
    expect(defaultPlot.layout.legend).toMatchObject({
      x: 0.985,
      xanchor: 'right',
      y: 0.975,
      yanchor: 'top',
      orientation: 'v',
      bgcolor: 'rgba(255,253,248,0.97)',
      bordercolor: '#A7BBB5',
      borderwidth: 1,
      font: {
        color: UMAP_LEGEND_VISUAL_STYLE.textColor,
        family: UMAP_LEGEND_VISUAL_STYLE.fontFamily,
        size: UMAP_LEGEND_VISUAL_STYLE.fontSize,
        weight: UMAP_LEGEND_VISUAL_STYLE.fontWeight,
      },
      itemsizing: 'constant',
      itemwidth: 42,
      itemclick: 'toggle',
      itemdoubleclick: 'toggleothers',
    });
    expect(defaultPlot.layout.legend).not.toHaveProperty('title');
    expect(defaultPlot.layout.xaxis.title).toMatchObject({
      text: 'UMAP 1',
      font: { color: '#243E3A', size: 18 },
      standoff: 14,
    });
    expect(defaultPlot.layout.yaxis.title).toMatchObject({
      text: 'UMAP 2',
      font: { color: '#243E3A', size: 18 },
      standoff: 14,
    });
    expect(defaultPlot.layout.shapes[0]).toMatchObject({
      type: 'path',
      xref: 'x',
      yref: 'y',
      fillcolor: umapModel.MATURATION_ARROW_STYLE.color,
      opacity: umapModel.MATURATION_ARROW_STYLE.opacity,
      line: { color: umapModel.MATURATION_ARROW_STYLE.color, width: 0 },
      layer: 'above',
    });
    expect(defaultPlot.layout.shapes).toHaveLength(2);
    expect(defaultPlot.layout.shapes.every((shape) => (
      shape.type === 'path'
      && shape.path.endsWith(' Z')
      && shape.xref === 'x'
      && shape.yref === 'y'
    ))).toBe(true);
    expect(defaultPlot.layout).not.toHaveProperty('annotations');
    const directionLegend = screen.getByTestId('maturation-direction-legend');
    expect(directionLegend.getAttribute('aria-label'))
      .toBe('Schematic maturation direction legend');
    expect(screen.getByText('schematic maturation direction')).toBeTruthy();
    expect(screen.queryByText('Arrows inside UMAP')).toBeNull();
    const directionLabel = screen.getByText('schematic maturation direction');
    const exampleArrow = screen.getByRole('img', { name: 'Example arrow pointing down and right' });
    expect(directionLabel.nextElementSibling).toBe(exampleArrow);
    const arrowShape = screen.getByTestId('maturation-direction-arrow-shape');
    expect(exampleArrow.getAttribute('viewBox')).toBe('0 0 224 50');
    expect(arrowShape.getAttribute('d')).toMatch(/Z\s*$/);
    expect(arrowShape.getAttribute('d')).toBe(
      umapModel.buildSolidArrowPath(
        { ax: 8, ay: 10, x: 216, y: 31 },
        { shaftHalfWidth: 4.5, headLength: 24, headHalfWidth: 15 },
      ),
    );
    expect(arrowShape.getAttribute('fill')).toBe(umapModel.MATURATION_ARROW_STYLE.color);
    expect(arrowShape.getAttribute('stroke')).toBe('none');
    expect(Number(arrowShape.getAttribute('opacity')))
      .toBe(umapModel.MATURATION_ARROW_STYLE.opacity);
    expect(exampleArrow.querySelectorAll('line')).toHaveLength(0);
    const directionLabelStyle = window.getComputedStyle(directionLabel);
    expect(directionLabelStyle.fontFamily.replace(/\s+/g, ''))
      .toBe(UMAP_LEGEND_VISUAL_STYLE.fontFamily.replace(/\s+/g, ''));
    expect(directionLabelStyle.fontSize).toBe(`${defaultPlot.layout.legend.font.size}px`);
    expect(Number(directionLabelStyle.fontWeight)).toBe(defaultPlot.layout.legend.font.weight);
    expect(directionLabelStyle.color).toBe('rgb(36, 62, 58)');
    const directionStyle = window.getComputedStyle(directionLegend);
    expect(directionStyle.position).toBe('absolute');
    expect(directionStyle.borderStyle).toBe('solid');
    expect(directionStyle.borderWidth).toBe('1px');
    expect(directionStyle.borderRadius).toBe('12px');
    expect(directionLegend.parentElement.contains(screen.getByTestId('mock-plotly-scattergl')))
      .toBe(true);

    const nativeLegend = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nativeLegend.setAttribute('class', 'legend');
    const nativeLegendBackground = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    nativeLegendBackground.setAttribute('class', 'bg');
    nativeLegend.appendChild(nativeLegendBackground);
    screen.getByTestId('mock-plotly-scattergl').appendChild(nativeLegend);
    act(() => defaultPlot.onAfterPlot());
    expect(nativeLegendBackground.getAttribute('rx')).toBe('12');
    expect(nativeLegendBackground.getAttribute('ry')).toBe('12');
    expect(defaultPlot.data).toHaveLength(2);
    expect(defaultPlot.data.every((trace) => trace.type === 'scattergl')).toBe(true);

    const hoverTemplate = defaultPlot.data[0].hovertemplate;
    [
      'Point index',
      'Lineage',
      'Stage',
      'Region',
      'RNA maturation',
      'ATAC maturation',
      'UMI',
      'nCRE',
    ].forEach((label) => expect(hoverTemplate).toContain(label));
    expect(hoverTemplate).not.toMatch(/\b(donor|barcode|diagnosis|group|age|sex|aab)\b/i);
    expect(defaultPlot.data[0].customdata[0]).toEqual([
      0, 'Naive CD8+ T cell', 'CD8', 'Naive', 'pln', -0.201, 0.1, 1000, 300,
    ]);
    expect(defaultPlot.config).toMatchObject({
      displaylogo: false,
      showLink: false,
    });
    expect(defaultPlot.config.modeBarButtonsToRemove).toEqual(expect.arrayContaining([
      'sendDataToCloud',
      'editInChartStudio',
    ]));
    expect(StandaloneKnowledgeGraph).not.toHaveBeenCalled();
    expect(document.querySelector('[class*="cytoscape"]')).toBeNull();

    const correspondence = screen.getByRole('heading', { name: 'Related pathway concepts' });
    expect(correspondence).toBeTruthy();
    expect(screen.getByText(/not ontology equivalence or differentiation evidence/i)).toBeTruthy();
    expect(screen.getByTestId('kg-data-view-relationship')).toBeTruthy();
    expect(screen.getByText('6 UMAP cell labels map to KG concepts')).toBeTruthy();
    expect(screen.getByText('Six public T-cell labels crosswalk to concepts in the pathway.'))
      .toBeTruthy();
    expect(screen.getByText('Context only; not differentiation or mechanism evidence.'))
      .toBeTruthy();
    expect(screen.getByText('Schematic-arrow coverage in the KG')).toBeTruthy();
    expect(screen.getByText('Downstream memory transitions remain symbolic in the KG.'))
      .toBeTruthy();
    expect(screen.getByText('Not represented as a differentiation edge.')).toBeTruthy();
    const memoryLink = screen.getByRole('link', {
      name: /Show memory CD8-positive T cell in the T-cell pathway/i,
    });
    expect(memoryLink.getAttribute('href')).toBe(
      '/T1D_GPS/v8/pathways/human-alpha-beta-t-cell-differentiation-and-regulation?focus=CL%3A0000909',
    );
    const tregStateLink = screen.getByRole('link', {
      name: /Show Related T1D state: FOXP3-low Treg state in the T-cell pathway/i,
    });
    expect(tregStateLink.getAttribute('href')).toContain('focus=T1DGPS%3ACS%3A000008');
  });

  test('renders the correspondence panel separately from Plotly without subscribing to hover', () => {
    render(
      <MemoryRouter>
        <RelatedPathwayConcepts kgContext={manifest.kg_context} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('article')).toHaveLength(6);
    expect(screen.getAllByText('closest public class')).toHaveLength(2);
    expect(screen.getAllByText('KG refinement:')).toHaveLength(2);
    expect(mockPlotRender).not.toHaveBeenCalled();
  });

  test('rounds the native Plotly legend panel without replacing its interaction', () => {
    const root = document.createElement('div');
    root.innerHTML = '<svg><g class="legend"><rect class="bg" /></g></svg>';
    expect(roundPlotlyLegendPanel(root)).toBe(true);
    const background = root.querySelector('.legend .bg');
    expect(background.getAttribute('rx')).toBe('12');
    expect(background.getAttribute('ry')).toBe('12');
    expect(roundPlotlyLegendPanel(document.createElement('div'))).toBe(false);
  });

  test('maturation toggle shows an unclipped continuous colorbar and preserves zoom revision', async () => {
    global.fetch
      .mockResolvedValueOnce(manifestResponse())
      .mockResolvedValueOnce(pointsResponse());
    renderPage();
    await waitFor(() => expect(mockPlotRender).toHaveBeenCalled());
    const subtypePlot = mockPlotRender.mock.calls.at(-1)[0];
    const subtypeRevision = subtypePlot.layout.uirevision;
    const subtypeShapes = subtypePlot.layout.shapes;

    fireEvent.click(screen.getByRole('button', { name: 'Maturation coordinate' }));
    await waitFor(() => {
      const latest = mockPlotRender.mock.calls.at(-1)[0];
      expect(latest.data).toHaveLength(1);
      expect(latest.data[0].marker.colorbar.title.text).toBe('RNA maturation');
    });

    const maturationPlot = mockPlotRender.mock.calls.at(-1)[0];
    expect(maturationPlot.layout.showlegend).toBe(false);
    expect(maturationPlot.layout.uirevision).toBe(subtypeRevision);
    expect(maturationPlot.layout.shapes).toEqual(subtypeShapes);
    expect(maturationPlot.data[0].marker.cmin).toBe(-0.201);
    expect(maturationPlot.data[0].marker.cmax).toBe(1.207);
    expect(maturationPlot.data[0].marker.color).toEqual([-0.201, 1.207]);
    expect(maturationPlot.data[0].marker.colorbar).toMatchObject({
      title: {
        text: 'RNA maturation',
        font: { color: '#243E3A', size: 15 },
        side: 'right',
      },
      tickfont: { color: '#304B49', size: 12 },
      thickness: 22,
      outlinecolor: '#78908A',
      outlinewidth: 1,
    });
    expect(screen.getByTestId('maturation-direction-legend')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Example arrow pointing down and right' }))
      .toBeTruthy();
  });

  test('WebGL failure skips the point payload and shows the manifest preview', async () => {
    umapModel.hasWebGlSupport.mockReturnValue(false);
    global.fetch.mockResolvedValueOnce(manifestResponse());
    renderPage();

    expect(await screen.findByText(/WebGL is unavailable/i)).not.toBeNull();
    const preview = screen.getByRole('img');
    expect(preview.getAttribute('src'))
      .toBe('http://localhost/t1d-gps-v8/embeddings/scfm-t-cell-differentiation/preview.abc.png');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(umapModel.parseVerifiedPointBundle).not.toHaveBeenCalled();
    expect(mockPlotRender).not.toHaveBeenCalled();
  });

  test.each([
    {
      label: 'payload HTTP',
      pointResult: { ok: false, status: 503 },
      parseError: null,
      expected: /Failed to load UMAP point bundle: 503/i,
    },
    {
      label: 'checksum',
      pointResult: pointsResponse(),
      parseError: new Error('UMAP point bundle checksum validation failed.'),
      expected: /checksum validation failed/i,
    },
  ])('$label failure shows the same static preview and error', async ({
    pointResult,
    parseError,
    expected,
  }) => {
    if (parseError) umapModel.parseVerifiedPointBundle.mockRejectedValueOnce(parseError);
    global.fetch
      .mockResolvedValueOnce(manifestResponse())
      .mockResolvedValueOnce(pointResult);
    renderPage();

    expect(await screen.findByText(expected)).not.toBeNull();
    expect(screen.getByRole('img').getAttribute('src'))
      .toBe('http://localhost/t1d-gps-v8/embeddings/scfm-t-cell-differentiation/preview.abc.png');
    expect(mockPlotRender).not.toHaveBeenCalled();
    expect(StandaloneKnowledgeGraph).not.toHaveBeenCalled();
  });
});
