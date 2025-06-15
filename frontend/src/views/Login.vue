<template>
  <div class="auth-container">
    <div class="auth-card">
      <h2 class="auth-title">{{ t('LOGIN') }}</h2>
      
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="email" class="form-label">{{ t('EMAIL') }}</label>
          <input
            type="email"
            id="email"
            v-model="form.email"
            class="form-input"
            placeholder="Enter your email"
            required
          />
        </div>

        <div class="form-group">
          <label for="password" class="form-label">{{ t('PASSWORD') }}</label>
          <input
            type="password"
            id="password"
            v-model="form.password"
            class="form-input"
            placeholder="Enter your password"
            required
          />
        </div>

        <button type="submit" class="btn btn-primary" style="width: 100%;" :disabled="loading">
          {{ loading ? 'Logging in...' : t('LOGIN') }}
        </button>
      </form>

      <div class="text-center mt-6">
        <p style="color: #6b7280;">
          {{ t('DONT_HAVE_ACCOUNT') }}
          <router-link to="/register" style="color: #4f46e5; text-decoration: none; font-weight: 500;">
            {{ t('REGISTER') }}
          </router-link>
        </p>
      </div>

      <div v-if="error" class="alert alert-error mt-4">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLanguageStore } from '../stores/language'

export default {
  name: 'Login',
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    const languageStore = useLanguageStore()
    
    const t = computed(() => languageStore.t)
    const loading = ref(false)
    const error = ref('')
    
    const form = ref({
      email: '',
      password: ''
    })

    const handleLogin = async () => {
      loading.value = true
      error.value = ''
      
      try {
        await authStore.login(form.value)
        router.push('/dashboard')
      } catch (err) {
        error.value = err.message || 'Login failed. Please try again.'
      } finally {
        loading.value = false
      }
    }

    return {
      t,
      form,
      loading,
      error,
      handleLogin
    }
  }
}
</script> 