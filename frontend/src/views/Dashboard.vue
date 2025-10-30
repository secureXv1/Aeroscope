<template>
  <!-- KPIs Superiores (Totales, nunca filtrados) -->
  <div class="grid md:grid-cols-4 gap-5">
    <section class="kpi">
      <div class="kpi-label">Total Registros</div>
      <div class="kpi-num">
        {{ kpi.aeroscope }}
        <div class="text-xs text-gray-400 mt-1">{{ kpiAgrupado.total }}</div>
      </div>      
    </section>
    <section class="kpi text-green-500">
      <div class="kpi-label">FFPP</div>
      <div class="kpi-num">
        {{ kpi.ffpp }}
        <div class="text-xs text-gray-400 mt-1"> {{ kpiAgrupado.ffpp }}</div>
      </div>
    </section>
    <section class="kpi text-blue-600">
      <div class="kpi-label">Aeronáutica</div>
      <div class="kpi-num">
        {{ kpi.aeronautica }}
        <div class="text-xs text-gray-400 mt-1"> {{ kpiAgrupado.aeronautica }}</div>
      </div>
    </section>
    <section class="kpi text-red-600">
      <div class="kpi-label">Otros</div>
      <div class="kpi-num">
        {{ kpi.hostil }}
        <div class="text-xs text-gray-400 mt-1"> {{ kpiAgrupado.hostil }}</div>
      </div>
    </section>
  </div>



  <!-- Filtros en card -->
  <div class="card p-4 my-6">
    <div class="flex flex-wrap gap-4 items-end">
      <div>
        <label class="text-xs text-slate-600">Fecha inicio</label>
        <input type="date" v-model="dateStart" class="input mt-1" />
      </div>
      <div>
        <label class="text-xs text-slate-600">Fecha fin</label>
        <input type="date" v-model="dateEnd" class="input mt-1" />
      </div>
      <div>
        <label class="text-xs text-slate-600">Hora inicio</label>
        <input type="time" v-model="timeStart" class="input mt-1" step="60" />
      </div>
      <div>
        <label class="text-xs text-slate-600">Hora fin</label>
        <input type="time" v-model="timeEnd" class="input mt-1" step="60" />
      </div>
      <div>
        <label class="text-xs text-slate-600">Drone ID</label>
        <select v-model="droneId" class="input mt-1 min-w-[140px]">
          <option value="">Todos</option>
          <option v-for="id in droneIdsFiltrados" :key="id" :value="id">{{ id }}</option>
        </select>
      </div>
      <div>
        <label class="text-xs text-slate-600">Aeroscope ID</label>
        <select v-model="aeroscopeId" class="input mt-1 min-w-[140px]">
          <option value="">Todos</option>
          <option v-for="id in aeroscopeIdsFiltrados" :key="id" :value="id">{{ id }}</option>
        </select>
      </div>
      <button class="btn mt-2"
        @click="resetFiltros"
        v-if="dateStart || dateEnd || timeStart || timeEnd || droneId || aeroscopeId">
        Limpiar
      </button>
      <button class="btn btn-primary" @click="descargarInforme" :disabled="descargandoInforme">
        {{ descargandoInforme ? 'Generando…' : 'Descargar informe' }}
      </button>
      </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
    <!-- Cuadro DRONES ÚNICOS -->
    <!-- Cuadro DETECCIONES -->
    <div class="card p-4 flex flex-wrap items-center gap-2">
      <div class="font-semibold text-lg mb-3 w-full">Detecciones</div>

      <div class="kpi">
        <div class="kpi-label">Total</div>
        <div class="kpi-num">
          {{ kpiFiltrado.total }}
          <div class="text-xs text-gray-400 mt-1"> {{ kpiFiltradoAgrupado.total }}</div>
        </div>
      </div>

      <div class="kpi text-green-500">
        <div class="kpi-label">FFPP</div>
        <div class="kpi-num">
          {{ kpiFiltrado.ffpp }}
          <div class="text-xs text-gray-400 mt-1"> {{ kpiFiltradoAgrupado.ffpp }}</div>
        </div>
      </div>

      <div class="kpi text-blue-600">
        <div class="kpi-label">Aeronautica</div>
        <div class="kpi-num">
          {{ kpiFiltrado.aeronautica }}
          <div class="text-xs text-gray-400 mt-1"> {{ kpiFiltradoAgrupado.aeronautica }}</div>
        </div>
      </div>

      <div class="kpi text-red-600">
        <div class="kpi-label">Otros</div>
        <div class="kpi-num">
          {{ kpiFiltrado.hostil }}
          <div class="text-xs text-gray-400 mt-1">{{ kpiFiltradoAgrupado.hostil }}</div>
        </div>
      </div>
    </div>

    <!-- Cuadro DRONES ÚNICOS -->
    <div class="card p-4 flex flex-wrap items-center gap-2">
      <div class="font-semibold text-lg mb-3 w-full">Drones</div>

      <div class="kpi">
        <div class="kpi-label">Total</div>
        <div class="kpi-num">
          {{ kpiDronesUnicos.total }}
           <!--<div class="text-xs text-gray-400 mt-1">Agrupadas: {{ kpiDronesUnicosAgrupado.total }}</div>-->
        </div>
      </div>

      <div class="kpi text-green-500">
        <div class="kpi-label">FFPP</div>
        <div class="kpi-num">
          {{ kpiDronesUnicos.ffpp }}
           <!--<div class="text-xs text-gray-400 mt-1">Agrupadas: {{ kpiDronesUnicosAgrupado.ffpp }}</div>-->
        </div>
      </div>

      <div class="kpi text-blue-600">
        <div class="kpi-label">Aeronautica</div>
        <div class="kpi-num">
          {{ kpiDronesUnicos.aeronautica }}
          <!--<div class="text-xs text-gray-400 mt-1">Agrupadas: {{ kpiDronesUnicosAgrupado.aeronautica }}</div>-->
        </div>
      </div>

      <div class="kpi text-red-600">
        <div class="kpi-label">Otros</div>
        <div class="kpi-num">
          {{ kpiDronesUnicos.hostil }}
           <!--<div class="text-xs text-gray-400 mt-1">Agrupadas: {{ kpiDronesUnicosAgrupado.hostil }}</div>-->
        </div>
      </div>
    </div>
  </div>

  <!-- Primer fila: 2 gráficas pequeñas -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
    <!-- Detecciones Vs Aeroscope -->
    <div class="card p-4">
      <h3 class="font-semibold mb-2">Detecciones Vs Aeroscope</h3>
      <div style="height: 220px;">
        <Bar :data="barDeteccionesAeroscope" :options="barOpts" />
      </div>
    </div>
    <div class="card p-4">
      <h3 class="font-semibold mb-2">Drones Vs Aeroscope</h3>
      <Bar
        :data="{
          labels: Object.keys(dronesUnicosPorCampo('aeroscope_id', posicionesFiltradas.value)),
          datasets: [
            { label: 'Drones', data: Object.values(dronesUnicosPorCampo('aeroscope_id', posicionesFiltradas.value)), backgroundColor: '#38bdf8' },
            //{ label: 'Agrupadas', data: Object.values(dronesUnicosPorCampo('aeroscope_id', posicionesAgrupadas.value)), backgroundColor: '#a3a3a3' }
          ]
        }"
        :options="{ responsive: true, plugins: { legend: { display: true } } }"
        style="height: 200px; width: 100%;"
      />
    </div>
    <!-- Detecciones Vs Tipo -->
    <div class="card p-4">
      <h3 class="font-semibold mb-2">Detecciones Vs Tipo</h3>
      <div style="height: 220px;">
        <Bar :data="barDeteccionesTipo" :options="barOpts" />
      </div>
    </div>
    <div class="card p-4">
      <h3 class="font-semibold mb-2">Drones Vs Tipo</h3>
      <Bar
        :data="{
          labels: Object.keys(dronesUnicosPorCampo('drone_type', posicionesFiltradas.value)),
          datasets: [
            { label: 'Drones', data: Object.values(dronesUnicosPorCampo('drone_type', posicionesFiltradas.value)), backgroundColor: '#38bdf8' },
            //{ label: 'Agrupadas', data: Object.values(dronesUnicosPorCampo('drone_type', posicionesAgrupadas.value)), backgroundColor: '#a3a3a3' }
          ]
        }"
        :options="{ responsive: true, plugins: { legend: { display: true } } }"
        style="height: 200px; width: 100%;"
      />
    </div>
  </div>

