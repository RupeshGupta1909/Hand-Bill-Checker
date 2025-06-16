const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { GoogleGenAI } = require('@google/genai');
const cloudStorage = require('./cloudStorage');
const axios = require('axios');

const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

class OCRService {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    logger.info('OCR Service initialized with Google Gemini AI');
  }

  async analyzeImage(imageUrl) {
    const startTime = Date.now();
    try {
      logger.info(`Starting Gemini analysis for image URL: ${imageUrl}`);

      // Download image from cloud storage
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(response.data);
      const imageBase64 = imageBuffer.toString('base64');

      const prompt = `
        Analyze the provided image of a bill. The text may be in Hindi or a mix of Hindi and English.
        Extract the following information and return it as a structured JSON object:
        1.  **items**: An array of objects, where each object represents an item on the bill and has the following properties:
            *   \`name\` (string): The name of the item.
            *   \`quantity\` (number): The quantity of the item. Default to 1 if not mentioned.
            *   \`price\` (number): The price of the item.
        2.  **written_total** (number): The total amount written on the bill. If not present, set to null.
        3.  **computed_total** (number): The sum of all item prices you've extracted.
        4.  **mismatch** (boolean): A boolean flag that is true if the 'written_total' does not match the 'computed_total'.

        Here is an example of the expected JSON output format:
        {
          "items": [
            { "name": "Item 1", "quantity": 2, "price": 100 },
            { "name": "Item 2", "quantity": 1, "price": 50 }
          ],
          "written_total": 250,
          "computed_total": 250,
          "mismatch": false
        }
      `;
      const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          prompt,
          {
            inlineData: {
              data: imageBase64,
              mimeType: 'image/jpeg',
            },
          },
        ]
      });
      const text = result.candidates[0].content.parts[0].text;
      const processingTime = Date.now() - startTime;
      logger.info(`Gemini analysis completed in ${processingTime}ms.`);

      const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const extractedData = JSON.parse(jsonString);
      
      return {
        extractedData,
        processingTime,
        rawText: text,
      };

    } catch (error) {
      logger.error('Gemini analysis failed:', { message: error.message, stack: error.stack });
      throw new Error(`Gemini analysis failed: ${error.message}`);
    }
  }

  async terminate() {
    logger.info('OCR Service terminated');
  }
}

module.exports = new OCRService(); 