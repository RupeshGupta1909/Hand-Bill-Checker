# Miscalc Backend API

A comprehensive backend service for the Miscalculation Detection Web App designed for small shopkeepers. This API handles receipt image processing, OCR text extraction, AI-powered calculation verification, and user management.

## 🚀 Features

- **User Authentication**: JWT-based authentication with refresh tokens
- **Receipt Processing**: Upload and process receipt images with OCR
- **AI Analysis**: Detect calculation errors using OpenAI GPT models
- **Queue Management**: Background job processing with Redis and Bull
- **Multi-language Support**: Hindi and English text recognition
- **Subscription Management**: Free, Basic, and Premium tiers
- **Real-time Updates**: WebSocket support for processing status
- **Comprehensive Logging**: Winston-based logging system
- **Rate Limiting**: API rate limiting and upload quotas
- **Admin Dashboard**: System monitoring and analytics

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Cache/Queue**: Redis with Bull Queue
- **OCR**: Tesseract.js with Hindi language support
- **AI**: OpenAI GPT-4 for calculation analysis
- **Image Processing**: Sharp for image optimization
- **Authentication**: JWT with bcrypt password hashing
- **Validation**: Express-validator and Joi
- **Logging**: Winston with file rotation
- **File Upload**: Multer with image optimization

## 📋 Prerequisites

- Node.js 18.0 or higher
- MongoDB 7.0 or higher
- Redis 7.0 or higher
- OpenAI API key (for AI analysis)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd miscalc-app/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   # Server Configuration
   PORT=8080
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173

   # Database Configuration
   MONGODB_URI=mongodb://admin:password123@localhost:27017/miscalc_db?authSource=admin

   # Redis Configuration
   REDIS_URL=redis://localhost:6379

   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRES_IN=7d

   # OpenAI Configuration
   OPENAI_API_KEY=your-openai-api-key-here
   OPENAI_MODEL=gpt-4o-mini

   # File Upload Configuration
   MAX_FILE_SIZE=10485760
   UPLOAD_DIR=uploads
   ```

4. **Start Services**
   
   Using Docker Compose (recommended):
   ```bash
   cd ..
   docker-compose up -d mongodb redis
   ```
   
   Or install MongoDB and Redis locally.

5. **Run the Application**
   
   Development mode (API + Worker):
   ```bash
   npm run dev:all
   ```
   
   Or run separately:
   ```bash
   # Terminal 1 - API Server
   npm run dev
   
   # Terminal 2 - Worker Process
   npm run worker:dev
   ```

## 📁 Project Structure

```
backend/
├── controllers/          # Route controllers
│   ├── authController.js
│   ├── imageController.js
│   └── dashboardController.js
├── middleware/           # Custom middleware
│   ├── auth.js
│   └── errorHandler.js
├── models/              # Database models
│   ├── User.js
│   └── Receipt.js
├── routes/              # API routes
│   ├── authRoutes.js
│   ├── imageRoutes.js
│   └── dashboardRoutes.js
├── services/            # Business logic services
│   ├── ocrService.js
│   └── aiService.js
├── queues/              # Queue management
│   └── imageProcessingQueue.js
├── workers/             # Background workers
│   └── imageProcessor.js
├── utils/               # Utility functions
│   ├── logger.js
│   └── redis.js
├── uploads/             # File upload directory
├── logs/                # Application logs
├── app.js               # Main application file
├── worker.js            # Worker process entry point
└── package.json
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh-token` - Refresh JWT token
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/usage-stats` - Get usage statistics

### Image Processing
- `POST /api/images/upload` - Upload receipt image
- `GET /api/images` - Get user's receipts (paginated)
- `GET /api/images/stats` - Get receipt statistics
- `GET /api/images/jobs` - Get processing jobs
- `GET /api/images/:id` - Get specific receipt
- `GET /api/images/jobs/:jobId/status` - Get job status
- `POST /api/images/:id/feedback` - Provide feedback
- `PATCH /api/images/:id/archive` - Archive receipt
- `DELETE /api/images/:id` - Delete receipt

### Dashboard
- `GET /api/dashboard/user` - User dashboard data
- `GET /api/dashboard/admin` - Admin dashboard (admin only)
- `GET /api/dashboard/health` - System health check
- `GET /api/dashboard/analytics` - Processing analytics (admin only)

