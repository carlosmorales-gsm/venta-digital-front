import { GState, jsPDF } from 'jspdf';
import { saleCompanyName } from '../constants/sale-companies';
import {
  formatDigitalFolio,
  fullName,
  isSignedSaleStatus,
  realContrato,
  type SaleFormData,
} from '../types/sale-form';
import { normalizeTipoCobranza } from './payment-method';
import { parseDiscountPct, parseMoney } from './sale-finance';

/** A4, el mismo papel del reporte Funepet en Odoo. */
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 20;
const INNER = PAGE_W - MARGIN * 2;
const BLUE: [number, number, number] = [0, 114, 192];
const FIELD: [number, number, number] = [240, 240, 240];

type CheckItem = { on: boolean; label: string };

type Cell = {
  w: number;
  label?: string;
  value?: string;
  checks?: CheckItem[];
  perLine?: number;
  /** Razón social, a la derecha y en azul, sin recuadro gris. */
  company?: boolean;
};

type Doc = jsPDF;

export async function buildFunepetCaratulaBundle(
  form: SaleFormData,
  opts?: { saleId?: number | null; status?: string },
): Promise<{ blob: Blob; pages: string[] }> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  drawCaratula(doc, form, opts);
  await drawDeclaraciones(doc, form);
  if (isDraft(form, opts)) drawDraft(doc);
  const blob = doc.output('blob');
  const { renderPdfToPageImages } = await import('./pdf-page-renderer');
  try {
    const pages = await renderPdfToPageImages(blob);
    return { blob, pages };
  } catch {
    return { blob, pages: [] };
  }
}

