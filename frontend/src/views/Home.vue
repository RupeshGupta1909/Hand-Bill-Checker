<template>
  <div class="main-content">
    <!-- Hero Section -->
    <section class="hero">
      <h1 class="hero-title">{{ t('HERO_TITLE') }}</h1>
      <p class="hero-subtitle">{{ t('HERO_SUBTITLE') }}</p>
      <div class="flex justify-center gap-4">
        <router-link to="/register" class="btn btn-primary">{{ t('GET_STARTED') }}</router-link>
        <router-link to="#features" class="btn btn-secondary">{{ t('LEARN_MORE') }}</router-link>
      </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="mb-8">
      <div class="text-center mb-6">
        <h2 class="text-2xl font-bold mb-2">{{ t('FEATURES_TITLE') }}</h2>
        <p class="text-lg" style="color: #6b7280;">{{ t('FEATURES_SUBTITLE') }}</p>
      </div>
      
      <div class="grid grid-cols-3">
        <!-- Feature 1 -->
        <div class="text-center">
          <div style="width: 4rem; height: 4rem; background: rgba(79, 70, 229, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
            <span style="font-size: 1.5rem;">📷</span>
          </div>
          <h3 class="text-xl font-semibold mb-2">{{ t('UPLOAD_PHOTO') }}</h3>
          <p style="color: #6b7280;">{{ t('UPLOAD_PHOTO_DESC') }}</p>
        </div>

        <!-- Feature 2 -->
        <div class="text-center">
          <div style="width: 4rem; height: 4rem; background: rgba(16, 185, 129, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
            <span style="font-size: 1.5rem;">⚡</span>
          </div>
          <h3 class="text-xl font-semibold mb-2">{{ t('INSTANT_CHECK') }}</h3>
          <p style="color: #6b7280;">{{ t('INSTANT_CHECK_DESC') }}</p>
        </div>

        <!-- Feature 3 -->
        <div class="text-center">
          <div style="width: 4rem; height: 4rem; background: rgba(245, 158, 11, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
            <span style="font-size: 1.5rem;">💡</span>
          </div>
          <h3 class="text-xl font-semibold mb-2">{{ t('GET_SUGGESTIONS') }}</h3>
          <p style="color: #6b7280;">{{ t('GET_SUGGESTIONS_DESC') }}</p>
        </div>
      </div>
    </section>

    <!-- How it Works -->
    <section style="background: rgba(249, 250, 251, 0.5); padding: 3rem; border-radius: 16px; margin-bottom: 2rem;">
      <div class="text-center mb-6">
        <h2 class="text-2xl font-bold">{{ t('HOW_IT_WORKS') }}</h2>
      </div>
      
      <div class="grid grid-cols-4">
        <div class="text-center">
          <div style="width: 2.5rem; height: 2.5rem; background: #4f46e5; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-weight: 700;">1</div>
          <h3 class="font-semibold mb-2">{{ t('STEP_REGISTER') }}</h3>
          <p style="font-size: 0.875rem; color: #6b7280;">{{ t('STEP_REGISTER_DESC') }}</p>
        </div>
        
        <div class="text-center">
          <div style="width: 2.5rem; height: 2.5rem; background: #4f46e5; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-weight: 700;">2</div>
          <h3 class="font-semibold mb-2">{{ t('STEP_UPLOAD') }}</h3>
          <p style="font-size: 0.875rem; color: #6b7280;">{{ t('STEP_UPLOAD_DESC') }}</p>
        </div>
        
        <div class="text-center">
          <div style="width: 2.5rem; height: 2.5rem; background: #4f46e5; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-weight: 700;">3</div>
          <h3 class="font-semibold mb-2">{{ t('STEP_CHECK') }}</h3>
          <p style="font-size: 0.875rem; color: #6b7280;">{{ t('STEP_CHECK_DESC') }}</p>
        </div>
        
        <div class="text-center">
          <div style="width: 2.5rem; height: 2.5rem; background: #4f46e5; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-weight: 700;">4</div>
          <h3 class="font-semibold mb-2">{{ t('STEP_RESULTS') }}</h3>
          <p style="font-size: 0.875rem; color: #6b7280;">{{ t('STEP_RESULTS_DESC') }}</p>
        </div>
      </div>
    </section>

    <!-- Pricing -->
    <section>
      <div class="text-center mb-6">
        <h2 class="text-2xl font-bold mb-2">{{ t('PRICING_TITLE') }}</h2>
        <p class="text-lg" style="color: #6b7280;">{{ t('PRICING_SUBTITLE') }}</p>
      </div>
      
      <div class="grid grid-cols-3">
        <!-- Free Plan -->
        <div class="card text-center">
          <h3 class="text-xl font-bold mb-4">{{ t('FREE_PLAN') }}</h3>
          <div class="text-xl font-bold mb-4" style="color: #4f46e5;">₹0</div>
          <p style="color: #6b7280;" class="mb-6">{{ t('PER_MONTH') }}</p>
          <ul class="text-left mb-8" style="list-style: none; padding: 0;">
            <li class="flex items-center mb-2">
              <span style="color: #10b981; margin-right: 0.5rem;">✓</span>
              10 {{ t('BILLS_PER_MONTH') }}
            </li>
            <li class="flex items-center">
              <span style="color: #10b981; margin-right: 0.5rem;">✓</span>
              {{ t('BASIC_SUPPORT') }}
            </li>
          </ul>
          <router-link to="/register" class="btn btn-primary" style="width: 100%;">{{ t('GET_STARTED') }}</router-link>
        </div>

        <!-- Basic Plan -->
        <div class="card text-center" style="border: 2px solid rgba(79, 70, 229, 0.2);">
          <h3 class="text-xl font-bold mb-4">{{ t('BASIC_PLAN') }}</h3>
          <div class="text-3xl font-bold mb-4" style="color: #4f46e5;">₹299</div>
          <p style="color: #6b7280;" class="mb-6">{{ t('PER_MONTH') }}</p>
          <ul class="text-left mb-8" style="list-style: none; padding: 0;">
            <li class="flex items-center mb-2">
              <span style="color: #10b981; margin-right: 0.5rem;">✓</span>
              100 {{ t('BILLS_PER_MONTH') }}
            </li>
            <li class="flex items-center">
              <span style="color: #10b981; margin-right: 0.5rem;">✓</span>
              {{ t('PRIORITY_SUPPORT') }}
            </li>
          </ul>
          <router-link to="/register" class="btn btn-primary" style="width: 100%;">{{ t('CHOOSE') }}</router-link>
        </div>

        <!-- Premium Plan -->
        <div class="card text-center">
          <h3 class="text-xl font-bold mb-4">{{ t('PREMIUM_PLAN') }}</h3>
          <div class="text-3xl font-bold mb-4" style="color: #4f46e5;">₹999</div>
          <p style="color: #6b7280;" class="mb-6">{{ t('PER_MONTH') }}</p>
          <ul class="text-left mb-8" style="list-style: none; padding: 0;">
            <li class="flex items-center mb-2">
              <span style="color: #10b981; margin-right: 0.5rem;">✓</span>
              1000 {{ t('BILLS_PER_MONTH') }}
            </li>
            <li class="flex items-center mb-2">
              <span style="color: #10b981; margin-right: 0.5rem;">✓</span>
              {{ t('PRIORITY_PROCESSING') }}
            </li>
            <li class="flex items-center">
              <span style="color: #10b981; margin-right: 0.5rem;">✓</span>
              {{ t('SUPPORT_24_7') }}
            </li>
          </ul>
          <router-link to="/register" class="btn btn-primary" style="width: 100%;">{{ t('CHOOSE') }}</router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useLanguageStore } from '../stores/language'

export default {
  name: 'Home',
  setup() {
    const languageStore = useLanguageStore()
    const t = computed(() => languageStore.t)
    
    return {
      t
    }
  }
}
</script> 