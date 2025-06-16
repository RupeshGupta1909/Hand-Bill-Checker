<template>
  <div class="main-content results-content-area">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">{{ t('RESULTS_TITLE') }}</h1>
          <p class="text-gray-600">Receipt ID: {{ receiptId }}</p>
        </div>
        <div class="results-header-box no-print">
          <router-link to="/dashboard" class="action-button-secondary">{{ t('BACK_TO_DASHBOARD') }}</router-link>
          <router-link to="/upload" class="action-button-primary">{{ t('UPLOAD_NEW_BILL') }}</router-link>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="spinner"></div>
      <p class="text-gray-600 mt-4">{{ t('RESULTS_LOADING') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert-error">
      <h3 class="font-semibold">{{ t('ERROR') }}</h3>
      <p>{{ error }}</p>
    </div>

    <!-- Results Content -->
    <div v-else-if="result" class="space-y-8">
      <!-- Status Banner -->
      <div class="card">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center space-x-4">
            <div :class="getStatusIconClass(result.status)" class="p-3 rounded-full">
              <CheckCircleIcon v-if="result.status === 'completed'" class="w-6 h-6" />
              <ClockIcon v-else-if="result.status === 'processing'" class="w-6 h-6" />
              <XCircleIcon v-else class="w-6 h-6" />
            </div>
            <div>
              <p v-if="authStore.user" class="text-xl font-semibold text-gray-900">{{ authStore.user.profile.shopName }}</p>
              <p class="text-sm font-medium text-gray-500">{{ getStatusText(result.status) }}</p>
              <p class="text-gray-600">{{ t('PROCESSED_ON') }} {{ formatDate(result.createdAt) }}</p>
            </div>
          </div>
          <div v-if="result.analysis" class="text-right">
            <div :class="result.analysis.hasDiscrepancies ? 'text-red-600' : 'text-green-600'" class="text-lg font-semibold">
              {{ result.analysis.hasDiscrepancies ? t('ERRORS_FOUND') : t('NO_ERRORS') }}
            </div>
            <p class="text-sm text-gray-600">{{ t('CONFIDENCE') }}: {{ (result.analysis.overallConfidence * 100).toFixed(1) || 'N/A' }}%</p>
          </div>
        </div>
      </div>

      <!-- Analysis Results -->
      <div v-if="result.analysis" class="card">
        <h3 class="text-lg font-semibold text-gray-900 mb-6">{{ t('CALCULATION_ANALYSIS') }}</h3>
        <!-- Overall Status -->
        <div class="mb-6 p-4 rounded-lg" :class="result.analysis.hasDiscrepancies ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'">
          <div class="flex items-center">
            <div v-if="!result.analysis.hasDiscrepancies" class="w-5 h-5 mr-2 flex-shrink-0" :class="result.analysis.hasDiscrepancies ? 'text-red-400' : 'text-green-400'" />
            <div v-else class="w-5 h-5 mr-2 flex-shrink-0" :class="result.analysis.hasDiscrepancies ? 'text-red-400' : 'text-green-400'" />
            <span :class="result.analysis.hasDiscrepancies ? 'text-red-800' : 'text-green-800'" class="font-semibold">
              {{ result.analysis.hasDiscrepancies ? t('CALCULATION_ERRORS_FOUND') : t('ALL_CALCULATIONS_CORRECT') }}
            </span>
          </div>
          <p :class="result.analysis.hasDiscrepancies ? 'text-red-700' : 'text-green-700'" class="mt-1 text-sm">{{ result.analysis.aiAnalysis || t('NO_DETAILS_AVAILABLE') }}</p>
        </div>

        <!-- Detected Items -->
        <div v-if="result.extractedData && result.extractedData.items && result.extractedData.items.length > 0" class="mb-6">
          <h4 class="font-semibold text-gray-900 mb-4">{{ t('DETECTED_ITEMS') }}</h4>
          <div class="overflow-x-auto">
            <table class="min-w-full border-separate" style="border-spacing: 20px 10px;">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('ITEM') }}</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('QUANTITY') }}</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('PRICE') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in result.extractedData.items" :key="index" class="bg-white rounded-lg shadow-sm">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{{ item.name || `${t('ITEM')} ${index + 1}` }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{{ item.quantity || '1' }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-semibold">₹{{ item.price || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <!-- Totals Summary -->
        <div v-if="result.extractedData" class="mb-6 mt-8">
            <h4 class="font-semibold text-gray-900 mb-4">{{ t('TOTALS_SUMMARY') }}</h4>
            <div class="bg-gray-50 rounded-lg p-4 space-y-2">
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600">{{ t('WRITTEN_TOTAL') }}:</span>
                    <span class="font-medium text-gray-900">₹{{ result.extractedData.written_total || 'N/A' }}</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600">{{ t('CALCULATED_TOTAL') }}:</span>
                    <span class="font-medium text-green-600">₹{{ result.extractedData.computed_total || 'N/A' }}</span>
                </div>
                <div class="flex justify-between text-lg font-semibold pt-2 border-t mt-2">
                    <span class="text-gray-900">{{ t('DIFFERENCE') }}:</span>
                    <span :class="result.analysis.hasDiscrepancies ? 'text-red-600' : 'text-green-600'">
                        ₹{{ Math.abs((result.extractedData.written_total || 0) - (result.extractedData.computed_total || 0)).toFixed(2) }}
                    </span>
                </div>
            </div>
        </div>

        <!-- Errors -->
        <div v-if="result.analysis.itemsWithErrors && result.analysis.itemsWithErrors.length > 0" class="mb-6">
          <h4 class="font-semibold text-red-800 mb-4">{{ t('ERRORS_FOUND_LIST') }}</h4>
          <div class="space-y-3">
            <div v-for="(error, index) in result.analysis.itemsWithErrors" :key="index" class="bg-red-50 border border-red-200 rounded-lg p-4">
              <div class="flex">
                <div>
                  <h5 class="font-medium text-red-800">{{ error.errorType || t('CALCULATION_ERROR') }}</h5>
                  <p class="text-red-700 text-sm mt-1">{{ error.errorMessage }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Suggestions -->
        <div v-if="result.analysis.suggestions && result.analysis.suggestions.length > 0">
          <h4 class="font-semibold text-blue-800 mb-4">{{ t('SUGGESTIONS') }}</h4>
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <ul class="space-y-2">
              <li v-for="(suggestion, index) in result.analysis.suggestions" :key="index" class="flex items-start">
                <span class="text-blue-800 text-sm">{{ suggestion }}</span>
              </li>
            </ul>
          </div>
        </div>
      
        <!-- Actions -->
        <div class="card mt-8 actions-card">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ t('ACTIONS') }}</h3>
          <div class="flex flex-wrap gap-4">
            <button @click="downloadPDF" class="action-button-primary">{{ t('DOWNLOAD_PDF') }}</button>
            <button class="action-button-secondary">{{ t('SEND_VIA_EMAIL') }}</button>
            <button class="action-button-secondary">{{ t('PRINT') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLanguageStore } from '../stores/language'
import { receiptService } from '../services/receiptService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon, 
  PhotoIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/vue/24/outline'
import { useAuthStore } from '../stores/auth';

export default {
  name: 'Results',
  components: {
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    PhotoIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon
  },
  setup() {
    const route = useRoute()
    const languageStore = useLanguageStore()
    const t = computed(() => languageStore.t)
    const receiptId = computed(() => route.params.id)
    const authStore = useAuthStore();
    
    const loading = ref(true)
    const error = ref(null)
    const result = ref(null)

    const downloadPDF = () => {
      const resultsContent = document.querySelector('.results-content-area');
      const elementsToHide = resultsContent.querySelectorAll('.no-print, .actions-card');
      
      // Hide elements before capture
      elementsToHide.forEach(el => el.style.display = 'none');

      html2canvas(resultsContent, {
        scale: 2, // Improve resolution
        useCORS: true,
        onclone: (document) => {
          // In the cloned document, we can ensure styles are applied
          const clonedContent = document.querySelector('.results-content-area');
          clonedContent.style.padding = '1rem';
        }
      }).then(canvas => {
        // Show elements again after capture
        elementsToHide.forEach(el => el.style.display = '');

        const imgData = canvas.toDataURL('image/jpeg', 0.8); // Use JPEG for better compression
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
        pdf.save(`receipt-analysis-${receiptId.value}.pdf`);
      }).catch(err => {
        // Ensure elements are shown even if there's an error
        elementsToHide.forEach(el => el.style.display = '');
        console.error("PDF generation failed:", err);
        error.value = "Could not generate PDF.";
      });
    };

    const getStatusIconClass = (status) => {
      switch (status) {
        case 'completed':
          return 'bg-green-100 text-green-600'
        case 'processing':
          return 'bg-yellow-100 text-yellow-600'
        case 'failed':
          return 'bg-red-100 text-red-600'
        default:
          return 'bg-gray-100 text-gray-600'
      }
    }

    const getStatusText = (status) => {
      switch(status) {
        case 'completed': return t.value('STATUS_COMPLETED')
        case 'processing': return t.value('STATUS_PROCESSING')
        case 'failed': return t.value('STATUS_FAILED')
        default: return t.value('STATUS_UNKNOWN')
      }
    }

    const formatDate = (dateString) => {
      if (!dateString) return ''
      const options = { year: 'numeric', month: 'long', day: 'numeric' }
      const lang = languageStore.language === 'hi' ? 'hi-IN' : 'en-US'
      return new Date(dateString).toLocaleDateString(lang, options)
    }

    onMounted(async () => {
      try {
        loading.value = true;
        const response = await receiptService.getReceiptDetails(receiptId.value);
        if (response.data && response.data.data && response.data.data.receipt) {
            result.value = response.data.data.receipt;
        } else {
            throw new Error("Invalid data structure received from server.");
        }
      } catch (error) {
        console.error('Failed to load receipt details:', error);
        error.value = t.value('ERROR_FETCHING_RESULTS');
      } finally {
        loading.value = false;
      }
    });

    return {
      loading,
      error,
      result,
      receiptId,
      t,
      getStatusIconClass,
      getStatusText,
      formatDate,
      downloadPDF,
      authStore
    }
  }
}
</script>

<style scoped>
.main-content {
  max-width: 900px;
  margin: 2rem auto;
  padding: 1.5rem;
}

.card {
  background-color: #fff;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.spinner {
    display: inline-block;
    width: 2rem;
    height: 2rem;
    border: 3px solid rgba(79, 70, 229, 0.3);
    border-right-color: #4f46e5;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

pre {
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
}

.results-header-box {
  padding: 1rem;
  border: 1px solid #e5e7eb; /* gray-200 */
  border-radius: 0.5rem; /* rounded-lg */
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); /* shadow-sm */
  display: flex;
  align-items: center;
  gap: 1rem; /* space-x-4 */
}

.action-button-primary,
.action-button-secondary {
  text-decoration: none !important;
  padding: 0.5rem 1rem;
  font-size: 0.875rem; /* text-sm */
  font-weight: 500; /* font-medium */
  border-radius: 0.5rem; /* rounded-lg */
  transition: background-color 0.2s;
}

.action-button-primary {
  background-color: #4f46e5; /* indigo-600 */
  color: white;
  border: 1px solid transparent;
}

.action-button-primary:hover {
  background-color: #4338ca; /* indigo-700 */
}

.action-button-secondary {
  background-color: white;
  color: #374151; /* gray-700 */
  border: 1px solid #d1d5db; /* gray-300 */
}

.action-button-secondary:hover {
  background-color: #f9fafb; /* gray-50 */
}
</style> 