function drawCaratula(
  doc: Doc,
  form: SaleFormData,
  opts?: { saleId?: number | null; status?: string },
) {
  const c = form.contacto;
  const sc = form.segundoContacto;
  const ts = form.derechohabientes.titularSustituto;
  const plan = form.ubicacionPlan;
  const pago = form.pago;
  const pet = form.mascota;
  const sexo = text(c.sexo).toUpperCase();
  const civil = text(c.estadoCivil).toUpperCase();
  const estatus = text(form.meta.estatus).toUpperCase();
  const freq = text(pago.frecuencia).toUpperCase();
  const forma = text(pago.formaPago).toUpperCase();
  const cobranza = normalizeTipoCobranza(c.tipoCobranza);
  const tamano = text(pet.tamanoCode).toLowerCase();
  const especieRaza = [text(pet.especieName), text(pet.razaName)]
    .filter(Boolean)
    .join(' / ');
  const entre = [text(c.entreCalles), text(c.senaParticular)]
    .filter(Boolean)
    .join(' · ');
  const pct = parseDiscountPct(pago.promocionDescuento);

  let y = 16;
  y = header(doc, y);
  y += 4;

  y = drawTable(doc, y, [
    [
      { w: 0.28, label: 'Origen de venta:', value: text(form.meta.branchName) },
      {
        w: 0.28,
        label: 'Folio de solicitud:',
        value: formatDigitalFolio(form.meta.folioSolicitud || opts?.saleId),
      },
      {
        w: 0.44,
        company: true,
        value: saleCompanyName(plan.planKind),
      },
    ],
  ]);

  y = drawTable(doc, y, [
    [
      { w: 0.4, label: 'Fecha:', value: dmy(form.meta.fecha, ' / ') },
      { w: 0.6, label: 'Contrato:', value: realContrato(form.meta.contrato) },
    ],
  ]);

  y = drawTable(doc, y, [
    [
      {
        w: 0.28,
        label: 'Fecha de servicio:',
        value: dmy(form.meta.fechaServicio, ' / ') || ' /  / ',
      },
      {
        w: 0.36,
        label: 'Estatus:',
        perLine: 4,
        checks: [
          { on: !estatus || estatus === 'ACTIVO' || estatus === 'FUNEPET', label: 'ACTIVO' },
          { on: estatus.includes('REACTIV'), label: 'REACTIVACIÓN' },
          { on: estatus === 'MEJORA', label: 'MEJORA' },
          { on: estatus === 'MINORIA' || estatus === 'MINORÍA', label: 'MINORÍA' },
        ],
      },
      { w: 0.18, label: 'Anterior:', value: text(form.meta.anterior) },
      { w: 0.18, label: 'Verificación:', value: text(form.meta.verificacion) },
    ],
  ]);

  y = pill(doc, y, 'DATOS DE CONTACTO');
  y = drawTable(doc, y, [
    [
      {
        w: 0.7,
        label: 'Nombre: (paterno, materno y nombres)',
        value: fullName(c),
      },
      {
        w: 0.3,
        label: 'Sexo:',
        checks: [
          { on: sexo.startsWith('F'), label: 'F' },
          { on: sexo.startsWith('M') || sexo === 'H', label: 'M' },
        ],
      },
    ],
    [
      {
        w: 1,
        label: 'Estado civil:',
        checks: [
          { on: civil.includes('SOLTER'), label: 'SOLTERO' },
          { on: civil.includes('CASAD'), label: 'CASADO' },
          { on: civil.includes('VIUD'), label: 'VIUDO' },
          { on: civil.includes('DIVOR'), label: 'DIVORCIADO' },
          { on: civil.includes('UNI') || civil.includes('LIBRE'), label: 'UNIÓN LIBRE' },
          { on: civil.includes('CONCUB'), label: 'CONCUBINATO' },
        ],
      },
    ],
    [
      { w: 0.55, label: 'CURP:', value: text(c.curp) },
      { w: 0.45, label: 'RFC:', value: text(c.rfc) },
    ],
    [{ w: 1, label: 'Dirección:', value: text(c.direccion) }],
  ]);

  y = drawTable(doc, y, [
    [
      { w: 0.28, label: 'Colonia:', value: text(c.colonia) },
      { w: 0.12, label: 'C.P:', value: text(c.cp) },
      { w: 0.38, label: 'Entre calles: (seña particular)', value: entre },
      {
        w: 0.22,
        label: 'Domicilio para entrega de documentación',
        checks: [
          {
            on: text(sc.domicilioEntregaDocumentacion).toUpperCase() === 'SI',
            label: '',
          },
        ],
      },
    ],
  ]);

  y = drawTable(doc, y, [
    [
      { w: 0.1, label: 'Sind.', value: text(c.sindicalizado) },
      { w: 0.22, label: 'Municipio:', value: text(c.municipio) },
      { w: 0.2, label: 'Estado:', value: text(c.estado) },
      {
        w: 0.18,
        label: 'Fecha de nacimiento:',
        value: dmy(c.fechaNacimiento, '/'),
      },
      {
        w: 0.3,
        label: 'Tipo de cobranza:',
        perLine: 2,
        checks: [
          { on: cobranza === 'VENTANILLA', label: 'VENTANILLA' },
          { on: cobranza === 'DOMICILIADO', label: 'DOMICILIADO' },
          { on: cobranza === 'NOMINA', label: 'NOMINA' },
          { on: cobranza === 'OTRO', label: 'OTRO' },
        ],
      },
    ],
  ]);

  y = drawTable(doc, y, [
    [
      { w: 0.22, label: 'Celular 1:', value: text(c.celular1) },
      { w: 0.22, label: 'Celular 2:', value: text(c.celular2) },
      { w: 0.56, label: 'Correo electronico:', value: text(c.correo) },
    ],
    [{ w: 1, label: 'Observaciones:', value: text(c.observaciones) }],
  ]);

  y = pill(doc, y, 'SEGUNDO CONTACTO DEL TITULAR (RESIDENTE LOCAL)');
  y = drawTable(doc, y, [
    [
      { w: 0.5, label: 'Nombre: (paterno, materno y nombres)', value: fullName(sc) },
      { w: 0.5, label: 'Dirección:', value: text(sc.direccion) },
    ],
    [
      { w: 0.5, label: 'Celular:', value: text(sc.celular) },
      { w: 0.5, label: 'Colonia:', value: text(sc.colonia) },
    ],
    [
      { w: 0.5, label: 'Entre calles:', value: text(sc.entreCalles) },
      {
        w: 0.18,
        label: 'C.P:',
        value: text(sc.cp),
      },
      { w: 0.32, label: 'Parentesco:', value: text(sc.parentesco) },
    ],
  ]);

  y = pill(doc, y, 'DATOS DE DERECHOHABIENTES');
  y = subhead(doc, y, 'TITULAR SUSTITUTO');
  y = drawTable(doc, y, [
    [{ w: 1, label: 'Nombre(s):', value: fullName(ts) }],
    [
      {
        w: 0.34,
        label: 'Fecha de nacimiento:',
        value: dmy(ts.fechaNacimiento, '/'),
      },
      { w: 0.33, label: 'Celular:', value: text(ts.celular) },
      { w: 0.33, label: 'Parentesco:', value: text(ts.parentesco) },
    ],
  ]);

  y = pill(doc, y, 'IDENTIFICACIÓN DE LA MASCOTA');
  y = drawTable(doc, y, [
    [
      { w: 0.22, label: 'Nombre:', value: text(pet.name) },
      { w: 0.28, label: 'Especie / raza:', value: especieRaza },
      { w: 0.18, label: 'Color:', value: text(pet.color) },
      { w: 0.32, label: 'Rasgos particulares:', value: text(pet.rasgosParticulares) },
    ],
  ]);

  y = pill(doc, y, 'DATOS DEL PLAN');
  y = drawTable(doc, y, [
    [
      { w: 0.62, label: 'Nombre del plan:', value: text(plan.nombrePlan) },
      {
        w: 0.38,
        checks: [
          { on: tamano === 'chico', label: 'CHICO' },
          { on: tamano === 'mediano', label: 'MEDIANO' },
          { on: tamano === 'grande', label: 'GRANDE' },
        ],
      },
    ],
  ]);

  y = pill(doc, y, 'IMPORTE Y CONDICIONES DE PAGO');
  y = drawTable(doc, y, [
    [
      { w: 0.2, label: 'Precio del plan:', value: money(plan.precioPlan || pago.precioPlan) },
      {
        w: 0.2,
        label: 'Promoción vigente / descuento:',
        value: pct ? `${pct.toFixed(2)} %` : '',
      },
      { w: 0.2, label: 'Anticipo:', value: money(pago.anticipo) },
      { w: 0.2, label: 'Pago inicial:', value: money(pago.pagoInicial) },
      { w: 0.2, label: 'Saldo:', value: money(pago.saldo) },
    ],
  ]);

  y = drawTable(doc, y, [
    [
      {
        w: 0.2,
        label: 'Frecuencia:',
        perLine: 1,
        checks: [
          { on: freq.includes('SEMANAL'), label: 'SEMANAL' },
          { on: freq.includes('QUINCENAL'), label: 'QUINCENAL' },
          { on: freq.includes('MENSUAL'), label: 'MENSUAL' },
        ],
      },
      { w: 0.12, label: 'Plazo:', value: text(pago.plazo) },
      { w: 0.16, label: 'Importe de cada pago:', value: money(pago.importeCadaPago) },
      {
        w: 0.16,
        label: 'Fecha de próximo pago:',
        value: dmy(pago.fechaProximoPago, '/'),
      },
      { w: 0.18, label: 'Nombre del asesor:', value: text(pago.nombreAsesor) },
      {
        w: 0.18,
        label: 'Nombre del jefe de ventas:',
        value: text(pago.nombreJefeVentas),
      },
    ],
  ]);

  y = drawTable(doc, y, [
    [
      {
        w: 0.42,
        label: 'Forma de pago:',
        checks: [
          { on: forma.includes('TRANSFERENCIA'), label: 'TRANSFERENCIA' },
          { on: forma === 'EFECTIVO', label: 'EFECTIVO' },
          { on: forma.includes('CHEQUE'), label: 'CHEQUE' },
        ],
      },
      { w: 0.1, label: 'N°:', value: '' },
      { w: 0.24, label: 'Cuenta:', value: text(pago.cuenta) },
      { w: 0.24, label: 'Banco:', value: text(pago.banco) },
    ],
  ]);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BLUE);
  doc.text('SERVICIOS FUNERARIOS PARA MASCOTAS', PAGE_W / 2, Math.min(y + 12, PAGE_H - 14), {
    align: 'center',
  });
}

