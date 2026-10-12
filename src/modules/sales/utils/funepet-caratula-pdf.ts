import { GState, jsPDF } from 'jspdf';
import { saleOriginLabel } from '../constants/sale-origins';
import { saleCompanyName } from '../constants/sale-companies';
import {
  documentContractFolio,
  formatDigitalFolio,
  fullName,
  isSignedSaleStatus,
  type SaleFormData,
} from '../types/sale-form';
import { normalizeTipoCobranza } from './payment-method';
import { formatMoneyDisplay, parseDiscountPct } from './sale-finance';

/** Mismo papel que la carátula de contrato. Medidas tomadas del formato oficial Funepet. */
const PAGE_W = 612.28;
const PAGE_H = 1009.13;
const FRAME_L = 25.5;
const FRAME_R = 591;
const BAND_L = 30;
const BAND_R = 586.5;

const INK: [number, number, number] = [26, 34, 42];
const BLUE: [number, number, number] = [0, 103, 177];
const HINT: [number, number, number] = [96, 150, 205];
const GRAY: [number, number, number] = [239, 240, 241];
const WHITE: [number, number, number] = [255, 255, 255];

type Doc = jsPDF;
type Rgb = [number, number, number];
type LogoAsset = { dataUrl: string; width: number; height: number };

export async function buildFunepetCaratulaBundle(
  form: SaleFormData,
  opts?: { saleId?: number | null; status?: string },
): Promise<{ blob: Blob; pages: string[] }> {
  const [logo, companySig] = await Promise.all([
    loadPng('/forms/logo-funepet-white.png'),
    loadPng('/forms/firma-inhumaciones-abc.png'),
  ]);
  const doc = new jsPDF({
    unit: 'pt',
    format: [PAGE_W, PAGE_H],
    compress: true,
  });
  drawCaratula(doc, form, logo, opts);
  doc.addPage([PAGE_W, PAGE_H]);
  drawDeclaraciones(doc, form, companySig);
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
  logo: LogoAsset | null,
  opts?: { saleId?: number | null; status?: string },
) {
  const c = form.contacto;
  const sc = form.segundoContacto;
  const ts = form.derechohabientes.titularSustituto;
  const plan = form.ubicacionPlan;
  const pago = form.pago;
  const pet = form.mascota;
  const folio = formatDigitalFolio(form.meta.folioSolicitud || opts?.saleId);
  const contrato = documentContractFolio(
    form.meta.contrato,
    form.meta.folioSolicitud,
    opts?.saleId,
  );
  const origen = v(form.meta.branchName) || saleOriginLabel(form.meta.origenVenta);
  const estatus = v(form.meta.estatus).toUpperCase();
  const freq = v(pago.frecuencia).toUpperCase();
  const forma = v(pago.formaPago).toUpperCase();
  const civil = v(c.estadoCivil).toUpperCase();
  const sexo = v(c.sexo).toUpperCase();
  const sind = v(c.sindicalizado).toUpperCase();
  const cobranza = normalizeTipoCobranza(c.tipoCobranza);
  const tamano = v(pet.tamanoCode).toLowerCase();
  const especie = [v(pet.especieName), v(pet.razaName)].filter(Boolean).join(' / ');
  const entre = [v(c.entreCalles), v(c.senaParticular)].filter(Boolean).join(' · ');
  const pct = parseDiscountPct(pago.promocionDescuento);

  drawHeader(doc, logo);

  // Datos de la venta
  frame(doc, 82.5, 157);
  lab(doc, 'ORIGEN DE VENTA:', 31, 97);
  band(doc, 95.5, 87.5, 191, 101.5);
  val(doc, origen, 99, 97.5, 88);
  lab(doc, 'FOLIO DE SOLICITUD:', 199, 97);
  band(doc, 273.5, 87.5, 370.5, 101.5);
  val(doc, folio, 277, 97.5, 90);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.6);
  doc.setTextColor(...BLUE);
  doc.text(
    doc.splitTextToSize(saleCompanyName(plan.planKind), 200).slice(0, 2),
    581,
    97,
    { align: 'right' },
  );

  band(doc, 273.5, 107.5, BAND_R, 128);
  lab(doc, 'FECHA:', 279, 122);
  datePart(doc, form.meta.fecha, [328, 362, 395], 113.5, 123, 8);
  lab(doc, 'CONTRATO:', 439, 122);
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.8);
  doc.rect(482.2, 111.2, 98.8, 12.8, 'FD');
  val(doc, contrato, 486, 120.6, 92);

  band(doc, BAND_L, 133, BAND_R, 152);
  lab(doc, 'FECHA DE SERVICIO:', 35, 146);
  datePart(doc, form.meta.fechaServicio, [121, 152.5, 183], 138.5, 148, 7);
  div(doc, 206, 133, 152);
  lab(doc, 'ESTATUS:', 213, 146);
  cb(doc, !estatus || estatus === 'ACTIVO' || estatus === 'FUNEPET', 255.4, 136.6, 'ACTIVO');
  cb(doc, estatus.includes('REACTIV'), 255.4, 144.4, 'REACTIVACIÓN');
  cb(doc, estatus.includes('MEJORA'), 310.4, 136.6, 'MEJORA');
  cb(doc, estatus.includes('MINOR'), 310.4, 144.4, 'MINORIA');
  div(doc, 350.5, 133, 152);
  lv(doc, 'ANTERIOR:', form.meta.anterior, 356.5, 146, 504);
  div(doc, 506.5, 133, 152);
  lv(doc, 'VERIFICACIÓN:', form.meta.verificacion, 513, 146, 585);

  // Datos de contacto + segundo contacto
  frame(doc, 180.5, 402.5);
  pill(doc, 'DATOS DE CONTACTO', 268, 183.5, 79.5);

  band(doc, BAND_L, 199, BAND_R, 223.5);
  lab(doc, 'NOMBRE:', 35.3, 215);
  hint(doc, '(PATERNO, MATERNO Y NOMBRES)', 74.8, 206);
  val(doc, fullName(c), 75, 216, 238);
  div(doc, 318, 199, 223.5);
  lab(doc, 'SEXO:', 329, 214);
  cb(doc, sexo.startsWith('F'), 354, 209.6, 'F');
  cb(doc, sexo.startsWith('M') || sexo === 'H', 375, 209.6, 'M');
  div(doc, 399.5, 199, 223.5);
  lab(doc, 'ESTADO CIVIL:', 406.6, 214);
  cb(doc, civil.includes('SOLTER'), 460.5, 204.8, 'SOLTERO');
  cb(doc, civil.includes('CASAD'), 460.5, 213.8, 'CASADO');
  cb(doc, civil.includes('VIUD'), 495, 204.8, 'VIUDO');
  cb(doc, civil.includes('DIVOR'), 495, 213.8, 'DIVORCIADO');
  cb(doc, civil.includes('UNI') || civil.includes('LIBRE'), 537.6, 204.8, 'UNIÓN LIBRE');
  cb(doc, civil.includes('CONCUB'), 537.6, 213.8, 'CONCUBINATO');

  band(doc, BAND_L, 226, BAND_R, 245);
  lv(doc, 'CURP:', c.curp, 35, 238, 205);
  div(doc, 207.5, 226, 245);
  lv(doc, 'RFC:', c.rfc, 213.5, 238, 368);
  div(doc, 370.5, 226, 245);
  lv(doc, 'DIRECCIÓN:', c.direccion, 375.5, 238, 584);

  band(doc, BAND_L, 247.5, 506, 267);
  lv(doc, 'COLONIA:', c.colonia, 35, 260, 201);
  div(doc, 203.5, 247.5, 267);
  lv(doc, 'C.P:', c.cp, 207.5, 260, 266);
  div(doc, 268.5, 247.5, 267);
  lab(doc, 'ENTRE CALLES:', 272.7, 260);
  hint(doc, '(SEÑA PARTICULAR)', 324, 252.6);
  val(doc, entre, 324, 260.5, 178);
  entregaDoc(
    doc,
    v(c.domicilioEntregaDocumentacion).toUpperCase() === 'SI',
    571,
    575.5,
    252.5,
    'right',
  );

  band(doc, BAND_L, 269.5, 501.5, 291.5);
  band(doc, 504.5, 269.5, BAND_R, 291.5);
  lv(doc, 'SIND.', sind === 'SI' ? 'SÍ' : sind, 35, 283.5, 122);
  div(doc, 124.5, 269.5, 291.5);
  lv(doc, 'MUNICIPIO:', c.municipio, 131.6, 283.5, 226);
  div(doc, 228.5, 269.5, 291.5);
  lv(doc, 'ESTADO:', c.estado, 236, 283.5, 317);
  div(doc, 319, 269.5, 291.5);
  lab(doc, 'FECHA DE NACIMIENTO:', 324, 283.5);
  datePart(doc, c.fechaNacimiento, [412.6, 445, 476.6], 275.6, 286, 7);
  lab(doc, 'TIPO DE COBRANZA:', 507.5, 275.4, 4.8);
  cb(doc, cobranza === 'VENTANILLA', 507.5, 278.2, 'VENTANILLA');
  cb(doc, cobranza === 'DOMICILIADO', 507.5, 284.6, 'DOMICILIADO');
  cb(doc, cobranza === 'NOMINA', 553, 278.2, 'NOMINA');
  cb(doc, cobranza === 'OTRO', 553, 284.6, 'OTRO');

  band(doc, BAND_L, 294.5, BAND_R, 314);
  lv(doc, 'CELULAR 1:', c.celular1, 35, 306.8, 165);
  div(doc, 167.5, 294.5, 314);
  lv(doc, 'CELULAR 2:', c.celular2, 175.8, 306.8, 316);
  div(doc, 318.5, 294.5, 314);
  lv(doc, 'CORREO ELECTRONICO:', c.correo, 324.7, 306.8, 584);

  band(doc, BAND_L, 317, BAND_R, 336.5);
  lv(doc, 'OBSERVACIONES:', c.observaciones, 35, 329.4, 584);

  pill(doc, 'SEGUNDO CONTACTO DEL TITULAR (RESIDENTE LOCAL)', 177, 341, 187);
  entregaDoc(
    doc,
    v(sc.domicilioEntregaDocumentacion).toUpperCase() === 'SI',
    372.6,
    432.4,
    341.6,
    'left',
  );

  band(doc, BAND_L, 357.5, BAND_R, 377);
  lab(doc, 'NOMBRE:', 35, 370.5);
  hint(doc, '(PATERNO, MATERNO Y NOMBRES)', 69.4, 361.6);
  val(doc, fullName(sc), 70, 371, 182);
  div(doc, 255, 357.5, 377);
  lv(doc, 'DIRECCIÓN:', sc.direccion, 261.3, 370.5, 458);
  div(doc, 460, 357.5, 377);
  lv(doc, 'CELULAR:', sc.celular, 465.3, 370.5, 584);

  band(doc, BAND_L, 380, BAND_R, 399.5);
  lv(doc, 'COLONIA:', sc.colonia, 36.5, 393, 190);
  div(doc, 192, 380, 399.5);
  lv(doc, 'ENTRE CALLES:', sc.entreCalles, 198.5, 393, 410);
  div(doc, 412, 380, 399.5);
  lv(doc, 'C.P:', sc.cp, 415.6, 393, 469);
  div(doc, 471, 380, 399.5);
  lv(doc, 'PARENTESCO:', sc.parentesco, 474.2, 393, 584);

  // Derechohabientes
  frame(doc, 422.8, 502.5);
  pill(doc, 'DATOS DE DERECHOHABIENTES', 251, 427, 114.4);
  pill(doc, 'TITULAR SUSTITUTO', 31, 439.5, 67.7, 9.4, 5.2);

  band(doc, BAND_L, 453.5, BAND_R, 472.5);
  lab(doc, 'APELLIDO', 38.9, 461);
  lab(doc, 'PATERNO:', 38.9, 468);
  val(doc, ts.apellidoPaterno, 76, 468, 124);
  div(doc, 203.5, 453.5, 472.5);
  lab(doc, 'APELLIDO', 208.7, 461);
  lab(doc, 'MATERNO:', 208.7, 468);
  val(doc, ts.apellidoMaterno, 247, 468, 134);
  div(doc, 383.5, 453.5, 472.5);
  lv(doc, 'NOMBRE(S):', ts.nombres, 390, 466, 584);

  band(doc, BAND_L, 475.5, BAND_R, 494.5);
  lab(doc, 'FECHA DE NACIMIENTO:', 38.9, 488);
  datePart(doc, ts.fechaNacimiento, [125, 158, 192], 481.4, 491, 7);
  div(doc, 227.5, 475.5, 494.5);
  lv(doc, 'CELULAR:', ts.celular, 239.8, 488, 409);
  div(doc, 411.5, 475.5, 494.5);
  lv(doc, 'PARENTESCO:', ts.parentesco, 418.6, 488, 584);

  // Mascota, plan e importe
  frame(doc, 526.2, 757);
  pill(doc, 'IDENTIFICACIÓN DE LA MASCOTA', 249.4, 535.8, 117.2);

  band(doc, BAND_L, 554.5, BAND_R, 587);
  lab(doc, 'NOMBRE:', 38.9, 565);
  val(doc, pet.name, 38.9, 580, 138);
  div(doc, 180.6, 557, 570);
  lab(doc, 'ESPECIE / RAZA:', 185.4, 565);
  val(doc, especie, 185.4, 580, 134);
  div(doc, 323.5, 557, 570);
  lab(doc, 'COLOR:', 331.9, 565);
  val(doc, pet.color, 331.9, 580, 84);
  div(doc, 419.8, 557, 570);
  lab(doc, 'RASGOS', 427, 562);
  lab(doc, 'PARTICULARES:', 427, 568.6);
  val(doc, pet.rasgosParticulares, 427, 580, 156);

  pill(doc, 'DATOS DEL PLAN', 273, 596.8, 69);
  band(doc, BAND_L, 616, 356.5, 635.5);
  lv(doc, 'NOMBRE DEL PLAN:', plan.nombrePlan, 37.7, 628.6, 354);
  band(doc, 370.5, 616, 585, 635.5);
  drawPlanSizes(doc, tamano, 376, 623.2, 582);

  pill(doc, 'IMPORTE Y CONDICIONES DE PAGO', 248, 643.4, 121);
  band(doc, BAND_L, 664, BAND_R, 683);
  lv(
    doc,
    'PRECIO DEL PLAN:',
    formatMoneyDisplay(plan.precioPlan || pago.precioPlan),
    34.7,
    677,
    179,
  );
  div(doc, 181, 664, 683);
  lab(doc, 'PROMOCIÓN VIGENTE /', 185.4, 670.6, 4.8);
  lab(doc, 'DESCUENTO:', 185.4, 677, 4.8);
  val(doc, pct ? `${pct.toFixed(2)} %` : '', 240, 677, 62);
  div(doc, 304, 664, 683);
  lv(doc, 'ANTICIPO:', formatMoneyDisplay(pago.anticipo), 308.6, 677, 396);
  div(doc, 398, 664, 683);
  lv(doc, 'PAGO INICIAL:', formatMoneyDisplay(pago.pagoInicial), 403, 677, 494);
  div(doc, 496.5, 664, 683);
  lv(doc, 'SALDO:', formatMoneyDisplay(pago.saldo), 499.3, 677, 584);

  band(doc, BAND_L, 688.5, BAND_R, 724);
  lab(doc, 'FRECUENCIA:', 34.7, 697);
  cb(doc, freq.includes('SEMANAL'), 35.3, 701.6, 'SEMANAL');
  cb(doc, freq.includes('QUINCENAL'), 35.3, 708.4, 'QUINCENAL');
  cb(doc, freq.includes('MENSUAL'), 35.3, 715.4, 'MENSUAL');
  div(doc, 84, 688.5, 724);
  lab(doc, 'PLAZO:', 89.7, 697);
  val(doc, pago.plazo, 89.7, 712, 28);
  div(doc, 120.2, 688.5, 724);
  lab(doc, 'IMPORTE DE CADA PAGO:', 127.4, 697);
  val(doc, formatMoneyDisplay(pago.importeCadaPago), 127.4, 712, 78);
  div(doc, 208.5, 688.5, 724);
  lv(doc, 'FECHA DE PRÓXIMO PAGO:', dateText(pago.fechaProximoPago), 214.7, 697, 370);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  doc.line(214, 705.6, 369, 705.6);
  lv(doc, 'DÍAS ESPECÍFICOS DE PAGO:', pago.diasEspecificosPago, 214.7, 716.5, 378);
  div(doc, 382, 688.5, 724);
  lab(doc, 'NOMBRE DEL', 388, 695.4, 4.8);
  lab(doc, 'ASESOR:', 388, 701.2, 4.8);
  val(doc, pago.nombreAsesor, 388, 716, 86, 6.6);
  div(doc, 476.2, 688.5, 724);
  lab(doc, 'NOMBRE DEL', 481.4, 695.4, 4.8);
  lab(doc, 'JEFE DE VENTAS:', 481.4, 701.2, 4.8);
  val(doc, pago.nombreJefeVentas, 481.4, 716, 102, 6.6);

  band(doc, BAND_L, 729, BAND_R, 746.5);
  lab(doc, 'FORMA DE PAGO:', 34.7, 740.5);
  cb(doc, forma.includes('TRANSFERENCIA'), 89.7, 736.4, 'TRANSFERENCIA', 4.2, 5);
  cb(doc, forma === 'EFECTIVO', 150.7, 736.4, 'EFECTIVO', 4.2, 5);
  cb(doc, forma.includes('CHEQUE'), 192.6, 736.4, 'CHEQUE', 4.2, 5);
  lineField(doc, 'N°.', '', 245.8, 257, 338, 741);
  lineField(doc, 'CUENTA:', pago.cuenta, 346.2, 378, 464, 741);
  lineField(doc, 'BANCO:', pago.banco, 472.4, 500, 576.5, 741);

  drawFooter(doc);
}

