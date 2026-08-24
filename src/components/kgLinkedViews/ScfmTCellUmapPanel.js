import React from 'react';

import EmbeddingPortalCard from '../../pages/EmbeddingPortalCard';

export default function ScfmTCellUmapPanel({ context, assetBaseUrl }) {
  return (
    <EmbeddingPortalCard
      embeddingView={context.view}
      linkage={context.linkage}
      assetBaseUrl={assetBaseUrl}
    />
  );
}