</template>

<script setup>
import { ref, reactive, onMounted, computed, watch  } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

import { http } from '../lib/http'

const kpi = reactive({ aeroscope: 0, ffpp: 0, aeronautica: 0, hostil: 0 })
const dateStart = ref('')
const dateEnd = ref('')
const timeStart = ref('')
const timeEnd   = ref('')
const droneId = ref('')
const aeroscopeId = ref('')
const droneIds = ref([])
const aeroscopeIds = ref([])
const descargando = ref(false)
const descargandoKmz = ref(false)

const posicionesFiltradas = ref([]) // Solo lo filtrado

// === NUEVO: dataset agrupado para gráficas/KPIs inferiores ===
const posicionesAgrupadas = ref([])

// === NUEVO: KPIs agrupados (filtrados) para los cuadros inferiores ===
const kpiFiltradoAgrupado = computed(() => {
  const arr = Array.isArray(posicionesAgrupadas.value) ? posicionesAgrupadas.value : []
  const total = arr.length
  const ffpp = arr.filter(p => p.tipo === 'ffpp').length
  const aeronautica = arr.filter(p => p.tipo === 'aeronautica').length
  const hostil = arr.filter(p => p.tipo === 'hostil').length
  return { total, ffpp, aeronautica, hostil }
})

// === NUEVO: drones únicos AGRUPADOS (para el cuadro inferior derecho) ===
const kpiDronesUnicosAgrupado = computed(() => {
  const arr = Array.isArray(posicionesAgrupadas.value) ? posicionesAgrupadas.value : []
  const setFFPP = new Set()
  const setAE = new Set()
  const setHO = new Set()
  const setALL = new Set()
  arr.forEach(p => {
    if (!p?.drone_id) return
    setALL.add(p.drone_id)
    if (p.tipo === 'ffpp') setFFPP.add(p.drone_id)
    else if (p.tipo === 'aeronautica') setAE.add(p.drone_id)
    else if (p.tipo === 'hostil') setHO.add(p.drone_id)
  })
  return {
    total: setALL.size,
    ffpp: setFFPP.size,
    aeronautica: setAE.size,
    hostil: setHO.size
  }
})

