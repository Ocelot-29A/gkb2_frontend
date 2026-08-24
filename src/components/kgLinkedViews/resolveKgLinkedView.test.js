import {
  findRegisteredKgLinkedView,
  hasRegisteredKgLinkedView,
  resolveRegisteredKgLinkedViewRoute,
  SCFM_T_CELL_UMAP_TARGET_ROUTE,
} from './registry';
import resolveKgLinkedView from './resolveKgLinkedView';

const pathwayId = 'T1D:PATHWAY:human_alpha_beta_t_cell_differentiation_regulation';
const resourceId = 'T1D:DATARESOURCE:scfm_t_cell_rna_umap';

const graph = {
  nodes: [
    {
      '~id': pathwayId,
      '~labels': ['Pathway'],
      '~properties': { name: 'Human T-cell differentiation and regulation in T1D' },
    },
    {
      '~id': resourceId,
      '~labels': ['T1DConcept', 'DataResource'],
      '~properties': {
        name: 'scFM T-cell RNA-side UMAP',
        resource_view_key: 'scfm-t-cell-rna-umap',
        resource_view_kind: 'data',
        graph_link: '/T1D_GPS/v8/details/scfm-t-cell-differentiation',
        manifest_path: 'embeddings/scfm-t-cell-differentiation/manifest.json',
        cell_count: 32952,
        donor_count: 22,
      },
    },
  ],
  edges: [{
    '~id': 'data-link',
    '~type': 'HAS_ASSOCIATED_DATA_VIEW',
    '~start': pathwayId,
    '~end': resourceId,
    '~properties': {
      display_label: '6 UMAP cell labels map to KG concepts',
      link_reason: 'Six T-cell subtype labels crosswalk to concepts in this pathway.',
      evidence_boundary: 'Context only; not differentiation evidence.',
      link_basis: 'curated_subtype_crosswalk',
      mapped_subtype_count: 6,
      non_causal: true,
      not_evidence: true,
    },
  }],
};

