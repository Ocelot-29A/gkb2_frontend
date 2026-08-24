import { render } from '@testing-library/react';

import {
  buildFindConnectionCypher,
  buildDataNavigationStyles,
  buildViewNodeStyles,
  buildMechanismTitleNodes,
  getNodeRenderFontSize,
  buildPreviousLayout,
  createExactGraphCapture,
  edgeLabelToCytoscapeData,
  edgeRouteToCytoscapeData,
  extendOccurrenceProjection,
  getCanonicalNodeLabel,
  getNodeType,
  getNodeLabel,
  resolveLegendPanelLayout,
  resolveLegendToggleDirection,
  resolveMechanismTitleSlot,
  getEdgeTextBackplateData,
  getGenomeLaneModelYs,
  getImageNodeBackgroundData,
  getImageNodeOpacityData,
  InfocardData,
  InfocardMenu,
  getNodeBodyPreviewData,
  getNodePrimaryAction,
  getNodeTextBackplateData,
  getRasterImageOpacityStyle,
  getCanonicalVisibleNodeIds,
  getCanvasOverlayAwarePan,
  getNewCanonicalCandidateNodeIds,
  GRAPH_QUERY_ID_PROPERTY,
  graphHasDataNavigationEdge,
  graphHasDataResource,
  getCytoscapeEdgeLabel,
  getCytoscapeNodeLabel,
  isExactLinkedViewPreview,
  isHiddenInfoProperty,
  isDirectResourceNavigationNodeData,
  isStrictEdgeMidpointHit,
  isOverflowId,
  mergeExploreNeighborsCypher,
  normalizeEdgeLineStyle,
  projectGraphViewerResultToOccurrences,
  resolveNodeImageUrl,
  resolveInitialFocusNode,
  resolveCanonicalNodeQueryId,
  resolvePreviewAssetUrl,
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

describe('layered presentation helpers', () => {
  test('uses horizontal chevrons for a horizontal legend and vertical chevrons otherwise', () => {
    expect(resolveLegendToggleDirection(true, false)).toBe('left');
    expect(resolveLegendToggleDirection(true, true)).toBe('right');
    expect(resolveLegendToggleDirection(false, false)).toBe('down');
    expect(resolveLegendToggleDirection(false, true)).toBe('up');
  });

  test('keeps the default legend vertical and supports a view-specific horizontal bottom-right legend', () => {
    expect(resolveLegendPanelLayout({}, {
      layeredNavigationEnabled: true,
      canvasOverlayPresent: true,
    })).toEqual(expect.objectContaining({
      horizontal: false,
      right: 424,
      bottom: 24,
      width: 208,
      showConnections: true,
      dataResourceLabel: 'Data view',
    }));

    expect(resolveLegendPanelLayout({
      legend_layout: {
        placement: 'below-data-view',
        orientation: 'horizontal',
        right: 88,
        bottom: 24,
        width: 620,
        show_connections: false,
        data_resource_label: 'Data view',
      },
    }, {
      layeredNavigationEnabled: true,
      canvasOverlayPresent: true,
    })).toEqual(expect.objectContaining({
      horizontal: true,
      placement: 'below-data-view',
      right: 88,
      bottom: 24,
      width: 620,
      showConnections: false,
      dataResourceLabel: 'Data view',
    }));
  });

  test('resolves versioned image assets against local and deployed fixture roots', () => {
    expect(resolveNodeImageUrl(
      '/t1d-gps-v8/assets/trialnet-25-logo.svg',
      'https://pank-s3-to-share.s3.us-east-1.amazonaws.com/t1d-gps-v8',
    )).toBe('https://pank-s3-to-share.s3.us-east-1.amazonaws.com/t1d-gps-v8/assets/trialnet-25-logo.svg');
    expect(resolveNodeImageUrl(
      '/t1d-gps-v8/assets/trialnet-25-logo.svg',
      '/t1d-gps-v8',
    )).toBe('/t1d-gps-v8/assets/trialnet-25-logo.svg');
    expect(resolveNodeImageUrl(
      '/layeredgraph/assets/thymus-node-v3.png',
      'https://pank-s3-to-share.s3.us-east-1.amazonaws.com/t1d-gps-v8',
    )).toBe('/layeredgraph/assets/thymus-node-v3.png');
  });

  test('honors an explicit empty display label for logo-only nodes', () => {
    expect(getNodeLabel({
      '~id': 'EXT:TRIALNET',
      '~properties': { name: 'TrialNet', display_label: '' },
    })).toBe('');
  });

  test('creates a compact two-line region tab attached to a group border', () => {
    const nodes = buildMechanismTitleNodes([{
      id: 'cd8', x: 40, y: 200, width: 2000,
      title_lines: ['CD8 DIFFERENTIATION', 'HUMAN T1D STATES'],
      border: '#567F74',
      label_node: {
        mode: 'region_tab_v1', anchor: 'top_right',
        x: 1540, y: 168, width: 840, height: 164,
        shape: 'compact-tag', tip_fraction: 0.12,
        fill: '#D4E1DC', border: '#567F74',
        text_color: '#304B49', font_size: 34,
        title_lines: ['CD8 DIFFERENTIATION', 'HUMAN T1D STATES'],
      },
    }], { mode: 'region_tab_v1', default_shape: 'compact-tag' });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].data.label).toBe('CD8 DIFFERENTIATION\nHUMAN T1D STATES');
    expect(nodes[0].data.mechanismTitle).toBe('true');
    expect(nodes[0].data.mechanismTitleShape).toBe('polygon');
    expect(nodes[0].data.mechanismTitleVariant).toBe('compact-tag');
    expect(nodes[0].data.renderWidth).toBe(420);
    expect(nodes[0].position).toEqual({ x: 770, y: 168 });
  });

  test('resolves all region title positions from fixed perimeter slots', () => {
    const region = { x: 100, y: 200, width: 1000, height: 600 };
    const common = {
      position_mode: 'region-slot-v1', width: 200, height: 100,
      placement: 'inside', offset_x: 20, offset_y: 30,
    };
    expect(resolveMechanismTitleSlot(region, { ...common, anchor_slot: 'top-left' }))
      .toEqual({ x: 220, y: 280 });
    expect(resolveMechanismTitleSlot(region, { ...common, anchor_slot: 'top' }))
      .toEqual({ x: 600, y: 280 });
    expect(resolveMechanismTitleSlot(region, { ...common, anchor_slot: 'top-right' }))
      .toEqual({ x: 980, y: 280 });
    expect(resolveMechanismTitleSlot(region, { ...common, anchor_slot: 'right' }))
      .toEqual({ x: 980, y: 500 });
    expect(resolveMechanismTitleSlot(region, { ...common, anchor_slot: 'bottom-right' }))
      .toEqual({ x: 980, y: 720 });
    expect(resolveMechanismTitleSlot(region, { ...common, anchor_slot: 'bottom' }))
      .toEqual({ x: 600, y: 720 });
    expect(resolveMechanismTitleSlot(region, { ...common, anchor_slot: 'bottom-left' }))
      .toEqual({ x: 220, y: 720 });
    expect(resolveMechanismTitleSlot(region, { ...common, anchor_slot: 'left' }))
      .toEqual({ x: 220, y: 500 });
  });

  test('supports a metadata-scoped font hierarchy by node type', () => {
    const layout = { node_font_size: 30, node_font_sizes_by_type: { Pathway: 46 } };
    expect(getNodeRenderFontSize(layout, 'Pathway')).toBe(46);
    expect(getNodeRenderFontSize(layout, 'CellType')).toBe(30);
  });
});

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

  test('recognizes DataResource as a first-class non-biological display type', () => {
    const node = { '~labels': ['T1DConcept', 'DataResource'] };
    expect(getCanonicalNodeLabel(node)).toBe('DataResource');
    expect(getNodeType(node)).toBe('DataResource');
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

describe('view-local semantic node types', () => {
  test('uses an explicitly colored view-local subtype instead of a broad shared type', () => {
    const node = { '~labels': ['Cell', 'CellState', 'T1DV8Entity'] };

    expect(getNodeType(node)).toBe('Cell');
    expect(getNodeType(node, { Cell: '#91B8C4', CellState: '#C894A3' })).toBe('CellState');
    expect(getNodeType({ '~labels': ['MolecularState', 'T1DConcept'] }, {
      MolecularState: '#B5A6D8',
    })).toBe('MolecularState');
  });

  test('builds exact fill, border, and text styles from view metadata', () => {
    const styles = buildViewNodeStyles(
      { CellState: '#C894A3' },
      { CellState: '#7D3F52' },
      { CellState: '#341A24' },
    );

    expect(styles[0]).toEqual({
      selector: 'node[type = "CellState"][Level = "Core"]',
      style: {
        shape: 'round-rectangle',
        label: 'data(label)',
        'border-width': 1,
        'text-valign': 'center',
        'text-halign': 'center',
        'text-wrap': 'data(labelWrap)',
        'text-max-width': 'data(labelMaxWidth)',
        padding: '4px',
        'background-color': '#C894A3',
        'border-color': '#7D3F52',
        color: '#341A24',
      },
    });
    expect(styles[1].style).toEqual(expect.objectContaining({
      shape: 'round-rectangle',
      label: 'data(label)',
      'text-wrap': 'data(labelWrap)',
    }));
  });
});

describe('GKB 07-18 viewer schema', () => {
  test('uses biology-focused panels for T1D concepts and suppresses rendering internals', () => {
    expect(graphViewerSchema.node_panel_by_label.Process).toBe('t1d_biology');
    expect(graphViewerSchema.node_panel_by_label.Pathway).toBe('t1d_biology');
    expect(graphViewerSchema.node_panel_by_label.Cell).toBe('t1d_biology');
    expect(graphViewerSchema.info_panel_v2.node_profile_by_type.DataResource)
      .toBe('data_resource');
    expect(graphViewerSchema.info_panel_v2.edge_profile_by_type.HAS_ASSOCIATED_DATA_VIEW)
      .toBe('data_navigation');
    const dataNavigationProfile = graphViewerSchema.info_panel_v2.edge_profiles.data_navigation;
    expect(dataNavigationProfile.title.paths[0]).toBe('display_label');
    expect(dataNavigationProfile.annotation.paths[0]).toBe('link_reason');
    expect(dataNavigationProfile.key_statistics[0]).toEqual({
      label: 'Mapped UMAP labels', paths: ['mapped_subtype_count'], format: 'count',
    });
    expect(dataNavigationProfile.detail_sections[0].rows)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ label: 'Link basis', paths: ['link_basis'] }),
        expect.objectContaining({ label: 'Evidence boundary', paths: ['evidence_boundary'] }),
      ]));
    expect(graphViewerSchema.hidden_info_properties).toEqual(expect.arrayContaining([
      'gkb_matches',
      'accepted_kg_annotation',
      'gene_set_annotations_json',
      'preview_cache_key',
      'cell_container_id',
      'labelWrap',
      'renderFontSize',
      'renderEdgeColor',
      'previewNodeImageBorderColor',
      'broaderColor',
      'borderColor',
      'clickable',
      'navigation_action',
    ]));
    expect(isHiddenInfoProperty('preview_render_contract_sha256')).toBe(true);
    expect(isHiddenInfoProperty('source_checksum')).toBe(true);
    expect(isHiddenInfoProperty('v8_overlay_release_id')).toBe(true);
    [
      'x', 'y', 'width', 'height', 'display_lane', 'event_order', 'default_visible',
      'display_instance_id', 'primary_semantic_type', 'node_type', 'layer',
    ].forEach((key) => expect(isHiddenInfoProperty(key)).toBe(true));
    expect(isHiddenInfoProperty('evidence_limitation')).toBe(false);
  });

  test('covers every live Neo4j and curated T1D node label and relationship type', () => {
    expect(Object.keys(graphViewerSchema.nodes).sort()).toEqual([
      'AB_compartment', 'Anatomy', 'Antibody', 'CDS_segments', 'Cell', 'CellType',
      'Cell_or_tissue', 'Chemical', 'Chemokine', 'ChromHMM_state', 'ClinicalStage', 'Coding_element', 'Cytokine',
      'DataResource', 'Deletion', 'ENCODE_feature', 'Enhancer', 'Epigenomic_feature', 'Exon', 'ExternalFactor',
      'FIRE_region', 'GO_term', 'Gene', 'GeneratedFallback', 'Genomic_feature', 'HLA_allele',
      'HLA_allele_group', 'Insertion', 'Intervention', 'Loop', 'LoopAnchor', 'Non_coding_RNA',
      'Non_coding_element', 'Ontology', 'Ontology_term', 'Outcome', 'Pathology', 'Pathway',
      'Peptide', 'Process', 'Promoter', 'Protein', 'Replication_timing', 'SNP', 'SNV',
      'Sequence_variant', 'Structural_variant', 'Super_enhancer', 'TF_binding_motif', 'TSS_segment',
      'ThreeD_structure', 'Transcript', 'UTR_segments', 'Variant', 'cCRE',
    ].sort());
    expect(Object.keys(graphViewerSchema.edges).sort()).toEqual([
      'ACTS_ON', 'ASSOCIATED_WITH_GO', 'BINDS', 'COMPETES_WITH', 'CONFERS_RISK',
      'CONTRIBUTES_TO', 'CO_STIMULATES', 'DIFFERENTIATES_INTO', 'DRAINS_TO', 'ENCODED_BY',
      'ENCODES', 'EQTL_OF', 'EXPRESSES', 'EXPRESS_IN', 'FEEDS_BACK_TO', 'FUNCTION_ANNOTATE',
      'GENERATES', 'GENETIC_INTERACTION', 'GWAS_ASSOCIATION', 'HAS_ANCHOR_A', 'HAS_ANCHOR_B',
      'HAS_ASSOCIATED_DATA_VIEW', 'HAS_CDS_SEGMENT', 'HAS_EXON', 'HAS_STATE', 'HAS_TRANSCRIPT', 'HAS_TSS',
      'HAS_UTR_SEGMENT', 'INDUCES', 'INFECTS', 'INFILTRATES', 'INHIBITS', 'KILLS',
      'LIGAND_RECEPTOR_PAIR', 'LOCATED_IN', 'MAPPING_MAPPING', 'MIGRATES_TO', 'MODIFIES',
      'PHYSICAL_INTERACTION', 'PRESENTS_TO', 'PROVIDES_HELP_TO', 'RECOGNIZES', 'RECRUITS',
      'REGULATE', 'REPLACED_BY', 'RESULTS_IN', 'SECRETES', 'SENSED_BY', 'SUBCLASS_OF',
      'TRANSLATES_TO', 'UNDERGOES', 'UPREGULATES',
    ].sort());
  });

  test('keeps DataResource nodes distinct while data-navigation edges use regular edge styling', () => {
    const styles = buildDataNavigationStyles();
    expect(styles).toHaveLength(1);
    expect(styles[0]).toEqual(expect.objectContaining({
      selector: 'node[type = "DataResource"]',
      style: expect.objectContaining({
        shape: 'round-rectangle',
        'background-color': '#F5F2EA',
        'border-color': '#3F7169',
        'border-width': 4,
        'border-style': 'double',
        'underlay-color': '#79AFA6',
        'underlay-opacity': 0.16,
      }),
    }));
    expect(styles.some(({ selector }) => selector.includes('edge'))).toBe(false);

    const graph = {
      nodes: [{ '~id': 'resource', '~labels': ['DataResource'] }],
      edges: [{
        '~id': 'data-link',
        '~type': 'HAS_ASSOCIATED_DATA_VIEW',
        '~start': 'pathway',
        '~end': 'resource',
      }],
    };
    expect(graphHasDataResource(graph)).toBe(true);
    expect(graphHasDataNavigationEdge(graph)).toBe(true);
    expect(graphHasDataResource(graph, new Set(['resource']))).toBe(false);
    expect(graphHasDataNavigationEdge(graph, new Set(['data-link']))).toBe(false);
    expect(graphHasDataNavigationEdge(graph, new Set(['resource']))).toBe(false);
  });

  test('uses the curated crosswalk reason as the visible data-navigation label', () => {
    expect(getCytoscapeEdgeLabel({
      '~type': 'HAS_ASSOCIATED_DATA_VIEW',
      '~properties': { display_label: '6 UMAP cell labels map to KG concepts' },
    })).toBe('6 UMAP cell labels map to KG concepts');
    expect(getCytoscapeEdgeLabel({
      '~type': 'HAS_ASSOCIATED_DATA_VIEW',
      '~properties': {},
    })).toBe('associated data view');
  });

  test('gives linked UMAP resources an explicit visual-only navigation label', () => {
    const umapResource = {
      '~id': 'T1D:DATARESOURCE:scfm_t_cell_rna_umap',
      '~labels': ['T1DConcept', 'DataResource'],
      '~properties': {
        name: 'scFM T-cell RNA-side UMAP',
        graph_link: '/T1D_GPS/v8/details/scfm-t-cell-differentiation',
        manifest_path: 'embeddings/scfm-t-cell-differentiation/manifest.json',
      },
    };
    expect(getNodeLabel(umapResource)).toBe('scFM T-cell RNA-side UMAP');
    expect(getCytoscapeNodeLabel(umapResource, 'DataResource')).toBe(
      'UMAP DATA VIEW ↗\nscFM T-cell RNA-side UMAP',
    );

    const ordinaryNode = {
      '~id': 'CL:0000909',
      '~labels': ['T1DConcept', 'Cell'],
      '~properties': { name: 'CD8-positive, alpha-beta memory T cell' },
    };
    expect(getCytoscapeNodeLabel(ordinaryNode, 'Cell')).toBe(
      'CD8-positive, alpha-beta memory T cell',
    );
  });

  test('gives DataResource nodes a direct same-origin navigation action', () => {
    expect(isDirectResourceNavigationNodeData({
      type: 'DataResource',
      graph_link: '/T1D_GPS/v8/details/scfm-t-cell-differentiation',
    })).toBe(true);
    expect(isDirectResourceNavigationNodeData({
      type: 'DataResource',
      graph_link: 'https://example.org/private',
    })).toBe(false);
    expect(isDirectResourceNavigationNodeData({
      type: 'Pathway',
      graph_link: '/T1D_GPS/v8/details/scfm-t-cell-differentiation',
    })).toBe(false);
  });

  test('focuses the first deterministic occurrence when metadata names a canonical resource ID', () => {
    const canonicalId = 'T1D:DATARESOURCE:scfm_t_cell_rna_umap';
    const occurrence = (id, canonical_id, resource_view_key) => ({
      id: () => id,
      data: (property) => ({ canonical_id, resource_view_key })[property],
    });
    const cd4Occurrence = occurrence(
      `${canonicalId}@cd4`,
      canonicalId,
      'scfm-t-cell-rna-umap',
    );
    const cd8Occurrence = occurrence(
      `${canonicalId}@cd8`,
      canonicalId,
      'scfm-t-cell-rna-umap',
    );
    const cy = {
      getElementById: jest.fn(() => ({ nonempty: () => false })),
      nodes: jest.fn(() => [cd4Occurrence, cd8Occurrence]),
    };

    expect(resolveInitialFocusNode(cy, canonicalId)).toBe(cd4Occurrence);
  });

  test('uses the registered view key as a canonical-focus fallback for legacy occurrences', () => {
    const canonicalId = 'T1D:DATARESOURCE:scfm_t_cell_rna_umap';
    const occurrence = {
      id: () => `${canonicalId}@cd4`,
      data: (property) => ({
        canonical_id: undefined,
        resource_view_key: 'scfm-t-cell-rna-umap',
      })[property],
    };
    const cy = {
      getElementById: () => ({ nonempty: () => false }),
      nodes: () => [occurrence],
    };

    expect(resolveInitialFocusNode(cy, canonicalId)).toBe(occurrence);
  });
});

