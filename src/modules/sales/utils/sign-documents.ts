import { parseSaleKind, saleNeedsOriginSales } from '../constants/sale-kinds';
import type { SaleFormData } from '../types/sale-form';
import { normalizeTipoCobranza } from './payment-method';

export type SignDocumentKind =
  | 'caratula'
  | 'cartaExclusiones'
  | 'reglamentoParque'
  | 'reglamentoParqueFolleto'
  | 'cartaAutorizacion'
  | 'cartaNomina'
  | 'cartaNoFactura'
  | 'cartaFactura'
  | 'solicitudReconocimiento'
  | 'cartaNoPapeleria';

export type SignDocument = {
  kind: SignDocumentKind;
  /** Distinto cuando hay un formato por venta a reconocer. */
  key?: string;
  originId?: number;
  title: string;
  hint: string;
};

/** Cartas y contrato que el cliente debe leer y aceptar antes de firmar. */
export function listSignDocuments(form: SaleFormData): SignDocument[] {
  if (parseSaleKind(form.meta.tipoVenta) === 'FUNEPET') {
    const docs: SignDocument[] = [
      {
        kind: 'caratula',
        title: 'Carátula de contrato',
        hint: 'Contrato de servicios funerarios para mascotas',
      },
      {
        kind: 'cartaExclusiones',
        title: 'Exclusiones contractuales',
        hint: 'Periodo de espera de 90 días',
      },
    ];
    if (normalizeTipoCobranza(form.contacto.tipoCobranza) === 'DOMICILIADO') {
      docs.push({
        kind: 'cartaAutorizacion',
        title: 'Carta de autorización',
        hint: 'Cargo automático a tarjeta · Funepet',
      });
    }
    if (form.ubicacionPlan.planKind === 'PARQUE') {
      docs.push({
        kind: 'reglamentoParque',
        title: 'Reglamento de parque',
        hint: 'Carta de reglas para el cliente',
      });
      docs.push({
        kind: 'reglamentoParqueFolleto',
        title: 'Reglamento de parque (artículos)',
        hint: 'Folleto carta apaisada · 2 páginas por hoja',
      });
    }
    if (
      normalizeTipoCobranza(form.contacto.tipoCobranza) === 'NOMINA' &&
      form.pago.empresaNominaId
    ) {
      docs.push({
        kind: 'cartaNomina',
        title: 'Carta de consentimiento (nómina)',
        hint: form.pago.empresaNomina
          ? `FO-GEN-SMGF-05 · ${form.pago.empresaNomina}`
          : 'Descuento por convenio',
      });
    }
    if (form.contacto.factura === 'NO') {
      docs.push({
        kind: 'cartaNoFactura',
        title: 'Consentimiento de no factura',
        hint: 'Acepta factura con RFC genérico · Funepet',
      });
    }
    if (form.contacto.factura === 'SI') {
      docs.push({
        kind: 'cartaFactura',
        title: 'Carta de requerimiento de factura',
        hint: 'Datos fiscales para facturar · Funepet',
      });
    }
    return docs;
  }

  const docs: SignDocument[] = [
    {
      kind: 'caratula',
      title: 'Carátula del contrato',
      hint: 'Datos del contrato y declaraciones',
    },
    {
      kind: 'cartaExclusiones',
      title: 'Carta de aceptación de exclusiones',
      hint: 'Anexo A · plan de previsión',
    },
  ];

  if (saleNeedsOriginSales(form.meta.tipoVenta)) {
    for (const venta of form.meta.reconocimientoVentas ?? []) {
      docs.push({
        kind: 'solicitudReconocimiento',
        key: `solicitudReconocimiento:${venta.id}`,
        originId: venta.id,
        title: `Solicitud de reconocimiento · ${venta.folio || venta.id}`,
        hint: 'FOR-GSM-CMR-08 · un formato por contrato anterior',
      });
      docs.push({
        kind: 'cartaNoPapeleria',
        key: `cartaNoPapeleria:${venta.id}`,
        originId: venta.id,
        title: `Carta de no papelería · ${venta.folio || venta.id}`,
        hint: 'FOR-GSM-CMR-09 · un formato por contrato anterior',
      });
    }
  }

  if (form.ubicacionPlan.planKind === 'PARQUE') {
    docs.push({
      kind: 'reglamentoParque',
      title: 'Reglamento de parque',
      hint: 'Carta de reglas para el cliente',
    });
    docs.push({
      kind: 'reglamentoParqueFolleto',
      title: 'Reglamento de parque (artículos)',
      hint: 'Folleto carta apaisada · 2 páginas por hoja',
    });
  }

  if (normalizeTipoCobranza(form.contacto.tipoCobranza) === 'DOMICILIADO') {
    docs.push({
      kind: 'cartaAutorizacion',
      title: 'Carta de autorización',
      hint: 'Cargo automático a tarjeta',
    });
  }

  if (
    normalizeTipoCobranza(form.contacto.tipoCobranza) === 'NOMINA' &&
    form.pago.empresaNominaId
  ) {
    docs.push({
      kind: 'cartaNomina',
      title: 'Carta de consentimiento (nómina)',
      hint: form.pago.empresaNomina
        ? `FO-GEN-SMGF-05 · ${form.pago.empresaNomina}`
        : 'Descuento por convenio',
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
