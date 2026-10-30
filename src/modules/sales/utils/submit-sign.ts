import { parseSaleKind } from '../constants/sale-kinds';
import { mergeSaleForm, type SaleAttachment, type SaleFormData } from '../types/sale-form';
import { buildAuthorizationLetterPdf } from './authorization-letter-pdf';
import {
  buildCardSidesAttachment,
  buildIneSidesAttachment,
} from './card-sides-pdf';
import { isUasConvenio } from './convenio-letter';
import { buildConvenioLetterPdf } from './convenio-letter-pdf';
import { buildExclusionesLetterPdf } from './exclusiones-letter-pdf';
import { buildInvoiceLetterPdf } from './invoice-letter-pdf';
import { buildNoInvoiceConsentPdf } from './no-invoice-consent-pdf';
import { buildParkRegulationBookletPdf } from './park-regulation-booklet-pdf';
import { buildParkRegulationPdf } from './park-regulation-pdf';
import { normalizeTipoCobranza } from './payment-method';
import { buildFunepetCaratulaBundle } from './funepet-caratula-pdf';
import {
  buildRecognitionBalancePdf,
  saleUsesRecognitionLetter,
} from './recognition-balance-pdf';
import {
  buildNoStationeryPdf,
  saleUsesNoStationery,
} from './no-stationery-pdf';
import {
  buildCancellationRequestPdf,
  saleUsesCancellationRequest,
} from './cancellation-request-pdf';
import { buildSalePreviewPdf } from './sale-pdf';

