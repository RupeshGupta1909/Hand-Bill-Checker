<template>
  <div class="main-content">
    <!-- Header -->
    <div class="mb-8 text-center">
      <h1 class="text-3xl font-bold text-gray-900">{{ t('UPLOAD_BILL') }}</h1>
      <p class="text-gray-600 mt-2">{{ t('UPLOAD_BILL_SUBTITLE') }}</p>
    </div>

    <!-- Upload Area -->
    <div class="card mb-8">
      <div 
        class="upload-area"
        :class="{ 'dragover': isDragging }"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <div v-if="!selectedFile" class="text-center">
          <div class="mt-4">
            <p class="mt-2 block text-sm font-medium text-gray-900">{{ t('DRAG_DROP') }}</p>
            <input
              ref="fileInput"
              type="file"
              class="sr-only"
              accept="image/*"
              @change="handleFileSelect"
            />
            <p class="mt-1 text-xs text-gray-500">{{ t('SUPPORTED_FORMATS') }}</p>
          </div>
        </div>

        <!-- Selected File Preview -->
        <div v-else>
          <div class="relative inline-block mx-auto w-full max-w-xs">
            <img v-if="filePreview" :src="filePreview" alt="Preview" class="w-full h-auto object-contain max-h-48 rounded-lg shadow-md"/>
            <button @click.stop="removeFile" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-600">
               X
            </button>
          </div>
          <div class="text-center">
            <p class="mt-2 text-sm text-gray-900">{{ selectedFile.name }}</p>
            <p class="text-xs text-gray-500">{{ formatFileSize(selectedFile.size) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload Form & Action -->
    <div v-if="selectedFile && !uploadResult" class="card mb-8">
      <div class="mt-6 flex justify-end space-x-4">
        <button type="button" @click="removeFile" class="btn-secondary">{{ t('CANCEL') }}</button>
        <button @click="handleUpload" :disabled="isUploading" class="btn-primary">
          <span v-if="isUploading" class="spinner mr-2"></span>
          {{ isUploading ? t('UPLOADING') : t('UPLOAD') }}
        </button>
      </div>
    </div>

    <!-- Upload Status -->
    <div v-if="uploadResult" class="card">
      <div v-if="uploadResult.error" class="alert-error">
        <h3 class="text-sm font-medium text-red-800">{{ t('UPLOAD_FAILED') }}</h3>
        <p class="mt-1 text-sm text-red-700">{{ uploadResult.error }}</p>
      </div>
      <div v-else>
        <div class="alert-success mb-4">
          <h3 class="text-sm font-medium text-green-800">{{ t('UPLOAD_SUCCESS') }}</h3>
          <p class="mt-1 text-sm text-green-700">{{ t('UPLOAD_SUCCESS_DESC') }}</p>
        </div>
        
        <div class="processing-status">
          <h4 class="text-lg font-semibold text-gray-900 mb-2">{{ t('PROCESSING_STATUS') }}</h4>
          <div class="flex items-center">
            <div class="spinner mr-3" v-if="processingStatus !== 'completed' && processingStatus !== 'failed'"></div>
            <p class="text-gray-700">
              {{ t(`STATUS_${processingStatus.toUpperCase()}`, processingStatus) }}
            </p>
          </div>
          
          <div v-if="processingStatus === 'completed'" class="mt-4">
            <p class="text-green-600 font-semibold mb-2">{{ t('PROCESSING_COMPLETE') }}</p>
            <div v-if="receiptAnalysis" class="analysis-summary">
              <p v-if="receiptAnalysis.hasDiscrepancies" class="text-orange-600 font-semibold">
                {{ t('DISCREPANCY_FOUND') }}
              </p>
              <p v-else class="text-green-600 font-semibold">
                {{ t('NO_DISCREPANCIES') }}
              </p>
            </div>
            <router-link :to="`/results/${uploadResult.receiptId}`" class="btn-primary mt-2">
              {{ t('VIEW_RESULTS') }}
            </router-link>
          </div>
          
          <div v-if="processingStatus === 'failed'" class="mt-4">
            <p class="text-red-600 font-semibold">{{ t('PROCESSING_FAILED') }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Usage Info -->
    <div class="card mt-8">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ t('USAGE_INFO') }}</h3>
      <div class="bg-gray-50 rounded-lg p-4">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm text-gray-600">{{ t('USAGE_THIS_MONTH') }}</span>
          <span class="text-sm font-medium text-gray-900">5 / 10 {{ t('BILLS') }}</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div class="bg-indigo-600 h-2 rounded-full" style="width: 50%"></div>
        </div>
        <p class="text-xs text-gray-500 mt-2">{{ t('FREE_PLAN') }} - 5 {{ t('BILLS_LEFT') }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLanguageStore } from '../stores/language'
import { receiptService } from '../services/receiptService'

export default {
  name: 'Upload',
  components: {
    
  },
  setup() {
    const router = useRouter()
    const languageStore = useLanguageStore()
    const t = computed(() => languageStore.t)
    const fileInput = ref(null)
    
    const selectedFile = ref(null)
    const filePreview = ref(null)
    const isDragging = ref(false)
    const isUploading = ref(false)
    const uploadResult = ref(null)
    const processingStatus = ref('')
    const receiptAnalysis = ref(null)
    
    let pollingInterval = null

    const handleDragOver = () => {
      isDragging.value = true
    }

    const handleDragLeave = () => {
      isDragging.value = false
    }

    const handleDrop = (event) => {
      isDragging.value = false
      const files = event.dataTransfer.files
      if (files.length > 0) {
        selectFile(files[0])
      }
    }

    const handleFileSelect = (event) => {
      const file = event.target.files[0]
      if (file) {
        selectFile(file)
      }
    }

    const triggerFileInput = () => {
      fileInput.value.click()
    }

    const selectFile = (file) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert(t.value('ALERT_IMAGE_ONLY'))
        return
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(t.value('ALERT_FILE_SIZE_LIMIT'))
        return
      }

      selectedFile.value = file
      uploadResult.value = null // Reset status on new file selection
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        filePreview.value = e.target.result
      }
      reader.readAsDataURL(file)
    }

    const removeFile = () => {
      selectedFile.value = null
      filePreview.value = null
      if (fileInput.value) {
        fileInput.value.value = ''
      }
      uploadResult.value = null
      stopPolling()
    }

    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const startPolling = (jobId, receiptId) => {
      stopPolling() // Ensure no multiple intervals running
      let pollCount = 0;
      const maxPolls = 5;
      
      pollingInterval = setInterval(async () => {
        if (pollCount >= maxPolls) {
            console.error('Polling timeout reached.');
            processingStatus.value = 'failed';
            stopPolling();
            return;
        }

        try {
          const response = await receiptService.getReceiptStatus(jobId);
          console.log("response=====getReceiptStatus=====gemini====", response);
          const data = response.data.data;
          const status = data.jobStatus.status;
          processingStatus.value = status;
          
          if (status === 'completed' || status === 'failed') {
            stopPolling();
            if (data.receipt) {
              receiptAnalysis.value = data.receipt.analysis;
            }
          }
        } catch (error) {
          console.error('Polling error:', error)
          processingStatus.value = 'failed'
          stopPolling()
        }
        pollCount++;
      }, 3000)
    }

    const stopPolling = () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
        pollingInterval = null
      }
    }

    const handleUpload = async () => {
      if (!selectedFile.value) return

      isUploading.value = true
      uploadResult.value = null

      try {
        const response = await receiptService.uploadReceipt(selectedFile.value)
        
        const result = response.data.data;
        uploadResult.value = {
          success: true,
          receiptId: result.receipt.id,
          jobId: result.processing.jobId
        }
        
        processingStatus.value = result.receipt.status;
        startPolling(result.processing.jobId, result.receipt.id)
        
      } catch (error) {
        uploadResult.value = {
          success: false,
          error: error.response?.data?.message || error.message || t.value('UPLOAD_ERROR_GENERIC')
        }
      } finally {
        isUploading.value = false
      }
    }
    
    onUnmounted(() => {
      stopPolling()
    })

    return {
      selectedFile,
      filePreview,
      isDragging,
      isUploading,
      uploadResult,
      processingStatus,
      receiptAnalysis,
      form: {}, // Keep empty form object to avoid template errors if referenced
      t,
      fileInput,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      handleFileSelect,
      triggerFileInput,
      removeFile,
      formatFileSize,
      handleUpload
    }
  }
}
</script>

<style scoped>
.main-content {
  max-width: 800px;
  margin: 2rem auto;
  padding: 1.5rem;
}

.card {
  background-color: #fff;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.upload-area {
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  padding: 2rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.upload-area:hover, .upload-area.dragover {
  background-color: #f9fafb;
  border-color: #4f46e5;
}

.spinner {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.alert-success {
  background-color: #d1fae5;
  color: #065f46;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #10b981;
}

.alert-error {
  background-color: #fee2e2;
  color: #991b1b;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #ef4444;
}
</style> 