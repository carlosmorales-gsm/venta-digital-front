import { jsPDF } from 'jspdf';
import { formatUtcToLocal } from '../../../shared/utils/datetime';

export type AuditLogPdfItem = {
  actorName: string | null;
  actorType: string | null;
  action: string;
  entityType: string;
  entityId: number | null;
  summary: string;
  details: Record<string, unknown> | null;
  createdAt: string;
};

/** Títulos cortos y claros para quien no es de sistemas. */
const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Nuevo registro',
  UPDATE: 'Cambio de datos',
  ACTIVATE: 'Habilitación',
  DEACTIVATE: 'Deshabilitación',
  DELETE: 'Eliminación',
  CANCEL: 'Cancelación',
  APPLY: 'Aplicación',
};

/** Campos internos que no aportan al lector de negocio. */
const HIDDEN_FIELDS = new Set(['id', 'sellerId']);

const FIELD_LABELS: Record<string, string> = {
  type: 'Tipo de cuenta',
  fullName: 'Nombre',
  username: 'Usuario de acceso',
  cellphone: 'Celular / WhatsApp',
  active: 'Estado',
  password: 'Contraseña',
  amount: 'Monto',
  sellerName: 'Vendedor',
  titularName: 'Titular',
  status: 'Estatus',
  fecha: 'Fecha',
  contrato: 'Contrato',
  origenVenta: 'Origen de venta',
  folioSolicitud: 'Folio solicitud',
  curp: 'CURP',
  celular: 'Celular',
  correo: 'Correo',
  municipio: 'Municipio',
  estado: 'Estado (domicilio)',
  planKind: 'Tipo de plan',
  nombrePlan: 'Nombre del plan',
  servicioFunerario: 'Servicio funerario',
  parqueFuneral: 'Parque funeral',
  seccion: 'Sección',
  cuadrante: 'Cuadrante',
  numero: 'Número',
  preasignacion: 'Preasignación',
  beneficiario1: 'Beneficiario 1',
  beneficiario1Parentesco: 'Parentesco beneficiario 1',
  beneficiario2: 'Beneficiario 2',
  segundoContacto: 'Segundo contacto',
  documentos: 'Documentos',
  precioPlan: 'Precio del plan',
  anticipo: 'Anticipo',
  pagoInicial: 'Pago inicial',
  frecuencia: 'Frecuencia',
  plazo: 'Plazo',
  importeCadaPago: 'Importe cada pago',
  saldo: 'Saldo',
  formaPago: 'Forma de pago',
  banco: 'Banco',
  cuenta: 'Cuenta',
  nombreAsesor: 'Asesor',
  nombreJefeVentas: 'Jefe de ventas',
  driveFolderUrl: 'Carpeta Drive',
  percent: 'Porcentaje',
  createdByName: 'Generó',
  cancelledByName: 'Canceló',
  appliedSaleId: 'Venta aplicada',
  draftLimit: 'Límite de borradores',
  draftTtlHours: 'Vigencia borrador (h)',
  maxDiscountAmount: 'Descuento máximo (%)',
};

const TYPE_LABELS: Record<string, string> = {
  VENDEDOR: 'Vendedor',
  MONITOR: 'Monitor',
  ADMIN: 'Administrador',
  USER: 'Usuario',
  SALE: 'Venta',
  DISCOUNT: 'Descuento especial',
  SETTINGS: 'Configuración',
  ACTIVE: 'Activo',
  CANCELLED: 'Cancelado',
  APPLIED: 'Aplicado',
  DRAFT: 'Borrador',
  PENDING_PAYMENT: 'Pendiente de pago',
  PENDING_SIGNATURE: 'Pendiente de firma',
  COMPLETED: 'Completada',
  SUBMITTED: 'Enviada',
  PARQUE: 'Parque',
  PLAN_FUTURO: 'Plan a futuro',
};

const COLORS = {
  blue: [53, 100, 125] as const,
  cafe: [204, 160, 121] as const,
  ink: [32, 38, 42] as const,
  muted: [100, 110, 118] as const,
  line: [220, 226, 230] as const,
  card: [248, 250, 251] as const,
  cardAlt: [255, 255, 255] as const,
  detailBg: [255, 255, 255] as const,
  headerBg: [53, 100, 125] as const,
  white: [255, 255, 255] as const,
};

export type AuditPdfFilters = {
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  actorName?: string;
  action?: string;
};

function formatCalendarDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return isoDate;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Sin dato';
  if (typeof value === 'boolean') {
    if (key === 'active') return value ? 'Activo' : 'Inactivo';
    return value ? 'Sí' : 'No';
  }
  if (typeof value === 'string' && TYPE_LABELS[value]) return TYPE_LABELS[value];
  if (key === 'password') {
    const s = String(value).toLowerCase();
    if (s.includes('actualiz') || s.includes('updated')) return 'actualizada';
    return 'no visible';
  }
  return String(value);
}

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

function detailLines(details: Record<string, unknown> | null): string[] {
  if (!details) return [];
  const lines: string[] = [];

  if (details.after && typeof details.after === 'object') {
    for (const [key, value] of Object.entries(
      details.after as Record<string, unknown>,
    )) {
      if (HIDDEN_FIELDS.has(key)) continue;
      lines.push(`${fieldLabel(key)}: ${formatValue(key, value)}`);
    }
    return lines;
  }

  if (details.changes && typeof details.changes === 'object') {
    const changes = details.changes as Record<
      string,
      { from?: unknown; to?: unknown }
    >;
    for (const [key, change] of Object.entries(changes)) {
      if (HIDDEN_FIELDS.has(key)) continue;
      const from = formatValue(key, change?.from);
      const to = formatValue(key, change?.to);
      if (key === 'password') {
        lines.push(`${fieldLabel(key)}: se actualizó`);
        continue;
      }
      if (key === 'active') {
        lines.push(`Estado: pasó de ${from} a ${to}`);
        continue;
      }
      lines.push(`${fieldLabel(key)}: pasó de "${from}" a "${to}"`);
    }
    return lines;
  }

  for (const [key, value] of Object.entries(details)) {
    if (HIDDEN_FIELDS.has(key)) continue;
    if (typeof value === 'object' && value !== null) continue;
    lines.push(`${fieldLabel(key)}: ${formatValue(key, value)}`);
  }

  return lines;
}

const ACTION_VERBS: Record<string, string> = {
  CREATE: 'Dio de alta',
  UPDATE: 'Modificó',
  ACTIVATE: 'Habilitó',
  DEACTIVATE: 'Deshabilitó',
  DELETE: 'Eliminó',
  CANCEL: 'Canceló',
  APPLY: 'Aplicó',
};

const ENTITY_WORDS: Record<string, string> = {
  USER: 'usuario',
  SALE: 'venta',
  DISCOUNT: 'descuento especial',
  SETTINGS: 'configuración',
  VENDEDOR: 'vendedor',
  MONITOR: 'monitor',
  ADMIN: 'administrador',
};

/** Nombre del afectado desde details (sin el actor). */
function targetNameFromDetails(
  details: Record<string, unknown> | null,
): string | null {
  if (!details) return null;

  const after = details.after;
  if (after && typeof after === 'object') {
    const a = after as Record<string, unknown>;
    const titular = a.titularName;
    if (typeof titular === 'string' && titular.trim()) return titular.trim();
    const name = a.fullName;
    if (typeof name === 'string' && name.trim()) return name.trim();
    const seller = a.sellerName;
    if (typeof seller === 'string' && seller.trim()) return seller.trim();
  }

  const changes = details.changes;
  if (changes && typeof changes === 'object') {
    const fullName = (changes as Record<string, { to?: unknown }>).fullName;
    if (typeof fullName?.to === 'string' && fullName.to.trim()) {
      return fullName.to.trim();
    }
  }

  return null;
}

