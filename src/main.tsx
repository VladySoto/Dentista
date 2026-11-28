import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Bloqueo from './components/Bloqueo'
import CapaDialogos from './components/CapaDialogos'
import Layout from './components/Layout'
import './index.css'
import Ajustes from './pages/Ajustes'
import Caja from './pages/Caja'
import Inventario from './pages/Inventario'
import Mas from './pages/Mas'
import Reportes from './pages/Reportes'
import Cartel from './pages/Cartel'
import TomarTurno from './pages/TomarTurno'
import Citas from './pages/Citas'
import PacienteDetalle from './pages/PacienteDetalle'
import Pacientes from './pages/Pacientes'
import SalaEspera from './pages/SalaEspera'
import { iniciarSincronizacion } from './lib/sync'

iniciarSincronizacion()

// Pide al navegador que no borre los datos locales automáticamente
navigator.storage?.persist?.()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CapaDialogos />
    <BrowserRouter>
      <Routes>
        <Route path="t/:codigo" element={<TomarTurno />} />
        <Route path="cartel" element={<Bloqueo><Cartel /></Bloqueo>} />
        <Route element={<Bloqueo><Layout /></Bloqueo>}>
          <Route index element={<SalaEspera />} />
          <Route path="citas" element={<Citas />} />
          <Route path="pacientes" element={<Pacientes />} />
          <Route path="pacientes/:id" element={<PacienteDetalle />} />
          <Route path="caja" element={<Caja />} />
          <Route path="inventario" element={<Inventario />} />
          <Route path="mas" element={<Mas />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="ajustes" element={<Ajustes />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