// === NUEVO: fetch del mapa AGRUPADO (misma firma de filtros) ===
async function aplicarFiltros () {
  // si falta rango, vacía
  if (!dateStart.value || !dateEnd.value) { posicionesFiltradas.value = []; return }
  const params = buildRangeParams()
  const { data } = await http.get('/aeroscope/map', { params })
  posicionesFiltradas.value = (data || []).filter(p =>
    p.longitude !== null && p.latitude !== null &&
    !isNaN(Number(p.longitude)) && !isNaN(Number(p.latitude))
  )
}

async function aplicarFiltrosAgrupado () {
  if (!dateStart.value || !dateEnd.value) { posicionesAgrupadas.value = []; return }
  const params = buildRangeParams()
  const { data } = await http.get('/aeroscope_agrupado/map', { params })
  posicionesAgrupadas.value = (data || []).filter(p =>
    p.longitude !== null && p.latitude !== null &&
    !isNaN(Number(p.longitude)) && !isNaN(Number(p.latitude))
  )
}

const droneIdsFiltrados = computed(() => {
  const set = new Set()
  posicionesFiltradas.value.forEach(p => { if (p.drone_id) set.add(p.drone_id) })
  return Array.from(set).sort()
})

const aeroscopeIdsFiltrados = computed(() => {
  const set = new Set()
  posicionesFiltradas.value.forEach(p => { if (p.aeroscope_id) set.add(p.aeroscope_id) })
  return Array.from(set).sort()
})

