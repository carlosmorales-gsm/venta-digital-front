import type { SaleFormData } from '../types/sale-form';
import { normalizeTipoCobranza } from './payment-method';

export type SignDocumentKind =
  | 'caratula'
  | 'reglamentoParque'
  | 'cartaAutorizacion'
  | 'cartaNoFactura'
  | 'cartaFactura';

export type SignDocument = {
  kind: SignDocumentKind;
  title: string;
  hint: string;
};

/** Cartas y contrato que el cliente debe leer y aceptar antes de firmar. */
export function listSignDocuments(form: SaleFormData): SignDocument[] {
  const docs: SignDocument[] = [
    {
      kind: 'caratula',
      title: 'Carátula del contrato',
      hint: 'Datos del contrato y declaraciones',
    },
  ];

  if (form.ubicacionPlan.planKind === 'PARQUE') {
    docs.push({
      kind: 'reglamentoParque',
      title: 'Reglamento de parque',
      hint: 'Normas del parque funeral',
    });
  }

  if (normalizeTipoCobranza(form.contacto.tipoCobranza) === 'DOMICILIADO') {
    docs.push({
      kind: 'cartaAutorizacion',
      title: 'Carta de autorización',
      hint: 'Cargo automático a tarjeta',
    });
  }

  if (form.contacto.factura === 'NO') {
    docs.push({
      kind: 'cartaNoFactura',
      title: 'Consentimiento de no factura',
      hint: 'Acepta no recibir factura',
    });
  }

  if (form.contacto.factura === 'SI') {
    docs.push({
      kind: 'cartaFactura',
      title: 'Carta de requerimiento de factura',
      hint: 'Datos fiscales para facturar',
    });
  }

  return docs;
}
