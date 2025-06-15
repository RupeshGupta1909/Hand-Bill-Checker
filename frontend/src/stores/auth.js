import { defineStore } from 'pinia'
import { authService } from '../services/authService'
import router from '../router'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('token'),
    loading: false,
    error: null
  }),
  
  getters: {
    isAuthenticated: (state) => !!state.token && !!state.user,
    isLoading: (state) => state.loading,
    getError: (state) => state.error,
    getUser: (state) => state.user
  },
  
  actions: {
    async login(credentials) {
      this.loading = true
      this.error = null
      
      try {
        console.log('Attempting login with credentials:', { email: credentials.email, password: '***' });
        const response = await authService.login(credentials);
        console.log('Login response:', response);
        this.token = response.data.tokens.authToken
        this.user = response.data.user
        localStorage.setItem('token', response.data.tokens.authToken)
        return response.data
      } catch (error) {
        console.error('Login error:', error);
        console.error('Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        this.error = error.response?.data?.message || 'Login failed'
        throw error
      } finally {
        this.loading = false
      }
    },
    
    async register(userData) {
      this.loading = true
      this.error = null
      
      try {
        const response = await authService.register(userData)
        this.token = response.token
        this.user = response.user
        
        localStorage.setItem('token', response.token)
        return response
      } catch (error) {
        this.error = error.response?.data?.message || 'Registration failed'
        throw error
      } finally {
        this.loading = false
      }
    },
    
    async logout() {
      try {
        await authService.logout()
      } catch (error) {
        console.error('Logout error:', error)
      } finally {
        this.token = null
        this.user = null
        localStorage.removeItem('token')
      }
    },
    
    async fetchUser() {
      if (!this.token) return
      
      this.loading = true
      this.error = null
      try {
        const response = await authService.getProfile();
        if (response.data.user) {
          this.user = response.data.user;
          router.push('/dashboard');
        } else {
          // Handle cases where the 'user' object might be missing in the response
          throw new Error('User data not found in response');
        }
      } catch (error) {
        console.error('Failed to fetch user:', error)
        // This will clear the token if fetching the user fails (e.g., token expired)
        this.logout()
        this.error = 'Session expired. Please log in again.';
      } finally {
        this.loading = false
      }
    },
    
    async initAuth() {
      const token = localStorage.getItem('token');
      if (token) {
        this.token = token;
        await this.fetchUser();
      }
    },

    clearError() {
      this.error = null
    }
  }
})