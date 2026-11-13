# Consultorio Dental

App web instalable (PWA) para un consultorio dental que atiende **por orden de llegada**, con citas opcionales e historial clínico.

Pensada para un dentista que trabaja solo: la app le ahorra pasos entre paciente y paciente.

## Funciones
- **Sala de espera**: registrar llegada → número de turno automático, tiempo de espera en vivo, alerta de alergias, cobrado del día.
- **Llamar siguiente**: un toque abre la ficha del próximo paciente; al terminar, "Guardar y llamar siguiente" cierra la consulta y pasa al otro.
- **Consulta rápida**: tratamientos frecuentes como botones con su precio (se suman solos), "Pagó todo" / "No pagó", recordar control en N meses.
- **Caja**: cobrado hoy y en el mes, pacientes que deben, controles por avisar.
- **Mensajes de WhatsApp**: plantillas editables (cita, control, saldo) que se abren listas en WhatsApp Business.
- **Pagos a cuenta**: registrar abonos de deudas.
- **Pacientes sin celular**: "+1 llegada" crea un turno sin nombre (para fichas de papel numeradas); se identifica al paciente cuando entra.
- **Familiar o contacto**: nombre, parentesco y teléfono; los avisos de WhatsApp pueden ir a ese número.
- **Próxima cita en la ficha**: para copiarla en la tarjeta de cita de papel.
- **Citas**: agenda por día, estados (pendiente, confirmada, llegó, cancelada), recordatorio por WhatsApp; "Llegó" pasa la cita a la cola.
- **Pacientes**: búsqueda por nombre, CI o teléfono; antecedentes médicos.
- **Historial clínico**: consultas con diagnóstico, tratamiento, piezas, costo y saldo pendiente.
- **Odontograma** interactivo (numeración FDI).
- **Respaldo**: exportar/importar todos los datos en JSON.
- Funciona sin internet y se instala en celular o PC.

## Tecnologías
React 18 + TypeScript, Vite, Tailwind CSS, Dexie (IndexedDB), vite-plugin-pwa.

## Uso
```bash
npm install
npm run dev      # desarrollo
npm run build    # producción (carpeta dist/)
```

> Los datos se guardan en el navegador del dispositivo. Haz respaldos periódicos desde **Ajustes**.
