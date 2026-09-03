import { GState, jsPDF } from 'jspdf';
import { fullName, realContrato, type SaleFormData } from '../types/sale-form';
import { saleOriginLabel } from '../constants/sale-origins';
import { saleCompanyName } from '../constants/sale-companies';
import { formatMoneyDisplay } from './sale-finance';

/** Tamaño exacto de la carátula oficial (pt). */
const PAGE_W = 612.28;
const PAGE_H = 1009.13;

const INK: [number, number, number] = [26, 34, 42];
const MUTED: [number, number, number] = [95, 105, 115];
const LINE: [number, number, number] = [170, 180, 188];
const PILL: [number, number, number] = [72, 84, 94];
/** Encabezado oficial (barra oscura). */
const HEADER_BG: [number, number, number] = [83, 98, 112];
const WHITE: [number, number, number] = [255, 255, 255];

function v(t: string | null | undefined) {
  return (t ?? '').trim();
}

function has(s: string, part: string) {
  return v(s).toUpperCase().includes(part.toUpperCase());
}

function splitDate(iso: string): { d: string; m: string; y: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso?.trim() ?? '');
  if (!m) return { d: '', m: '', y: '' };
  return { d: m[3], m: m[2], y: m[1].slice(-2) };
}

type Doc = jsPDF;

function setInk(doc: Doc, rgb = INK) {
  doc.setTextColor(...rgb);
  doc.setDrawColor(...rgb);
}

function box(
  doc: Doc,
  x: number,
  y: number,
  w: number,
  h: number,
  fill?: [number, number, number],
) {
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.6);
  if (fill) {
    doc.setFillColor(...fill);
    doc.rect(x, y, w, h, 'FD');
  } else {
    doc.rect(x, y, w, h);
  }
}

function vLine(doc: Doc, x: number, y1: number, y2: number) {
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.5);
  doc.line(x, y1, x, y2);
}

function label(doc: Doc, text: string, x: number, y: number, size = 6.2) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  doc.setTextColor(...MUTED);
  doc.text(text, x, y);
}

function value(
  doc: Doc,
  text: string,
  x: number,
  y: number,
  size = 8,
  maxW?: number,
) {
  const t = v(text);
  if (!t) return;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  setInk(doc);
  if (maxW) {
    const clipped = doc.splitTextToSize(t, maxW)[0] as string;
    doc.text(clipped, x, y);
  } else {
    doc.text(t, x, y);
  }
}

/**
 * Campo tipo plantilla oficial: label arriba, valor debajo con hueco.
 * Evita el solape label/valor que había con cellVal + labels a media altura.
 */
function field(
  doc: Doc,
  lbl: string | string[],
  val: string,
  x: number,
  top: number,
  h: number,
  maxW: number,
  opts?: { labelSize?: number; valueSize?: number },
) {
  const lines = Array.isArray(lbl) ? lbl : [lbl];
  const labelSize = opts?.labelSize ?? 5.6;
  const valueSize = opts?.valueSize ?? 7.6;
  let ly = top + 6.2;
  for (const line of lines) {
    label(doc, line, x, ly, labelSize);
    ly += labelSize + 0.8;
  }
  const gap = 3.2;
  const valueY = Math.min(top + h - 3.8, Math.max(ly + gap, top + h * 0.72));
  value(doc, val, x, valueY, valueSize, maxW);
}

/** Valor a la derecha del label (misma línea), para celdas angostas. */
function fieldInline(
  doc: Doc,
  lbl: string,
  val: string,
  x: number,
  y: number,
  labelW: number,
  maxW: number,
  size = 7.4,
) {
  label(doc, lbl, x, y, 5.8);
  value(doc, val, x + labelW, y, size, maxW);
}

function pill(doc: Doc, text: string, cx: number, y: number, w = 160) {
  const h = 14;
  const x = cx - w / 2;
  doc.setFillColor(...PILL);
  doc.roundedRect(x, y, w, h, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(255, 255, 255);
  doc.text(text, cx, y + 9.5, { align: 'center' });
}

function check(
  doc: Doc,
  on: boolean,
  x: number,
  y: number,
  size = 4,
) {
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.55);
  doc.rect(x, y, size, size);
  if (on) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size + 2);
    setInk(doc);
    doc.text('X', x + 0.55, y + size - 0.4);
  }
}

