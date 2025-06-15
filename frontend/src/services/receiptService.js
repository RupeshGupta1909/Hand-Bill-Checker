import api from './authService';

const RECEIPT_API_URL = '/image';

export const receiptService = {
  uploadReceipt(file) {
    const formData = new FormData();
    formData.append('receipt', file);

    return api.post(`${RECEIPT_API_URL}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  getReceiptStatus(jobId) {
    return api.get(`${RECEIPT_API_URL}/jobs/${jobId}/status`);
  },
  
  getReceiptDetails(receiptId) {
    return api.get(`${RECEIPT_API_URL}/${receiptId}`);
  },

  getUserReceipts(limit = 10) {
    return api.get(`${RECEIPT_API_URL}?limit=${limit}`);
  }
}; 