describe('hover infocard structured values', () => {
  const acceptedKgAnnotation = {
    name: 'dendritic cell',
    description: 'Antigen-presenting immune cell',
    synonyms: ['DC'],
    organism: 'Homo sapiens',
    source_record_id: 'CL:0000451',
    data_source: 'Cell Ontology',
    data_source_url: 'https://purl.obolibrary.org/obo/CL_0000451',
    data_version: '2026-08-03',
    source_properties: { exact_match: true },
  };

  test('renders a nested accepted KG annotation without passing an object to React', () => {
    let view;
    expect(() => {
      view = render(<InfocardData value={acceptedKgAnnotation} dataKey="accepted_kg_annotation" />);
    }).not.toThrow();
    expect(view.container.textContent).toContain('dendritic cell');
    expect(view.container.textContent).toContain('Homo sapiens');
    expect(view.container.textContent).not.toContain('[object Object]');
  });

  test('renders an object array through the list formatter safely', () => {
    const view = render(<InfocardData value={[acceptedKgAnnotation]} config="list" />);
    expect(view.container.textContent).toContain('CL:0000451');
    expect(view.container.textContent).not.toContain('[object Object]');
  });

  test('shows structured evidence limitations but hides rendering and navigation internals', () => {
    const view = render(<InfocardMenu
      hoveredData={{
        id: 'T1DGPS:CS:000002',
        name: 'TCF7-high stem-like autoreactive CD8 state',
        type: 'CellState',
        evidence_limitation: 'Continuous human pancreatic seeding has not been demonstrated.',
        human_mechanism_status: 'not_established',
        evidence_assessments: [{ species: 'NOD mouse', status: 'model_support_only' }],
        broaderColor: '#EFE3C0',
        navigation_action: 'Show all data',
        preview_target_graph_sha256: 'abc123',
        x: 12345.678,
        y: 23456.789,
        width: 34567.891,
        height: 45678.912,
        display_lane: 'immune-islet interface',
        event_order: 7,
        default_visible: true,
        display_instance_id: 'T1DGPS:CS:000002@detail',
        primary_semantic_type: 'CellState',
        node_type: 'islet_event',
        layer: 3,
      }}
    />);

    expect(view.container.textContent).toContain('Evidence limitation');
    expect(view.container.textContent).toContain('not_established');
    expect(view.container.textContent).toContain('NOD mouse');
    expect(view.container.textContent).not.toContain('Broader Color');
    expect(view.container.textContent).not.toContain('Show all data');
    expect(view.container.textContent).not.toContain('abc123');
    expect(view.container.textContent).not.toContain('Display Lane');
    expect(view.container.textContent).not.toContain('Event Order');
    expect(view.container.textContent).not.toContain('Default Visible');
    expect(view.container.textContent).not.toContain('Display Instance Id');
    expect(view.container.textContent).not.toContain('Primary Semantic Type');
    expect(view.container.textContent).not.toContain('Node Type');
    expect(view.container.textContent).not.toContain('Layer');
    expect(view.container.textContent).not.toContain('12345.678');
    expect(view.container.textContent).not.toContain('23456.789');
    expect(view.container.textContent).not.toContain('34567.891');
    expect(view.container.textContent).not.toContain('45678.912');
    expect(view.container.textContent).not.toContain('[object Object]');
  });
});

