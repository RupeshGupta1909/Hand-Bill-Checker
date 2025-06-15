<template>
  <div id="app" class="app-container">
    <nav class="navbar">
      <div class="nav-container">
        <router-link to="/" class="nav-brand">
          {{ t('BRAND_NAME') }}
        </router-link>
        
        <div class="nav-links">
          <!-- Language Toggle -->
          <div class="language-toggle">
            <button 
              @click="setLanguage('en')" 
              :class="['language-btn', { active: isEnglish }]"
            >
              EN
            </button>
            <button 
              @click="setLanguage('hi')" 
              :class="['language-btn', { active: isHindi }]"
            >
              हि
            </button>
          </div>
          
          <!-- Navigation Links -->
          <template v-if="isAuthenticated">
            <router-link to="/dashboard" class="nav-link">{{ t('DASHBOARD') }}</router-link>
            <router-link to="/upload" class="nav-link">{{ t('UPLOAD') }}</router-link>
            <button @click="logout" class="nav-link" style="color: #ef4444;">{{ t('LOGOUT') }}</button>
          </template>
          <template v-else>
            <router-link to="/" class="nav-link">{{ t('HOME') }}</router-link>
            <router-link to="/login" class="nav-link">{{ t('LOGIN') }}</router-link>
            <router-link to="/register" class="nav-link">{{ t('REGISTER') }}</router-link>
          </template>
        </div>
      </div>
    </nav>

    <main>
      <router-view />
    </main>

    <!-- Footer -->
    <footer style="background: rgba(255, 255, 255, 0.9); border-top: 1px solid #e5e7eb; margin-top: 3rem; padding: 2rem 0;">
      <div style="max-width: 1200px; margin: 0 auto; padding: 0 2rem; text-align: center; color: #6b7280;">
        <p style="font-size: 0.875rem;">© 2025 {{ t('BRAND_NAME') }} - {{ t('HERO_SUBTITLE') }}</p>
      </div>
    </footer>
  </div>
</template>

<script>
import { computed, onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import { useLanguageStore } from './stores/language'
import { useRouter } from 'vue-router'

export default {
  name: 'App',
  setup() {
    const authStore = useAuthStore()
    const languageStore = useLanguageStore()
    const router = useRouter()
    
    const isAuthenticated = computed(() => authStore.isAuthenticated)
    const t = computed(() => languageStore.t)
    const isEnglish = computed(() => languageStore.isEnglish)
    const isHindi = computed(() => languageStore.isHindi)
    
    const logout = async () => {
      try {
        await authStore.logout()
        router.push('/')
      } catch (error) {
        console.error('Logout failed:', error)
      }
    }
    
    const setLanguage = (lang) => {
      languageStore.setLanguage(lang)
    }
    
    onMounted(() => {
      languageStore.initializeLanguage()
      authStore.initAuth()
    })
    
    return {
      isAuthenticated,
      t,
      isEnglish,
      isHindi,
      logout,
      setLanguage
    }
  }
} 
</script> 