// KPIs superiores: sólo al montar
async function loadKpis() {
  const { data } = await http.get('/aeroscope/kpi-global')
  kpi.aeroscope   = Number(data?.total ?? 0)
  kpi.ffpp        = Number(data?.ffpp ?? 0)
  kpi.aeronautica = Number(data?.aeronautica ?? 0)
  kpi.hostil      = Number(data?.hostil ?? 0)
}

// Cargar IDs únicos para selects
async function cargarFiltros() {
  const { data } = await http.get('/aeroscope/distincts')
  droneIds.value = data.drone_ids
  aeroscopeIds.value = data.aeroscope_ids
}

// KPIs filtrados, siempre sobre las posiciones filtradas actuales
const kpiFiltrado = computed(() => {
  const total = posicionesFiltradas.value.length
  const ffpp = posicionesFiltradas.value.filter(p => p.tipo === 'ffpp').length
  const aeronautica = posicionesFiltradas.value.filter(p => p.tipo === 'aeronautica').length
  const hostil = posicionesFiltradas.value.filter(p => p.tipo === 'hostil').length
  return { total, ffpp, aeronautica, hostil }
})

const kpiDronesUnicos = computed(() => {
  // Set para drones únicos por tipo
  const setFFPP = new Set()
  const setAero = new Set()
  const setHostil = new Set()
  posicionesFiltradas.value.forEach(p => {
    if (!p.drone_id) return
    if (p.tipo === 'ffpp') setFFPP.add(p.drone_id)
    else if (p.tipo === 'aeronautica') setAero.add(p.drone_id)
    else if (p.tipo === 'hostil') setHostil.add(p.drone_id)
  })
  // Set total de drones únicos en el filtro (puede haber repetidos entre tipos si hay inconsistencias en la DB)
  const setTotal = new Set([...setFFPP, ...setAero, ...setHostil])
  return {
    total: setTotal.size,
    ffpp: setFFPP.size,
    aeronautica: setAero.size,
    hostil: setHostil.size
  }
})

function buildRangeParams () {
  const params = {}
  const joinDT = (d, t, fallback) => {
    if (!d) return ''
    const hhmm = (t && /^\d{2}:\d{2}$/.test(t)) ? t : fallback
    return `${d} ${hhmm}:00`
  }
  if (dateStart.value) params.start_dt = joinDT(dateStart.value, timeStart.value, '00:00')
  if (dateEnd.value)   params.end_dt   = joinDT(dateEnd.value,   timeEnd.value,   '23:59')
  if (droneId.value)     params.drone_id = String(droneId.value).trim()
  if (aeroscopeId.value) params.aeroscope_id = String(aeroscopeId.value).trim()
  return params
}

function resetFiltros () {
  dateStart.value = ''
  dateEnd.value   = ''
  timeStart.value = ''
  timeEnd.value   = ''
  droneId.value = ''
  aeroscopeId.value = ''
  posicionesFiltradas.value = []
  posicionesAgrupadas.value = []
}

async function descargarCsv() {
  descargando.value = true
  try {
    const params = {}
    if (dateStart.value) params.start = dateStart.value
    if (dateEnd.value) params.end = dateEnd.value
    if (droneId.value) params.drone_id = droneId.value
    if (aeroscopeId.value) params.aeroscope_id = aeroscopeId.value

    const qs = new URLSearchParams(params).toString()
    const resp = await fetch(`/api/aeroscope/export-csv?${qs}`)
    const blob = await resp.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'aeroscope_export.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  } finally {
    descargando.value = false
  }
}

async function descargarKmz() {
  descargandoKmz.value = true
  try {
    const params = {}
    if (dateStart.value) params.start = dateStart.value
    if (dateEnd.value) params.end = dateEnd.value
    if (droneId.value) params.drone_id = droneId.value
    if (aeroscopeId.value) params.aeroscope_id = aeroscopeId.value

    const qs = new URLSearchParams(params).toString()
    const resp = await fetch(`/api/aeroscope/export-kmz?${qs}`)
    const blob = await resp.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'aeroscope_export.kmz'
    a.click()
    window.URL.revokeObjectURL(url)
  } finally {
    descargandoKmz.value = false
  }
}

