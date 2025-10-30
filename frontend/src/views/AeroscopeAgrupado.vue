<template>
  <div class="space-y-6">
    <!-- KPIs Superiores (agrupado) -->
    <div class="grid md:grid-cols-4 gap-5">
      <section class="kpi">
        <div class="kpi-label">Total Registros</div>
        <div class="kpi-num">{{ kpi.total }}</div>
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

    <!-- Filtros -->
    <div class="card p-4">
      <div class="flex flex-wrap gap-4 items-end">
        <div>
          <label class="text-xs text-slate-600">Fecha inicio</label>
          <input type="date" v-model="dateStart" class="input mt-1" />
        </div>
        <div>
          <label class="text-xs text-slate-600">Hora inicio</label>
          <input type="time" v-model="timeStart" class="input mt-1" step="60" />
        </div>

        <div>
          <label class="text-xs text-slate-600">Fecha fin</label>
          <input type="date" v-model="dateEnd" class="input mt-1" />
        </div>
        <div>
          <label class="text-xs text-slate-600">Hora fin</label>
          <input type="time" v-model="timeEnd" class="input mt-1" step="60" />
        </div>
        <div>
          <label class="text-xs text-slate-600">Drone ID</label>
          <select v-model="droneId" class="input mt-1 min-w-[160px]">
            <option value="">Todos</option>
            <option v-for="id in droneIds" :key="id" :value="id">{{ id }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-slate-600">Aeroscope ID</label>
          <select v-model="aeroscopeId" class="input mt-1 min-w-[160px]">
            <option value="">Todos</option>
            <option v-for="id in aeroscopeIds" :key="id" :value="id">{{ id }}</option>
          </select>
        </div>

        <!-- Filtro por tipo (como en Aeroscope: ffpp / aeronautica / hostil) -->
        <div class="flex gap-2">
          <button
            class="btn btn-ghost"
            :class="tipo === '' ? 'ring-1 ring-slate-300' : ''"
            @click="tipo = ''"
          >Todos</button>
          <button
            class="btn btn-ghost text-green-600"
            :class="tipo === 'ffpp' ? 'ring-1 ring-green-300' : ''"
            @click="tipo = 'ffpp'"
          >FFPP</button>
          <button
            class="btn btn-ghost text-blue-600"
            :class="tipo === 'aeronautica' ? 'ring-1 ring-blue-300' : ''"
            @click="tipo = 'aeronautica'"
          >Aeronáutica</button>
          <button
            class="btn btn-ghost text-red-600"
            :class="tipo === 'hostil' ? 'ring-1 ring-red-300' : ''"
            @click="tipo = 'hostil'"
          >Otros</button>
        </div>

        <button class="btn" v-if="hayFiltros" @click="resetFiltros">Limpiar</button>
        <button class="btn btn-primary" @click="descargarCsvAgrupado" :disabled="descargandoAgrupado">
          {{ descargandoAgrupado ? 'Descargando…' : 'Descargar CSV Agrupado' }}
        </button>
        <button class="btn btn-primary" @click="downloadKmz">
          Descargar KMZ
        </button>
        <div v-if="msg" class="w-full">
          <span :class="msgClass">{{ msg }}</span>
        </div>
      </div>
    </div>

    <!-- Tabla Agrupado -->
    <div class="card p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold">Resultados (Agrupado)</h3>

        <!-- Paginación -->
        <div class="flex items-center gap-2 text-xs">
          <button class="btn btn-xs" :disabled="page===1" @click="page--">«</button>
          <span>Página {{ page }} / {{ totalPages }}</span>
          <button class="btn btn-xs" :disabled="page>=totalPages" @click="page++">»</button>
          <select v-model.number="pageSize" class="input input-xs ml-2">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 text-slate-700">
              <th class="text-left p-2 border">Inicio</th>
              <th class="text-left p-2 border">Fin</th>
              <th class="text-left p-2 border">Aeroscope</th>
              <th class="text-left p-2 border">Drone ID</th>
              <th class="text-left p-2 border">Tipo</th>
              <th class="text-right p-2 border">Lon</th>
              <th class="text-right p-2 border">Lat</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in pageRows" :key="i" class="odd:bg-white even:bg-slate-50">
              <td class="p-2 border whitespace-nowrap">{{ r.time_start_fmt }}</td>
              <td class="p-2 border whitespace-nowrap">{{ r.time_end_fmt }}</td>
              <td class="p-2 border">{{ r.aeroscope_id || '-' }}</td>
              <td class="p-2 border">{{ r.drone_id || '-' }}</td>
              <td class="p-2 border capitalize">
                <span
                  :class="{
                    'text-green-600': r.tipo === 'ffpp',
                    'text-blue-600': r.tipo === 'aeronautica',
                    'text-red-600': r.tipo === 'hostil'
                  }"
                >
                  {{ r.tipo || '-' }}
                </span>
              </td>
              <td class="p-2 border text-right">{{ r.longitude ?? '-' }}</td>
              <td class="p-2 border text-right">{{ r.latitude ?? '-' }}</td>
            </tr>

            <tr v-if="!pageRows.length">
              <td colspan="7" class="p-4 text-center text-slate-400">
                Sin datos para los filtros actuales.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { http } from '../lib/http'

