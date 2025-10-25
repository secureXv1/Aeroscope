<template>
  <div class="space-y-5">
    <div class="card">
      <div class="card-body flex flex-col md:flex-row md:items-end gap-3">
        <div class="flex-1">
          <label class="text-sm text-slate-600">Buscar</label>
          <input class="input" placeholder="Entidad, Equipo, Serie…" v-model="q" @keyup.enter="fetchData(1)" />
        </div>
        <button class="btn" @click="fetchData(1)">Buscar</button>
        <button class="btn-primary ml-auto" @click="showForm()">Agregar nuevo</button>
        <!-- Carga de CSV -->
        <div class="flex-1 md:max-w-xs">
          <label class="text-sm text-slate-600">Subir CSV</label>
          <div
            class="mt-1 rounded-2xl border-2 border-dashed border-slate-300 bg-white/70 p-2 text-center cursor-pointer hover:bg-slate-50"
            @click="fileEl?.click()"
            @dragover.prevent
            @drop.prevent="onDrop"
          >
            <input ref="fileEl" type="file" class="hidden" accept=".csv" @change="onFile" />
            <p class="text-xs text-slate-500">
              Arrastra aquí o <span class="underline">haz clic</span>
            </p>
            <p v-if="file" class="mt-1 text-xs text-slate-500">Seleccionado: {{ file?.name }}</p>
            <button class="btn-primary mt-2" :disabled="!file || uploading" @click="uploadCsv">
              {{ uploading ? 'Cargando…' : 'Procesar CSV' }}
            </button>
          </div>
          <!-- Estado de carga -->
          <div v-if="csvResult" class="mt-2 text-xs">
            <span class="chip bg-green-100 text-green-700">Insertados: {{ csvResult.inserted ?? 0 }}</span>
            <span class="chip bg-red-100 text-red-700">Omitidos: {{ csvResult.omitidas ?? 0 }}</span>
            <span class="chip bg-yellow-100 text-yellow-700">Errores: {{ csvResult.errors?.length || 0 }}</span>
            <span v-if="csvResult.ok" class="ml-2 text-green-600 font-semibold">✔ ¡Carga exitosa!</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de formulario -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
        <h2 class="font-bold text-lg mb-4">{{ isEdit ? 'Editar' : 'Agregar' }} registro</h2>
        <form @submit.prevent="submitForm">
          <div class="space-y-2">
            <div>
              <label class="text-xs">Entidad</label>
              <input v-model="form.entidad" class="input w-full" required />
            </div>
            <div>
              <label class="text-xs">Equipo</label>
              <input v-model="form.equipo" class="input w-full" required />
            </div>
            <div>
              <label class="text-xs">Serie</label>
              <input v-model="form.serie" class="input w-full" required />
            </div>
            <div>
              <label class="text-xs">Matrícula</label>
              <input v-model="form.matricula" class="input w-full" />
            </div>
          </div>
          <div class="flex gap-2 mt-4">
            <button type="button" class="btn" @click="showModal=false">Cancelar</button>
            <button type="submit" class="btn-primary">{{ isEdit ? 'Guardar' : 'Agregar' }}</button>
          </div>
        </form>
        <button class="absolute top-3 right-4 text-slate-400 hover:text-red-500" @click="showModal=false">✕</button>
      </div>
    </div>

    <!-- Tabla de registros -->
    <div class="card overflow-hidden">
      <div class="card-body overflow-x-auto p-0">
        <div class="p-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div class="text-xs text-slate-500">Total: {{ total }}</div>
          <div class="flex items-center gap-2">
            <button class="btn" :disabled="page<=1" @click="fetchData(page-1)">«</button>
            <div class="px-2 py-2 text-sm">Página {{ page }}</div>
            <button class="btn" :disabled="page*pageSize>=total" @click="fetchData(page+1)">»</button>
          </div>
          <!-- Selector de cantidad por página -->
          <div class="flex items-center gap-1">
            <label class="text-xs">Por página:</label>
            <select v-model="pageSize" @change="fetchData(1)" class="input w-20">
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </div>
        </div>

        <table class="w-full text-sm">
          <thead class="bg-slate-50">
            <tr class="text-left border-b">
              <th class="py-3 px-4">Serie</th>
              <th class="py-3 px-4">Modelo</th>
              <th class="py-3 px-4">Entidad</th>
              <th class="py-3 px-4 w-24">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in items" :key="r.id" class="border-b last:border-0 hover:bg-slate-50/60">
              <td class="py-3 px-4">{{ r.serie }}</td>
              <td class="py-3 px-4">{{ r.modelo }}</td>
              <td class="py-3 px-4" :title="r.entidad">  {{ r.entidad }}</td>
              <td class="py-3 px-4">
                <button class="btn-ghost" @click="edit(r)">Editar</button>
                <button class="btn-ghost text-red-500" @click="del(r.id)">Eliminar</button>
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

// CSV state
const fileEl = ref(null)
const file = ref(null)
const uploading = ref(false)
const csvResult = ref(null)

// Modal/form state
const showModal = ref(false)
const isEdit = ref(false)
const form = ref({
  id: null, entidad: '', equipo: '', serie: '', matricula: ''
})

const fetchData = async (p = 1) => {
  page.value = p
  const { data } = await http.get('/aeronautica', {
    params: { page: p, pageSize: pageSize.value, q: q.value }
  })
  items.value = data.items || data
  total.value = data.total ?? items.value.length
}

function showForm(edit = false) {
  isEdit.value = !!edit
  if (edit && typeof edit === 'object') {
    form.value = { ...edit }
  } else {
    form.value = { id: null, entidad: '', equipo: '', serie: '', matricula: '' }
  }
  showModal.value = true
}

const edit = (row) => showForm(row)
const del = async (id) => {
  if (!confirm('¿Eliminar registro?')) return
  await http.delete(`/aeronautica/${id}`)
  await fetchData(page.value)
}
const submitForm = async () => {
  if (isEdit.value && form.value.id) {
    await http.put(`/aeronautica/${form.value.id}`, form.value)
  } else {
    await http.post('/aeronautica', form.value)
  }
  showModal.value = false
  await fetchData(page.value)
}

// ---- CSV logic
const onFile = (e) => (file.value = e.target.files?.[0] || null)
const onDrop = (e) => (file.value = e.dataTransfer?.files?.[0] || null)

const uploadCsv = async () => {
  if (!file.value) return
  const fd = new FormData()
  fd.append('file', file.value)
  uploading.value = true
  try {
    const { data } = await http.post('/aeronautica/upload-csv', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    csvResult.value = data
    await fetchData(1)
  } finally {
    uploading.value = false
    file.value = null
    if (fileEl.value) fileEl.value.value = null // LIMPIA el input real
  }
}
onMounted(() => fetchData(1))
</script>