function drawFooter(doc: Doc) {
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  doc.line(FRAME_L, PAGE_H - 40, FRAME_R, PAGE_H - 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BLUE);
  doc.text('SERVICIOS FUNERARIOS PARA MASCOTAS', PAGE_W / 2, PAGE_H - 24, { align: 'center' });
}

/** Vacío mientras no exista registro PROFECO propio del contrato Funepet. */
const FUNEPET_PROFECO_REGISTRO = '';

const OFICINAS = [
  'OFICINAS CORPORATIVAS:',
  'DOMINGO RUBÍ 836 SUR, COL GUADALUPE',
  'CULIACÁN, SIN. C.P. 80220. TELÉFONO: 667 716 5939',
  'WWW.SANMARTIN.COM.MX',
  'CONTACTO@SANMARTIN.COM.MX',
];

function drawDeclaraciones(doc: Doc, form: SaleFormData, companySig: LogoAsset | null) {
  const company = saleCompanyName(form.ubicacionPlan.planKind);
  const merc = v(form.declaraciones.aceptaMercadotecnia).toUpperCase();
  const pub = v(form.declaraciones.aceptaPublicidad).toUpperCase();
  const x = 40;
  const w = PAGE_W - x * 2;
  const bodySize = 8.4;
  const lh = 12.4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.2);
  doc.setTextColor(...BLUE);
  doc.text('DECLARACIONES Y CONSENTIMIENTO DEL CONSUMIDOR (TITULAR)', PAGE_W / 2, 70, {
    align: 'center',
  });

  let y = 104;
  const heading = (text: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.4);
    doc.setTextColor(...BLUE);
    doc.text(text, x, y);
    y += lh + 1;
  };
  const para = (text: string, indent = 0) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(bodySize);
    setInk(doc);
    const lines = doc.splitTextToSize(text, w - indent) as string[];
    doc.text(lines, x + indent, y, { lineHeightFactor: lh / bodySize });
    y += lines.length * lh;
  };
  const bullet = (title: string, text: string) => {
    doc.setFillColor(...BLUE);
    doc.circle(x + 3, y - 2.6, 1.3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(bodySize);
    setInk(doc);
    doc.text(title, x + 10, y);
    y += lh;
    para(text, 10);
    y += 3;
  };
  const gap = () => {
    y += 10;
  };

  const registro = FUNEPET_PROFECO_REGISTRO
    ? ` El Contrato de Adhesión se encuentra inscrito ante la Procuraduría Federal del Consumidor (PROFECO) bajo el número de registro ${FUNEPET_PROFECO_REGISTRO}.`
    : '';

  heading('1. ACEPTACIÓN CONTRACTUAL Y REGISTRO');
  para(
    `El Cliente solicita a ${company} (la "Empresa"), a través de su marca FUNEPET, la contratación del servicio funerario para mascotas detallado al anverso, a favor de la mascota identificada en el mismo. El Cliente declara que conoce y acepta en su integridad el Contrato de Adhesión.${registro}`,
  );
  gap();

  heading('2. ENTREGA DE CLAUSULADO Y DOCUMENTACIÓN');
  para(
    'El Cliente reconoce que, por razones de simplificación de este formato, el clausulado completo no se imprime en el presente; sin embargo, la Empresa se obliga a entregar el ejemplar original del Contrato y la Carátula al momento de la formalización. El Cliente manifiesta que previo a esta firma tuvo a su disposición el catálogo de servicios, precios y el presupuesto detallado.',
  );
  gap();

  heading('3. DERECHOS CLAVE Y CONDICIONES');
  bullet(
    'DERECHO DE REVOCACIÓN',
    'El Cliente podrá cancelar la contratación sin penalización alguna dentro de los 5 (cinco) días hábiles siguientes a la firma, recibiendo la devolución total de sus pagos en un plazo no mayor a 5 días hábiles.',
  );
  bullet(
    'PENAS CONVENCIONALES',
    'Fuera del plazo de revocación, la rescisión por cualquier parte causará una pena convencional equivalente al 10% del valor total del plan contratado.',
  );
  bullet(
    'PERIODO DE CARENCIA',
    'La Empresa prestará los servicios siempre que el plan esté liquidado y hayan transcurrido al menos 3 meses desde la firma. Para uso inmediato o antes de dicho plazo, se deberán cubrir las diferencias tarifarias correspondientes.',
  );
  bullet(
    'CESIÓN',
    'El Cliente podrá ceder sus derechos a un tercero siempre que el plan esté liquidado, notificando por escrito y cubriendo la cuota administrativa vigente.',
  );
  gap();

  heading('4. PRIVACIDAD Y PUBLICIDAD');
  para(
    'Sus datos serán tratados conforme al Aviso de Privacidad disponible en www.sanmartin.com.mx.',
  );
  y += 4;
  const consent = (text: string, value: string) => {
    doc.setFillColor(...BLUE);
    doc.circle(x + 3, y - 2.6, 1.3, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(bodySize);
    setInk(doc);
    doc.text(text, x + 10, y);
    const tx = x + 10 + doc.getTextWidth(text) + 12;
    checkLabel(doc, value === 'SI', tx, y - 6.4, 'SÍ', 7, 8);
    checkLabel(doc, value === 'NO', tx + 34, y - 6.4, 'NO', 7, 8);
    y += lh + 4;
  };
  consent('¿Acepta que su información se use con fines mercadotécnicos o publicitarios?', merc);
  consent('¿Acepta recibir publicidad sobre bienes y servicios de la Empresa?', pub);
  gap();

  heading('5. ATENCIÓN Y CONTROVERSIAS');
  para(
    'Para atención de quejas, dudas o reclamaciones, la Empresa pone a disposición el teléfono 667 716 5939 y el correo contacto@sanmartin.com.mx (L-V de 8:00 a 18:00 hrs). La PROFECO es la autoridad competente en la vía administrativa; para la vía judicial, las partes se someten a los tribunales de Culiacán, Sinaloa.',
  );

  const lineY = Math.max(y + 86, 640);
  const sigW = 160;
  const clientX = x;
  const companyX = x + sigW + 36;

  const firma = form.documentos.firmaCliente;
  if (firma?.dataBase64?.trim()) {
    const dataUrl = firma.dataBase64.startsWith('data:')
      ? firma.dataBase64
      : `data:${firma.mime || 'image/png'};base64,${firma.dataBase64}`;
    try {
      const props = doc.getImageProperties(dataUrl);
      const boxW = sigW - 10;
      const boxH = 52;
      const scale = Math.min(boxW / props.width, boxH / props.height);
      const fw = props.width * scale;
      const fh = props.height * scale;
      doc.addImage(dataUrl, 'PNG', clientX + (sigW - fw) / 2, lineY - 4 - fh, fw, fh);
    } catch {
      /* firma ilegible */
    }
  }
  if (companySig && company.startsWith('INHUMACIONES ABC')) {
    const sh = 40;
    const sw = Math.min(sigW - 20, (companySig.width / companySig.height) * sh);
    doc.addImage(companySig.dataUrl, 'PNG', companyX + (sigW - sw) / 2, lineY - sh - 4, sw, sh);
  }

  doc.setDrawColor(...INK);
  doc.setLineWidth(0.6);
  doc.line(clientX, lineY, clientX + sigW, lineY);
  doc.line(companyX, lineY, companyX + sigW, lineY);

  const nombre = fullName(form.contacto);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  setInk(doc);
  if (v(nombre)) {
    const lines = doc.splitTextToSize(nombre, sigW) as string[];
    doc.text(lines.slice(0, 2), clientX + sigW / 2, lineY + 11, { align: 'center' });
  }
  doc.setTextColor(...BLUE);
  doc.text('FIRMA DE CLIENTE', clientX + sigW / 2, lineY + (v(nombre) ? 24 : 11), {
    align: 'center',
  });
  doc.text(
    doc.splitTextToSize(company, sigW).slice(0, 2),
    companyX + sigW / 2,
    lineY + 11,
    { align: 'center' },
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.4);
  doc.setTextColor(...BLUE);
  OFICINAS.forEach((line, i) => {
    doc.text(line, PAGE_W - x, lineY - 22 + i * 7.4, { align: 'right' });
  });

  drawFooter(doc);
}

function drawHeader(
  doc: Doc,
  logo: LogoAsset | null,
  title = [
    'CARÁTULA DEL CONTRATO DE ADHESIÓN PARA LA PRESTACIÓN',
    'DE SERVICIOS FUNERARIOS PARA MASCOTAS',
  ],
) {
  const h = 54;
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, PAGE_W, h, 'F');
  if (logo) {
    const logoH = 34;
    const logoW = Math.min(130, (logo.width / logo.height) * logoH);
    doc.addImage(logo.dataUrl, 'PNG', 24, (h - logoH) / 2, logoW, logoH, undefined, 'NONE');
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...WHITE);
    doc.text('funepet', 26, 34);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.2);
  doc.setTextColor(...WHITE);
  doc.text(title, 595, 26, { align: 'right', lineHeightFactor: 15 / 10.2 });
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
      const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () =>
          resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
        img.onerror = () => reject(new Error('logo'));
        img.src = dataUrl;
      });
      return { dataUrl, width: size.width, height: size.height };
    })
    .catch(() => null);
}

