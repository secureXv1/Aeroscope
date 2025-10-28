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
        <div class="ml-auto flex gap-2">
          <label class="btn btn-primary">
            <input
              ref="csvInput"
              type="file"
              accept=".csv,.xlsx"
              class="hidden"
              @change="onPickCsv"
            />
            {{ uploading ? `Subiendo… ${uploadPct}%` : 'Subir CSV' }}
          </label>
        </div>
        
        <!-- Estado de carga/resultado (opcional) -->
        <div v-if="csvResult" class="mt-2 text-xs">
          <span class="chip bg-green-100 text-green-700">Insertados: {{ csvResult.inserted ?? 0 }}</span>
          <span class="chip bg-red-100 text-red-700">Omitidos: {{ (csvResult.omitidas ?? csvResult.errors?.length) || 0 }}</span>
          <span class="chip bg-yellow-100 text-yellow-700">Errores: {{ csvResult.errors?.length || 0 }}</span>
          <span v-if="csvResult.ok" class="ml-2 text-green-600 font-semibold">✔ ¡Carga exitosa!</span>
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

// === CSV estilo Aeroscope ===
const csvInput = ref(null)       // <input type="file" ref="csvInput" ... />
const uploading = ref(false)     // estado de subida
const uploadPct = ref(0)         // porcentaje de subida
const csvResult = ref(null)      // { ok, inserted, omitidas, errors }

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

function showForm (edit = false) {
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

// === Helpers CSV ===
function openCsvPicker () {
  csvInput.value?.click()
}

async function onPickCsv (e) {
  csvResult.value = null
  uploadPct.value = 0

  const file = e.target.files?.[0]
  const reset = () => { e.target.value = '' }

  if (!file) return reset()

  // (Opcional) límite en cliente
  const MAX = 100 * 1024 * 1024 // 100 MB
  if (file.size > MAX) {
    alert('Archivo muy grande (máx. 100 MB).')
    return reset()
  }

  const fd = new FormData()
  fd.append('file', file)

  uploading.value = true
  try {
    const { data } = await http.post('/aeronautica/upload-csv', fd, {
      // ⚠️ No fijar manualmente Content-Type; axios lo arma con boundary correcto
      onUploadProgress: (p) => {
        if (p.total) uploadPct.value = Math.round((p.loaded * 100) / p.total)
      }
    })

    csvResult.value = {
      ok: !!data?.ok,
      inserted: data?.inserted ?? 0,
      omitidas: data?.omitidas ?? (data?.errors?.length || 0),
      errors: data?.errors || []
    }

    await fetchData(1) // refresca la tabla
  } catch (err) {
    const msg = err?.response?.data?.error || err?.message || 'Error subiendo CSV.'
    alert(msg)
  } finally {
    uploading.value = false
    uploadPct.value = 0
    reset()
  }
}

onMounted(() => fetchData(1))
</script>
