import { GState, jsPDF } from 'jspdf';
import { fullName, isSignedSaleStatus, type SaleFormData } from '../types/sale-form';
import type { ExclusionesLetterOpts } from './exclusiones-letter-pdf';

const PAGE_W = 596;
const PAGE_H = 842;
const ML = 72;
const CONTENT_W = PAGE_W - ML - 70;
const INK: [number, number, number] = [20, 22, 24];
const BLUE: [number, number, number] = [16, 99, 165];

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

type Doc = jsPDF;
type LogoAsset = { dataUrl: string; width: number; height: number };
type Run = { t: string; bold?: boolean };

function v(text?: string | null) {
  return (text ?? '').trim();
}

function parseDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  const date = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date();
  return {
    day: String(date.getDate()),
    month: MESES[date.getMonth()] ?? '',
    year: String(date.getFullYear()),
  };
}

function cityOf(form: SaleFormData) {
  const branch = v(form.meta.branchName);
  if (!branch) return 'Culiacán, Sinaloa';
  if (/sinaloa/i.test(branch)) return branch;
  return `${branch}, Sinaloa`;
}

function loadPng(src: string): Promise<LogoAsset | null> {
  return fetch(src)
    .then(async (res) => {
      if (!res.ok) return null;
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const size = await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          const img = new Image();
          img.onload = () =>
            resolve({
              width: img.naturalWidth || 1,
              height: img.naturalHeight || 1,
            });
          img.onerror = () => reject(new Error(src));
          img.src = dataUrl;
        },
      );
      return { dataUrl, ...size };
    })
    .catch(() => null);
}

function drawRuns(
  doc: Doc,
  runs: Run[],
  x: number,
  y: number,
  maxW: number,
  lineH: number,
) {
  doc.setFontSize(11);
  const words: { t: string; bold: boolean; w: number }[] = [];
  for (const run of runs) {
    doc.setFont('helvetica', run.bold ? 'bold' : 'normal');
    for (const part of run.t.split(/(\s+)/)) {
      if (!part) continue;
      words.push({
        t: part,
        bold: Boolean(run.bold),
        w: doc.getTextWidth(part),
      });
    }
  }
  let cx = x;
  let cy = y;
  for (const word of words) {
    const space = /^\s+$/.test(word.t);
    if (!space && cx > x + 1 && cx + word.w > x + maxW) {
      cx = x;
      cy += lineH;
    }
    if (space && cx <= x + 1) continue;
    doc.setFont('helvetica', word.bold ? 'bold' : 'normal');
    doc.text(word.t, cx, cy);
    cx += word.w;
  }
  return cy + lineH;
}

function drawDraft(doc: Doc) {
  const ys = [PAGE_H * 0.28, PAGE_H * 0.52, PAGE_H * 0.76];
  doc.saveGraphicsState();
  doc.setGState(new GState({ opacity: 0.11 }));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(54);
  doc.setTextColor(120, 128, 136);
  for (const y of ys) {
    doc.text('BORRADOR', PAGE_W / 2, y, {
      align: 'center',
      baseline: 'middle',
      angle: 32,
    });
  }
  doc.restoreGraphicsState();
}

