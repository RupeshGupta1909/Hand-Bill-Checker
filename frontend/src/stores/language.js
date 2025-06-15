import { defineStore } from 'pinia'
import { LANGUAGE_CONSTANTS } from '../constants/language-constants.js'

export const useLanguageStore = defineStore('language', {
  state: () => ({
    currentLanguage: 'en' // Default to English
  }),
  
  getters: {
    t: (state) => (key) => {
      const constant = LANGUAGE_CONSTANTS[key]
      if (!constant) {
        console.warn(`Language constant not found: ${key}`)
        return key
      }
      return constant[state.currentLanguage] || constant.en || key
    },
    
    isEnglish: (state) => state.currentLanguage === 'en',
    isHindi: (state) => state.currentLanguage === 'hi'
  },
  
  actions: {
    setLanguage(language) {
      if (language === 'en' || language === 'hi') {
        this.currentLanguage = language
        localStorage.setItem('preferred-language', language)
      }
    },
    
    toggleLanguage() {
      this.setLanguage(this.currentLanguage === 'en' ? 'hi' : 'en')
    },
    
    initializeLanguage() {
      const saved = localStorage.getItem('preferred-language')
      if (saved && (saved === 'en' || saved === 'hi')) {
        this.currentLanguage = saved
      }
    }
  }
}); 