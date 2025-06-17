<template>
  <div id="app" class="app-container">
    <nav class="navbar">
      <div class="nav-container">
        <router-link to="/" class="nav-brand">
          {{ t('BRAND_NAME') }}
        </router-link>
        
        <!-- Right side navigation -->
        <div class="nav-right">
          <!-- Language Toggle - Always visible -->
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
          
          <!-- Mobile menu button -->
          <button 
            @click="toggleMobileMenu" 
            class="mobile-menu-btn md:hidden"
            :class="{ 'active': isMobileMenuOpen }"
          >
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
          </button>
          
          <!-- Desktop navigation links -->
          <div class="desktop-nav-links">
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
        
        <!-- Mobile dropdown menu -->
        <div class="mobile-nav" :class="{ 'active': isMobileMenuOpen }">
          <!-- Mobile Navigation Links -->
          <template v-if="isAuthenticated">
            <router-link to="/dashboard" class="mobile-nav-link" @click="closeMobileMenu">{{ t('DASHBOARD') }}</router-link>
            <router-link to="/upload" class="mobile-nav-link" @click="closeMobileMenu">{{ t('UPLOAD') }}</router-link>
            <button @click="logout; closeMobileMenu()" class="mobile-nav-link logout-btn">{{ t('LOGOUT') }}</button>
          </template>
          <template v-else>
            <router-link to="/" class="mobile-nav-link" @click="closeMobileMenu">{{ t('HOME') }}</router-link>
            <router-link to="/login" class="mobile-nav-link" @click="closeMobileMenu">{{ t('LOGIN') }}</router-link>
            <router-link to="/register" class="mobile-nav-link" @click="closeMobileMenu">{{ t('REGISTER') }}</router-link>
          </template>
        </div>
      </div>
    </nav>

    <!-- Mobile menu overlay -->
    <div 
      v-if="isMobileMenuOpen" 
      class="mobile-overlay"
      @click="closeMobileMenu"
    ></div>

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
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from './stores/auth'
import { useLanguageStore } from './stores/language'
import { useRouter } from 'vue-router'

export default {
  name: 'App',
  setup() {
    const authStore = useAuthStore()
    const languageStore = useLanguageStore()
    const router = useRouter()
    const isMobileMenuOpen = ref(false)
    
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
    
    const toggleMobileMenu = () => {
      isMobileMenuOpen.value = !isMobileMenuOpen.value
    }
    
    const closeMobileMenu = () => {
      isMobileMenuOpen.value = false
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
      setLanguage,
      isMobileMenuOpen,
      toggleMobileMenu,
      closeMobileMenu
    }
  }
} 
</script> 

<style scoped>
/* Mobile menu button (hamburger) */
.mobile-menu-btn {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  width: 30px;
  height: 30px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  z-index: 1001;
}

.hamburger-line {
  width: 100%;
  height: 3px;
  background-color: #374151;
  transition: all 0.3s ease;
  transform-origin: center;
}

.mobile-menu-btn.active .hamburger-line:nth-child(1) {
  transform: rotate(45deg) translate(7px, 7px);
}

.mobile-menu-btn.active .hamburger-line:nth-child(2) {
  opacity: 0;
}

.mobile-menu-btn.active .hamburger-line:nth-child(3) {
  transform: rotate(-45deg) translate(7px, -7px);
}

/* Right side navigation container */
.nav-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* Desktop navigation links - hide on mobile */
.desktop-nav-links {
  display: flex;
  align-items: center;
  gap: 1rem;
}

@media (max-width: 768px) {
  .desktop-nav-links {
    display: none;
  }
}

/* Mobile navigation dropdown */
.mobile-nav {
  display: none;
  position: absolute;
  top: 100%;
  right: 0;
  left: 0;
  background: white;
  border-top: 1px solid #e5e7eb;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  z-index: 1000;
  padding: 1rem;
}

.mobile-nav.active {
  display: block;
}

/* Mobile navigation links */
.mobile-nav-link {
  display: block;
  padding: 0.75rem 1rem;
  text-decoration: none;
  color: #374151;
  border-bottom: 1px solid #f3f4f6;
  transition: background-color 0.2s;
  border: none;
  background: none;
  text-align: left;
  width: 100%;
  font-size: 1rem;
  cursor: pointer;
}

.mobile-nav-link:hover {
  background-color: #f9fafb;
}

.mobile-nav-link:last-child {
  border-bottom: none;
}

.mobile-nav-link.logout-btn {
  color: #ef4444;
}



/* Mobile overlay */
.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: block;
}

@media (min-width: 769px) {
  .mobile-overlay {
    display: none;
  }
}

/* Ensure navbar has relative positioning for dropdown */
.navbar {
  position: relative;
}

/* Show mobile menu button only on small screens */
.mobile-menu-btn {
  display: none;
}

@media (max-width: 768px) {
  .mobile-menu-btn {
    display: flex;
  }
}
</style> 