function checkLabel(
  doc: Doc,
  on: boolean,
  x: number,
  y: number,
  text: string,
  size = 4,
  font = 4,
) {
  check(doc, on, x, y, size);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(font);
  setInk(doc);
  doc.text(text, x + size + 2.2, y + size - 0.3);
}

function dateParts(
  doc: Doc,
  iso: string,
  x: number,
  y: number,
  size = 7.5,
) {
  const f = splitDate(iso);
  value(doc, f.d || '  ', x, y, size);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  setInk(doc);
  doc.text('/', x + 16, y);
  value(doc, f.m || '  ', x + 28, y, size);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  doc.text('/', x + 46, y);
  value(doc, f.y || '  ', x + 58, y, size);
}

type LogoAsset = { dataUrl: string; width: number; height: number };

/** Mismo logo del sistema (`AppLayout` / bitácora). */
function loadLogo(): Promise<LogoAsset | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || 114;
      const height = img.naturalHeight || 52;
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve({ dataUrl: c.toDataURL('image/png'), width, height });
    };
    img.onerror = () => resolve(null);
    img.src = '/logo-sanmartin-white.svg';
  });
}

function drawHeader(doc: Doc, logo: LogoAsset | null) {
  const h = 56;
  doc.setFillColor(...HEADER_BG);
  doc.rect(0, 0, PAGE_W, h, 'F');

  if (logo) {
    const logoH = 34;
    const logoW = (logo.width / logo.height) * logoH;
    const logoY = (h - logoH) / 2;
    doc.addImage(logo.dataUrl, 'PNG', 18, logoY, logoW, logoH);
  } else {
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...WHITE);
    doc.text('SAN MARTÍN', 22, 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text('TU VIDA, UN LEGADO', 22, 40);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(...WHITE);
  doc.text('CARÁTULA DEL CONTRATO DE ADHESIÓN PARA LA', PAGE_W - 18, 24, {
    align: 'right',
  });
  doc.text('PRESTACIÓN DE SERVICIOS FUNERARIOS A FUTURO', PAGE_W - 18, 36, {
    align: 'right',
  });
}

function drawMeta(doc: Doc, form: SaleFormData) {
  const { meta } = form;
  const metaX = 20.9;
  const metaY = 62.6;
  const metaW = 569.4;
  box(doc, metaX, metaY, metaW, 75);

  const rowTop = 64;
  const rowH = 22;

  field(doc, 'ORIGEN DE VENTA:', saleOriginLabel(meta.origenVenta), 25.2, rowTop, rowH, 158, {
    labelSize: 5.2,
    valueSize: 7.2,
  });
  field(doc, 'FOLIO DE SOLICITUD:', meta.folioSolicitud, 195.4, rowTop, rowH, 68, {
    labelSize: 5.2,
    valueSize: 7.2,
  });

  const company = saleCompanyName(form.ubicacionPlan.planKind);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  setInk(doc);
  const companyLines = doc.splitTextToSize(company, metaW - 278) as string[];
  let companyY = rowTop + 10;
  for (const line of companyLines.slice(0, 2)) {
    doc.text(line, metaX + metaW - 6, companyY, { align: 'right' });
    companyY += 8.5;
  }

  box(doc, 270.4, 87.4, 315.6, 20.8, [250, 252, 253]);
  label(doc, 'FECHA:', 275.4, 99, 5.2);
  dateParts(doc, meta.fecha, 322, 100, 8);
  fieldInline(doc, 'CONTRATO:', realContrato(meta.contrato), 421, 100, 44, 108, 8);

  box(doc, 25.2, 113.1, 560.8, 19.4);
  label(doc, 'FECHA DE SERVICIO:', 29.7, 125, 5.2);
  dateParts(doc, meta.fechaServicio, 114, 126, 8);

  label(doc, 'ESTATUS:', 208.4, 125);
  checkLabel(doc, has(meta.estatus, 'ACTIVO'), 251.9, 117.8, 'ACTIVO', 3.6, 4);
  checkLabel(doc, has(meta.estatus, 'MEJORA'), 307.6, 117.8, 'MEJORA', 3.6, 4);
  checkLabel(
    doc,
    has(meta.estatus, 'REACTIV'),
    251.9,
    125.5,
    'REACTIVACIÓN',
    3.6,
    4,
  );
  checkLabel(
    doc,
    has(meta.estatus, 'MINOR'),
    307.6,
    125.5,
    'MINORÍA',
    3.6,
    4,
  );

  fieldInline(doc, 'ANTERIOR:', meta.anterior, 353.8, 126, 42, 95, 7);
  fieldInline(doc, 'VERIFICACIÓN:', meta.verificacion, 500, 126, 52, 80, 7);
}

function drawNameRow(
  doc: Doc,
  p: { nombres: string; apellidoMaterno: string; apellidoPaterno: string },
  y: number,
  h = 24,
) {
  box(doc, 25.7, y, 560.3, h);
  vLine(doc, 230, y, y + h);
  vLine(doc, 405, y, y + h);
  field(doc, 'NOMBRE(S):', p.nombres, 30, y, h, 190);
  field(doc, ['APELLIDO', 'PATERNO:'], p.apellidoPaterno, 238, y, h, 155);
  field(doc, ['APELLIDO', 'MATERNO:'], p.apellidoMaterno, 413, y, h, 160);
}

function drawContacto(doc: Doc, form: SaleFormData) {
  const c = form.contacto;
  const L = 21.5;
  const R = 590.8;
  const W = R - L;
  // Solo envuelve datos de contacto (no el segundo contacto).
  const top = 144.6;
  const bottom = 338;
  box(doc, L, top, W, bottom - top);
  pill(doc, 'DATOS DE CONTACTO', (L + R) / 2, 147, 150);

  drawNameRow(doc, c, 167.8, 24.4);

  const y2 = 195.5;
  const h2 = 21.7;
  box(doc, 25.7, y2, 560.4, h2);
  vLine(doc, 268, y2, y2 + h2);
  vLine(doc, 338, y2, y2 + h2);
  vLine(doc, 390, y2, y2 + h2);
  fieldInline(doc, 'CURP:', c.curp, 30, y2 + 14, 28, 200, 7.2);
  label(doc, 'FACTURA:', 274, y2 + 8);
  checkLabel(doc, has(c.factura, 'SI'), 310.7, 200.9, 'SI', 4.4, 5);
  checkLabel(doc, has(c.factura, 'NO'), 310.7, 207.9, 'NO', 4.4, 5);
  label(doc, 'SEXO:', 343.5, y2 + 8);
  checkLabel(doc, has(c.sexo, 'F'), 367.9, 200.9, 'F', 4.4, 5);
  checkLabel(doc, has(c.sexo, 'M'), 367.9, 207.9, 'M', 4.4, 5);
  label(doc, 'ESTADO CIVIL:', 395, y2 + 8);
  checkLabel(doc, has(c.estadoCivil, 'SOLTERO'), 450.5, 200.2, 'SOLTERO', 3.9, 4.2);
  checkLabel(doc, has(c.estadoCivil, 'CASADO'), 450.5, 208.8, 'CASADO', 3.9, 4.2);
  checkLabel(doc, has(c.estadoCivil, 'VIUDO'), 488.2, 200.2, 'VIUDO', 3.9, 4.2);
  checkLabel(
    doc,
    has(c.estadoCivil, 'DIVORCIADO'),
    488.1,
    208.8,
    'DIVORCIADO',
    3.9,
    4.2,
  );
  checkLabel(
    doc,
    has(c.estadoCivil, 'UNION') || has(c.estadoCivil, 'UNIÓN'),
    532.2,
    200.2,
    'UNIÓN LIBRE',
    3.9,
    4.2,
  );
  checkLabel(
    doc,
    has(c.estadoCivil, 'CONCUBINATO'),
    532.2,
    208.8,
    'CONCUBINATO',
    3.9,
    4.2,
  );

  const y3 = 220.1;
  const h3 = 19.4;
  box(doc, 25.7, y3, 560.4, h3);
  vLine(doc, 340, y3, y3 + h3);
  field(doc, 'DIRECCIÓN:', c.direccion, 30, y3, h3, 300, { labelSize: 5.4 });
  field(doc, 'COLONIA:', c.colonia, 342, y3, h3, 185, { labelSize: 5.4 });

  const y4 = 242.7;
  const h4 = 19.4;
  box(doc, 25.7, y4, 479.6, h4);
  box(doc, 505.3, y4, 80.5, h4);
  vLine(doc, 118, y4, y4 + h4);
  field(doc, 'C.P:', c.cp, 30, y4, h4, 70, { labelSize: 5.4 });
  label(doc, 'ENTRE CALLES:', 130, y4 + 6.5, 5.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(3.8);
  doc.setTextColor(...MUTED);
  doc.text('(SEÑA PARTICULAR)', 190, y4 + 6.5);
  value(
    doc,
    [c.entreCalles, c.senaParticular].filter(Boolean).join(' · '),
    130,
    y4 + h4 - 4,
    7,
    360,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(3.8);
  doc.setTextColor(...MUTED);
  doc.text('DOMICILIO PARA ENTREGA', 510.4, y4 + 6);
  doc.setFontSize(4.5);
  doc.text('DE DOCUMENTACIÓN:', 510.4, y4 + 11);
  check(doc, Boolean(v(c.domicilioEntregaDocumentacion)), 575.2, 247.8, 9.5);

  const y5 = 265.4;
  const h5 = 22.3;
  box(doc, 25.7, y5, 414.4, h5);
  box(doc, 446, y5, 139.5, h5);
  vLine(doc, 95, y5, y5 + h5);
  vLine(doc, 250, y5, y5 + h5);
  field(
    doc,
    'SIND.',
    String(c.sindicalizado || '').toUpperCase() === 'SI' ? 'Sí' : 'No',
    30,
    y5,
    h5,
    55,
    { labelSize: 5.2 },
  );
  field(doc, 'MUNICIPIO:', c.municipio, 115.9, y5, h5, 120, { labelSize: 5.2 });
  field(doc, 'ESTADO:', c.estado, 285.9, y5, h5, 110, { labelSize: 5.2 });
  label(doc, 'TIPO DE COBRANZA:', 451, y5 + 7, 5);
  checkLabel(
    doc,
    has(c.tipoCobranza, 'VENTANILLA'),
    505.4,
    271.4,
    'VENTANILLA',
    3.6,
    4,
  );
  checkLabel(
    doc,
    has(c.tipoCobranza, 'DOMICILIADO'),
    505.4,
    277.9,
    'DOMICILIADO',
    3.6,
    4,
  );
  checkLabel(
    doc,
    has(c.tipoCobranza, 'NOMINA') || has(c.tipoCobranza, 'NÓMINA'),
    555.9,
    271.4,
    'NÓMINA',
    3.6,
    4,
  );
  checkLabel(doc, has(c.tipoCobranza, 'OTRO'), 555.9, 277.9, 'OTRO', 3.6, 4);

  const y6 = 291;
  const h6 = 22.4;
  box(doc, 25.7, y6, 560.1, h6);
  vLine(doc, 255, y6, y6 + h6);
  label(doc, 'FECHA DE NACIMIENTO:', 30, y6 + 7, 5.4);
  dateParts(doc, c.fechaNacimiento, 132, y6 + 16, 8);
  field(doc, 'CORREO ELECTRONICO:', c.correo, 267.3, y6, h6, 290, {
    labelSize: 5.2,
  });

  const y7 = 316.7;
  const h7 = 19.4;
  box(doc, 25.4, y7, 560.5, h7);
  vLine(doc, 175, y7, y7 + h7);
  vLine(doc, 350, y7, y7 + h7);
  field(doc, 'CELULAR 1:', c.celular1, 30, y7, h7, 130, { labelSize: 5.2 });
  field(doc, 'CELULAR 2:', c.celular2, 183, y7, h7, 150, { labelSize: 5.2 });
  field(doc, 'OBSERVACIONES:', c.observaciones, 357.6, y7, h7, 215, {
    labelSize: 5.2,
    valueSize: 6.5,
  });
}

function drawSegundo(doc: Doc, form: SaleFormData) {
  const s = form.segundoContacto;
  const top = 348;
  const h = 118;
  box(doc, 21.5, top, 569.4, h);
  pill(
    doc,
    'SEGUNDO CONTACTO DEL TITULAR (RESIDENTE LOCAL)',
    250,
    top + 2.5,
    280,
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(3.8);
  doc.setTextColor(...MUTED);
  doc.text('DOMICILIO PARA ENTREGA', 470, top + 6);
  doc.setFontSize(4.5);
  doc.text('DE DOCUMENTACIÓN:', 470, top + 11);
  check(doc, Boolean(v(s.domicilioEntregaDocumentacion)), 555, top + 5, 8.9);

  drawNameRow(doc, s, top + 20, 24);

  const y2 = top + 47;
  const h2 = 19.4;
  box(doc, 25.4, y2, 560.9, h2);
  vLine(doc, 340, y2, y2 + h2);
  field(doc, 'DIRECCIÓN:', s.direccion, 30, y2, h2, 300, { labelSize: 5.2 });
  field(doc, 'COLONIA:', s.colonia, 342, y2, h2, 185, { labelSize: 5.2 });

  const y3 = top + 69;
  const h3 = 18;
  box(doc, 25.7, y3, 560.9, h3);
  field(doc, 'ENTRE CALLES:', s.entreCalles, 30, y3, h3, 520, { labelSize: 5.2 });

  const y4 = top + 90;
  const h4 = 20;
  box(doc, 25.7, y4, 560.9, h4);
  vLine(doc, 250, y4, y4 + h4);
  vLine(doc, 370, y4, y4 + h4);
  field(doc, 'PARENTESCO:', s.parentesco, 30, y4, h4, 200, { labelSize: 5.2 });
  field(doc, 'C.P:', s.cp, 260.8, y4, h4, 90, { labelSize: 5.2 });
  field(doc, 'CELULAR:', s.celular, 384, y4, h4, 180, { labelSize: 5.2 });
}

function drawBeneficiario(
  doc: Doc,
  title: string,
  p: SaleFormData['derechohabientes']['titularSustituto'],
  yName: number,
) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(...MUTED);
  doc.text(title, 31.8, yName - 4);

  const h = 22;
  drawNameRow(doc, p, yName, h);

  const yMeta = yName + h + 2;
  box(doc, 26, yMeta, 560.3, h);
  vLine(doc, 225, yMeta, yMeta + h);
  vLine(doc, 400, yMeta, yMeta + h);
  label(doc, 'FECHA DE NACIMIENTO:', 30, yMeta + 7, 5.2);
  dateParts(doc, p.fechaNacimiento, 117, yMeta + 16, 7.5);
  field(doc, 'CELULAR:', p.celular, 236.7, yMeta, h, 140, { labelSize: 5.2 });
  field(doc, 'PARENTESCO:', p.parentesco, 415, yMeta, h, 150, {
    labelSize: 5.2,
  });
}

function drawDerechohabientes(doc: Doc, form: SaleFormData) {
  const top = 478;
  const h = 188;
  box(doc, 21.5, top, 569.4, h);
  pill(doc, 'DATOS DE DERECHOHABIENTES', 306, top + 3, 190);
  const d = form.derechohabientes;
  drawBeneficiario(doc, 'TITULAR SUSTITUTO', d.titularSustituto, top + 28);
  drawBeneficiario(
    doc,
    'DATOS DEL PRIMER BENEFICIARIO',
    d.primerBeneficiario,
    top + 84,
  );
  drawBeneficiario(
    doc,
    'DATOS DEL SEGUNDO BENEFICIARIO (OPCIONAL)',
    d.segundoBeneficiario,
    top + 140,
  );
}

function drawPlanPago(doc: Doc, form: SaleFormData) {
  const u = form.ubicacionPlan;
  const p = form.pago;
  const top = 678;
  box(doc, 21.5, top, 569.8, 168);

  pill(doc, 'DATOS DEL PLAN', 145, top + 3, 120);
  pill(doc, 'DATOS DE LA UBICACIÓN', 360, top + 3, 140);
  // N/A a la derecha del pill (antes se montaba encima del título).
  // La captura usa bandera boolean; en carátula se mapea a N/A / activo sin cambiar layout.
  const preasigLabel = u.preasignacion ? 'SI' : 'N/A';
  checkLabel(
    doc,
    has(preasigLabel, 'N/A') || !v(preasigLabel),
    445,
    top + 5.5,
    'N/A',
    5.5,
    6.5,
  );

  const y1 = top + 22;
  const h1 = 20;
  box(doc, 26.9, y1, 212.2, h1);
  box(doc, 244.2, y1, 341.6, h1);
  vLine(doc, 400, y1, y1 + h1);
  field(doc, 'NOMBRE DEL PLAN:', u.nombrePlan, 30, y1, h1, 195, {
    labelSize: 5.2,
  });
  field(doc, 'SECCIÓN:', u.seccion, 250.9, y1, h1, 130, { labelSize: 5.2 });
  field(doc, 'CUADRANTE:', u.cuadrante, 458, y1, h1, 100, { labelSize: 5.2 });

  const y2 = top + 45;
  const h2 = 20;
  box(doc, 26.9, y2, 212.5, h2);
  box(doc, 244.2, y2, 341.6, h2);
  checkLabel(
    doc,
    Boolean(v(u.servicioFunerario)),
    34.9,
    y2 + 7,
    'SERVICIO FUNERARIO',
    6.1,
    6,
  );
  checkLabel(
    doc,
    Boolean(v(u.parqueFuneral)),
    149.5,
    y2 + 7,
    'PARQUE FUNERAL',
    6.1,
    6,
  );
  field(doc, 'NÚMERO:', u.numero, 253, y2, h2, 120, { labelSize: 5.2 });
  check(
    doc,
    Boolean(v(preasigLabel)) && !has(preasigLabel, 'N/A'),
    405.3,
    y2 + 7,
    6.4,
  );
  label(doc, 'PREASIGNACIÓN:', 414.8, y2 + 7, 5.2);

  pill(doc, 'IMPORTE Y CONDICIONES DE PAGO', 306, top + 70, 200);

  const y3 = top + 88;
  const h3 = 22;
  box(doc, 26.5, y3, 559.8, h3);
  vLine(doc, 140, y3, y3 + h3);
  vLine(doc, 290, y3, y3 + h3);
  vLine(doc, 380, y3, y3 + h3);
  vLine(doc, 470, y3, y3 + h3);
  field(doc, 'PRECIO DEL PLAN:', formatMoneyDisplay(p.precioPlan), 30, y3, h3, 100, {
    labelSize: 5,
    valueSize: 6.8,
  });
  field(
    doc,
    ['PROMOCIÓN VIGENTE /', 'DESCUENTO:'],
    p.promocionDescuento?.trim()
      ? `${String(p.promocionDescuento).trim()}%`
      : '',
    145,
    y3,
    h3,
    135,
    { labelSize: 4.8, valueSize: 6.4 },
  );
  field(doc, 'ANTICIPO:', formatMoneyDisplay(p.anticipo), 295, y3, h3, 75, {
    labelSize: 5,
    valueSize: 6.4,
  });
  field(doc, 'PAGO INICIAL:', formatMoneyDisplay(p.pagoInicial), 385, y3, h3, 75, {
    labelSize: 5,
    valueSize: 6.4,
  });
  field(doc, 'SALDO:', formatMoneyDisplay(p.saldo), 475, y3, h3, 95, {
    labelSize: 5,
    valueSize: 6.4,
  });

  const y4 = top + 113;
  const h4 = 34;
  box(doc, 26.8, y4, 559.8, h4);
  label(doc, 'FRECUENCIA:', 30, y4 + 8, 5.2);
  checkLabel(doc, has(p.frecuencia, 'SEMANAL'), 31, y4 + 12, 'SEMANAL', 3.9, 4.2);
  checkLabel(
    doc,
    has(p.frecuencia, 'QUINCENAL'),
    31,
    y4 + 19,
    'QUINCENAL',
    3.9,
    4.2,
  );
  checkLabel(doc, has(p.frecuencia, 'MENSUAL'), 31, y4 + 26, 'MENSUAL', 3.9, 4.2);

  field(doc, 'PLAZO:', p.plazo, 90, y4, 16, 40, { labelSize: 5.2 });
  field(doc, 'IMPORTE DE CADA PAGO:', formatMoneyDisplay(p.importeCadaPago), 135, y4, 16, 70, {
    labelSize: 5,
    valueSize: 6.6,
  });
  // Columna central: fecha arriba, días abajo (sin solape).
  label(doc, 'FECHA DE PRÓXIMO PAGO:', 215, y4 + 6.5, 4.8);
  const fp = splitDate(p.fechaProximoPago);
  value(doc, fp.d ? `${fp.d}/${fp.m}/${fp.y}` : '', 215, y4 + 14.5, 7, 90);
  label(doc, 'DÍAS ESPECÍFICOS DE PAGO:', 215, y4 + 22, 4.8);
  value(doc, p.diasEspecificosPago, 215, y4 + 30.5, 6.5, 90);
  field(doc, ['NOMBRE DEL', 'ASESOR:'], p.nombreAsesor, 320, y4, h4, 90, {
    labelSize: 5,
    valueSize: 6.8,
  });
  field(
    doc,
    ['NOMBRE DEL', 'JEFE DE VENTAS:'],
    p.nombreJefeVentas,
    430,
    y4,
    h4,
    140,
    { labelSize: 5, valueSize: 6.8 },
  );

  const y5 = top + 150;
  const h5 = 16;
  box(doc, 26.5, y5, 559.8, h5);
  label(doc, 'FORMA DE PAGO:', 30.3, y5 + 10, 5.4);
  checkLabel(
    doc,
    has(p.formaPago, 'TRANSFERENCIA'),
    100,
    y5 + 6.5,
    'TRANSFERENCIA',
    4.4,
    5.4,
  );
  checkLabel(doc, has(p.formaPago, 'EFECTIVO'), 185, y5 + 6.5, 'EFECTIVO', 4.4, 5.4);
  checkLabel(doc, has(p.formaPago, 'CHEQUE'), 245, y5 + 6.5, 'CHEQUE', 4.4, 5.4);
  checkLabel(
    doc,
    has(p.formaPago, 'DEBITO'),
    292,
    y5 + 6.5,
    'T. DÉBITO',
    4.4,
    5.2,
  );
  checkLabel(
    doc,
    has(p.formaPago, 'CREDITO'),
    348,
    y5 + 6.5,
    'T. CRÉDITO',
    4.4,
    5.2,
  );
  fieldInline(doc, 'CUENTA:', p.cuenta, 412, y5 + 10, 32, 58, 6.6);
  fieldInline(doc, 'BANCO:', p.banco, 508, y5 + 10, 28, 72, 6.6);
}

function loadImageDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 1;
      c.height = img.naturalHeight || 1;
      const ctx = c.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Hoja 2 tal cual el PDF oficial (plantilla), solo se marcan
 * los consentimientos capturados en el formulario.
 */
async function drawPage2Official(doc: Doc, form: SaleFormData) {
  const bg =
    (await loadImageDataUrl('/forms/caratula-p2.png')) ||
    (await loadImageDataUrl('/forms/declaraciones-p2.png'));
  if (!bg) {
    throw new Error('No se encontró la plantilla oficial de declaraciones');
  }

  doc.addImage(bg, 'PNG', 0, 0, PAGE_W, PAGE_H);

  const merc = v(form.declaraciones.aceptaMercadotecnia).toUpperCase();
  const pub = v(form.declaraciones.aceptaPublicidad).toUpperCase();

  // Coordenadas exactas de los [ ] en la plantilla oficial
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setInk(doc);
  if (merc === 'SI') doc.text('X', 361.2, 475.5);
  if (merc === 'NO') doc.text('X', 386.4, 475.5);
  if (pub === 'SI') doc.text('X', 320.3, 491.2);
  if (pub === 'NO') doc.text('X', 345.5, 491.2);

  // Firma manuscrita (si ya fue capturada al enviar)
  const firmaX = 24;
  const firmaW = 160;
  const firmaY = 580;
  const firmaH = 48;
  const firmaCx = firmaX + firmaW / 2;

  const firma = form.documentos.firmaCliente;
  if (firma?.dataBase64?.trim()) {
    const dataUrl = firma.dataBase64.startsWith('data:')
      ? firma.dataBase64
      : `data:${firma.mime || 'image/png'};base64,${firma.dataBase64}`;
    try {
      doc.addImage(dataUrl, 'PNG', firmaX, firmaY, firmaW, firmaH);
    } catch {
      /* ignore broken signature image */
    }
  }

  // Nombre completo centrado sobre la línea / bajo la firma
  const nombre = fullName(form.contacto);
  if (v(nombre)) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    setInk(doc);
    const lines = doc.splitTextToSize(nombre, firmaW - 10);
    doc.text(lines, firmaCx, 636, { align: 'center' });
  }
}

export type SalePdfOpts = { saleId?: number | null; status?: string };

/** Sin firma (o venta aún no COMPLETED) la carátula es borrador. */
export function isDraftCaratula(
  form: SaleFormData,
  opts?: SalePdfOpts,
): boolean {
  const status = String(opts?.status || '').toUpperCase();
  if (status === 'COMPLETED' || status === 'SUBMITTED') return false;
  const firma = form.documentos?.firmaCliente;
  return !firma?.dataBase64?.trim();
}

function drawDraftWatermark(doc: Doc) {
  const pages = doc.getNumberOfPages();
  const ys = [PAGE_H * 0.14, PAGE_H * 0.38, PAGE_H * 0.62, PAGE_H * 0.86];
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity: 0.11 }));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(78);
    doc.setTextColor(130, 138, 146);
    for (const y of ys) {
      doc.text('BORRADOR', PAGE_W / 2, y, {
        align: 'center',
        baseline: 'middle',
        angle: 32,
      });
    }
    doc.restoreGraphicsState();
  }
}

