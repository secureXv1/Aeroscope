<template>
  <!-- KPIs Superiores (Totales, nunca filtrados) -->
  <div class="grid md:grid-cols-4 gap-5">
    <section class="kpi">
      <div class="kpi-label">Total Registros</div>
      <div class="kpi-num">{{ kpi.aeroscope }}</div>
      <div class="mt-2 text-xs text-slate-500">Cargas por CSV</div>
    </section>
    <section class="kpi text-green-500">
      <div class="kpi-label">FFPP</div>
      <div class="kpi-num">{{ kpi.ffpp }}</div>
    </section>
    <section class="kpi text-blue-600">
      <div class="kpi-label">Aeronáutica</div>
      <div class="kpi-num">{{ kpi.aeronautica }}</div>
    </section>
    <section class="kpi text-red-600">
      <div class="kpi-label">Otros</div>
      <div class="kpi-num">{{ kpi.hostil }}</div>
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
      <button class="btn mt-2" @click="resetFiltros" v-if="dateStart || dateEnd || droneId || aeroscopeId">Limpiar</button>
      <!-- Botones de descarga -->
      <button class="btn" @click="descargarCsv" :disabled="descargando">
        {{ descargando ? 'Descargando…' : 'Descargar CSV' }}
      </button>
      <button class="btn" @click="descargarKmz" :disabled="descargandoKmz">
        {{ descargandoKmz ? 'Descargando…' : 'Descargar KMZ' }}
      </button>
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
    <!-- Cuadro DETECCIONES -->
    <div class="card p-4 flex flex-wrap items-center gap-2">
      <div class="font-semibold text-lg mb-3 w-full">Detecciones</div>
      <div class="kpi"><div class="kpi-label">Total</div><div class="kpi-num">{{ kpiFiltrado.total }}</div></div>
      <div class="kpi text-green-500"><div class="kpi-label">FFPP</div><div class="kpi-num">{{ kpiFiltrado.ffpp }}</div></div>
      <div class="kpi text-blue-600"><div class="kpi-label">Aero...</div><div class="kpi-num">{{ kpiFiltrado.aeronautica }}</div></div>
      <div class="kpi text-red-600"><div class="kpi-label">Otros</div><div class="kpi-num">{{ kpiFiltrado.hostil }}</div></div>
    </div>
    <!-- Cuadro DRONES ÚNICOS -->
    <div class="card p-4 flex flex-wrap items-center gap-2">
      <div class="font-semibold text-lg mb-3 w-full">Drones</div>
      <div class="kpi "><div class="kpi-label">Total</div><div class="kpi-num">{{ kpiDronesUnicos.total }}</div></div>
      <div class="kpi text-green-500 "><div class="kpi-label">FFPP</div><div class="kpi-num">{{ kpiDronesUnicos.ffpp }}</div></div>
      <div class="kpi text-blue-600 "><div class="kpi-label">Aero...</div><div class="kpi-num">{{ kpiDronesUnicos.aeronautica }}</div></div>
      <div class="kpi text-red-600 "><div class="kpi-label">Otros</div><div class="kpi-num">{{ kpiDronesUnicos.hostil }}</div></div>
    </div>
  </div>

  <!-- Primer fila: 2 gráficas pequeñas -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
    <div
      v-for="g in graficas.filter(x => x.size === 'small')"
      :key="g.titulo"
      class="card p-4"
    >
      <h3 class="font-semibold mb-2">{{ g.titulo }}</h3>
      <Bar
        :data="{
          labels: Object.keys(g.datos),
          datasets: [{ label: '', data: Object.values(g.datos), backgroundColor: '#38bdf8' }]
        }"
        :options="{ responsive: true, plugins: { legend: { display: false } } }"
        style="height: 200px; width: 100%;"
      />
    </div>
  </div>
  <!-- Segunda fila: 1 gráfica grande -->
  <div v-for="g in graficas.filter(x => x.size === 'large')" :key="g.titulo" class="card p-4 my-4">
    <h3 class="font-semibold mb-2">{{ g.titulo }}</h3>
    <Bar
      :data="{
        labels: Object.keys(g.datos),
        datasets: [{ label: '', data: Object.values(g.datos), backgroundColor: '#38bdf8' }]
      }"
      :options="{ responsive: true, plugins: { legend: { display: false } } }"
      style="height: 400px; width: 100%;"
    />
  </div>





</template>

<script setup>
import { ref, reactive, onMounted, computed, watch  } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

import { http } from '../lib/http'

const kpi = reactive({ aeroscope: 0, ffpp: 0, aeronautica: 0 })
const dateStart = ref('')
const dateEnd = ref('')
const droneId = ref('')
const aeroscopeId = ref('')
const droneIds = ref([])
const aeroscopeIds = ref([])
const descargando = ref(false)
const descargandoKmz = ref(false)

const posicionesFiltradas = ref([]) // Solo lo filtrado
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
  kpi.aeroscope = data.total ?? 0
  kpi.ffpp = data.ffpp ?? 0
  kpi.aeronautica = data.aeronautica ?? 0
  kpi.hostil = data.hostil ?? 0
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

// Consulta datos filtrados (para KPIs, gráficos y descargas)
async function aplicarFiltros() {
  if (!dateStart.value || !dateEnd.value) {
    posicionesFiltradas.value = []
    return
  }
  const params = { start: dateStart.value, end: dateEnd.value }
  if (droneId.value) params.drone_id = droneId.value
  if (aeroscopeId.value) params.aeroscope_id = aeroscopeId.value
  const { data } = await http.get('/aeroscope/map', { params })
  posicionesFiltradas.value = (data || []).filter(p =>
    p.longitude !== null && p.latitude !== null &&
    !isNaN(Number(p.longitude)) && !isNaN(Number(p.latitude))
  )
}

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

function resetFiltros() {
  dateStart.value = ''
  dateEnd.value = ''
  droneId.value = ''
  aeroscopeId.value = ''
  posicionesFiltradas.value = []
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

// Gráficas dinámicas según filtros
function agrupaPor(campo) {
  const counts = {}
  posicionesFiltradas.value.forEach(p => {
    const key = p[campo] || 'Desconocido'
    counts[key] = (counts[key] || 0) + 1
  })
  return counts
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

function dronesUnicosPorCampo(campo) {
  // Map<campo, Set<drone_id>>
  const mapa = {}
  posicionesFiltradas.value.forEach(p => {
    if (!p[campo] || !p.drone_id) return
    if (!mapa[p[campo]]) mapa[p[campo]] = new Set()
    mapa[p[campo]].add(p.drone_id)
  })
  const resultado = {}
  Object.keys(mapa).forEach(k => {
    resultado[k] = mapa[k].size
  })
  return resultado
}

onMounted(() => {
  cargarFiltros()
  loadKpis()
  aplicarFiltros() // Esto pobla los datos desde el inicio
})

watch([dateStart, dateEnd, droneId, aeroscopeId], () => {
  aplicarFiltros()
})

watch(droneIdsFiltrados, (ids) => {
  if (droneId.value && !ids.includes(droneId.value)) droneId.value = ''
})
watch(aeroscopeIdsFiltrados, (ids) => {
  if (aeroscopeId.value && !ids.includes(aeroscopeId.value)) aeroscopeId.value = ''
})

</script>
