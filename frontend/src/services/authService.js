import axios from 'axios'

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api`

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true
})

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}, error => {
  console.error('Request error:', error);
  return Promise.reject(error);
})

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      }
    });
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authService = {
  async login(credentials) {
    const response = await api.post('/auth/login', credentials)
    return response.data
  },
  
  async register(userData) {
    const response = await api.post('/auth/register', userData)
    return response.data
  },
  
  async logout() {
    const response = await api.post('/auth/logout')
    return response.data
  },
  
  async getProfile() {
    const response = await api.get('/auth/me')
    return response.data
  },
  
  async refreshToken() {
    const response = await api.post('/auth/refresh')
    return response.data
  }
}

export default api 