/** Respaldo: saca el nombre del resumen guardado en BD. */
function targetNameFromSummary(summary: string): string | null {
  const m = summary.match(
    /(?:al usuario|al vendedor|al monitor|al administrador|usuario|vendedor)\s+(.+?)(?:\s*\(|$)/i,
  );
  const name = m?.[1]?.trim();
  return name || null;
}

/**
 * Título corto: acción + objetivo.
 * Ej. "Deshabilitó usuario Carlos morales", "Modificó venta #12"
 */
function entryTitle(item: AuditLogPdfItem): string {
  const verb =
    ACTION_VERBS[item.action] ?? ACTION_LABELS[item.action] ?? item.action;
  const entityWord =
    ENTITY_WORDS[item.entityType] ??
    (TYPE_LABELS[item.entityType] ?? 'registro').toLowerCase();
  const name =
    targetNameFromDetails(item.details) ?? targetNameFromSummary(item.summary);

  if (item.entityType === 'SALE') {
    const titular =
      targetNameFromDetails(item.details) ??
      targetNameFromSummary(item.summary);
    if (item.entityId != null && titular) {
      return `${verb} venta #${item.entityId} (${titular})`;
    }
    if (item.entityId != null) return `${verb} venta #${item.entityId}`;
    return `${verb} venta`;
  }

  if (name) return `${verb} ${entityWord} ${name}`;
  if (item.entityId != null) return `${verb} ${entityWord} #${item.entityId}`;
  return verb;
}

function setRgb(
  doc: jsPDF,
  mode: 'text' | 'draw' | 'fill',
  rgb: readonly [number, number, number],
) {
  if (mode === 'text') doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  else if (mode === 'draw') doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  else doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

/** Carga SVG/PNG y lo convierte a PNG data URL para jsPDF. */
function loadImageAsPng(
  src: string,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || 228;
      const h = img.naturalHeight || 104;
      const canvas = document.createElement('canvas');
      // Mayor resolución para que se vea nítido en el PDF
      const scale = 2;
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      resolve({
        dataUrl: canvas.toDataURL('image/png'),
        width: w,
        height: h,
      });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Genera y descarga un PDF de bitácora con lectura visual clara.
 */
export async function downloadAuditLogsPdf(
  items: AuditLogPdfItem[],
  filters: AuditPdfFilters,
) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const marginX = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginX * 2;
  const footerY = pageHeight - 36;
  let y = 36;

  const ensureSpace = (needed: number) => {
    if (y + needed > footerY - 12) {
      doc.addPage();
      y = 40;
    }
  };

  const logo = await loadImageAsPng('/logo-sanmartin-white.svg');

  // —— Cabecera en bloque ——
  const headerH = 88;
  setRgb(doc, 'fill', COLORS.headerBg);
  doc.rect(0, 0, pageWidth, headerH, 'F');
  setRgb(doc, 'fill', COLORS.cafe);
  doc.rect(0, headerH, pageWidth, 4, 'F');

  let textLeft = marginX;
  if (logo) {
    const logoH = 36;
    const logoW = (logo.width / logo.height) * logoH;
    const logoY = (headerH - logoH) / 2;
    doc.addImage(logo.dataUrl, 'PNG', marginX, logoY, logoW, logoH);
    textLeft = marginX + logoW + 16;
  }

  setRgb(doc, 'text', COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Venta Digital', textLeft, 36);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Bitácora de actividad', textLeft, 56);

  doc.setFontSize(9);
  const generated = `Generado: ${formatUtcToLocal(new Date())}`;
  doc.text(generated, pageWidth - marginX, 50, { align: 'right' });
  y = headerH + 22;

  // —— Resumen de filtros ——
  const filterParts: string[] = [];
  if (filters.dateFrom && filters.dateTo && filters.dateFrom === filters.dateTo) {
    filterParts.push(`Día: ${formatCalendarDate(filters.dateFrom)}`);
  } else if (filters.dateFrom || filters.dateTo) {
    filterParts.push(
      `Del ${filters.dateFrom ? formatCalendarDate(filters.dateFrom) : '...'} al ${
        filters.dateTo ? formatCalendarDate(filters.dateTo) : '...'
      }`,
    );
  }
  if (filters.q) filterParts.push(`Búsqueda: "${filters.q}"`);
  if (filters.actorName) filterParts.push(`Hecho por: ${filters.actorName}`);
  if (filters.action) {
    filterParts.push(`Tipo: ${ACTION_LABELS[filters.action] ?? filters.action}`);
  }

  setRgb(doc, 'fill', COLORS.card);
  setRgb(doc, 'draw', COLORS.line);
  doc.roundedRect(marginX, y, contentWidth, 52, 6, 6, 'FD');

  setRgb(doc, 'text', COLORS.blue);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(
    items.length === 1
      ? '1 registro encontrado'
      : `${items.length} registros encontrados`,
    marginX + 14,
    y + 20,
  );

  setRgb(doc, 'text', COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const filterText = filterParts.length
    ? filterParts.join('   |   ')
    : 'Sin filtros adicionales';
  const filterLines = doc.splitTextToSize(filterText, contentWidth - 28);
  doc.text(filterLines, marginX + 14, y + 36);
  y += 68;

  if (!items.length) {
    setRgb(doc, 'text', COLORS.muted);
    doc.setFontSize(11);
    doc.text('No hay actividad para mostrar con estos filtros.', marginX, y);
  } else {
    items.forEach((item, index) => {
      const when = formatUtcToLocal(item.createdAt);
      const who = item.actorName?.trim() || 'Sistema';
      const details = detailLines(item.details);
      const detailTitle =
        item.action === 'CREATE' ? 'Datos registrados' : 'Qué cambió';
      const title = `${index + 1}.  ${entryTitle(item)}`;

      const padX = 16;
      const padY = 14;
      const textWidth = contentWidth - padX * 2 - 8;

      // Columna derecha: badge arriba + fecha abajo (alineados a la izquierda)
      const badgeLabel = who.length > 22 ? `${who.slice(0, 21)}…` : who;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      const badgePadX = 7;
      const badgeH = 15;
      const badgeW = Math.min(
        doc.getTextWidth(badgeLabel) + badgePadX * 2,
        138,
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const whenW = doc.getTextWidth(when);
      const metaColW = Math.max(badgeW, whenW);
      const titleMaxW = Math.max(140, textWidth - metaColW - 16);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      const titleLines = doc.splitTextToSize(title, titleMaxW);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const detailWrapped: string[][] = details.map((line) =>
        doc.splitTextToSize(line, textWidth - 18),
      );
      const detailsHeight = details.length
        ? 18 +
          detailWrapped.reduce((acc, lines) => acc + lines.length * 12 + 4, 0) +
          8
        : 0;

      const metaGap = 4;
      const metaBlockH = badgeH + metaGap + 11;
      const titleBlockH = titleLines.length * 15;
      const headerH = Math.max(titleBlockH, metaBlockH);

      const cardHeight = padY + headerH + 8 + detailsHeight + padY;

      ensureSpace(cardHeight + 10);

      const cardTop = y;
      const fill = index % 2 === 0 ? COLORS.card : COLORS.cardAlt;
      setRgb(doc, 'fill', fill);
      setRgb(doc, 'draw', COLORS.line);
      doc.roundedRect(marginX, cardTop, contentWidth, cardHeight, 7, 7, 'FD');

      // Barra lateral de acento
      setRgb(doc, 'fill', COLORS.blue);
      doc.roundedRect(marginX, cardTop, 5, cardHeight, 7, 7, 'F');
      doc.rect(marginX + 2, cardTop, 4, cardHeight, 'F');

      const contentLeft = marginX + padX + 6;
      const metaColX = marginX + contentWidth - padX - metaColW;
      let cy = cardTop + padY;

      // Título a la izquierda
      setRgb(doc, 'text', COLORS.blue);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(titleLines, contentLeft, cy + 11);

      // Meta a la derecha: badge → fecha (misma X)
      const badgeY = cy;
      setRgb(doc, 'fill', [232, 238, 242]);
      doc.roundedRect(metaColX, badgeY, badgeW, badgeH, 7, 7, 'F');
      setRgb(doc, 'text', COLORS.blue);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(badgeLabel, metaColX + badgePadX, badgeY + badgeH / 2 + 2.5);

      setRgb(doc, 'text', COLORS.muted);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(when, metaColX, badgeY + badgeH + metaGap + 9);

      cy += headerH + 8;

      if (details.length) {
        const boxTop = cy;
        const boxH =
          14 +
          detailWrapped.reduce((acc, lines) => acc + lines.length * 12 + 4, 0) +
          6;

        setRgb(doc, 'fill', COLORS.white);
        setRgb(doc, 'draw', COLORS.line);
        doc.roundedRect(
          marginX + padX,
          boxTop,
          contentWidth - padX * 2,
          boxH,
          4,
          4,
          'FD',
        );

        setRgb(doc, 'text', COLORS.cafe);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(detailTitle.toUpperCase(), marginX + padX + 10, boxTop + 12);

        let dy = boxTop + 26;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        setRgb(doc, 'text', COLORS.ink);
        for (const lines of detailWrapped) {
          // viñeta
          setRgb(doc, 'fill', COLORS.blue);
          doc.circle(marginX + padX + 14, dy - 2.5, 2, 'F');
          setRgb(doc, 'text', COLORS.ink);
          doc.text(lines, marginX + padX + 22, dy);
          dy += lines.length * 12 + 4;
        }
      }

      y = cardTop + cardHeight + 10;
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    setRgb(doc, 'draw', COLORS.line);
    doc.setLineWidth(0.6);
    doc.line(marginX, footerY - 10, pageWidth - marginX, footerY - 10);
    setRgb(doc, 'text', COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Grupo San Martín · Venta Digital', marginX, footerY);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - marginX, footerY, {
      align: 'right',
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`bitacora-venta-digital-${stamp}.pdf`);
}
