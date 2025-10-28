<template>
  <div class="space-y-6">
    <!-- KPIs Superiores (sobre el dataset filtrado) -->
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
          <label class="text-xs text-slate-600">Fecha fin</label>
          <input type="date" v-model="dateEnd" class="input mt-1" />
        </div>

        <!-- Drone ID: escribible + sugerencias -->
        <div>
          <label class="text-xs text-slate-600">Drone ID</label>
          <select v-model="droneId" class="input mt-1 min-w-[160px]">
            <option value="">Todos</option>
            <option v-for="id in droneIds" :key="id" :value="id">{{ id }}</option>
          </select>
        </div>

        <div>
          <label class="text-xs text-slate-600">Aeroscope ID</label>
          <select v-model="aeroscopeId" class="input mt-1 min-w-[180px]">
            <option value="">Todos</option>
            <option v-for="id in aeroscopeIds" :key="id" :value="id">{{ id }}</option>
          </select>
        </div>

        <!-- Filtro por tipo -->
        <div class="flex gap-2">
          <button class="btn btn-ghost" :class="tipo === '' ? 'ring-1 ring-slate-300' : ''" @click="tipo = ''">Todos</button>
          <button class="btn btn-ghost text-green-600" :class="tipo === 'ffpp' ? 'ring-1 ring-green-300' : ''" @click="tipo = 'ffpp'">FFPP</button>
          <button class="btn btn-ghost text-blue-600" :class="tipo === 'aeronautica' ? 'ring-1 ring-blue-300' : ''" @click="tipo = 'aeronautica'">Aeronáutica</button>
          <button class="btn btn-ghost text-red-600" :class="tipo === 'hostil' ? 'ring-1 ring-red-300' : ''" @click="tipo = 'hostil'">Otros</button>
        </div>

        <button class="btn" v-if="hayFiltros" @click="resetFiltros">Limpiar</button>
      </div>
      
      <div class="ml-auto flex gap-2" style="margin-top: 15px;">
          <label class="btn btn-primary">
            <input
              type="file"
              accept=".csv,text/csv"
              class="hidden"
              @change="onCsvUpload"
            />
            {{ uploading ? `Subiendo… ${uploadPct}%` : 'Subir CSV' }}
          </label>
        </div>
    </div>

    <!-- Tabla -->
    <div class="card p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold">Resultados</h3>

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
              <th class="text-left p-2 border">Fecha</th>
              <th class="text-left p-2 border">Aeroscope</th>
              <th class="text-left p-2 border">Drone ID</th>
              <th class="text-left p-2 border">Tipo</th>
              <th class="text-right p-2 border">Lon</th>
              <th class="text-right p-2 border">Lat</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in pageRows" :key="i" class="odd:bg-white even:bg-slate-50">
              <td class="p-2 border whitespace-nowrap">{{ r.created_at_fmt }}</td>
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
              <td colspan="6" class="p-4 text-center text-slate-400">
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

// === Subida de CSV ===
const uploading = ref(false)
const uploadPct = ref(0)

async function onCsvUpload (e) {
  const file = e.target.files?.[0]
  const reset = () => { e.target.value = '' }

  uploadPct.value = 0

  if (!file) return reset()

  // Validaciones básicas
  const name = file.name.toLowerCase()
  if (!name.endsWith('.csv')) {
    alert('El archivo debe ser .csv')
    return reset()
  }
  const MAX = 100 * 1024 * 1024
  if (file.size > MAX) {
    alert('Archivo demasiado grande (máx. 25 MB).')
    return reset()
  }

  const fd = new FormData()
  // 👇 el backend espera el campo 'file' (multer.single('file'))
  fd.append('file', file)

  uploading.value = true
  try {
    // Usa tu wrapper http (baseURL ya debe incluir /api)
    const { data } = await http.post('/aeroscope/upload-csv', fd, {
      // No seteamos manualmente Content-Type
      onUploadProgress: (p) => {
        if (p.total) uploadPct.value = Math.round((p.loaded * 100) / p.total)
      }
    })

    if (data?.ok) {
      // feedback rápido
      const inserted = data.inserted ?? 0
      const omitidas = data.omitidas ?? 0
      alert(`Importación completa.\nInsertadas: ${inserted}\nOmitidas: ${omitidas}`)
      // refrescar filtros/kpis/tabla
      await aplicarFiltros()
    } else {
      alert(data?.error || 'No se recibió confirmación del servidor.')
    }
  } catch (err) {
    const apiMsg = err?.response?.data?.error || err?.message || 'Error subiendo CSV.'
    alert(apiMsg)
  } finally {
    uploading.value = false
    reset()
    uploadPct.value = 0
  }
}