function drawLetter(
  doc: Doc,
  form: SaleFormData,
  logo: LogoAsset | null,
  paw: LogoAsset | null,
) {
  if (paw) {
    const pawW = 310;
    const pawH = (paw.height / paw.width) * pawW;
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity: 0.14 }));
    doc.addImage(
      paw.dataUrl,
      'PNG',
      (PAGE_W - pawW) / 2,
      300,
      pawW,
      pawH,
      undefined,
      'FAST',
    );
    doc.restoreGraphicsState();
  }

  if (logo) {
    const logoH = 54;
    const logoW = (logo.width / logo.height) * logoH;
    doc.addImage(
      logo.dataUrl,
      'PNG',
      PAGE_W - 36 - logoW,
      16,
      logoW,
      logoH,
      undefined,
      'FAST',
    );
  }

  doc.setDrawColor(...BLUE);
  doc.setLineWidth(1.6);
  doc.line(36, 82, PAGE_W - 36, 82);

  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('EXCLUSIONES CONTRACTUALES', PAGE_W / 2, 128, { align: 'center' });

  const lh = 14;
  let y = 168;
  y = drawRuns(
    doc,
    [
      { t: 'CLÁUSULA I. PERIODO DE ESPERA Y CONDICIÓN DE VIGENCIA:', bold: true },
      { t: ' Las partes acuerdan un ' },
      { t: 'periodo de espera obligatorio de 90 (noventa) días naturales', bold: true },
      {
        t: ', contados a partir de la firma del presente contrato y el pago de la primera cuota. Si el fallecimiento de la mascota del titular ocurre dentro de dicho plazo, el contrato no surtirá efectos como "Plan de Previsión". En tal supuesto, la Empresa reconocerá el monto total efectivamente pagado por el Cliente como un ',
      },
      { t: 'saldo a favor', bold: true },
      { t: ', el cual podrá aplicarse exclusivamente a la adquisición de un ' },
      { t: '"Servicio de Necesidad Inmediata"', bold: true },
      { t: ' bajo las tarifas vigentes al momento del suceso.' },
    ],
    ML,
    y,
    CONTENT_W,
    lh,
  );

  y += 8;
  y = drawRuns(
    doc,
    [
      { t: 'CLÁUSULA II. EXCEPCIÓN POR MUERTE ACCIDENTAL:', bold: true },
      { t: ' El periodo de espera de 90 días ' },
      { t: 'no será aplicable', bold: true },
      {
        t: ' cuando el fallecimiento de la mascota sea consecuencia directa de un hecho externo e involuntario que constituya un accidente, debidamente acreditado por un dictamen emitido por el médico veterinario autorizado, o mediante la documentación que la Empresa considere necesaria para acreditar dicha circunstancia. En este supuesto, la Empresa otorgará el servicio funerario para mascotas conforme a la tarifa de previsión contratada, desde el primer día de vigencia.',
      },
    ],
    ML,
    y,
    CONTENT_W,
    lh,
  );

  y += 8;
  y = drawRuns(
    doc,
    [
      { t: 'CLÁUSULA III. USO POSTERIOR AL PLAZO:', bold: true },
      {
        t: ' Transcurridos los 90 días naturales, el servicio de previsión quedará plenamente activo para cualquier causa de fallecimiento, respetando las condiciones y precios establecidos en este instrumento.',
      },
    ],
    ML,
    y,
    CONTENT_W,
    lh,
  );

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(
    'ACEPTACIÓN DE PERIODO DE ESPERA Y CONDICIONES DE TARIFA:',
    PAGE_W / 2,
    y,
    { align: 'center' },
  );
  y += 20;
  y = drawRuns(
    doc,
    [
      { t: 'El titular manifiesta que ha sido informado claramente sobre el ' },
      { t: 'Periodo de Espera de 90 (noventa) días naturales', bold: true },
      {
        t: ' y las implicaciones de solicitar el servicio antes de dicho plazo. Entiende y acepta que, en caso de fallecimiento por causas naturales o enfermedad dentro de este periodo, el servicio se brindará bajo el esquema de ',
      },
      { t: '"Necesidad Inmediata"', bold: true },
      {
        t: ' a precio de lista vigente, aplicando únicamente las cantidades pagadas como saldo a favor. Asimismo, reconoce la excepción de este plazo en caso de ',
      },
      { t: 'muerte accidental', bold: true },
      { t: ' debidamente acreditada.' },
    ],
    ML,
    y,
    CONTENT_W,
    lh,
  );

  y += 6;
  const cliente = fullName(form.contacto);
  y = drawRuns(
    doc,
    [
      { t: 'Lectura y conformidad del Cliente:', bold: true },
      { t: cliente ? ` ${cliente}` : ' _________________________________' },
    ],
    ML,
    y,
    CONTENT_W,
    lh,
  );

  y += 4;
  const date = parseDate(form.meta.fecha);
  y = drawRuns(
    doc,
    [
      { t: 'ENTERADAS LAS PARTES', bold: true },
      {
        t: ' del contenido y alcance legal del presente contrato, lo firman en la ciudad de ',
      },
      { t: cityOf(form), bold: true },
      { t: ', a los ' },
      { t: date.day, bold: true },
      { t: ' días del mes de ' },
      { t: date.month, bold: true },
      { t: ' de ' },
      { t: date.year, bold: true },
      {
        t: ', manifestando que en su celebración no existió dolo, error, mala fe ni cualquier otro vicio del consentimiento que pudiera invalidarlo.',
      },
    ],
    ML,
    y,
    CONTENT_W,
    lh,
  );

  y += 28;
  const firma = form.documentos.firmaCliente;
  if (firma?.dataBase64?.trim()) {
    const dataUrl = firma.dataBase64.startsWith('data:')
      ? firma.dataBase64
      : `data:${firma.mime || 'image/png'};base64,${firma.dataBase64}`;
    try {
      doc.addImage(dataUrl, 'PNG', PAGE_W / 2 - 70, y - 6, 140, 40);
      y += 38;
    } catch {
      /* la firma no bloquea el resto del documento */
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  const nameLabel = cliente
    ? `Nombre y firma del cliente: ${cliente}`
    : 'Nombre y firma del cliente: __________________________________';
  const lines = doc.splitTextToSize(nameLabel, CONTENT_W) as string[];
  doc.text(lines, PAGE_W / 2, y, { align: 'center' });
}

export function isDraftFunepetExclusiones(
  form: SaleFormData,
  opts?: ExclusionesLetterOpts,
): boolean {
  const status = String(opts?.status || '').toUpperCase();
  if (isSignedSaleStatus(status)) return false;
  return !form.documentos?.firmaCliente?.dataBase64?.trim();
}

export async function buildFunepetExclusionesPdf(
  form: SaleFormData,
  opts?: ExclusionesLetterOpts,
): Promise<Blob> {
  const [logo, paw] = await Promise.all([
    loadPng('/forms/funepet-exclusiones-logo.png'),
    loadPng('/forms/funepet-exclusiones-huella.png'),
  ]);
  const doc = new jsPDF({
    unit: 'pt',
    format: [PAGE_W, PAGE_H],
    compress: true,
  });
  drawLetter(doc, form, logo, paw);
  if (isDraftFunepetExclusiones(form, opts)) drawDraft(doc);
  return doc.output('blob');
}
