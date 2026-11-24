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

- **Turnos por QR**: el paciente escanea un cartel, escribe su nombre y recibe su número; ve cuántos faltan y recibe aviso cuando le toca. Si da su carnet, se vincula a su ficha.
- **Fotos y radiografías**: desde la ficha, con la cámara o subiendo imágenes; se comprimen y se guardan en la nube.
- **Recetas y presupuestos en PDF**: medicamentos frecuentes con dosis, aviso si el paciente es alérgico, tratamientos con precios; se comparten por WhatsApp o se descargan.
- **Bloqueo con PIN o huella** en cada dispositivo.
- **Odontograma** adulto, mixto e infantil, por caras del diente y con historial por fecha.
- **Cobro con QR del banco** y **recibos de pago en PDF** con el monto en letras.
- **Gastos y ganancia**, **inventario de materiales** con avisos, y **reportes mensuales** con exportación a Excel (CSV).
- **Tiempo estimado**: cada turno muestra a qué hora le toca; quien tomó turno con QR ve en su celular la hora aproximada y cuánto dura su atención. Los minutos por motivo se editan en Ajustes.
- **Un solo número: la ficha de papel.** Cada paciente toma una ficha al llegar; el dentista toca "Llamar ficha 4", "Llamar ficha 5"… (o "No vino"). Con el QR, el paciente escribe el número de su ficha para ver cuánto le falta y recibir el aviso.
- **Copia semanal a Google Drive**: aviso en la sala de espera y guardado con el menú de compartir.
- **Nube (opcional)**: con una cuenta, los datos se sincronizan entre celular, PC y tablet. Funciona sin internet y sube los cambios después.

## Tecnologías
React 18 + TypeScript, Vite, Tailwind CSS, Dexie (IndexedDB), vite-plugin-pwa, Supabase (nube, cuentas y archivos), jsPDF, Vercel (publicación).

## Nube (Supabase)
1. En Supabase → **SQL Editor** → pegar y ejecutar `supabase/schema.sql` luego `supabase/02-turnos-qr.sql`, `supabase/03-fotos.sql` `supabase/04-tiempo-estimado.sql` y `supabase/05-fichas.sql`.
2. La URL y la llave *publishable* del proyecto están en `src/lib/supabase.ts`
   (se pueden cambiar con `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY`).
3. Cada usuario solo puede ver sus propios registros (Row Level Security).

## Uso
```bash
npm install
npm run dev      # desarrollo
npm run build    # producción (carpeta dist/)
```

> Sin cuenta, los datos se guardan solo en el navegador del dispositivo. Con cuenta, se guardan también en la nube.