async function buildDoc(form: SaleFormData, opts?: SalePdfOpts): Promise<jsPDF> {
  const logo = await loadLogo();
  const doc = new jsPDF({
    unit: 'pt',
    format: [PAGE_W, PAGE_H],
    compress: true,
  });

  // Hoja 1: formulario propio (basado en la carátula)
  drawHeader(doc, logo);
  drawMeta(doc, form);
  drawContacto(doc, form);
  drawSegundo(doc, form);
  drawDerechohabientes(doc, form);
  drawPlanPago(doc, form);

  // Hoja 2: declaraciones oficiales tal cual
  doc.addPage([PAGE_W, PAGE_H]);
  await drawPage2Official(doc, form);

  if (isDraftCaratula(form, opts)) {
    drawDraftWatermark(doc);
  }
  return doc;
}

/** PDF vectorial descargable (formato carátula). */
export async function buildSalePreviewPdf(
  form: SaleFormData,
  opts?: SalePdfOpts,
): Promise<Blob> {
  const doc = await buildDoc(form, opts);
  return doc.output('blob');
}

/** Genera PDF + hojas nítidas (alta resolución) en una sola pasada. */
export async function buildSalePreviewBundle(
  form: SaleFormData,
  opts?: { saleId?: number | null; status?: string },
): Promise<{ blob: Blob; pages: string[] }> {
  const blob = await buildSalePreviewPdf(form, opts);
  const { renderPdfToPageImages } = await import('./pdf-page-renderer');
  try {
    const pages = await renderPdfToPageImages(blob);
    return { blob, pages };
  } catch {
    return { blob, pages: [] };
  }
}

/** @deprecated usa buildSalePreviewBundle */
export async function buildSalePreviewPages(
  form: SaleFormData,
): Promise<string[]> {
  const { pages } = await buildSalePreviewBundle(form);
  return pages;
}