/** Hoja de declaraciones (mismo tamaño que la plantilla oficial). */
const P2_W = 612.28;
const P2_H = 1009.13;

async function drawDeclaraciones(doc: Doc, form: SaleFormData) {
  const bg =
    (await loadImageDataUrl('/forms/caratula-p2.png')) ||
    (await loadImageDataUrl('/forms/declaraciones-p2.png'));
  if (!bg) {
    throw new Error('No se encontró la plantilla de declaraciones');
  }

  doc.addPage([P2_W, P2_H]);
  doc.addImage(bg, 'PNG', 0, 0, P2_W, P2_H);

  const merc = text(form.declaraciones.aceptaMercadotecnia).toUpperCase();
  const pub = text(form.declaraciones.aceptaPublicidad).toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  if (merc === 'SI') doc.text('X', 361.2, 475.5);
  if (merc === 'NO') doc.text('X', 386.4, 475.5);
  if (pub === 'SI') doc.text('X', 320.3, 491.2);
  if (pub === 'NO') doc.text('X', 345.5, 491.2);

  const firmaX = 24;
  const firmaW = 160;
  const firmaY = 580;
  const firmaH = 48;
  const firma = form.documentos.firmaCliente;
  if (firma?.dataBase64?.trim()) {
    const dataUrl = firma.dataBase64.startsWith('data:')
      ? firma.dataBase64
      : `data:${firma.mime || 'image/png'};base64,${firma.dataBase64}`;
    try {
      doc.addImage(dataUrl, 'PNG', firmaX, firmaY, firmaW, firmaH);
    } catch {
      /* la línea de firma queda vacía si la imagen no se puede leer */
    }
  }

  const nombre = fullName(form.contacto);
  if (nombre) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(nombre, firmaW - 10);
    doc.text(lines, firmaX + firmaW / 2, 636, { align: 'center' });
  }
}

function loadImageDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1;
      canvas.height = img.naturalHeight || 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function header(doc: Doc, y: number) {
  const h = 46;
  doc.setFillColor(...BLUE);
  doc.roundedRect(MARGIN, y, INNER, h, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('funepet', MARGIN + 12, y + 29);
  doc.setFontSize(8);
  const titleW = INNER * 0.72;
  const title = doc.splitTextToSize(
    'CARÁTULA DEL CONTRATO DE ADHESIÓN PARA LA PRESTACIÓN DE SERVICIOS FUNERARIOS PARA MASCOTAS',
    titleW,
  );
  doc.text(title, MARGIN + INNER * 0.26 + titleW / 2, y + 16, { align: 'center' });
  return y + h;
}

function pill(doc: Doc, y: number, label: string) {
  y = ensure(doc, y, 18);
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const w = doc.getTextWidth(label) + 16;
  const h = 13;
  doc.setFillColor(...BLUE);
  doc.roundedRect(MARGIN, y, w, h, 6, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(label, MARGIN + 8, y + 9.2);
  return y + h + 2;
}

function subhead(doc: Doc, y: number, label: string) {
  y = ensure(doc, y, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BLUE);
  doc.text(label, MARGIN, y + 9);
  return y + 12;
}

function drawTable(doc: Doc, y: number, rows: Cell[][]) {
  const heights = rows.map((row) =>
    Math.max(18, ...row.map((cell) => cellHeight(doc, cell))),
  );
  const total = heights.reduce((sum, h) => sum + h, 0);
  y = ensure(doc, y, total);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.7);
  doc.rect(MARGIN, y, INNER, total);
  let ry = y;
  rows.forEach((row, index) => {
    paintRow(doc, ry, heights[index], row);
    ry += heights[index];
  });
  return y + total + 3;
}

function cellWidth(cell: Cell) {
  return INNER * cell.w;
}

function labelLines(doc: Doc, cell: Cell): string[] {
  if (!cell.label) return [];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  return doc.splitTextToSize(cell.label.toUpperCase(), cellWidth(cell) - 8);
}

function valueLines(doc: Doc, cell: Cell): string[] {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const lines = doc.splitTextToSize(cell.value || ' ', cellWidth(cell) - 12);
  return lines.slice(0, 2);
}

function cellHeight(doc: Doc, cell: Cell) {
  if (cell.company) return 22;
  let h = 4;
  const labels = labelLines(doc, cell);
  if (labels.length) h += labels.length * 7.4;
  if (cell.checks) {
    const per = cell.perLine || cell.checks.length || 1;
    h += Math.ceil(cell.checks.length / per) * 9 + 2;
  } else {
    h += Math.max(11, valueLines(doc, cell).length * 8 + 3);
  }
  return h + 3;
}

function paintRow(doc: Doc, y: number, rowH: number, row: Cell[]) {
  let x = MARGIN;
  for (const cell of row) {
    const w = cellWidth(cell);
    if (cell.company) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...BLUE);
      const lines = doc.splitTextToSize(cell.value || '', w - 10);
      doc.text(lines, x + w - 4, y + rowH / 2 + 1, {
        align: 'right',
        baseline: 'middle',
      });
      x += w;
      continue;
    }
    let ty = y + 3;
    const labels = labelLines(doc, cell);
    if (labels.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(...BLUE);
      doc.text(labels, x + 3, ty + 6);
      ty += labels.length * 7.4;
    }
    if (cell.checks) {
      const checksY = labels.length ? ty + 1 : y + 10;
      drawChecks(doc, cell.checks, x + 3, checksY, cell.perLine || cell.checks.length);
    } else {
      const lines = cell.value ? valueLines(doc, cell) : [];
      const fieldH = Math.max(11, lines.length * 8 + 3);
      doc.setFillColor(...FIELD);
      doc.rect(x + 3, ty + 1, Math.max(8, w - 6), fieldH, 'F');
      if (lines.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(0, 0, 0);
        doc.text(lines, x + 5, ty + 9);
      }
    }
    x += w;
  }
}