// === Estado de filtros ===
const dateStart = ref('')
const dateEnd = ref('')
const timeStart = ref('') 
const timeEnd   = ref('')
const droneId = ref('')
const aeroscopeId = ref('')
const tipo = ref('') // '', 'ffpp', 'aeronautica', 'hostil'

// === Listas para selects (tomadas de /aeroscope/distincts) ===
const droneIds = ref([])
const aeroscopeIds = ref([])

// === KPIs (agrupado) ===
const kpi = reactive({ total: 0, ffpp: 0, aeronautica: 0, hostil: 0 })

// === Datos de tabla (agrupado) ===
const rows = ref([])

const msg = ref('')
const msgClass = computed(() => 'text-amber-600')

const hayFiltros = computed(() =>
  !!(dateStart.value || timeStart.value || dateEnd.value || timeEnd.value ||
     droneId.value || aeroscopeId.value || tipo.value)
)


function getRangeSafe() {
  const p = buildRangeParams()
  if (!p.start_dt && !p.end_dt) return { ok: true, params: p } // sin rango, permitido

  const toDate = (s) => s ? new Date(s.replace(' ', 'T')) : null
  const d1 = toDate(p.start_dt)
  const d2 = toDate(p.end_dt)

  if (d1 && d2 && d1.getTime() > d2.getTime()) {
    msg.value = 'El rango es inválido: inicio es mayor que fin.'
    setTimeout(() => (msg.value = ''), 3500)
    return { ok: false }
  }
  return { ok: true, params: p }
}


// === Cargar distincts de la vista base (para selects) ===
async function cargarDistincts() {
  const { data } = await http.get('/aeroscope/distincts')
  droneIds.value = data?.drone_ids || []
  aeroscopeIds.value = data?.aeroscope_ids || []
}

// 👇 helper: arma start_dt / end_dt respetando hora si existe
function buildRangeParams() {
  const params = {}
  const joinDT = (d, t, fallback) => {
    if (!d) return ''
    const hhmm = (t && /^\d{2}:\d{2}$/.test(t)) ? t : fallback
    return `${d} ${hhmm}:00`
  }

  // Si hay fecha de inicio: usa hora elegida o 00:00
  if (dateStart.value) params.start_dt = joinDT(dateStart.value, timeStart.value, '00:00')
  // Si hay fecha fin: usa hora elegida o 23:59
  if (dateEnd.value)   params.end_dt   = joinDT(dateEnd.value,   timeEnd.value,   '23:59')

  if (droneId.value)     params.drone_id = droneId.value
  if (aeroscopeId.value) params.aeroscope_id = aeroscopeId.value
  return params
}