// ✅ Conteo simple (no suma pesos)
function agrupaPor (campo, lista = []) {
  const arr = Array.isArray(lista) ? lista : []
  const out = {}
  arr.forEach(row => {
    const key = row?.[campo] ?? 'Desconocido'
    out[key] = (out[key] || 0) + 1
  })
  return out
}

const graficas = computed(() => {
  // Solo fecha: 4 gráficas (como antes)
  if (dateStart.value && dateEnd.value && !droneId.value && !aeroscopeId.value) {
    return [
      { tipo: 'aeroscope', datos: agrupaPor('aeroscope_id'), titulo: 'Detecciones Vs Aeroscope', size: 'small' },
      { tipo: 'aeroscope_unicos', datos: dronesUnicosPorCampo('aeroscope_id'), titulo: 'Drones Vs Aeroscope', size: 'small' },
      { tipo: 'drone_type', datos: agrupaPor('drone_type'), titulo: 'Detecciones Vs Tipo', size: 'small' },
      { tipo: 'drone_type_unicos', datos: dronesUnicosPorCampo('drone_type'), titulo: 'Drones Vs Tipo', size: 'small' }
    ]
  }
  // Fecha + Aeroscope: 3 gráficas (2 pequeñas, 1 grande)
  if (dateStart.value && dateEnd.value && !droneId.value && aeroscopeId.value) {
    return [
      { tipo: 'drone_type', datos: agrupaPor('drone_type'), titulo: 'Vuelos por Drone Type', size: 'small' },
      { tipo: 'drone_type_unicos', datos: dronesUnicosPorCampo('drone_type'), titulo: 'Drones únicos por Drone Type', size: 'small' },
      { tipo: 'drone_id', datos: agrupaPor('drone_id'), titulo: 'Vuelos por Drone ID', size: 'large' }
    ]
  }
  // Fecha + Drone_id: 1 gráfica
  if (dateStart.value && dateEnd.value && droneId.value && !aeroscopeId.value) {
    return [
      { tipo: 'aeroscope', datos: agrupaPor('aeroscope_id'), titulo: 'Vuelos por Aeroscope ID', size: 'large' }
    ]
  }
  // Otros casos: ...
  return []
})

function dronesUnicosPorCampo(campo, lista = posicionesFiltradas.value || []) {
  const arr = Array.isArray(lista) ? lista : []
  const mapa = {}
  arr.forEach(p => {
    const key = p?.[campo]
    const id = p?.drone_id
    if (!key || !id) return
    if (!mapa[key]) mapa[key] = new Set()
    mapa[key].add(id)
  })
  const resultado = {}
  Object.keys(mapa).forEach(k => { resultado[k] = mapa[k].size })
  return resultado
}

// KPIs agrupados (de aeroscope_agrupado)
const kpiAgrupado = reactive({ total: 0, ffpp: 0, aeronautica: 0, hostil: 0 })

async function loadKpisAgrupado() {
  const { data } = await http.get('/aeroscope_agrupado/kpi')
  kpiAgrupado.total = data.total ?? 0
  kpiAgrupado.ffpp = data.ffpp ?? 0
  kpiAgrupado.aeronautica = data.aeronautica ?? 0
  kpiAgrupado.hostil = data.hostil ?? 0
}

// === Helpers de agrupación y unión de claves ===
function groupCountBy(campo, lista = []) {
  const map = {}
  const arr = Array.isArray(lista) ? lista : []
  arr.forEach(r => {
    const key = r?.[campo] ?? 'Desconocido'
    map[key] = (map[key] || 0) + 1
  })
  return map
}

function unionLabels(mapA, mapB) {
  const set = new Set([...Object.keys(mapA || {}), ...Object.keys(mapB || {})])
  return Array.from(set).sort()
}

function valuesForLabels(map, labels) {
  return labels.map(l => Number(map?.[l] || 0))
}

