const ocrService = require('./services/ocrService');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

const testImagePath = path.join(__dirname, 'test-image.png');

async function runTest() {
  try {
    // 1. Initialize the service
    await ocrService.initialize();

    // 2. Create a dummy 1x1 PNG image file
    await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      }
    }).png().toFile(testImagePath);
    console.log(`Created dummy image file at: ${testImagePath}`);

    // 3. Call the extractText function
    console.log('--- Calling ocrService.extractText() ---');
    const result = await ocrService.extractText(testImagePath);
    console.log('--- OCR Service Response ---');
    console.log(result);
    console.log('----------------------------');

  } catch (error) {
    console.error('--- Test Script Error ---');
    console.error(error);
    console.log('-------------------------');
  } finally {
    // 4. Clean up the dummy file
    try {
      await fs.unlink(testImagePath);
      console.log('Cleaned up dummy image file.');
    } catch (cleanupError) {
      // ignore
    }
  }
}

runTest(); 