function v(t: string | null | undefined) {
  return (t ?? '').trim();
}

function setInk(doc: Doc, rgb: Rgb = INK) {
  doc.setTextColor(...rgb);
  doc.setDrawColor(...rgb);
}

function frame(doc: Doc, top: number, bottom: number) {
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.8);
  doc.rect(FRAME_L, top, FRAME_R - FRAME_L, bottom - top);
}

function band(doc: Doc, x0: number, y0: number, x1: number, y1: number) {
  doc.setFillColor(...GRAY);
  doc.rect(x0, y0, x1 - x0, y1 - y0, 'F');
}

function div(doc: Doc, x: number, y0: number, y1: number) {
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.8);
  doc.line(x, y0 + 3.5, x, y1 - 3.5);
}

function lab(doc: Doc, text: string, x: number, y: number, size = 5.6) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  doc.setTextColor(...BLUE);
  doc.text(text, x, y);
}

function hint(doc: Doc, text: string, x: number, y: number) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.4);
  doc.setTextColor(...HINT);
  doc.text(text, x, y);
}

function val(
  doc: Doc,
  text: string | null | undefined,
  x: number,
  y: number,
  maxW: number,
  size = 7.2,
) {
  const t = v(text);
  if (!t || maxW <= 0) return;
  doc.setFont('helvetica', 'bold');
  setInk(doc);
  let s = size;
  doc.setFontSize(s);
  while (s > 4.6 && doc.getTextWidth(t) > maxW) {
    s -= 0.2;
    doc.setFontSize(s);
  }
  const shown = doc.getTextWidth(t) > maxW ? (doc.splitTextToSize(t, maxW)[0] as string) : t;
  doc.text(shown, x, y);
}

