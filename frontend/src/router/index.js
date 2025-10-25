// frontend/src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import Layout from '../views/Layout.vue'
import Dashboard from '../views/Dashboard.vue'
import Aeroscope from '../views/Aeroscope.vue'
import FFPP from '../views/FFPP.vue'
import Aeronautica from '../views/Aeronautica.vue'

const routes = [
  {
    path: '/',
    component: Layout,
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', component: Dashboard },
      { path: 'aeroscope', component: Aeroscope },
      { path: 'ffpp', component: FFPP },
      { path: 'aeronautica', component: Aeronautica }
    ]
  }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
