import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import './index.css'
import Ajustes from './pages/Ajustes'
import Caja from './pages/Caja'
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
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<SalaEspera />} />
          <Route path="citas" element={<Citas />} />
          <Route path="pacientes" element={<Pacientes />} />
          <Route path="pacientes/:id" element={<PacienteDetalle />} />
          <Route path="caja" element={<Caja />} />
          <Route path="ajustes" element={<Ajustes />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