/** Etiqueta y valor en el mismo renglón, como en el formato. */
function lv(
  doc: Doc,
  label: string,
  value: string | null | undefined,
  x: number,
  y: number,
  endX: number,
) {
  lab(doc, label, x, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.6);
  const vx = x + doc.getTextWidth(label) + 4;
  val(doc, value, vx, y + 0.4, endX - vx - 2);
}

function lineField(
  doc: Doc,
  label: string,
  value: string | null | undefined,
  x: number,
  lineX0: number,
  lineX1: number,
  y: number,
) {
  lab(doc, label, x, y);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  doc.line(lineX0, y + 1, lineX1, y + 1);
  val(doc, value, lineX0 + 2, y - 0.6, lineX1 - lineX0 - 4, 6.8);
}

function pill(doc: Doc, text: string, x: number, y: number, w: number, h = 11.4, size = 6.2) {
  doc.setFillColor(...BLUE);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  doc.setTextColor(...WHITE);
  doc.text(text, x + w / 2, y + h / 2 + size * 0.35, { align: 'center' });
}

const PLAN_SIZES: [string, string][] = [
  ['mini', 'MINI'],
  ['chico', 'CHICO'],
  ['mediano', 'MEDIANO'],
  ['grande', 'GRANDE'],
  ['gigante', 'GIGANTE'],
];