// === Estado de filtros (armado igual que en la versión Agrupada) ===
const dateStart = ref('')
const dateEnd = ref('')
const droneId = ref('')       // input de texto con datalist
const aeroscopeId = ref('')
const tipo = ref('')          // '', 'ffpp', 'aeronautica', 'hostil'

// === Listas para selects (distincts) ===
const droneIds = ref([])
const aeroscopeIds = ref([])

// === KPIs calculados sobre el dataset filtrado ===
const kpi = reactive({ total: 0, ffpp: 0, aeronautica: 0, hostil: 0 })

// === Datos de tabla ===
const rows = ref([])

// === Export flags ===
const downCsv = ref(false)
const downKmz = ref(false)

// Distincts de Aeroscope
async function cargarDistincts() {
  const { data } = await http.get('/aeroscope/distincts')
  droneIds.value = data?.drone_ids || []
  aeroscopeIds.value = data?.aeroscope_ids || []
}

// Consulta (map) con filtros
async function aplicarFiltros() {
  const params = {}
  if (dateStart.value) params.start = dateStart.value
  if (dateEnd.value) params.end = dateEnd.value
  if (droneId.value) params.drone_id = droneId.value
  if (aeroscopeId.value) params.aeroscope_id = aeroscopeId.value
  // Si tu API soporta filtrar por tipo, envíalo:
  // if (tipo.value) params.tipo = tipo.value

  const { data } = await http.get('/aeroscope/map', { params })
  let arr = Array.isArray(data) ? data : []

  // filtro por tipo en cliente (garantiza funcionamiento aunque el backend no acepte tipo)
  if (tipo.value) {
    const t = tipo.value
    arr = arr.filter(r => String(r?.tipo || '').toLowerCase() === t)
  }

  rows.value = arr
    .filter(r =>
      r.longitude !== null && r.latitude !== null &&
      !Number.isNaN(Number(r.longitude)) && !Number.isNaN(Number(r.latitude))
    )
    .map(r => ({
      ...r,
      created_at_fmt: fmtDT(r.created_at || r.time || r.time_start || r.timestamp)
    }))
    .sort((a, b) => (b.created_at_fmt > a.created_at_fmt ? 1 : -1))

  // KPIs sobre el dataset filtrado
  kpi.total = rows.value.length
  kpi.ffpp = rows.value.filter(r => r.tipo === 'ffpp').length
  kpi.aeronautica = rows.value.filter(r => r.tipo === 'aeronautica').length
  kpi.hostil = rows.value.filter(r => r.tipo === 'hostil').length
}

function fmtDT(v) {
  const s = String(v || '')
  return s.replace('T', ' ').slice(0, 19) || '-'
}

const hayFiltros = computed(() =>
  !!(dateStart.value || dateEnd.value || droneId.value || aeroscopeId.value || tipo.value)
)

function resetFiltros() {
  dateStart.value = ''
  dateEnd.value = ''
  droneId.value = ''
  aeroscopeId.value = ''
  tipo.value = ''
  rows.value = []
  kpi.total = 0; kpi.ffpp = 0; kpi.aeronautica = 0; kpi.hostil = 0
}

// Exportaciones con filtros actuales
async function descargarCsv() {
  downCsv.value = true
  try {
    const params = {}
    if (dateStart.value) params.start = dateStart.value
    if (dateEnd.value) params.end = dateEnd.value
    if (droneId.value) params.drone_id = droneId.value
    if (aeroscopeId.value) params.aeroscope_id = aeroscopeId.value
    if (tipo.value) params.tipo = tipo.value

    const { data } = await http.get('/aeroscope/export-csv', {
      params,
      responseType: 'blob'
    })
    const url = window.URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'aeroscope_export.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  } finally {
    downCsv.value = false
  }
}

async function descargarKmz() {
  downKmz.value = true
  try {
    const params = {}
    if (dateStart.value) params.start = dateStart.value
    if (dateEnd.value) params.end = dateEnd.value
    if (droneId.value) params.drone_id = droneId.value
    if (aeroscopeId.value) params.aeroscope_id = aeroscopeId.value
    if (tipo.value) params.tipo = tipo.value

    const { data } = await http.get('/aeroscope/export-kmz', {
      params,
      responseType: 'blob'
    })
    const url = window.URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'aeroscope_export.kmz'
    a.click()
    window.URL.revokeObjectURL(url)
  } finally {
    downKmz.value = false
  }
}

// Paginación
const page = ref(1)
const pageSize = ref(20)
const totalPages = computed(() => Math.max(1, Math.ceil(rows.value.length / pageSize.value)))
const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return rows.value.slice(start, start + pageSize.value)
})
watch([rows, pageSize], () => { page.value = 1 })

// Lifecycle
onMounted(async () => {
  await cargarDistincts()
  await aplicarFiltros()
})
watch([dateStart, dateEnd, droneId, aeroscopeId, tipo], () => {
  aplicarFiltros()
})
</script>