export type SignSaleRequestBody = {
  firmaCliente: SaleAttachment;
  caratulaPdf?: SaleAttachment;
  cartaFacturaPdf?: SaleAttachment;
  cartaNoFacturaPdf?: SaleAttachment;
  cartaExclusionesPdf?: SaleAttachment;
  reglamentoParquePdf?: SaleAttachment;
  reglamentoParqueFolletoPdf?: SaleAttachment;
  cartaAutorizacionPdf?: SaleAttachment;
  cartaNominaPdf?: SaleAttachment;
  solicitudReconocimientoPdfs?: SaleAttachment[];
  cartaNoPapeleriaPdfs?: SaleAttachment[];
  solicitudCancelacionPdfs?: SaleAttachment[];
  tarjetaPdf?: SaleAttachment;
  inePdf?: SaleAttachment;
};

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** PDFs con la firma incluida, igual que al firmar desde el listado del vendedor. */
export async function buildSignSaleRequest(
  form: SaleFormData,
  saleId: number,
  dataUrl?: string | null,
): Promise<{ body: SignSaleRequestBody; hasCaratula: boolean }> {
  const rawUrl = (dataUrl || '').trim();
  const base64 = rawUrl.includes(',') ? rawUrl.split(',')[1]! : rawUrl;
  const firmaCliente: SaleAttachment | null = base64
    ? {
        name: 'firma-cliente.png',
        mime: 'image/png',
        dataBase64: base64,
      }
    : form.documentos.firmaCliente;
  const formForPdf = firmaCliente
    ? mergeSaleForm({
        ...form,
        documentos: {
          ...form.documentos,
          firmaCliente,
        },
      })
    : form;
  const opts = { saleId, status: 'COMPLETED' };
  const body: SignSaleRequestBody = {
    firmaCliente: firmaCliente ?? {
      name: 'firma-cliente.png',
      mime: 'image/png',
      dataBase64: '',
    },
  };
  const funepet = parseSaleKind(formForPdf.meta.tipoVenta) === 'FUNEPET';

  try {
    const blob = funepet
      ? (await buildFunepetCaratulaBundle(formForPdf, opts)).blob
      : await buildSalePreviewPdf(formForPdf, opts);
    body.caratulaPdf = {
      name: `caratula-contrato_venta-${saleId}.pdf`,
      mime: 'application/pdf',
      dataBase64: await blobToBase64(blob),
    };
  } catch (pdfErr) {
    console.warn('No se pudo generar carátula para Drive', pdfErr);
  }

  if (formForPdf.contacto.factura === 'SI') {
    try {
      const letter = await buildInvoiceLetterPdf(formForPdf, opts);
      body.cartaFacturaPdf = {
        name: `carta-requerimiento-factura_venta-${saleId}.pdf`,
        mime: 'application/pdf',
        dataBase64: await blobToBase64(letter),
      };
    } catch (pdfErr) {
      console.warn('No se pudo generar carta de factura para Drive', pdfErr);
    }
  }
  if (formForPdf.contacto.factura === 'NO') {
    try {
      const letter = await buildNoInvoiceConsentPdf(formForPdf, opts);
      body.cartaNoFacturaPdf = {
        name: `consentimiento-no-factura_venta-${saleId}.pdf`,
        mime: 'application/pdf',
        dataBase64: await blobToBase64(letter),
      };
    } catch (pdfErr) {
      console.warn('No se pudo generar consentimiento de no factura', pdfErr);
    }
  }
  try {
    const letter = await buildExclusionesLetterPdf(formForPdf, opts);
    body.cartaExclusionesPdf = {
      name: funepet
        ? `exclusiones-contractuales_venta-${saleId}.pdf`
        : `carta-aceptacion-exclusiones_venta-${saleId}.pdf`,
      mime: 'application/pdf',
      dataBase64: await blobToBase64(letter),
    };
  } catch (pdfErr) {
    console.warn('No se pudo generar carta de exclusiones', pdfErr);
  }
  if (formForPdf.ubicacionPlan.planKind === 'PARQUE') {
    try {
      const letter = await buildParkRegulationPdf(formForPdf, opts);
      body.reglamentoParquePdf = {
        name: `reglamento-parque_venta-${saleId}.pdf`,
        mime: 'application/pdf',
        dataBase64: await blobToBase64(letter),
      };
    } catch (pdfErr) {
      console.warn('No se pudo generar reglamento de parque', pdfErr);
    }
    try {
      const booklet = await buildParkRegulationBookletPdf(formForPdf, opts);
      body.reglamentoParqueFolletoPdf = {
        name: `reglamento-parque-articulos_venta-${saleId}.pdf`,
        mime: 'application/pdf',
        dataBase64: await blobToBase64(booklet),
      };
    } catch (pdfErr) {
      console.warn('No se pudo generar folleto del reglamento', pdfErr);
    }
  }
  if (
    normalizeTipoCobranza(formForPdf.contacto.tipoCobranza) === 'NOMINA' &&
    formForPdf.pago.empresaNominaId
  ) {
    try {
      const nominaLetter = await buildConvenioLetterPdf(formForPdf, opts);
      body.cartaNominaPdf = {
        name: `carta-consentimiento-nomina_venta-${saleId}.pdf`,
        mime: 'application/pdf',
        dataBase64: await blobToBase64(nominaLetter),
      };
    } catch (pdfErr) {
      console.warn('No se pudo generar carta de nómina para Drive', pdfErr);
    }
  }
  if (saleUsesRecognitionLetter(formForPdf)) {
    const letters: SaleAttachment[] = [];
    for (const venta of formForPdf.meta.reconocimientoVentas ?? []) {
      try {
        const letter = await buildRecognitionBalancePdf(formForPdf, {
          ...opts,
          originId: venta.id,
        });
        const folio = (venta.folio || String(venta.id)).replace(/[^\w.-]+/g, '-');
        letters.push({
          name: `solicitud-reconocimiento-saldo_venta-${saleId}-${folio}.pdf`,
          mime: 'application/pdf',
          dataBase64: await blobToBase64(letter),
        });
      } catch (pdfErr) {
        console.warn(
          `No se pudo generar la solicitud de reconocimiento ${venta.folio || venta.id}`,
          pdfErr,
        );
      }
    }
    if (letters.length) body.solicitudReconocimientoPdfs = letters;
  }
  if (saleUsesNoStationery(formForPdf)) {
    const letters: SaleAttachment[] = [];
    for (const venta of formForPdf.meta.reconocimientoVentas ?? []) {
      try {
        const letter = await buildNoStationeryPdf(formForPdf, {
          ...opts,
          originId: venta.id,
        });
        const folio = (venta.folio || String(venta.id)).replace(/[^\w.-]+/g, '-');
        letters.push({
          name: `carta-no-papeleria_venta-${saleId}-${folio}.pdf`,
          mime: 'application/pdf',
          dataBase64: await blobToBase64(letter),
        });
      } catch (pdfErr) {
        console.warn(
          `No se pudo generar la carta de no papelería ${venta.folio || venta.id}`,
          pdfErr,
        );
      }
    }
    if (letters.length) body.cartaNoPapeleriaPdfs = letters;
  }
  if (saleUsesCancellationRequest(formForPdf.meta.tipoVenta)) {
    const letters: SaleAttachment[] = [];
    for (const venta of formForPdf.meta.reconocimientoVentas ?? []) {
      try {
        const letter = await buildCancellationRequestPdf(formForPdf, {
          ...opts,
          originId: venta.id,
        });
        const folio = (venta.folio || String(venta.id)).replace(/[^\w.-]+/g, '-');
        letters.push({
          name: `solicitud-cancelacion_venta-${saleId}-${folio}.pdf`,
          mime: 'application/pdf',
          dataBase64: await blobToBase64(letter),
        });
      } catch (pdfErr) {
        console.warn(
          `No se pudo generar la solicitud de cancelación ${venta.folio || venta.id}`,
          pdfErr,
        );
      }
    }
    if (letters.length) body.solicitudCancelacionPdfs = letters;
  }
  if (normalizeTipoCobranza(formForPdf.contacto.tipoCobranza) === 'DOMICILIADO') {
    try {
      const authLetter = await buildAuthorizationLetterPdf(formForPdf, opts);
      body.cartaAutorizacionPdf = {
        name: `carta-autorizacion_venta-${saleId}.pdf`,
        mime: 'application/pdf',
        dataBase64: await blobToBase64(authLetter),
      };
    } catch (pdfErr) {
      console.warn('No se pudo generar carta de autorización para Drive', pdfErr);
    }
  }
  if (
    normalizeTipoCobranza(formForPdf.contacto.tipoCobranza) === 'DOMICILIADO' ||
    isUasConvenio(formForPdf)
  ) {
    const frente = formForPdf.documentos.tarjetaFrente;
    const reverso = formForPdf.documentos.tarjetaReverso;
    if (frente && reverso) {
      try {
        const cardPdf = await buildCardSidesAttachment(
          frente,
          reverso,
          `tarjeta-ambos-lados_venta-${saleId}.pdf`,
        );
        if (cardPdf.dataBase64) {
          body.tarjetaPdf = {
            name: cardPdf.name,
            mime: cardPdf.mime,
            dataBase64: cardPdf.dataBase64,
          };
        }
      } catch (pdfErr) {
        console.warn('No se pudo armar el PDF de la tarjeta', pdfErr);
      }
    }
  }
  const ineFrente = formForPdf.documentos.ineFrente;
  const ineReverso = formForPdf.documentos.ineReverso;
  if (ineFrente && ineReverso) {
    try {
      const combined = await buildIneSidesAttachment(
        ineFrente,
        ineReverso,
        `ine-ambos-lados_venta-${saleId}.pdf`,
      );
      if (combined.dataBase64) {
        body.inePdf = {
          name: combined.name,
          mime: combined.mime,
          dataBase64: combined.dataBase64,
        };
      }
    } catch (pdfErr) {
      console.warn('No se pudo armar el PDF de la INE', pdfErr);
    }
  }

  return { body, hasCaratula: Boolean(body.caratulaPdf) };
}
