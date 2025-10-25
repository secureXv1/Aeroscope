<template>
  <div class="space-y-5">
    <div class="card">
      <div class="card-body">
        <div class="flex flex-col md:flex-row md:items-end gap-3">
          <div class="flex-1">
            <label class="text-sm text-slate-600">Buscar</label>
            <input class="input" placeholder="Flight, Drone, Type…" v-model="q" @keyup.enter="fetchData(1)" />
          </div>
          <button class="btn" @click="fetchData(1)">Buscar</button>
          <div class="hidden md:block w-px h-8 bg-slate-200"></div>

          <div class="flex-1">
            <label class="text-sm text-slate-600">Subir CSV</label>
            <div
              class="mt-1 rounded-2xl border-2 border-dashed border-slate-300 bg-white/70 p-4 text-center cursor-pointer hover:bg-slate-50"
              @click="fileEl?.click()"
              @dragover.prevent
              @drop.prevent="onDrop"
            >
              <input ref="fileEl" type="file" class="hidden" accept=".csv" @change="onFile" />
              <p class="text-sm text-slate-600">
                Arrastra tu archivo aquí o <span class="underline">haz clic</span> para seleccionar
              </p>
              <p v-if="file" class="mt-1 text-xs text-slate-500">Seleccionado: {{ file?.name }}</p>
              <button class="btn-primary mt-3" :disabled="!file || uploading" @click="uploadCsv">
                {{ uploading ? 'Cargando…' : 'Procesar CSV' }}
              </button>
              <!-- Barra de progreso simple bajo el botón -->
              <div v-if="uploading" class="w-full h-2 bg-slate-200 rounded mt-2 overflow-hidden">
                <div class="h-full bg-blue-500 animate-pulse w-full"></div>
              </div>

            </div>
          </div>
          <!-- Aviso de éxito/error tras la carga -->
          <div v-if="csvMsg" :class="[
            'mt-4 px-4 py-2 rounded shadow text-white transition-all duration-300',
            csvMsgOk ? 'bg-green-600' : 'bg-red-600'
          ]">
            {{ csvMsg }}
          </div>
        </div>

        <div v-if="csvResult" class="mt-4 flex items-center gap-3">
          <span class="chip">Insertados: {{ csvResult.inserted }}</span>
          <span class="chip">Errores: {{ csvResult.errors?.length || 0 }}</span>
        </div>
      </div>
    </div>

    <div class="card overflow-hidden">
      <div class="card-body overflow-x-auto p-0">
        <table class="w-full text-sm">
          <thead class="bg-slate-50">
            <tr class="text-left border-b">
              <th class="py-3 px-4">Flight</th>
              <th class="py-3 px-4">Drone</th>
              <th class="py-3 px-4">Type</th>
              <th class="py-3 px-4">Max Alt (m)</th>
              <th class="py-3 px-4">Coords</th>
              <th class="py-3 px-4">Inicio</th>
              <th class="py-3 px-4">Fin</th>
              <th class="py-3 px-4 w-24">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in items" :key="r.id" class="border-b last:border-0 hover:bg-slate-50/60">
              <td class="py-3 px-4 font-medium">{{ r.flight_id }}</td>
              <td class="py-3 px-4">{{ r.drone_id }}</td>
              <td class="py-3 px-4"><span class="chip">{{ r.drone_type || '—' }}</span></td>
              <td class="py-3 px-4">{{ r.max_alt_m ?? '—' }}</td>
              <td class="py-3 px-4 text-xs">{{ r.latitude }}, {{ r.longitude }}</td>
              <td class="py-3 px-4">{{ fmt(r.time_start) }}</td>
              <td class="py-3 px-4">{{ fmt(r.time_end) }}</td>
              <td class="py-3 px-4">
                <button class="btn-ghost" @click="del(r.id)">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="p-3 flex items-center justify-between">
          <div class="text-xs text-slate-500">Total: {{ total }}</div>
          <div class="flex items-center gap-2">
            <button class="btn" :disabled="page<=1" @click="fetchData(page-1)">«</button>
            <div class="px-2 py-2 text-sm">Página {{ page }}</div>
            <button class="btn" :disabled="page*pageSize>=total" @click="fetchData(page+1)">»</button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { http } from '../lib/http'
import { ref, onMounted } from 'vue'

const items = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(12)
const q = ref('')

const fileEl = ref(null)
const file = ref(null)
const uploading = ref(false)
const csvResult = ref(null)

const csvMsg = ref('')
const csvMsgOk = ref(true)

const fetchData = async (p = 1) => {
  page.value = p
  const { data } = await http.get('/aeroscope', {
    params: { page: p, pageSize: pageSize.value, q: q.value }
  })
  items.value = data.items || data
  total.value = data.total ?? items.value.length
}

const onFile = (e) => (file.value = e.target.files?.[0] || null)
const onDrop = (e) => (file.value = e.dataTransfer?.files?.[0] || null)

const uploadCsv = async () => {
  if (!file.value) return
  const fd = new FormData()
  fd.append('file', file.value)
  uploading.value = true
  csvMsg.value = '' // Oculta mensajes previos
  try {
    const { data } = await http.post('/aeroscope/upload-csv', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    csvResult.value = data
    await fetchData(1)
    csvMsg.value = `¡Carga exitosa! ${data.inserted} filas insertadas.`
    csvMsgOk.value = true
  } catch (e) {
    csvMsg.value = e?.response?.data?.error || 'Error al cargar el CSV.'
    csvMsgOk.value = false
  } finally {
    uploading.value = false
    file.value = null
    if (fileEl.value) fileEl.value.value = null
    // El mensaje desaparece solo después de 4s
    setTimeout(() => { csvMsg.value = '' }, 4000)
  }
}

const del = async (id) => {
  if (!confirm('Eliminar registro?')) return
  await http.delete(`/aeroscope/${id}`)
  await fetchData(page.value)
}

const fmt = (d) => (d ? new Date(d).toLocaleString() : '—')
onMounted(() => fetchData(1))
</script>