### System
- `GET /api/health` - API health check

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Token Refresh
Access tokens expire in 7 days. Use the refresh token endpoint to get new tokens without re-authentication.

## 📤 File Upload

Receipt images can be uploaded using multipart/form-data:

```javascript
const formData = new FormData();
formData.append('receipt', imageFile);

fetch('/api/images/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

**Supported formats**: JPG, JPEG, PNG  
**Maximum size**: 10MB  
**Processing**: Images are automatically optimized and processed

## 🔄 Background Processing

The system uses Redis and Bull Queue for background image processing:

1. **Upload**: Image is uploaded and queued
2. **OCR**: Text extraction using Tesseract.js
3. **AI Analysis**: Calculation verification using OpenAI
4. **Results**: Analysis results stored in database

### Queue Monitoring

Monitor queue status through the admin dashboard or health endpoints.

## 📊 Subscription Tiers

| Feature | Free | Basic | Premium |
|---------|------|-------|---------|
| Monthly Uploads | 10 | 100 | 1000 |
| Processing Priority | Normal | Normal | High |
| Advanced Analytics | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ |

## 🔍 Error Handling

The API returns consistent error responses:

```json
{
  "status": "error",
  "message": "Error description",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Common HTTP status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## 📝 Logging

Logs are written to:
- Console (development)
- `logs/app.log` (all logs)
- `logs/error.log` (errors only)
- `logs/exceptions.log` (uncaught exceptions)

Log levels: `error`, `warn`, `info`, `debug`

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 🚀 Deployment

### Production Setup

1. **Environment Variables**
   ```bash
   NODE_ENV=production
   JWT_SECRET=<strong-random-secret>
   OPENAI_API_KEY=<your-openai-key>
   MONGODB_URI=<production-mongodb-uri>
   REDIS_URL=<production-redis-uri>
   ```

2. **Build and Start**
   ```bash
   npm install --production
   npm start
   ```

3. **Worker Process**
   ```bash
   npm run worker
   ```

### Docker Deployment

```bash
# Build image
docker build -t miscalc-backend .

# Run container
docker run -d \
  --name miscalc-api \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e MONGODB_URI=<mongodb-uri> \
  -e REDIS_URL=<redis-uri> \
  -e OPENAI_API_KEY=<openai-key> \
  miscalc-backend
```

### Process Management

Use PM2 for production process management:

```bash
# Install PM2
npm install -g pm2

# Start API server
pm2 start app.js --name "miscalc-api"

# Start worker process
pm2 start worker.js --name "miscalc-worker"

# Monitor processes
pm2 monit
```

## 🔧 Configuration

### OCR Configuration
- **Languages**: Hindi + English (`hin+eng`)
- **Page Segmentation**: Auto mode
- **Character Whitelist**: Numbers, letters, common symbols
- **Image Preprocessing**: Grayscale, normalize, sharpen, threshold

### AI Configuration
- **Model**: GPT-4o-mini (configurable)
- **Temperature**: 0.1 (for consistent results)
- **Max Tokens**: 1500
- **Response Format**: JSON object

### Queue Configuration
- **Concurrency**: 2 jobs simultaneously
- **Retry Attempts**: 3 with exponential backoff
- **Job Retention**: 100 completed, 50 failed
- **Priority Levels**: High (premium), Normal (free/basic)

## 🐛 Troubleshooting

### Common Issues

1. **OCR Not Working**
   - Check Tesseract.js installation
   - Verify image format and size
   - Check worker process logs

2. **AI Analysis Failing**
   - Verify OpenAI API key
   - Check API quota and billing
   - Monitor rate limits

3. **Queue Not Processing**
   - Check Redis connection
   - Verify worker process is running
   - Check queue statistics

4. **Database Connection Issues**
   - Verify MongoDB URI
   - Check network connectivity
   - Verify authentication credentials

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

### Health Checks

Monitor system health:
```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/dashboard/health
```

## 📚 API Documentation

For detailed API documentation with examples, see:
- [Postman Collection](./docs/postman-collection.json)
- [OpenAPI Specification](./docs/openapi.yaml)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting guide
- Review the logs for error details

---

**Note**: This backend is designed specifically for Indian shopkeepers and supports Hindi language receipt processing. Make sure to configure the OpenAI API key for full functionality. 