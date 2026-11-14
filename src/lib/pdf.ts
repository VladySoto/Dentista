import type { jsPDF } from 'jspdf'
import type { Config, Documento, Paciente } from './db'
import { dinero, edad } from './format'

const TEAL: [number, number, number] = [13, 148, 136]
const GRIS: [number, number, number] = [100, 116, 139]
const NEGRO: [number, number, number] = [15, 23, 42]

const fechaTexto = (ts: number) => new Date(ts).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })

/** Encabezado con los datos del consultorio. Devuelve la altura usada. */
function encabezado(doc: jsPDF, c: Config, m: number, ancho: number, y: number) {
  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...TEAL)
  doc.text(c.consultorio || 'Consultorio Dental', m, y)
  y += 5.5
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...NEGRO)
  const dentista = [c.dentista, c.matricula && `Mat. ${c.matricula}`].filter(Boolean).join('  ·  ')
  if (dentista) { doc.text(dentista, m, y); y += 4.5 }
  const contacto = [c.direccion, c.telefono && `Tel. ${c.telefono}`].filter(Boolean).join('  ·  ')
  if (contacto) {
    doc.setFontSize(8.5).setTextColor(...GRIS)
    const lineas = doc.splitTextToSize(contacto, ancho)
    doc.text(lineas, m, y); y += 4 * lineas.length
  }
  doc.setDrawColor(...TEAL).setLineWidth(0.6).line(m, y, m + ancho, y)
  return y + 7
}

function datosPaciente(doc: jsPDF, p: Paciente, fecha: number, m: number, ancho: number, y: number) {
  doc.setFontSize(10).setTextColor(...NEGRO)
  doc.setFont('helvetica', 'bold').text('Paciente:', m, y)
  const x = m + doc.getTextWidth('Paciente:') + 2
  const e = edad(p.fechaNacimiento)
  doc.setFont('helvetica', 'normal').text(`${p.nombre}${e !== null ? `  (${e} años)` : ''}`, x, y)
  doc.text(fechaTexto(fecha), m + ancho, y, { align: 'right' })
  if (p.documento) { y += 5; doc.setTextColor(...GRIS).text(`CI ${p.documento}`, m, y) }
  return y + 9
}

function firma(doc: jsPDF, c: Config, m: number, ancho: number, yPie: number) {
  const x = m + ancho / 2
  doc.setDrawColor(...GRIS).setLineWidth(0.3).line(x - 30, yPie, x + 30, yPie)
  doc.setFontSize(9).setTextColor(...NEGRO).setFont('helvetica', 'normal')
  doc.text(c.dentista || 'Firma y sello', x, yPie + 4.5, { align: 'center' })
  if (c.matricula) doc.setTextColor(...GRIS).text(`Mat. ${c.matricula}`, x, yPie + 8.5, { align: 'center' })
}