// === Computed para las dos gráficas de DETECCIONES (azul normal, gris agrupadas) ===
const barDeteccionesAeroscope = computed(() => {
  const mapAzul = groupCountBy('aeroscope_id', posicionesFiltradas.value)
  const mapGris = groupCountBy('aeroscope_id', posicionesAgrupadas.value)
  const labels = unionLabels(mapAzul, mapGris)
  return {
    labels,
    datasets: [
      { label: 'Detecciones', data: valuesForLabels(mapAzul, labels), backgroundColor: '#38bdf8' },
      { label: 'Agrupadas',   data: valuesForLabels(mapGris, labels), backgroundColor: '#9ca3af' }
    ]
  }
})

const barDeteccionesTipo = computed(() => {
  const mapAzul = groupCountBy('drone_type', posicionesFiltradas.value)
  const mapGris = groupCountBy('drone_type', posicionesAgrupadas.value)
  const labels = unionLabels(mapAzul, mapGris)
  return {
    labels,
    datasets: [
      { label: 'Detecciones', data: valuesForLabels(mapAzul, labels), backgroundColor: '#38bdf8' },
      { label: 'Agrupadas',   data: valuesForLabels(mapGris, labels), backgroundColor: '#9ca3af' }
    ]
  }
})

// Opciones básicas para que siempre renderice bien
const barOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: true } },
  scales: { x: { stacked: false }, y: { beginAtZero: true, ticks: { precision: 0 } } }
}

const descargandoInforme = ref(false)

function buildRangeParams () {
  const params = {}
  const joinDT = (d, t, f) => d ? `${d} ${(t && /^\d{2}:\d{2}$/.test(t) ? t : f)}:00` : ''
  if (dateStart.value) params.start_dt = joinDT(dateStart.value, timeStart.value, '00:00')
  if (dateEnd.value)   params.end_dt   = joinDT(dateEnd.value,   timeEnd.value,   '23:59')
  if (droneId.value)     params.drone_id = String(droneId.value).trim()
  if (aeroscopeId.value) params.aeroscope_id = String(aeroscopeId.value).trim()
  return params
}

async function descargarInforme() {
  descargandoInforme.value = true
  try {
    const params = buildRangeParams()
    const qs = new URLSearchParams(params).toString()
    const base = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')
    const url = `${base}/dashboard/export-report?${qs}`

    const resp = await fetch(url, { method: 'POST' }) // POST/GET indistinto
    if (!resp.ok) {
      const txt = await resp.text()
      throw new Error(`HTTP ${resp.status}: ${txt.slice(0,200)}`)
    }
    const ct = resp.headers.get('content-type') || ''
    const blob = await resp.blob()
    const a = document.createElement('a')
    const href = URL.createObjectURL(blob)
    a.href = href
    a.download = ct.includes('pdf') ? 'informe_aeroscope.pdf' : 'informe_aeroscope.html'
    a.click()
    URL.revokeObjectURL(href)
  } catch (e) {
    console.error(e)
    alert('No se pudo generar el informe.')
  } finally {
    descargandoInforme.value = false
  }
}

onMounted(() => {
  cargarFiltros()
  loadKpis()
  loadKpisAgrupado()
  aplicarFiltros()
  aplicarFiltrosAgrupado()
})

let t = null
function requery () {
  clearTimeout(t)
  t = setTimeout(() => {
    aplicarFiltros()
    aplicarFiltrosAgrupado()
  }, 200)
}

watch([dateStart, timeStart, dateEnd, timeEnd, droneId, aeroscopeId], requery)


watch(droneIdsFiltrados, (ids) => {
  if (droneId.value && !ids.includes(droneId.value)) droneId.value = ''
})
watch(aeroscopeIdsFiltrados, (ids) => {
  if (aeroscopeId.value && !ids.includes(aeroscopeId.value)) aeroscopeId.value = ''
})

watch(dateStart, (v) => { if (v && !timeStart.value) timeStart.value = '00:00' })
watch(dateEnd,   (v) => { if (v && !timeEnd.value)   timeEnd.value   = '23:59' })


</script>
