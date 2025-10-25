<template>
  <div class="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50">
    <!-- Topbar (móvil) -->
    <header class="md:hidden sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200/60">
      <div class="px-4 h-14 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl" :style="logoStyle"></div>
          <span class="font-semibold">AeroPortal</span>
        </div>
        <button class="btn-ghost" @click="open = !open">
          <MenuIcon class="w-5 h-5" />
        </button>
      </div>
      <nav v-if="open" class="p-2 grid gap-1 border-t border-slate-100">
        <RouterLink v-for="i in links" :key="i.to" :to="i.to" :class="linkClass(i.to)" @click="open=false">
          <component :is="i.icon" class="w-4 h-4" /> {{ i.name }}
        </RouterLink>
      </nav>
    </header>

    <div class="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10 flex gap-6">
      <!-- Sidebar (desktop) -->
      <aside class="hidden md:flex w-64 shrink-0">
        <div class="card w-full h-[calc(100vh-4rem)] sticky top-6 p-4 flex flex-col">
          <div class="flex items-center gap-3 px-2 pb-4 border-b border-slate-200/60">
            <div class="w-10 h-10 rounded-2xl" :style="logoStyle"></div>
            <div>
              <div class="font-semibold leading-tight">PORTAL</div>
              <div class="text-xs text-slate-500">MySQL • Node • Vue</div>
            </div>
          </div>

          <nav class="mt-4 space-y-1">
            <RouterLink v-for="i in links" :key="i.to" :to="i.to" :class="linkClass(i.to)">
              <component :is="i.icon" class="w-4 h-4" />
              <span>{{ i.name }}</span>
            </RouterLink>
          </nav>
          
          <div class="mt-auto pt-3">
            <button class="btn" @click="descargarBackup" :disabled="descargando">
                {{ descargando ? 'Exportando…' : 'Exportar Base de Datos SQL' }}
              </button>
            <div class="card p-3">
              <div class="text-xs text-slate-500">Estado</div>
              
              <div class="mt-1 flex items-center gap-2">
                <span class="size-2 rounded-full bg-emerald-500"></span>
                <span class="text-sm">API conectada</span>
                
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Contenido -->
      <main class="flex-1 space-y-6">
        <slot name="page-header">
          
        </slot>
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { computed, ref } from 'vue'
import { LayoutDashboard, Radar, FolderCog, Plane, Menu as MenuIcon } from 'lucide-vue-next'


const route = useRoute()
const open = ref(false)
const links = [
  { to: '/dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { to: '/aeroscope', name: 'Aeroscope', icon: Radar },
  { to: '/ffpp', name: 'FFPP', icon: FolderCog },
  { to: '/aeronautica', name: 'Aeronautica', icon: Plane }
]

const linkClass = (path) =>
  computed(() => `sidebar-link ${route.path === path ? 'sidebar-link-active' : ''}`).value

const logoStyle = computed(() => ({
  background:
    'conic-gradient(from 180deg at 50% 50%, hsl(var(--brand-from)) 0deg, hsl(var(--brand-to)) 160deg, #fff 360deg)'
}))

const descargando = ref(false);

async function descargarBackup() {
  descargando.value = true;
  try {
    const resp = await fetch('/api/export/export-db');
    if (!resp.ok) throw new Error('Error al exportar');
    const blob = await resp.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup_bd.sql';
    a.click();
    window.URL.revokeObjectURL(url);
  } finally {
    descargando.value = false;
  }
}

</script>