function drawChecks(
  doc: Doc,
  items: CheckItem[],
  x: number,
  y: number,
  perLine: number,
) {
  const box = 6.4;
  const lineH = 9;
  let cx = x;
  let cy = y;
  items.forEach((item, index) => {
    if (index > 0 && index % perLine === 0) {
      cx = x;
      cy += lineH;
    }
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.rect(cx, cy, box, box);
    if (item.on) {
      doc.setLineWidth(0.9);
      doc.line(cx + 1.15, cy + 3.2, cx + 2.55, cy + 5.15);
      doc.line(cx + 2.55, cy + 5.15, cx + 5.35, cy + 1.35);
    }
    if (item.label) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.3);
      doc.setTextColor(0, 0, 0);
      doc.text(item.label, cx + box + 2, cy + 5.5);
      cx += box + 2 + doc.getTextWidth(item.label) + 5;
    }
  });
}

function ensure(doc: Doc, y: number, need: number) {
  if (y + need <= PAGE_H - 24) return y;
  doc.addPage();
  return 16;
}

function text(value: string | null | undefined) {
  return (value ?? '').trim();
}

function dmy(iso: string, sep: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text(iso));
  if (!match) return '';
  return `${match[3]}${sep}${match[2]}${sep}${match[1].slice(-2)}`;
}

function money(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const n = parseMoney(value);
  if (!Number.isFinite(n)) return '';
  const formatted = n.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${formatted}`;
}

function isDraft(form: SaleFormData, opts?: { status?: string }) {
  const status = String(opts?.status || '').toUpperCase();
  if (isSignedSaleStatus(status)) return false;
  return !form.documentos?.firmaCliente?.dataBase64?.trim();
}

function drawDraft(doc: Doc) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity: 0.11 }));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(78);
    doc.setTextColor(130, 138, 146);
    for (const y of [h * 0.14, h * 0.38, h * 0.62, h * 0.86]) {
      doc.text('BORRADOR', w / 2, y, {
        align: 'center',
        baseline: 'middle',
        angle: 32,
      });
    }
    doc.restoreGraphicsState();
  }
}
