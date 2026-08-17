import { render } from '@testing-library/react';

import {
  buildViewNodeStyles,
  buildMechanismTitleNodes,
  buildPreviousLayout,
  createExactGraphCapture,
  edgeLabelToCytoscapeData,
  edgeRouteToCytoscapeData,
  getCanonicalNodeLabel,
  getNodeType,
  getNodeLabel,
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
  isExactLinkedViewPreview,
  isHiddenInfoProperty,
  isOverflowId,
  mergeExploreNeighborsCypher,
  normalizeEdgeLineStyle,
  resolveNodeImageUrl,
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
      'Deletion', 'ENCODE_feature', 'Enhancer', 'Epigenomic_feature', 'Exon', 'ExternalFactor',
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
      'HAS_CDS_SEGMENT', 'HAS_EXON', 'HAS_STATE', 'HAS_TRANSCRIPT', 'HAS_TSS',
      'HAS_UTR_SEGMENT', 'INDUCES', 'INFECTS', 'INFILTRATES', 'INHIBITS', 'KILLS',
      'LIGAND_RECEPTOR_PAIR', 'LOCATED_IN', 'MAPPING_MAPPING', 'MIGRATES_TO', 'MODIFIES',
      'PHYSICAL_INTERACTION', 'PRESENTS_TO', 'PROVIDES_HELP_TO', 'RECOGNIZES', 'RECRUITS',
      'REGULATE', 'REPLACED_BY', 'RESULTS_IN', 'SECRETES', 'SENSED_BY', 'SUBCLASS_OF',
      'TRANSLATES_TO', 'UNDERGOES', 'UPREGULATES',
    ].sort());
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
    let rendered;
    expect(() => {
      rendered = render(<InfocardData value={acceptedKgAnnotation} dataKey="accepted_kg_annotation" />);
    }).not.toThrow();
    expect(rendered.container.textContent).toContain('dendritic cell');
    expect(rendered.container.textContent).toContain('Homo sapiens');
    expect(rendered.container.textContent).not.toContain('[object Object]');
  });

  test('renders an object array through the list formatter safely', () => {
    const rendered = render(<InfocardData value={[acceptedKgAnnotation]} config="list" />);
    expect(rendered.container.textContent).toContain('CL:0000451');
    expect(rendered.container.textContent).not.toContain('[object Object]');
  });

  test('shows structured evidence limitations but hides rendering and navigation internals', () => {
    const rendered = render(<InfocardMenu
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

    expect(rendered.container.textContent).toContain('Evidence limitation');
    expect(rendered.container.textContent).toContain('not_established');
    expect(rendered.container.textContent).toContain('NOD mouse');
    expect(rendered.container.textContent).not.toContain('Broader Color');
    expect(rendered.container.textContent).not.toContain('Show all data');
    expect(rendered.container.textContent).not.toContain('abc123');
    expect(rendered.container.textContent).not.toContain('Display Lane');
    expect(rendered.container.textContent).not.toContain('Event Order');
    expect(rendered.container.textContent).not.toContain('Default Visible');
    expect(rendered.container.textContent).not.toContain('Display Instance Id');
    expect(rendered.container.textContent).not.toContain('Primary Semantic Type');
    expect(rendered.container.textContent).not.toContain('Node Type');
    expect(rendered.container.textContent).not.toContain('Layer');
    expect(rendered.container.textContent).not.toContain('12345.678');
    expect(rendered.container.textContent).not.toContain('23456.789');
    expect(rendered.container.textContent).not.toContain('34567.891');
    expect(rendered.container.textContent).not.toContain('45678.912');
    expect(rendered.container.textContent).not.toContain('[object Object]');
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
