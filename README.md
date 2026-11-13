# Consultorio Dental

App web instalable (PWA) para un consultorio dental que atiende **por orden de llegada**, con citas opcionales e historial clínico.

## Funciones
- **Sala de espera**: registrar llegada → número de turno automático, tiempo de espera en vivo, "Atender" / "Finalizar", alerta de alergias.
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