describe('KG linked-view registry', () => {
  test('resolves the current special node and its explanatory edge', () => {
    const resolved = resolveKgLinkedView(graph, {
      embedding_view: { title: 'scFM T-cell differentiation' },
    });

    expect(resolved.registration.component).toBe('ScfmTCellUmapPanel');
    expect(resolved.resourceNode['~id']).toBe(resourceId);
    expect(resolved.contextNode).toBe(graph.nodes[0]);
    expect(resolved.contextNodes).toEqual([graph.nodes[0]]);
    expect(resolved.sourceNode).toBe(graph.nodes[0]);
    expect(resolved.sourceNodes).toEqual([graph.nodes[0]]);
    expect(resolved.pathwayNode).toBe(graph.nodes[0]);
    expect(resolved.view).toEqual(expect.objectContaining({
      title: 'scFM T-cell differentiation',
      target_route: '/T1D_GPS/v8/details/scfm-t-cell-differentiation',
      manifest_path: 'embeddings/scfm-t-cell-differentiation/manifest.json',
      cell_count: 32952,
      donor_count: 22,
    }));
    expect(resolved.linkage).toEqual(expect.objectContaining({
      displayLabel: '6 UMAP cell labels map to KG concepts',
      mappedSubtypeCount: 6,
      sourceId: pathwayId,
      sourceName: 'Human T-cell differentiation and regulation in T1D',
      targetId: resourceId,
      targetName: 'scFM T-cell RNA-side UMAP',
      reason: 'Six T-cell subtype labels crosswalk to concepts in this pathway.',
      evidenceBoundary: 'Context only; not differentiation evidence.',
      nonCausal: true,
      notEvidence: true,
    }));
  });

  test('does not let detached metadata or an ordinary resource invent a panel', () => {
    expect(resolveKgLinkedView({ nodes: [], edges: [] }, {
      embedding_view: { target_route: '/T1D_GPS/v8/details/scfm-t-cell-differentiation' },
    })).toBeNull();
    expect(hasRegisteredKgLinkedView({
      nodes: [{ '~id': 'DATA:other', '~labels': ['DataResource'], '~properties': {} }],
    })).toBe(false);
  });

  test('recognizes label order variants and returns one deterministic match', () => {
    const cd4Occurrence = {
      ...graph.nodes[1],
      '~id': `${resourceId}@cd4`,
      '~labels': ['DataResource', 'T1DConcept'],
      '~properties': {
        ...graph.nodes[1]['~properties'],
        canonical_id: resourceId,
        graph_link: '/wrong-occurrence-route',
      },
    };
    const cd8Occurrence = {
      ...graph.nodes[1],
      '~id': `${resourceId}@cd8`,
      '~properties': {
        ...graph.nodes[1]['~properties'],
        graph_link: '/another-wrong-occurrence-route',
      },
    };
    const match = findRegisteredKgLinkedView({
      nodes: [cd4Occurrence, cd8Occurrence],
      edges: [],
    });
    expect(match.resourceNode['~id']).toBe(`${resourceId}@cd4`);
    expect(match.resourceNodes.map((node) => node['~id'])).toEqual([
      `${resourceId}@cd4`,
      `${resourceId}@cd8`,
    ]);
    expect(resolveRegisteredKgLinkedViewRoute(cd4Occurrence))
      .toBe(SCFM_T_CELL_UMAP_TARGET_ROUTE);
    expect(resolveRegisteredKgLinkedViewRoute(cd8Occurrence))
      .toBe(SCFM_T_CELL_UMAP_TARGET_ROUTE);
  });

  test('collapses occurrences into one panel context and aggregates every linkage edge', () => {
    const cd4Id = `${resourceId}@cd4`;
    const cd8Id = `${resourceId}@cd8`;
    const occurrence = (id) => ({
      ...graph.nodes[1],
      '~id': id,
      '~properties': {
        ...graph.nodes[1]['~properties'],
        canonical_id: resourceId,
      },
    });
    const contextNodes = [
      {
        '~id': 'CL:0000624',
        '~labels': ['CellType'],
        '~properties': { name: 'CD4-positive, alpha-beta T cell' },
      },
      {
        '~id': 'CL:0000625',
        '~labels': ['CellType'],
        '~properties': { name: 'CD8-positive, alpha-beta T cell' },
      },
    ];
    const edge = (id, source, target, displayLabel, reason, mappedSubtypes) => ({
      '~id': id,
      '~type': 'HAS_ASSOCIATED_DATA_VIEW',
      '~start': source,
      '~end': target,
      '~properties': {
        display_label: displayLabel,
        link_reason: reason,
        evidence_boundary: 'Context only; not differentiation evidence.',
        mapped_subtype_count: mappedSubtypes.length,
        mapped_subtypes: mappedSubtypes,
        non_causal: true,
        not_evidence: true,
      },
    });
    const resolved = resolveKgLinkedView({
      nodes: [...contextNodes, occurrence(cd4Id), occurrence(cd8Id)],
      edges: [
        edge(
          'cd4-link',
          'CL:0000624',
          cd4Id,
          'CD4 labels map to KG concepts',
          'CD4 subtype crosswalk.',
          ['Naive CD4+ T cell', 'Memory CD4+ T cell', 'T Regulatory Cell'],
        ),
        edge(
          'cd8-link',
          'CL:0000625',
          cd8Id,
          'CD8 labels map to KG concepts',
          'CD8 subtype crosswalk.',
          ['Naive CD8+ T cell', 'Memory CD8+ T cell', 'T Cytotoxic Cell'],
        ),
      ],
    });

    expect(resolved.occurrenceCount).toBe(2);
    expect(resolved.contextNodes).toEqual(contextNodes);
    expect(resolved.sourceNodes).toEqual(contextNodes);
    expect(resolved.contextNode).toBe(contextNodes[0]);
    expect(resolved.sourceNode).toBe(contextNodes[0]);
    expect(resolved.pathwayNode).toBeNull();
    expect(resolved.view.target_route).toBe(SCFM_T_CELL_UMAP_TARGET_ROUTE);
    expect(resolved.linkage.edgeCount).toBe(2);
    expect(resolved.linkage.mappedSubtypeCount).toBe(6);
    expect(resolved.linkage.mappedSubtypes).toEqual([
      'Naive CD4+ T cell',
      'Memory CD4+ T cell',
      'T Regulatory Cell',
      'Naive CD8+ T cell',
      'Memory CD8+ T cell',
      'T Cytotoxic Cell',
    ]);
    expect(resolved.linkage.displayLabels).toEqual([
      'CD4 labels map to KG concepts',
      'CD8 labels map to KG concepts',
    ]);
    expect(resolved.linkage.reasons).toEqual([
      'CD4 subtype crosswalk.',
      'CD8 subtype crosswalk.',
    ]);
    expect(resolved.linkage.sourceNames).toEqual([
      'CD4-positive, alpha-beta T cell',
      'CD8-positive, alpha-beta T cell',
    ]);
    expect(resolved.linkage.sourceNameSummary)
      .toBe('CD4-positive, alpha-beta T cell + CD8-positive, alpha-beta T cell');
    expect(resolved.linkage.sourceNameFull).toBe(resolved.linkage.sourceNameSummary);

    const cd4Only = resolveKgLinkedView({
      nodes: [contextNodes[0], occurrence(cd4Id)],
      edges: [
        edge(
          'cd4-link',
          'CL:0000624',
          cd4Id,
          'CD4 labels map to KG concepts',
          'CD4 subtype crosswalk.',
          ['Naive CD4+ T cell', 'Memory CD4+ T cell', 'T Regulatory Cell'],
        ),
      ],
    });
    expect(cd4Only.occurrenceCount).toBe(1);
    expect(cd4Only.linkage.edgeCount).toBe(1);
    expect(resolveKgLinkedView({ nodes: contextNodes, edges: [] })).toBeNull();
  });

  test('deduplicates mapped subtype lists and compacts large source and label summaries', () => {
    const resourceOccurrence = {
      ...graph.nodes[1],
      '~id': `${resourceId}-1`,
      '~properties': {
        ...graph.nodes[1]['~properties'],
        canonical_id: resourceId,
      },
    };
    const contextNodes = [1, 2, 3, 4].map((index) => ({
      '~id': `CELL:${index}`,
      '~labels': ['CellType'],
      '~properties': { name: `Mapped cell ${index}` },
    }));
    const edges = contextNodes.map((node, index) => ({
      '~id': `data-link-${index + 1}`,
      '~type': 'HAS_ASSOCIATED_DATA_VIEW',
      '~start': node['~id'],
      '~end': resourceOccurrence['~id'],
      '~properties': {
        display_label: `Mapping ${index + 1}`,
        link_reason: `Crosswalk ${index + 1}.`,
        mapped_subtype_count: 1,
        mapped_subtypes: [`Subtype ${Math.min(index + 1, 3)}`],
        non_causal: true,
        not_evidence: true,
      },
    }));

    const resolved = resolveKgLinkedView({
      nodes: [...contextNodes, resourceOccurrence],
      edges,
    });

    expect(resolved.sourceNodes).toEqual(contextNodes);
    expect(resolved.linkage.sourceName).toBe('Mapped cell 1 + Mapped cell 2 + 2 more');
    expect(resolved.linkage.sourceNameFull)
      .toBe('Mapped cell 1 + Mapped cell 2 + Mapped cell 3 + Mapped cell 4');
    expect(resolved.linkage.displayLabel).toBe('Mapping 1 · Mapping 2 · 2 more');
    expect(resolved.linkage.displayLabelFull)
      .toBe('Mapping 1 · Mapping 2 · Mapping 3 · Mapping 4');
    expect(resolved.linkage.mappedSubtypes).toEqual(['Subtype 1', 'Subtype 2', 'Subtype 3']);
    expect(resolved.linkage.mappedSubtypeCount).toBe(3);
  });
});
