<template>
  <div class="main-content">
      <!-- Header -->
      <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">{{ t('DASHBOARD') }}</h1>
      <p class="text-gray-600">{{ t('DASHBOARD_SUBTITLE') }}</p>
      </div>

            <!-- Stats Cards -->
      <div class="stats-grid-2x2">
        <div class="card">
                      <div class="flex items-center">
          <div class="p-3 bg-blue-100 rounded-lg">
            <DocumentTextIcon class="w-6 h-6 text-blue-600" />
              </div>
            <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">{{ t('TOTAL_BILLS') }}</h3>
              <p class="text-2xl font-bold text-blue-600">{{ stats.totalReceipts || 0 }}</p>
            </div>
          </div>
        </div>
        <div class="card">
                      <div class="flex items-center">
          <div class="p-3 bg-green-100 rounded-lg">
            <CheckCircleIcon class="w-6 h-6 text-green-600" />
              </div>
            <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">{{ t('CORRECT_BILLS') }}</h3>
              <p class="text-2xl font-bold text-green-600">{{ stats.correctReceipts || 0 }}</p>
            </div>
          </div>
        </div>
        <div class="card">
                      <div class="flex items-center">
          <div class="p-3 bg-red-100 rounded-lg">
            <XCircleIcon class="w-6 h-6 text-red-600" />
              </div>
            <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">{{ t('ERROR_BILLS') }}</h3>
              <p class="text-2xl font-bold text-red-600">{{ stats.incorrectReceipts || 0 }}</p>
            </div>
          </div>
        </div>
        <div class="card">
                      <div class="flex items-center">
          <div class="p-3 bg-purple-100 rounded-lg">
            <ScaleIcon class="w-6 h-6 text-purple-600" />
              </div>
            <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">{{ t('ACCURACY') }}</h3>
              <p class="text-2xl font-bold text-purple-600">{{ accuracy }}%</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex space-x-4 mb-8">
      <router-link to="/upload" class="action-button-primary">{{ t('UPLOAD_NEW_BILL') }}</router-link>
      <button class="action-button-secondary">{{ t('DOWNLOAD_REPORT') }}</button>
      </div>

      <!-- Recent Receipts -->
      <div class="card">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">{{ t('RECENT_BILLS') }}</h2>
        <div v-if="loading" class="text-center py-8">
          <div class="spinner"></div>
        <p class="text-gray-600 mt-2">{{ t('LOADING') }}</p>
        </div>
        <div v-else-if="recentReceipts.length === 0" class="text-center py-8">
        <p class="text-gray-600 mt-2">{{ t('NO_BILLS_FOUND') }}</p>
        <router-link to="/upload" class="btn-primary mt-4 inline-block">{{ t('UPLOAD_FIRST_BILL') }}</router-link>
        </div>
      <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 table-fixed recent-receipts-table">
            <thead class="bg-gray-50">
              <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-4/12">{{ t('FILE_NAME') }}</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/12">{{ t('STATUS') }}</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/12">{{ t('RESULT') }}</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/12">{{ t('DATE') }}</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/12">{{ t('ACTIONS') }}</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="receipt in recentReceipts" :key="receipt.id">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ receipt.originalImagePath.split('/').pop() }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                <span :class="getStatusClass(receipt.status)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">{{ getStatusText(receipt.status) }}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span v-if="receipt.status === 'completed'" :class="getResultClass(receipt.hasDiscrepancies)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                  {{ receipt.hasDiscrepancies ? t('ERRORS_FOUND') : t('NO_ERRORS') }}
                  </span>
                </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ formatDate(receipt.createdAt) }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <router-link v-if="receipt.status === 'completed'" :to="`/results/${receipt.id}`" class="text-indigo-600 hover:text-indigo-900">{{ t('VIEW') }}</router-link>
                </td>
              </tr>
            </tbody>
          </table>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useLanguageStore } from '../stores/language'
import { DocumentTextIcon, CheckCircleIcon, XCircleIcon, ScaleIcon } from '@heroicons/vue/24/outline'
import { receiptService } from '../services/receiptService'

export default {
  name: 'Dashboard',
  components: {
    DocumentTextIcon,
    CheckCircleIcon,
    XCircleIcon,
    ScaleIcon
  },
  setup() {
    const authStore = useAuthStore()
    const languageStore = useLanguageStore()
    const t = computed(() => languageStore.t)
    const loading = ref(true)
    const recentReceipts = ref([])
    const stats = ref({
      totalReceipts: 0,
      correctReceipts: 0,
      incorrectReceipts: 0
    })

    const accuracy = computed(() => {
      if (stats.value.totalReceipts === 0) return 0
      return Math.round((stats.value.correctReceipts / stats.value.totalReceipts) * 100)
    })

    const getStatusClass = (status) => {
      switch (status) {
        case 'completed':
          return 'bg-green-100 text-green-800'
        case 'processing':
          return 'bg-yellow-100 text-yellow-800'
        case 'failed':
          return 'bg-red-100 text-red-800'
        default:
          return 'bg-gray-100 text-gray-800'
      }
    }

    const getStatusText = (status) => {
      switch (status) {
        case 'completed': return t.value('STATUS_COMPLETED')
        case 'processing': return t.value('STATUS_PROCESSING')
        case 'failed': return t.value('STATUS_FAILED')
        default: return t.value('STATUS_UNKNOWN')
      }
    }

    const getResultClass = (hasErrors) => {
      return hasErrors ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
    }

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('hi-IN')
    }

    onMounted(async () => {
      try {
        const response = await receiptService.getUserReceipts(10);
        const receipts = response.data.data.receipts;
        recentReceipts.value = receipts;
        // Calculate stats from the fetched data
        const total = receipts.length;
        const incorrect = receipts.filter(r => r.hasDiscrepancies).length;
        const correct = total - incorrect;

        stats.value = {
          totalReceipts: total,
          correctReceipts: correct,
          incorrectReceipts: incorrect
        };

      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        loading.value = false;
      }
    })

    return {
      loading,
      recentReceipts,
      stats,
      accuracy,
      getStatusClass,
      getStatusText,
      getResultClass,
      formatDate,
      t
    }
  }
}
</script>

<style scoped>
.action-button-primary,
.action-button-secondary {
  text-decoration: none !important;
  padding: 0.5rem 1rem;
  font-size: 0.875rem; /* text-sm */
  font-weight: 500; /* font-medium */
  border-radius: 0.5rem; /* rounded-lg */
  transition: background-color 0.2s;
  display: inline-block;
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

/* Force specific column widths for the recent receipts table */
.recent-receipts-table {
  table-layout: fixed !important;
  width: 100% !important;
}

.recent-receipts-table th:nth-child(1),
.recent-receipts-table td:nth-child(1) {
  width: 33.333333% !important; /* 4/12 */
}

.recent-receipts-table th:nth-child(2),
.recent-receipts-table td:nth-child(2),
.recent-receipts-table th:nth-child(3),
.recent-receipts-table td:nth-child(3),
.recent-receipts-table th:nth-child(4),
.recent-receipts-table td:nth-child(4),
.recent-receipts-table th:nth-child(5),
.recent-receipts-table td:nth-child(5) {
  width: 16.666667% !important; /* 2/12 */
}

/* 2x2 Grid layout for stats cards */
.stats-grid-2x2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

@media (min-width: 768px) {
  .stats-grid-2x2 {
    grid-template-columns: 1fr 1fr;
    max-width: 800px; /* Limit width to ensure 2x2 layout */
  }
}
</style> 