import { findRegisteredKgLinkedView } from './registry';

const propertiesOf = (record) => record?.['~properties'] || {};

const presentValue = (value) => value !== undefined && value !== null && value !== '';

const uniqueValues = (values) => Array.from(new Set(values.filter(presentValue)));

const listValues = (value) => (
  (Array.isArray(value) ? value : [value])
    .filter(presentValue)
    .map((entry) => String(entry))
);

const compactValues = (values, separator) => {
  if (values.length <= 2) return values.join(separator);
  return `${values.slice(0, 2).join(separator)}${separator}${values.length - 2} more`;
};

const labelsOf = (node) => {
  const labels = node?.['~labels'];
  return new Set(Array.isArray(labels) ? labels : [labels].filter(Boolean));
};

const firstResourceProperty = (resourceNodes, property) => {
  for (const resourceNode of resourceNodes) {
    const value = propertiesOf(resourceNode)[property];
    if (presentValue(value)) return value;
  }
  return undefined;
};

const findRelationships = (graphData, resourceNodeIds) => (
  (graphData?.edges || []).filter((edge) => (
    edge?.['~type'] === 'HAS_ASSOCIATED_DATA_VIEW'
    && (resourceNodeIds.has(edge?.['~end']) || resourceNodeIds.has(edge?.['~start']))
  ))
);

const buildLink = (edge, resourceNodeIds, nodesById) => {
  const edgeProperties = propertiesOf(edge);
  const resourceNodeId = resourceNodeIds.has(edge?.['~end'])
    ? edge['~end']
    : edge?.['~start'];
  const contextNodeId = edge?.['~start'] === resourceNodeId
    ? edge?.['~end']
    : edge?.['~start'];
  const resourceNode = nodesById.get(resourceNodeId) || null;
  const contextNode = nodesById.get(contextNodeId) || null;
  const resourceProperties = propertiesOf(resourceNode);
  const contextProperties = propertiesOf(contextNode);

  return {
    edge,
    edgeId: edge?.['~id'] || '',
    relationType: edge?.['~type'] || '',
    displayLabel: edgeProperties.display_label
      || edgeProperties.relation_label
      || 'Associated data view',
    reason: edgeProperties.link_reason || edgeProperties.description || '',
    evidenceBoundary: edgeProperties.evidence_boundary || '',
    linkBasis: edgeProperties.link_basis || '',
    mappedSubtypeCount: edgeProperties.mapped_subtype_count,
    mappedSubtypes: uniqueValues(listValues(edgeProperties.mapped_subtypes)),
    sourceId: contextNodeId || '',
    sourceName: contextProperties.name || contextNodeId || '',
    targetId: resourceNodeId || '',
    targetName: resourceProperties.name || resourceNodeId || '',
    nonCausal: edgeProperties.non_causal === true,
    notEvidence: edgeProperties.not_evidence === true,
  };
};

export const resolveKgLinkedView = (graphData, metadata = {}) => {
  const match = findRegisteredKgLinkedView(graphData);
  if (!match) return null;

  const { registration, resourceNode, resourceNodes } = match;
  const allNodes = graphData?.nodes || [];
  const nodesById = new Map(allNodes.map((node) => [node?.['~id'], node]));
  const resourceNodeIds = new Set(resourceNodes.map((node) => node?.['~id']).filter(Boolean));
  const relationshipEdges = findRelationships(graphData, resourceNodeIds);
  const links = relationshipEdges.map((edge) => (
    buildLink(edge, resourceNodeIds, nodesById)
  ));
  const relationshipEdge = relationshipEdges[0] || null;
  const presentation = metadata?.embedding_view || {};
  const displayLabels = uniqueValues(links.map((link) => link.displayLabel));
  const reasons = uniqueValues(links.map((link) => link.reason));
  const evidenceBoundaries = uniqueValues(links.map((link) => link.evidenceBoundary));
  const sourceIds = uniqueValues(links.map((link) => link.sourceId));
  const sourceNames = uniqueValues(links.map((link) => link.sourceName));
  const targetIds = uniqueValues(links.map((link) => link.targetId));
  const targetNames = uniqueValues(links.map((link) => link.targetName));
  const contextNodes = sourceIds.map((sourceId) => nodesById.get(sourceId)).filter(Boolean);
  const contextNode = contextNodes[0] || null;
  const pathwayNode = contextNodes.find((node) => labelsOf(node).has('Pathway')) || null;
  const mappedSubtypes = uniqueValues(links.flatMap((link) => link.mappedSubtypes));
  const unlistedMappedSubtypeCount = links.reduce((total, link) => {
    if (link.mappedSubtypes.length) return total;
    const value = Number(link.mappedSubtypeCount);
    return Number.isFinite(value) ? total + value : total;
  }, 0);
  const mappedSubtypeCount = mappedSubtypes.length + unlistedMappedSubtypeCount;
  const displayLabelFull = displayLabels.join(' · ');
  const displayLabelSummary = compactValues(displayLabels, ' · ');
  const sourceNameFull = sourceNames.join(' + ');
  const sourceNameSummary = compactValues(sourceNames, ' + ');

  return {
    registration,
    resourceNode,
    resourceNodes,
    occurrenceCount: resourceNodes.length,
    relationshipEdge,
    relationshipEdges,
    contextNode,
    contextNodes,
    sourceNode: contextNode,
    sourceNodes: contextNodes,
    pathwayNode,
    view: {
      ...presentation,
      id: presentation.id
        || firstResourceProperty(resourceNodes, 'resource_view_key')
        || registration.key,
      kind: firstResourceProperty(resourceNodes, 'resource_view_kind')
        || presentation.kind
        || registration.kind,
      title: presentation.title || firstResourceProperty(resourceNodes, 'name'),
      subtitle: presentation.subtitle,
      summary: presentation.summary || firstResourceProperty(resourceNodes, 'description'),
      manifest_path: firstResourceProperty(resourceNodes, 'manifest_path')
        || presentation.manifest_path,
      target_route: firstResourceProperty(resourceNodes, 'graph_link')
        === '/T1D_GPS/v9/details/scfm-t-cell-differentiation'
        ? '/T1D_GPS/v9/details/scfm-t-cell-differentiation'
        : registration.targetRoute
        || presentation.target_route,
      cell_count: firstResourceProperty(resourceNodes, 'cell_count')
        ?? presentation.cell_count,
      donor_count: firstResourceProperty(resourceNodes, 'donor_count')
        ?? presentation.donor_count,
    },
    linkage: links.length ? {
      links,
      edgeCount: links.length,
      relationType: links[0].relationType,
      displayLabel: displayLabelSummary,
      displayLabelSummary,
      displayLabelFull,
      displayLabels,
      reason: reasons.join(' '),
      reasons,
      evidenceBoundary: evidenceBoundaries.join(' '),
      evidenceBoundaries,
      linkBasis: uniqueValues(links.map((link) => link.linkBasis)).join(' · '),
      mappedSubtypeCount: mappedSubtypeCount || undefined,
      mappedSubtypes,
      sourceId: sourceIds[0] || '',
      sourceIds,
      sourceName: sourceNameSummary,
      sourceNameSummary,
      sourceNameFull,
      sourceNames,
      targetId: targetIds[0] || resourceNode['~id'],
      targetIds,
      targetName: targetNames[0] || firstResourceProperty(resourceNodes, 'name') || resourceNode['~id'],
      targetNames,
      nonCausal: links.every((link) => link.nonCausal),
      notEvidence: links.every((link) => link.notEvidence),
    } : null,
  };
};

export default resolveKgLinkedView;
