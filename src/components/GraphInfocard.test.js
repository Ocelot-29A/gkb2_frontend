import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import GraphInfocard, {
  adaptLegacyInfoPanel,
  buildInfocardModel,
  firstInfocardValue,
  formatNihInfocardValue,
  getInfocardPathValue,
  isValidInfocardPath,
} from './GraphInfocard';

describe('NIH graph infocard model', () => {
  test('resolves validated nested paths and rejects executable or malformed paths', () => {
    const record = { quantitative_fields: { GENE_ENRICHED_IN: [{ log2FoldChange: 2.31 }] } };
    expect(getInfocardPathValue(record, 'quantitative_fields.GENE_ENRICHED_IN[0].log2FoldChange')).toBe(2.31);
    expect(firstInfocardValue(record, ['missing', 'quantitative_fields.GENE_ENRICHED_IN[0].log2FoldChange']).value).toBe(2.31);
    expect(isValidInfocardPath('__proto__.polluted')).toBe(false);
    expect(getInfocardPathValue(record, 'quantitative_fields[alert(1)]')).toBeUndefined();
  });

  test('adapts legacy array panels without restoring an additional-property dump', () => {
    const profile = adaptLegacyInfoPanel([
      ['Title', 'name'],
      ['Description', 'description'],
      ['Identity', [['ID', 'id']]],
      ['Footer', [['Source', 'data_source']]],
    ]);
    expect(profile.title.paths).toEqual(['name', 'name', 'id']);
    expect(profile.annotation.paths).toEqual(['description']);
    expect(profile.detail_sections[0].title).toBe('Identity');
  });

  test('selects no more than two declared expression statistics', () => {
    const model = buildInfocardModel({
      kind: 'edge',
      type: 'GENE_ENRICHED_IN',
      data: {
        type: 'GENE_ENRICHED_IN',
        source: 'gene',
        target: 'cell',
        relation_label: 'enriched in',
        direction_semantics: 'Non-causal expression annotation.',
        quantitative_fields: {
          GENE_ENRICHED_IN: [{ log2FoldChange: 2.309, padj: 6.52e-36 }],
        },
        data_source: 'PanKgraph',
        data_version: '2026-04-01',
        source_record_id: 'ENSG00000006071',
      },
    });
    expect(model.key_statistics).toHaveLength(2);
    expect(model.key_statistics.map((row) => row.label)).toEqual(['log₂ fold change', 'Adjusted P']);
    expect(formatNihInfocardValue(model.key_statistics[0].value, 'signed_decimal')).toBe('+2.31');
    expect(formatNihInfocardValue(model.key_statistics[1].value, 'scientific')).toBe('6.52e-36');
  });
});

describe('NIH graph infocard rendering', () => {
  const th17 = {
    id: 'T1DGPS:CS:000007',
    type: 'CellState',
    preferred_name: 'T1D-associated Th17-like CD4 state',
    nih_summary: 'A human T1D-associated CD4 state with a Th17-compatible phenotype.',
    evidence_status: 'primary_human_claims_resolved',
    human_evidence_only: true,
    mapping_confidence: 'moderate',
    base_cell_label: 'T-helper 17 cell',
    base_cell_ontology_id: 'CL:0000899',
    state_markers: ['RORC', 'CCR6', 'IL17A'],
    anatomical_context: ['peripheral blood'],
    antigen_specificity: {
      status: 'not assumed',
      description: 'T1D association does not establish a cognate peptide–HLA target.',
    },
    primary_claim_ids: ['DOI:10.2337/db11-0090'],
    data_source: 'Primary human T1D literature',
    data_version: 'human evidence reviewed 2026-08-16',
    data_source_url: 'https://doi.org/10.2337/db11-0090',
  };

  test('shows annotation, evidence, and provenance before collapsed secondary details', () => {
    render(<GraphInfocard hoveredData={th17} />);
    expect(screen.getByText('What this state represents')).toBeTruthy();
    expect(screen.getByText(th17.nih_summary)).toBeTruthy();
    expect(screen.getByText('Human evidence')).toBeTruthy();
    expect(screen.getByText('Provenance')).toBeTruthy();
    expect(screen.getByText('Primary human T1D literature')).toBeTruthy();
    expect(screen.queryByText('Antigen Specificity')).toBeNull();
    expect(screen.queryByText('Additional properties')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'More details' }));
    expect(screen.getByText('Antigen specificity')).toBeTruthy();
    expect(screen.getByText('T1D association does not establish a cognate peptide–HLA target.')).toBeTruthy();
  });

  test('labels generated lineage connectors as not evidence and omits fake statistics', () => {
    render(<GraphInfocard hoveredData={{
      id: 'V8:LINEAGE:CLP_PROT',
      type: 'MAY_DIFFERENTIATE_INTO',
      source: 'CLP',
      target: 'pro-T',
      relation_label: 'may differentiate into',
      description: 'Symbolic lineage connector pending human claim extraction.',
      generated: true,
      not_evidence: true,
      generated_reason: 'No extracted primary-human claim supports this exact transition.',
      data_source: 'T1D GPS V8 generated visual scaffold',
      data_version: 'V8',
      source_record_id: 'V8:LINEAGE:CLP_PROT',
    }} />);
    expect(screen.getByText('Generated fallback — not evidence')).toBeTruthy();
    expect(screen.queryByText('Key statistics')).toBeNull();
  });
});
