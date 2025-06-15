require('dotenv').config();
const Bull = require('bull');

// 1. CONFIGURE THE QUEUE
// This configuration must match the one used by your worker
const imageProcessingQueue = new Bull('image processing', {
  redis: {
    port: process.env.REDIS_PORT || 6379,
    host: process.env.REDIS_HOST || 'localhost',
  },
});

console.log('Test script configured to connect to Redis.');

// 2. SET UP THE CONSUMER
// The consumer listens for jobs with a specific name.
imageProcessingQueue.process('process-receipt-image', (job, done) => {
  console.log('\n--- JOB CONSUMED ---');
  console.log('Job ID:', job.id);
  console.log('Job Name:', job.name);
  console.log('Data received by consumer:');
  console.log(job.data);
  console.log('--------------------\n');

  // Signal that the job is complete
  done();
});

console.log("Consumer is set up and listening for jobs named 'process-receipt-image'...");

// 3. ADD A JOB (PRODUCER)
// This function adds a dummy job to the queue.
async function addTestJob() {
  try {
    console.log('Attempting to add a test job to the queue...');
    const job = await imageProcessingQueue.add(
      'process-receipt-image', // The name must match what the consumer is listening for
      {
        testReceiptId: 'test-receipt-123',
        testImagePath: '/path/to/dummy/image.jpg',
        testUserId: 'test-user-abc',
        source: 'test-script.js',
      }
    );
    console.log(`Job added successfully! Job ID: ${job.id}`);
  } catch (error) {
    console.error('Failed to add test job:', error);
  }
}

// 4. RUN THE TEST
// We wait a couple of seconds to ensure the consumer is ready before adding the job.
setTimeout(() => {
  addTestJob();
}, 2000);

// Keep the script running for a few seconds to allow the job to be processed
setTimeout(() => {
  console.log('Test finished. Closing queue connection.');
  imageProcessingQueue.close();
  process.exit(0);
}, 5000);

console.log('Test script is running. A job will be added in 2 seconds.'); 