import React from 'react';

import ScfmTCellUmapPanel from './ScfmTCellUmapPanel';
import resolveKgLinkedView from './resolveKgLinkedView';

const COMPONENTS = Object.freeze({
  ScfmTCellUmapPanel,
});

export default function KgLinkedViewHost({
  graphData,
  metadata,
  assetBaseUrl,
}) {
  const context = resolveKgLinkedView(graphData, metadata);
  if (!context) return null;
  const ViewComponent = COMPONENTS[context.registration.component];
  if (!ViewComponent) return null;

  return (
    <ViewComponent
      context={context}
      assetBaseUrl={assetBaseUrl}
    />
  );
}