export async function pdfDocumento(d: Documento, p: Paciente, c: Config): Promise<{ blob: Blob; nombre: string }> {
  const { jsPDF } = await import('jspdf')
  const base = p.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
  const dia = new Date(d.fecha).toISOString().slice(0, 10)

  if (d.tipo === 'receta') {
    const doc = new jsPDF({ format: 'a5', unit: 'mm' })
    const m = 14, ancho = 148 - 2 * m, alto = 210
    let y = encabezado(doc, c, m, ancho, 17)
    y = datosPaciente(doc, p, d.fecha, m, ancho, y)
    doc.setFont('times', 'bolditalic').setFontSize(20).setTextColor(...TEAL).text('Rp/', m, y)
    y += 8
    d.medicamentos.forEach((med, i) => {
      if (y > alto - 50) { doc.addPage(); y = 20 }
      doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...NEGRO).text(`${i + 1}. ${med.nombre}`, m, y)
      y += 5
      const ind = doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...GRIS).splitTextToSize(med.indicacion, ancho - 5)
      doc.text(ind, m + 5, y)
      y += 4.6 * ind.length + 4
    })
    if (d.indicaciones?.trim()) {
      y += 2
      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...NEGRO).text('Indicaciones', m, y)
      y += 5
      const ind = doc.setFont('helvetica', 'normal').setTextColor(...GRIS).splitTextToSize(d.indicaciones.trim(), ancho)
      doc.text(ind, m, y)
    }
    firma(doc, c, m, ancho, alto - 24)
    return { blob: doc.output('blob'), nombre: `Receta-${base}-${dia}.pdf` }
  }

  // Presupuesto
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  const m = 18, ancho = 210 - 2 * m, alto = 297
  let y = encabezado(doc, c, m, ancho, 22)
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...NEGRO).text('PRESUPUESTO', m, y + 2)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...GRIS).text(`N° ${String(d.id ?? '').slice(-6)}`, m + ancho, y + 2, { align: 'right' })
  y += 12
  y = datosPaciente(doc, p, d.fecha, m, ancho, y)

  const col = { trat: m + 2, pieza: m + 100, cant: m + 125, unit: m + 150, sub: m + ancho - 2 }
  const filaEncabezado = () => {
    doc.setFillColor(...TEAL).rect(m, y - 5, ancho, 8, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(255, 255, 255)
    doc.text('Tratamiento', col.trat, y); doc.text('Pieza', col.pieza, y)
    doc.text('Cant.', col.cant, y, { align: 'right' }); doc.text('P. unit.', col.unit, y, { align: 'right' })
    doc.text('Subtotal', col.sub, y, { align: 'right' })
    y += 8
  }
  filaEncabezado()
  let subtotal = 0
  d.items.forEach((it, i) => {
    const lineas = doc.setFont('helvetica', 'normal').setFontSize(10).splitTextToSize(it.tratamiento, 92)
    const h = 5 * lineas.length + 2
    if (y + h > alto - 60) { doc.addPage(); y = 25; filaEncabezado() }
    if (i % 2) doc.setFillColor(241, 245, 249).rect(m, y - 4.5, ancho, h + 1, 'F')
    const total = it.cantidad * it.precio
    subtotal += total
    doc.setTextColor(...NEGRO).text(lineas, col.trat, y)
    doc.setTextColor(...GRIS).text(it.pieza || '-', col.pieza, y)
    doc.setTextColor(...NEGRO).text(String(it.cantidad), col.cant, y, { align: 'right' })
    doc.text(dinero(it.precio), col.unit, y, { align: 'right' })
    doc.text(dinero(total), col.sub, y, { align: 'right' })
    y += h + 1
  })
  y += 4
  doc.setDrawColor(226, 232, 240).setLineWidth(0.3).line(m + 100, y - 3, m + ancho, y - 3)
  const fila = (etiqueta: string, valor: string, fuerte = false) => {
    doc.setFont('helvetica', fuerte ? 'bold' : 'normal').setFontSize(fuerte ? 12 : 10).setTextColor(...(fuerte ? TEAL : NEGRO))
    doc.text(etiqueta, col.unit, y, { align: 'right' }); doc.text(valor, col.sub, y, { align: 'right' })
    y += fuerte ? 8 : 6
  }
  const descuento = Math.min(d.descuento ?? 0, subtotal)
  if (descuento > 0) { fila('Subtotal', `Bs ${dinero(subtotal)}`); fila('Descuento', `- Bs ${dinero(descuento)}`) }
  fila('TOTAL', `Bs ${dinero(subtotal - descuento)}`, true)

  y += 6
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...GRIS)
  const vence = new Date(d.fecha + d.validezDias * 86400000)
  doc.text(`Válido por ${d.validezDias} días (hasta el ${fechaTexto(vence.getTime())}).`, m, y)
  y += 5
  if (d.notas?.trim()) {
    const n = doc.splitTextToSize(d.notas.trim(), ancho)
    doc.setTextColor(...NEGRO).text(n, m, y); y += 5 * n.length
  }
  doc.setFontSize(8.5).setTextColor(...GRIS)
    .text(doc.splitTextToSize('El presupuesto puede cambiar si durante el tratamiento se encuentra algo distinto a lo diagnosticado. Se informará al paciente antes de cualquier cambio.', ancho), m, y + 2)
  firma(doc, c, m, ancho, alto - 35)
  return { blob: doc.output('blob'), nombre: `Presupuesto-${base}-${dia}.pdf` }
}

/** Abre el menú de compartir del celular (WhatsApp, etc.) o, si no se puede, descarga el archivo. */
export async function compartirODescargar(blob: Blob, nombre: string, texto: string, soloDescargar = false) {
  const file = new File([blob], nombre, { type: 'application/pdf' })
  if (!soloDescargar && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: nombre, text: texto })
      return 'compartido'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelado'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nombre; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'descargado'
}