/** Cinco tamaños en la franja de datos del plan. */
function drawPlanSizes(doc: Doc, tamano: string, x: number, y: number, right: number) {
  const box = 4.8;
  const font = 5.1;
  const text = `${tamano}`.toLowerCase();
  const marked = PLAN_SIZES.find(([code]) => text.includes(code))?.[0] ?? '';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(font);
  const widths = PLAN_SIZES.map(
    ([, label]) => box + 1.8 + doc.getTextWidth(label),
  );
  const used = widths.reduce((sum, width) => sum + width, 0);
  const gap = Math.max(2.2, (right - x - used) / (PLAN_SIZES.length - 1));
  let cursor = x;
  PLAN_SIZES.forEach(([code, label], index) => {
    cb(doc, marked === code, cursor, y, label, box, font);
    cursor += widths[index] + gap;
  });
}

/** Casilla azul del formato; la marca va en tinta. */
function cb(
  doc: Doc,
  on: boolean,
  x: number,
  y: number,
  text: string,
  size = 3.8,
  font = 4.4,
) {
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.5);
  doc.rect(x, y, size, size);
  if (on) cross(doc, x, y, size);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(font);
  doc.setTextColor(...BLUE);
  doc.text(text, x + size + 2.4, y + size - 0.4);
}

function entregaDoc(
  doc: Doc,
  on: boolean,
  textX: number,
  boxX: number,
  boxY: number,
  align: 'left' | 'right',
) {
  const room = align === 'left' ? boxX - textX - 2.5 : textX - (boxX - 60);
  const fit = (text: string, size: number) => {
    let s = size;
    doc.setFontSize(s);
    while (s > 3.4 && doc.getTextWidth(text) > room) {
      s -= 0.1;
      doc.setFontSize(s);
    }
  };
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLUE);
  fit('DOMICILIO PARA ENTREGA', 4.4);
  doc.text('DOMICILIO PARA ENTREGA', textX, boxY + 3.6, { align });
  fit('DE DOCUMENTACIÓN:', 5);
  doc.text('DE DOCUMENTACIÓN:', textX, boxY + 9, { align });
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.7);
  doc.rect(boxX, boxY, 10, 10);
  if (on) cross(doc, boxX, boxY, 10);
}

