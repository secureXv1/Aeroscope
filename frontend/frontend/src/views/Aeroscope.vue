<template>
  <div class="space-y-4">
    <div class="card">
      <div class="card-body">
        <h2 class="font-semibold text-lg">Aeroscope</h2>
        <div class="flex flex-col sm:flex-row gap-3 mt-3">
          <input class="input sm:w-64" placeholder="Buscar (flight/drone/type)" v-model="q" @keyup.enter="fetchData(1)" />
          <button class="btn btn-primary" @click="fetchData(1)">Buscar</button>

          <form class="ml-auto flex items-center gap-2" @submit.prevent="uploadCsv">
            <input type="file" accept=".csv" @change="onFile" />
            <button class="btn btn-primary" :disabled="!file || uploading">
              {{ uploading ? 'Cargando…' : 'Subir CSV' }}
            </button>
          </form>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left border-b">
              <th class="py-2 pr-2">Flight ID</th>
              <th class="py-2 pr-2">Drone ID</th>
              <th class="py-2 pr-2">Type</th>
              <th class="py-2 pr-2">Max Alt (m)</th>
              <th class="py-2 pr-2">Coords</th>
              <th class="py-2 pr-2">Inicio</th>
              <th class="py-2 pr-2">Fin</th>
              <th class="py-2 pr-2 w-24">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in items" :key="r.id" class="border-b last:border-0">
              <td class="py-2 pr-2">{{ r.flight_id }}</td>
              <td class="py-2 pr-2">{{ r.drone_id }}</td>
              <td class="py-2 pr-2">{{ r.drone_type }}</td>
              <td class="py-2 pr-2">{{ r.max_alt_m }}</td>
              <td class="py-2 pr-2">{{ r.latitude }}, {{ r.longitude }}</td>
              <td class="py-2 pr-2">{{ fmt(r.time_start) }}</td>
              <td class="py-2 pr-2">{{ fmt(r.time_end) }}</td>
              <td class="py-2 pr-2">
                <button class="btn btn-ghost" @click="del(r.id)">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="flex items-center justify-between mt-3">
          <div class="text-xs text-slate-500">Total: {{ total }}</div>
          <div class="flex gap-2">
            <button class="btn" :disabled="page<=1" @click="fetchData(page-1)">«</button>
            <div class="px-2 py-2 text-sm">Página {{ page }}</div>
            <button class="btn" :disabled="page*pageSize>=total" @click="fetchData(page+1)">»</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="csvResult" class="card">
      <div class="card-body">
        <h3 class="font-semibold">Resultado CSV</h3>
        <p class="text-sm">Insertados: {{ csvResult.inserted }} | Errores: {{ csvResult.errors?.length || 0 }}</p>
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
const pageSize = ref(20)
const q = ref('')
const file = ref(null)
const uploading = ref(false)
const csvResult = ref(null)

const fetchData = async (p = 1) => {
  page.value = p
  const { data } = await http.get('/aeroscope', {
    params: { page: p, pageSize: pageSize.value, q: q.value }
  })
  items.value = data.items
  total.value = data.total
}

const onFile = (e) => file.value = e.target.files?.[0] || null

const uploadCsv = async () => {
  if (!file.value) return
  const fd = new FormData()
  fd.append('file', file.value)
  uploading.value = true
  try {
    const { data } = await http.post('/aeroscope/upload-csv', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    csvResult.value = data
    await fetchData(1)
  } finally {
    uploading.value = false
  }
}

const del = async (id) => {
  if (!confirm('Eliminar registro?')) return
  await http.delete(`/aeroscope/${id}`)
  await fetchData(page.value)
}

const fmt = (d) => d ? new Date(d).toLocaleString() : ''
onMounted(() => fetchData(1))
</script>