describe('interaction query helpers', () => {
  test('merges repeated explores of the same node by adding limits', () => {
    const firstQuery = mergeExploreNeighborsCypher([], 'node-1');
    const mergedQuery = mergeExploreNeighborsCypher(firstQuery, 'node-1');

    expect(mergedQuery).toHaveLength(1);
    expect(mergedQuery[0].query).toContain('LIMIT 20');
  });

  test('uses canonical IDs for occurrence-backed Explore and Find queries', () => {
    const selectedOccurrence = {
      id: () => 'CL:0000625-2',
      data: (property) => ({
        canonical_id: 'CL:0000625',
        viewer_occurrence_of: 'CL:0000625',
      })[property],
    };
    const graphData = {
      nodes: [
        {
          '~id': 'CL:0000625-1',
          '~properties': { canonical_id: 'CL:0000625' },
        },
        {
          '~id': 'CL:0000625-2',
          '~properties': { canonical_id: 'CL:0000625' },
        },
        {
          '~id': 'ENSG00000148737-1',
          '~properties': { canonical_id: 'ENSG00000148737' },
        },
      ],
    };

    const queryNodeId = resolveCanonicalNodeQueryId(selectedOccurrence, selectedOccurrence.id());
    const canonicalVisibleIds = getCanonicalVisibleNodeIds(
      graphData,
      new Set(['ENSG00000148737-1']),
    );
    const explore = mergeExploreNeighborsCypher([], queryNodeId)[0].query;
    const find = buildFindConnectionCypher(queryNodeId, Array.from(canonicalVisibleIds)).query;

    expect(queryNodeId).toBe('CL:0000625');
    expect(canonicalVisibleIds).toEqual(new Set(['CL:0000625']));
    expect(explore).toContain('WITH "CL:0000625" AS node_id');
    expect(explore).not.toContain('CL:0000625-2');
    expect(find).toContain('WITH "CL:0000625" AS selected_id');
    expect(find).toContain('["CL:0000625"] AS node_ids');
    expect(find).not.toContain('CL:0000625-1');
    expect(find).not.toContain('CL:0000625-2');

    const candidateGraphData = {
      nodes: [
        {
          '~id': 'CL:0000625',
          '~properties': { canonical_id: 'CL:0000625' },
        },
        {
          '~id': 'ENSG00000148737',
          '~properties': { canonical_id: 'ENSG00000148737' },
        },
        {
          '~id': 'ENSG00000148737-duplicate',
          '~properties': { canonical_id: 'ENSG00000148737' },
        },
      ],
    };
    expect(getNewCanonicalCandidateNodeIds(candidateGraphData, canonicalVisibleIds))
      .toEqual(['ENSG00000148737']);
  });

  test('prefers the explicit DB query identity when canonical identity differs', () => {
    const selectedOccurrence = {
      id: () => 'CL:0000625-2',
      data: (property) => ({
        [GRAPH_QUERY_ID_PROPERTY]: 'neo4j-node-625',
        canonical_id: 'CL:0000625',
      })[property],
    };

    expect(resolveCanonicalNodeQueryId(selectedOccurrence, selectedOccurrence.id()))
      .toBe('neo4j-node-625');
    expect(isHiddenInfoProperty(GRAPH_QUERY_ID_PROPERTY)).toBe(true);
  });

  test('projects through query_id without conflating semantic canonical and DB identity', () => {
    const existing = {
      graphData: {
        nodes: [{
          '~id': 'DISPLAY:CELL-1',
          '~labels': ['Cell'],
          '~properties': {
            query_id: 'DB:NODE:625',
            canonical_id: 'CL:0000625',
            viewer_occurrence: true,
            viewer_occurrence_index: 1,
          },
        }],
        edges: [],
      },
      coordData: { 'DISPLAY:CELL-1': { x: 10, y: 20 } },
    };
    const rawResult = {
      graphData: {
        nodes: [
          {
            '~id': 'DB:NODE:625',
            '~labels': ['Cell'],
            '~properties': { query_id: 'DB:NODE:625', canonical_id: 'CL:0000625' },
          },
          { '~id': 'DB:NODE:NEW', '~labels': ['Gene'], '~properties': {} },
        ],
        edges: [{
          '~id': 'DB:EDGE:NEW',
          '~type': 'EXPRESSES',
          '~start': 'DB:NODE:625',
          '~end': 'DB:NODE:NEW',
          '~properties': {},
        }],
      },
      coordData: { 'DB:NODE:625': { x: 100, y: 200 } },
    };

    const projected = projectGraphViewerResultToOccurrences(
      rawResult,
      existing,
      { exactNodeIds: ['DISPLAY:CELL-1'] },
    );
    expect(projected.graphData.nodes.map((node) => node['~id'])).toEqual([
      'DB:NODE:NEW',
      'DISPLAY:CELL-1',
    ]);
    expect(projected.graphData.edges[0]).toEqual(expect.objectContaining({
      '~start': 'DISPLAY:CELL-1',
      '~end': 'DB:NODE:NEW',
    }));
  });

  test('projects bare query records onto stable viewer occurrences deterministically', () => {
    const occurrenceNode = (id, canonicalId, index, role) => ({
      '~id': id,
      '~labels': ['Cell'],
      '~properties': {
        id,
        canonical_id: canonicalId,
        viewer_occurrence: true,
        viewer_occurrence_of: canonicalId,
        viewer_occurrence_index: index,
        viewer_occurrence_role: role,
      },
    });
    const occurrenceEdge = (id, canonicalId, index, start, end) => ({
      '~id': id,
      '~type': 'RELATED_TO',
      '~start': start,
      '~end': end,
      '~properties': {
        id,
        canonical_id: canonicalId,
        viewer_occurrence: true,
        viewer_occurrence_of: canonicalId,
        viewer_occurrence_index: index,
      },
    });
    const existing = {
      graphData: {
        nodes: [
          occurrenceNode('CELL:A-1', 'CELL:A', 1, 'first_lane'),
          occurrenceNode('CELL:A-2', 'CELL:A', 2, 'second_lane'),
          // Deliberately reverse B in source order: occurrence_index still wins.
          occurrenceNode('CELL:B-2', 'CELL:B', 2, 'second_lane'),
          occurrenceNode('CELL:B-1', 'CELL:B', 1, 'first_lane'),
        ],
        edges: [
          occurrenceEdge('EDGE:AB-1', 'EDGE:AB', 1, 'CELL:A-1', 'CELL:B-1'),
          occurrenceEdge('EDGE:AB-2', 'EDGE:AB', 2, 'CELL:A-2', 'CELL:B-2'),
        ],
      },
      coordData: {
        'CELL:A-1': { x: 10, y: 10 },
        'CELL:A-2': { x: 20, y: 20 },
        'CELL:B-1': { x: 30, y: 30 },
        'CELL:B-2': { x: 40, y: 40 },
      },
      edgeRoutes: {
        'EDGE:AB-1': { curveDistance: '-20' },
        'EDGE:AB-2': { curveDistance: '20' },
      },
    };
    const rawResult = {
      graphData: {
        nodes: [
          { '~id': 'CELL:A', '~labels': ['Cell'], '~properties': { canonical_id: 'CELL:A' } },
          { '~id': 'CELL:B', '~labels': ['Cell'], '~properties': { canonical_id: 'CELL:B' } },
          { '~id': 'CELL:C', '~labels': ['Cell'], '~properties': { canonical_id: 'CELL:C' } },
        ],
        edges: [
          {
            '~id': 'EDGE:AB', '~type': 'RELATED_TO', '~start': 'CELL:A', '~end': 'CELL:B',
            '~properties': { canonical_id: 'EDGE:AB' },
          },
          {
            '~id': 'EDGE:AC:NEW', '~type': 'RELATED_TO', '~start': 'CELL:A', '~end': 'CELL:C',
            '~properties': { canonical_id: 'EDGE:AC:NEW' },
          },
          {
            '~id': 'EDGE:AB:NEW', '~type': 'RELATED_TO', '~start': 'CELL:A', '~end': 'CELL:B',
            '~properties': { canonical_id: 'EDGE:AB:NEW' },
          },
        ],
      },
      coordData: {
        'CELL:A': { x: 100, y: 100 },
        'CELL:B': { x: 200, y: 200 },
        'CELL:C': { x: 300, y: 300 },
      },
      edgeRoutes: {
        'EDGE:AB': { curveDistance: '100' },
        'EDGE:AC:NEW': { curveDistance: '110' },
        'EDGE:AB:NEW': { curveDistance: '120' },
      },
    };

    const projected = projectGraphViewerResultToOccurrences(
      rawResult,
      existing,
      { exactNodeIds: ['CELL:A-2'] },
    );
    const projectedNodes = new Set(projected.graphData.nodes.map((node) => node['~id']));
    const projectedEdges = new Map(projected.graphData.edges.map((edge) => [edge['~id'], edge]));

    expect(projectedNodes).toEqual(new Set([
      'CELL:C', 'CELL:A-1', 'CELL:A-2', 'CELL:B-1', 'CELL:B-2',
    ]));
    expect(projectedNodes.has('CELL:A')).toBe(false);
    expect(projectedNodes.has('CELL:B')).toBe(false);
    expect(projectedEdges.has('EDGE:AB')).toBe(false);
    expect(projectedEdges.get('EDGE:AC:NEW')).toEqual(expect.objectContaining({
      '~start': 'CELL:A-2',
      '~end': 'CELL:C',
    }));
    expect(projectedEdges.get('EDGE:AB:NEW')).toEqual(expect.objectContaining({
      '~start': 'CELL:A-2',
      '~end': 'CELL:B-1',
    }));
    expect(projectedEdges.has('EDGE:AB-1')).toBe(true);
    expect(projectedEdges.has('EDGE:AB-2')).toBe(true);
    expect(projected.coordData['CELL:A']).toBeUndefined();
    expect(projected.coordData['CELL:A-2']).toEqual({ x: 20, y: 20 });
    expect(projected.edgeRoutes['EDGE:AB:NEW']).toBeUndefined();
    expect(projected.edgeRoutes['EDGE:AB-1']).toEqual({ curveDistance: '-20' });

    const exactTargetProjection = projectGraphViewerResultToOccurrences(
      rawResult,
      existing,
      { exactNodeIds: ['CELL:A-2', 'CELL:B-2'] },
    );
    expect(exactTargetProjection.graphData.edges.find(
      (edge) => edge['~id'] === 'EDGE:AB:NEW',
    )).toEqual(expect.objectContaining({ '~start': 'CELL:A-2', '~end': 'CELL:B-2' }));
  });

  test('preserves exact resource occurrences for distinct canonical CellType data edges', () => {
    const canonicalResourceId = 'T1D:DATARESOURCE:scfm_t_cell_rna_umap';
    const cd4Id = 'CL:0000624';
    const cd8Id = 'CL:0000625';
    const cd4ResourceId = `${canonicalResourceId}-1`;
    const cd8ResourceId = `${canonicalResourceId}-2`;
    const resourceOccurrence = (id, index, role) => ({
      '~id': id,
      '~labels': ['DataResource'],
      '~properties': {
        id,
        canonical_id: canonicalResourceId,
        viewer_occurrence: true,
        viewer_occurrence_of: canonicalResourceId,
        viewer_occurrence_index: index,
        viewer_occurrence_role: role,
      },
    });
    const dataEdge = (id, source, target) => ({
      '~id': id,
      '~type': 'HAS_ASSOCIATED_DATA_VIEW',
      '~start': source,
      '~end': target,
      '~properties': {
        id,
        canonical_id: id,
        canonical_source_id: source,
        canonical_target_id: canonicalResourceId,
      },
    });
    const cd4EdgeId = 'V8:TCELL:DATA_VIEW:CD4';
    const cd8EdgeId = 'V8:TCELL:DATA_VIEW:CD8';
    const existing = {
      graphData: {
        nodes: [
          {
            '~id': cd4Id,
            '~labels': ['CellType', 'Cell'],
            '~properties': { name: 'CD4-positive, alpha-beta T cell' },
          },
          {
            '~id': cd8Id,
            '~labels': ['CellType', 'Cell'],
            '~properties': { name: 'CD8-positive, alpha-beta T cell' },
          },
          resourceOccurrence(cd4ResourceId, 1, 'cd4_lane'),
          resourceOccurrence(cd8ResourceId, 2, 'cd8_lane'),
        ],
        edges: [
          dataEdge(cd4EdgeId, cd4Id, cd4ResourceId),
          dataEdge(cd8EdgeId, cd8Id, cd8ResourceId),
        ],
      },
      coordData: {
        [cd4Id]: { x: 10, y: 20 },
        [cd8Id]: { x: 10, y: 120 },
        [cd4ResourceId]: { x: 200, y: 20 },
        [cd8ResourceId]: { x: 200, y: 120 },
      },
      edgeRoutes: {
        [cd4EdgeId]: { curveDistance: '-30' },
        [cd8EdgeId]: { curveDistance: '30' },
      },
    };
    const rawResult = {
      graphData: {
        // Deliberately omit both ordinary CellType sources. Preserved viewer
        // edges must bring their exact source records back from `existing`.
        nodes: [{
          '~id': canonicalResourceId,
          '~labels': ['DataResource'],
          '~properties': { canonical_id: canonicalResourceId },
        }],
        edges: [
          {
            '~id': cd4EdgeId,
            '~type': 'HAS_ASSOCIATED_DATA_VIEW',
            '~start': cd4Id,
            '~end': canonicalResourceId,
            '~properties': { canonical_id: cd4EdgeId },
          },
          {
            '~id': cd8EdgeId,
            '~type': 'HAS_ASSOCIATED_DATA_VIEW',
            '~start': cd8Id,
            '~end': canonicalResourceId,
            '~properties': { canonical_id: cd8EdgeId },
          },
        ],
      },
      coordData: { [canonicalResourceId]: { x: 500, y: 500 } },
      edgeRoutes: {
        [cd4EdgeId]: { curveDistance: '-100' },
        [cd8EdgeId]: { curveDistance: '100' },
      },
    };

    const projected = projectGraphViewerResultToOccurrences(rawResult, existing);
    const nodeIds = new Set(projected.graphData.nodes.map((node) => node['~id']));
    const projectedEdges = new Map(
      projected.graphData.edges.map((edge) => [edge['~id'], edge]),
    );

    expect(nodeIds).toEqual(new Set([cd4Id, cd8Id, cd4ResourceId, cd8ResourceId]));
    expect(nodeIds.has(canonicalResourceId)).toBe(false);
    expect(projectedEdges).toEqual(new Map([
      [cd4EdgeId, expect.objectContaining({ '~start': cd4Id, '~end': cd4ResourceId })],
      [cd8EdgeId, expect.objectContaining({ '~start': cd8Id, '~end': cd8ResourceId })],
    ]));
    projected.graphData.edges.forEach((edge) => {
      expect(nodeIds.has(edge['~start'])).toBe(true);
      expect(nodeIds.has(edge['~end'])).toBe(true);
    });
    expect(projected.coordData[canonicalResourceId]).toBeUndefined();
    expect(projected.coordData[cd4Id]).toEqual(existing.coordData[cd4Id]);
    expect(projected.coordData[cd8Id]).toEqual(existing.coordData[cd8Id]);
    expect(projected.edgeRoutes).toEqual(existing.edgeRoutes);
  });

  test('retains prior exact occurrences across consecutive viewer actions', () => {
    const graphData = {
      nodes: [
        {
          '~id': 'CELL:A-1',
          '~properties': { query_id: 'DB:A', viewer_occurrence: true },
        },
        {
          '~id': 'CELL:A-2',
          '~properties': { query_id: 'DB:A', viewer_occurrence: true },
        },
        {
          '~id': 'CELL:B-2',
          '~properties': { query_id: 'DB:B', viewer_occurrence: true },
        },
      ],
    };
    const afterA = extendOccurrenceProjection(null, graphData, 'CELL:A-2');
    const afterB = extendOccurrenceProjection(afterA, graphData, 'CELL:B-2');
    const afterSwitchingA = extendOccurrenceProjection(afterB, graphData, 'CELL:A-1');

    expect(afterB.exactNodeIds).toEqual(['CELL:A-2', 'CELL:B-2']);
    expect(afterSwitchingA.exactNodeIds).toEqual(['CELL:B-2', 'CELL:A-1']);
  });

  test('falls back to the display ID for ordinary nodes without canonical metadata', () => {
    const ordinaryNode = {
      id: () => 'ordinary-node',
      data: () => undefined,
    };
    expect(resolveCanonicalNodeQueryId(ordinaryNode, ordinaryNode.id()))
      .toBe('ordinary-node');
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

  test('restores result-graph adjacency with the selected occurrence canonical ID', () => {
    const selectedOccurrence = {
      id: () => 'CL:0000625-2',
      data: (property) => ({ canonical_id: 'CL:0000625' })[property],
    };
    const resultGraph = {
      nodes: [{ '~id': 'CL:0000625' }, { '~id': 'T1D:neighbor' }],
      edges: [{
        '~id': 'canonical-edge',
        '~start': 'CL:0000625',
        '~end': 'T1D:neighbor',
      }],
    };
    const queryNodeId = resolveCanonicalNodeQueryId(selectedOccurrence, selectedOccurrence.id());

    expect(Array.from(restoreAdjacentDeletedIds(
      resultGraph,
      queryNodeId,
      new Set(['T1D:neighbor', 'canonical-edge']),
      true,
    ))).toEqual([]);
  });

  test('recognizes overflow placeholder ids', () => {
    expect(isOverflowId('overflow:node-1')).toBe(true);
    expect(isOverflowId('node-1')).toBe(false);
  });
});

describe('cached pathway previews', () => {
  test('resolves content-addressed preview assets against the fixture root', () => {
    const cacheKey = 'a'.repeat(64);
    expect(resolvePreviewAssetUrl(
      `pathway-cache/${cacheKey}.svg`,
      'https://pank-s3-to-share.s3.us-east-1.amazonaws.com/t1d-gps-v5/',
    )).toBe(`https://pank-s3-to-share.s3.us-east-1.amazonaws.com/t1d-gps-v5/pathway-cache/${cacheKey}.svg`);
    expect(resolvePreviewAssetUrl(`pathway-cache/${cacheKey}.svg`, '/t1d-gps-v5'))
      .toBe(`/t1d-gps-v5/pathway-cache/${cacheKey}.svg`);
    expect(resolvePreviewAssetUrl(
      `pathway-cache/${cacheKey}.png`,
      'https://pank-s3-to-share.s3.us-east-1.amazonaws.com/t1d-gps-v6/',
    )).toBe(`https://pank-s3-to-share.s3.us-east-1.amazonaws.com/t1d-gps-v6/pathway-cache/${cacheKey}.png`);
  });

  test('rejects graph-controlled external or malformed preview references', () => {
    expect(resolvePreviewAssetUrl('https://example.org/preview.svg', '/t1d-gps-v5')).toBe('');
    expect(resolvePreviewAssetUrl('data:image/svg+xml,<svg/>', '/t1d-gps-v5')).toBe('');
    expect(resolvePreviewAssetUrl('pathway-cache/abc.svg', '/t1d-gps-v5')).toBe('');
    expect(resolvePreviewAssetUrl(`pathway-cache/${'a'.repeat(64)}.jpg`, '/t1d-gps-v6')).toBe('');
  });

  test('opens a preview before navigation when both contracts are present', () => {
    const cacheKey = 'b'.repeat(64);
    expect(getNodePrimaryAction({
      preview_image_path: `pathway-cache/${cacheKey}.svg`,
      graph_link: '/T1D_GPS/v5/details/example',
    })).toBe('preview');
    expect(getNodePrimaryAction({
      preview_image_path: 'https://example.org/untrusted.svg',
      graph_link: '/T1D_GPS/v5/details/example',
    })).toBe('navigate');
    expect(getNodePrimaryAction({ graph_link: '/T1D_GPS/v5/details/example' }))
      .toBe('navigate');
    expect(getNodePrimaryAction({ id: 'node-with-menu' })).toBe('menu');
  });

  test('places trusted cached previews in Process and Pathway node bodies only when enabled', () => {
    const cacheKey = 'c'.repeat(64);
    const properties = { preview_image_path: `pathway-cache/${cacheKey}.svg` };
    const config = {
      enabled: true,
      fit: 'contain',
      background_color: '#FAF4EB',
      border_color: '#A96B64',
      border_width: 4,
    };
    expect(getNodeBodyPreviewData('Process', properties, '/t1d-gps-v5', config)).toEqual({
      previewNodeImageUrl: `/t1d-gps-v5/pathway-cache/${cacheKey}.svg`,
      previewNodeImageFit: 'contain',
      previewNodeImageBackground: '#FAF4EB',
      previewNodeImageBorderColor: '#A96B64',
      previewNodeImageBorderWidth: 4,
    });
    expect(getNodeBodyPreviewData('Pathway', properties, '/t1d-gps-v5', config))
      .toHaveProperty('previewNodeImageUrl');
    expect(getNodeBodyPreviewData('Gene', properties, '/t1d-gps-v5', config)).toEqual({});
    expect(getNodeBodyPreviewData('Anatomy', properties, '/t1d-gps-v5', config)).toEqual({});
  });

  test('does not create a node-body image from disabled, malformed, or external preview data', () => {
    const enabled = { enabled: true };
    expect(getNodeBodyPreviewData('Process', {
      preview_image_path: 'https://example.org/untrusted.svg',
    }, '/t1d-gps-v5', enabled)).toEqual({});
    expect(getNodeBodyPreviewData('Process', {
      preview_image_path: 'pathway-cache/not-a-hash.svg',
    }, '/t1d-gps-v5', enabled)).toEqual({});
    expect(getNodeBodyPreviewData('Process', {
      preview_image_path: `pathway-cache/${'d'.repeat(64)}.svg`,
    }, '/t1d-gps-v5', { enabled: false })).toEqual({});
  });

  test('distinguishes exact linked-view previews without changing legacy preview semantics', () => {
    expect(isExactLinkedViewPreview({ preview_representation: 'exact_linked_view' })).toBe(true);
    expect(isExactLinkedViewPreview({ preview_renderer: 't1d-linked-fixture-dfs-svg-v2' })).toBe(false);
  });

  test('exports the actual Cytoscape graph with sorted biological IDs and positions', () => {
    const element = (id, data = {}, position = { x: 0, y: 0 }) => ({
      id: () => id,
      data: (key) => data[key],
      position: (axis) => position[axis],
    });
    const nodes = [
      element('node-b', {}, { x: 20, y: 30 }),
      element('__background__', { mechanismBackground: 'true' }, { x: 0, y: 0 }),
      element('node-a', {}, { x: 10, y: 15 }),
    ];
    const edges = [element('edge-b'), element('edge-a')];
    const cy = {
      destroyed: () => false,
      nodes: () => nodes,
      edges: () => edges,
      png: jest.fn(() => 'data:image/png;base64,exact'),
    };

    const capture = createExactGraphCapture(cy, { background: '#FAF4EB' });
    expect(capture).toMatchObject({
      status: 'candidate',
      representation: 'exact_linked_view',
      png_data_url: 'data:image/png;base64,exact',
      node_ids: ['node-a', 'node-b'],
      edge_ids: ['edge-a', 'edge-b'],
      node_count: 2,
      edge_count: 2,
      positions: {
        'node-a': { x: 10, y: 15 },
        'node-b': { x: 20, y: 30 },
      },
    });
    expect(cy.png).toHaveBeenCalledWith({
      full: true,
      maxWidth: 1600,
      maxHeight: 900,
      bg: '#FAF4EB',
    });
  });
});

describe('metadata-controlled image-node presentation', () => {
  test('preserves the existing white label backplate and image body defaults', () => {
    expect(getNodeTextBackplateData()).toEqual({
      nodeTextBackgroundColor: '#FFFFFF',
      nodeTextBackgroundOpacity: 0.94,
    });
    expect(getImageNodeBackgroundData()).toEqual({
      imageNodeBackgroundColor: '#FFFFFF',
    });
  });

  test('allows fixture metadata to remove label backplates and blend image bodies into the canvas', () => {
    const layout = {
      node_text_background_color: '#FAF4EB',
      node_text_background_opacity: 0,
      image_background_color: '#FAF4EB',
    };

    expect(getNodeTextBackplateData(layout)).toEqual({
      nodeTextBackgroundColor: '#FAF4EB',
      nodeTextBackgroundOpacity: 0,
    });
    expect(getImageNodeBackgroundData({}, layout)).toEqual({
      imageNodeBackgroundColor: '#FAF4EB',
    });
  });

  test('prefers a valid per-image background and safely normalizes malformed metadata', () => {
    expect(getImageNodeBackgroundData(
      { image_background_color: '#F2E8DA' },
      { image_background_color: '#FAF4EB' },
    )).toEqual({ imageNodeBackgroundColor: '#F2E8DA' });
    expect(getImageNodeBackgroundData(
      { image_background_color: 'url(javascript:bad)' },
      { image_background_color: '#FAF4EB' },
    )).toEqual({ imageNodeBackgroundColor: '#FAF4EB' });
    expect(getNodeTextBackplateData({
      node_text_background_color: 'transparent',
      node_text_background_opacity: 3,
    })).toEqual({
      nodeTextBackgroundColor: '#FFFFFF',
      nodeTextBackgroundOpacity: 1,
    });
    expect(getNodeTextBackplateData({ node_text_background_opacity: -2 }))
      .toHaveProperty('nodeTextBackgroundOpacity', 0);
    expect(getNodeTextBackplateData({ node_text_background_opacity: null }))
      .toHaveProperty('nodeTextBackgroundOpacity', 0.94);
  });

  test('keeps node bodies opaque while applying sanitized opacity to raster images', () => {
    expect(getImageNodeOpacityData()).toEqual({ imageNodeImageOpacity: 1 });
    expect(getImageNodeOpacityData({ image_opacity: 0.55 }))
      .toEqual({ imageNodeImageOpacity: 0.55 });
    expect(getImageNodeOpacityData({ image_opacity: -4 }))
      .toEqual({ imageNodeImageOpacity: 0 });
    expect(getImageNodeOpacityData({ image_opacity: 'invalid' }))
      .toEqual({ imageNodeImageOpacity: 1 });
    expect(getRasterImageOpacityStyle('data(imageNodeImageOpacity)')).toEqual({
      'background-image-opacity': 'data(imageNodeImageOpacity)',
      'background-opacity': 1,
    });
    expect(getRasterImageOpacityStyle('data(canvasImageOpacity)')).not.toHaveProperty(
      'background-opacity',
      'data(canvasImageOpacity)',
    );
  });
});

describe('metadata-controlled edge-label presentation', () => {
  test('preserves the existing edge-label backplate defaults outside V6', () => {
    expect(getEdgeTextBackplateData()).toEqual({
      edgeTextBackgroundColor: '#F9FAFB',
      edgeTextBackgroundOpacity: 1,
    });
  });

  test('allows metadata to remove edge-label backplates and sanitizes malformed values', () => {
    expect(getEdgeTextBackplateData({
      edge_text_background_color: '#FAF4EB',
      edge_text_background_opacity: 0,
    })).toEqual({
      edgeTextBackgroundColor: '#FAF4EB',
      edgeTextBackgroundOpacity: 0,
    });
    expect(getEdgeTextBackplateData({
      edge_text_background_color: 'transparent',
      edge_text_background_opacity: 3,
    })).toEqual({
      edgeTextBackgroundColor: '#F9FAFB',
      edgeTextBackgroundOpacity: 1,
    });
    expect(getEdgeTextBackplateData({ edge_text_background_opacity: -2 }))
      .toHaveProperty('edgeTextBackgroundOpacity', 0);
    expect(getEdgeTextBackplateData({ edge_text_background_opacity: 'not-a-number' }))
      .toHaveProperty('edgeTextBackgroundOpacity', 1);
  });
});

describe('evidence-aware edge styling', () => {
  test('accepts only Cytoscape line-style values', () => {
    expect(normalizeEdgeLineStyle('solid')).toBe('solid');
    expect(normalizeEdgeLineStyle('dashed')).toBe('dashed');
    expect(normalizeEdgeLineStyle('dotted')).toBe('dotted');
    expect(normalizeEdgeLineStyle('mouse-mechanistic')).toBe('solid');
    expect(normalizeEdgeLineStyle()).toBe('solid');
  });
});

describe('strict edge midpoint hover targeting', () => {
  test.each([
    ['CD4 DataResource edge', 'HAS_ASSOCIATED_DATA_VIEW'],
    ['CD8 DataResource edge', 'HAS_ASSOCIATED_DATA_VIEW'],
    ['ordinary biological edge', 'DIFFERENTIATES_INTO'],
  ])('%s uses the same strict 20px threshold (%s)', (_label, _type) => {
    const midpoint = { x: 100, y: 100 };
    expect(isStrictEdgeMidpointHit(midpoint, [119.999, 100])).toBe(true);
    expect(isStrictEdgeMidpointHit(midpoint, [120, 100])).toBe(false);
    expect(isStrictEdgeMidpointHit(midpoint, [121, 100])).toBe(false);
  });
});

describe('canvas overlay viewport avoidance', () => {
  test('shifts fitted pan left only when an overlay is present', () => {
    expect(getCanvasOverlayAwarePan({ x: 240, y: -30 }, true))
      .toEqual({ x: 128, y: -30 });
    expect(getCanvasOverlayAwarePan({ x: 240, y: -30 }, false))
      .toEqual({ x: 240, y: -30 });
    expect(getCanvasOverlayAwarePan({ x: 240, y: -30 }, true, 100))
      .toEqual({ x: 140, y: -30 });
  });

  test('leaves invalid Cytoscape pan values untouched', () => {
    const invalidPan = { x: Number.NaN, y: 10 };
    expect(getCanvasOverlayAwarePan(invalidPan, true)).toBe(invalidPan);
  });
});

describe('optimized edge routing', () => {
  test('converts model-space bezier and polyline points for Cytoscape', () => {
    expect(edgeRouteToCytoscapeData({
      route_type: 'bezier',
      control_points: [[35, 20], [65, 20]],
    }, { x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({
      routeCurveStyle: 'unbundled-bezier',
      curveDistance: '20 20',
      curveWeight: '0.175 0.325',
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

  test('uses rounded safe corridors for bezier controls beyond either endpoint', () => {
    expect(edgeRouteToCytoscapeData({
      route_type: 'bezier',
      control_points: [[-40, 20], [60, 20]],
    }, { x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({
      routeCurveStyle: 'round-segments',
      segmentDistances: '20 20',
      segmentWeights: '-0.2 0.3',
      segmentRadii: '36 36',
    });
  });

  test('uses route label visibility and safe anchor offsets when supplied', () => {
    expect(edgeLabelToCytoscapeData({
      label_visible: false,
    }, { x: 0, y: 0 }, { x: 100, y: 0 }, 'related to')).toEqual({
      displayLabel: '', labelMarginX: '0', labelMarginY: '0',
    });
    expect(edgeLabelToCytoscapeData({
      label_visible: true,
      label_anchor: [50, 20],
    }, { x: 0, y: 0 }, { x: 100, y: 0 }, 'related to')).toEqual({
      displayLabel: 'related to', labelMarginX: '-25', labelMarginY: '20',
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