/** X dibujada dentro de la casilla para que no se salga en tamaños chicos. */
function cross(doc: Doc, x: number, y: number, size: number) {
  const p = size * 0.2;
  doc.setDrawColor(...INK);
  doc.setLineWidth(Math.max(0.55, size * 0.12));
  doc.setLineCap('round');
  doc.line(x + p, y + p, x + size - p, y + size - p);
  doc.line(x + size - p, y + p, x + p, y + size - p);
  doc.setLineCap('butt');
}

/** Casilla con texto en tinta (hoja de declaraciones). */
function checkLabel(
  doc: Doc,
  on: boolean,
  x: number,
  y: number,
  text: string,
  size = 4,
  font = 4,
) {
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.55);
  doc.rect(x, y, size, size);
  if (on) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size + 1.6);
    setInk(doc);
    doc.text('X', x + 0.4, y + size - 0.45);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(font);
  setInk(doc);
  doc.text(text, x + size + 2, y + size - 0.35);
}

function splitDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v(iso));
  if (!m) return { d: '', m: '', y: '' };
  return { d: m[3], m: m[2], y: m[1].slice(-2) };
}

function dateText(iso: string) {
  const f = splitDate(iso);
  return f.d ? `${f.d}/${f.m}/${f.y}` : '';
}

/** DD / MM / AA como en el formato: guía arriba, diagonales y valor centrado. */
function datePart(
  doc: Doc,
  iso: string,
  [dx, mx, ax]: [number, number, number],
  hintY: number,
  y: number,
  size: number,
) {
  hint(doc, 'DD', dx, hintY);
  hint(doc, 'MM', mx, hintY);
  hint(doc, 'AA', ax, hintY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(...BLUE);
  doc.text('/', (dx + mx) / 2 + 1, y);
  doc.text('/', (mx + ax) / 2 + 1, y);
  const f = splitDate(iso);
  if (!f.d) return;
  doc.setFontSize(size);
  setInk(doc);
  doc.text(f.d, dx + 3, y, { align: 'center' });
  doc.text(f.m, mx + 3.4, y, { align: 'center' });
  doc.text(f.y, ax + 3, y, { align: 'center' });
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
    for (const y of [h * 0.18, h * 0.42, h * 0.66, h * 0.9]) {
      doc.text('BORRADOR', w / 2, y, { align: 'center', baseline: 'middle', angle: 32 });
    }
    doc.restoreGraphicsState();
  }
}
