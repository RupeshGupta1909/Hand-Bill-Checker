-<template>
  <div class="auth-container">
    <div class="auth-card">
      <h2 class="auth-title">{{ t('REGISTER') }}</h2>
      
      <form @submit.prevent="handleRegister">
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

        <div class="form-group">
          <label for="confirmPassword" class="form-label">{{ t('CONFIRM_PASSWORD') }}</label>
          <input
            type="password"
            id="confirmPassword"
            v-model="form.confirmPassword"
            class="form-input"
            placeholder="Confirm your password"
            required
          />
        </div>

        <div class="form-group">
          <label for="shopName" class="form-label">{{ t('SHOP_NAME') }}</label>
          <input
            type="text"
            id="shopName"
            v-model="form.shopName"
            class="form-input"
            placeholder="Enter shop name"
            required
          />
        </div>

        <div class="form-group">
          <label for="name" class="form-label">{{ t('OWNER_NAME') }}</label>
          <input
            type="text"
            id="name"
            v-model="form.name"
            class="form-input"
            placeholder="Enter your name"
            required
          />
        </div>

        <div class="form-group">
          <label for="phone" class="form-label">{{ t('PHONE') }}</label>
          <input
            type="tel"
            id="phone"
            v-model="form.phone"
            class="form-input"
            placeholder="Enter phone number"
            required
          />
        </div>

        <div class="form-group">
          <label for="address" class="form-label">{{ t('ADDRESS') }}</label>
          <textarea
            id="address"
            v-model="form.address"
            class="form-textarea"
            placeholder="Enter shop address"
            rows="3"
            required
          ></textarea>
        </div>

        <div class="form-group">
          <label for="plan" class="form-label">{{ t('SUBSCRIPTION_PLAN') }}</label>
          <select id="plan" v-model="form.plan" class="form-select" required>
            <option value="">Select a plan</option>
            <option value="free">{{ t('FREE_PLAN') }} - ₹0/{{ t('PER_MONTH') }}</option>
            <option value="basic">{{ t('BASIC_PLAN') }} - ₹299/{{ t('PER_MONTH') }}</option>
            <option value="premium">{{ t('PREMIUM_PLAN') }} - ₹999/{{ t('PER_MONTH') }}</option>
          </select>
        </div>

        <button type="submit" class="btn btn-primary" style="width: 100%;" :disabled="loading">
          {{ loading ? 'Creating Account...' : t('REGISTER') }}
        </button>
      </form>

      <div class="text-center mt-6">
        <p style="color: #6b7280;">
          {{ t('ALREADY_HAVE_ACCOUNT') }}
          <router-link to="/login" style="color: #4f46e5; text-decoration: none; font-weight: 500;">
            {{ t('LOGIN') }}
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
  name: 'Register',
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    const languageStore = useLanguageStore()
    
    const t = computed(() => languageStore.t)
    const loading = ref(false)
    const error = ref('')
    
    const form = ref({
      email: '',
      password: '',
      confirmPassword: '',
      shopName: '',
      name: '',
      phone: '',
      address: '',
      plan: 'free'
    })

    const handleRegister = async () => {
      if (form.value.password !== form.value.confirmPassword) {
        error.value = 'Passwords do not match'
        return
      }

      loading.value = true
      error.value = ''
      
      try {
        await authStore.register(form.value)
        router.push('/dashboard')
      } catch (err) {
        error.value = err.message || 'Registration failed. Please try again.'
      } finally {
        loading.value = false
      }
    }

    return {
      t,
      form,
      loading,
      error,
      handleRegister
    }
  }
}
</script> 