// === Cargar KPIs agrupados (admite hora) ===
async function loadKpiAgrupado() {
  const { ok, params } = getRangeSafe()
  if (!ok) return
  const { data } = await http.get('/aeroscope_agrupado/kpi', { params })
  kpi.total = Number(data?.total || 0)
  kpi.ffpp = Number(data?.ffpp || 0)
  kpi.aeronautica = Number(data?.aeronautica || 0)
  kpi.hostil = Number(data?.hostil || 0)
}

// === Consultar tabla (admite hora) ===
async function aplicarFiltros() {
  const { ok, params } = getRangeSafe()
  if (!ok) return
  const { data } = await http.get('/aeroscope_agrupado/map', { params })
  const arr = Array.isArray(data) ? data : []

  const filtered = tipo.value
    ? arr.filter(r => String(r?.tipo || '').toLowerCase() === tipo.value)
    : arr

  rows.value = filtered
    .filter(r =>
      r.longitude !== null && r.latitude !== null &&
      !Number.isNaN(Number(r.longitude)) && !Number.isNaN(Number(r.latitude))
    )
    .map(r => ({
      ...r,
      time_start_fmt: fmtDT(r.time_start || r.start_time || r.start || r.fecha_inicio),
      time_end_fmt:   fmtDT(r.time_end   || r.end_time   || r.end   || r.fecha_fin)
    }))
    .sort((a, b) => (b.time_start_fmt > a.time_start_fmt ? 1 : -1))
}

// === Utils ===
function fmtDT(v) {
  const s = String(v || '')
  return s.replace('T', ' ').slice(0, 19) || '-'
}

async function downloadKmz() {
  const { ok, params } = getRangeSafe()
  if (!ok) return
  const qs = new URLSearchParams(params).toString()
  const base = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')
  const resp = await fetch(`${base}/aeroscope_agrupado/export-kmz?${qs}`)
  const blob = await resp.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'aeroscope_agrupado.kmz'
  a.click()
  window.URL.revokeObjectURL(url)
}

async function descargarCsvAgrupado() {
  const { ok, params } = getRangeSafe()
  if (!ok) return
  descargandoAgrupado.value = true
  try {
    const qs = new URLSearchParams(params).toString()
    const resp = await fetch(`/api/aeroscope_agrupado/export-csv?${qs}`)
    const blob = await resp.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'aeroscope_agrupado_export.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  } finally {
    descargandoAgrupado.value = false
  }
}

// === Limpiar (ahora borra también horas) ===
function resetFiltros() {
  dateStart.value = ''
  timeStart.value = '' // 👈
  dateEnd.value   = ''
  timeEnd.value   = '' // 👈
  droneId.value = ''
  aeroscopeId.value = ''
  tipo.value = ''
  rows.value = []
  loadKpiAgrupado()
}
const descargandoAgrupado = ref(false)

// === Paginación ===
const page = ref(1)
const pageSize = ref(20)
const totalPages = computed(() => Math.max(1, Math.ceil(rows.value.length / pageSize.value)))
const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return rows.value.slice(start, start + pageSize.value)
})
watch([rows, pageSize], () => { page.value = 1 })

// === Lifecycle ===
onMounted(async () => {
  await cargarDistincts()
  await loadKpiAgrupado()
  await aplicarFiltros()
})

let t = null
function requery() {
  clearTimeout(t)
  t = setTimeout(() => {
    page.value = 1
    aplicarFiltros()
    loadKpiAgrupado()
  }, 200)
}

watch([dateStart, timeStart, dateEnd, timeEnd, droneId, aeroscopeId, tipo], requery)

watch(dateStart, (v) => {
  if (v && !timeStart.value) timeStart.value = '00:00'
})
watch(dateEnd, (v) => {
  if (v && !timeEnd.value) timeEnd.value = '23:59'
})


</script>
