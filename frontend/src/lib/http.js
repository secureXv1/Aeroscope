import axios from 'axios';

export const http = axios.create({
  baseURL: 'http://192.168.1.95:8080/api' // Cambia esta IP por la de tu servidor real
})
