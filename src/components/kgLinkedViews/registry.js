export const SCFM_T_CELL_UMAP_RESOURCE_VIEW_KEY = 'scfm-t-cell-rna-umap';
export const SCFM_T_CELL_UMAP_RESOURCE_NODE_ID = 'T1D:DATARESOURCE:scfm_t_cell_rna_umap';
export const SCFM_T_CELL_UMAP_TARGET_ROUTE = '/T1D_GPS/v8/details/scfm-t-cell-differentiation';
export const SCFM_T_CELL_UMAP_V9_TARGET_ROUTE = '/T1D_GPS/v9/details/scfm-t-cell-differentiation';

const nodeLabels = (node) => {
  const labels = node?.['~labels'];
  return new Set(Array.isArray(labels) ? labels : [labels].filter(Boolean));
};

// Add future DataResource/ModelResource panels here. The registry deliberately
// describes UI capabilities only; it does not add nodes or biological meaning
// to the KG.
export const KG_LINKED_VIEW_REGISTRY = Object.freeze([
  Object.freeze({
    key: SCFM_T_CELL_UMAP_RESOURCE_VIEW_KEY,
    kind: 'data',
    component: 'ScfmTCellUmapPanel',
    canonicalNodeId: SCFM_T_CELL_UMAP_RESOURCE_NODE_ID,
    targetRoute: SCFM_T_CELL_UMAP_TARGET_ROUTE,
    matches: (node) => {
      const properties = node?.['~properties'] || {};
      return nodeLabels(node).has('DataResource') && (
        properties.resource_view_key === SCFM_T_CELL_UMAP_RESOURCE_VIEW_KEY
        || properties.canonical_id === SCFM_T_CELL_UMAP_RESOURCE_NODE_ID
        // Backward-compatible recognition for the first fixture generated
        // before resource_view_key became part of the public-safe contract.
        || node?.['~id'] === SCFM_T_CELL_UMAP_RESOURCE_NODE_ID
      );
    },
  }),
]);

export const findRegisteredKgLinkedView = (graphData) => {
  const nodes = graphData?.nodes || [];
  for (const registration of KG_LINKED_VIEW_REGISTRY) {
    const resourceNodes = nodes.filter((node) => registration.matches(node));
    if (resourceNodes.length) {
      return {
        registration,
        resourceNode: resourceNodes[0],
        resourceNodes,
      };
    }
  }
  return null;
};

export const findKgLinkedViewRegistrationForNode = (node) => (
  KG_LINKED_VIEW_REGISTRY.find((registration) => registration.matches(node)) || null
);

export const findKgLinkedViewRegistrationForCanonicalNodeId = (canonicalNodeId) => (
  KG_LINKED_VIEW_REGISTRY.find(
    (registration) => registration.canonicalNodeId === canonicalNodeId,
  ) || null
);

export const resolveRegisteredKgLinkedViewRoute = (node) => (
  node?.['~properties']?.graph_link === SCFM_T_CELL_UMAP_V9_TARGET_ROUTE
    ? SCFM_T_CELL_UMAP_V9_TARGET_ROUTE
    : findKgLinkedViewRegistrationForNode(node)?.targetRoute || ''
);

export const hasRegisteredKgLinkedView = (graphData) => (
  Boolean(findRegisteredKgLinkedView(graphData))
);
