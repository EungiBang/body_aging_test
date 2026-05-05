import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: 'AIzaSyCKH9_QymO-3HOxcSzTQu_pKmwCBZ-xMJw' });

async function test(modelName) {
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: 'hello',
    });
    console.log(`SUCCESS using ${modelName}`);
  } catch (e) {
    console.error(`ERROR using ${modelName}:`, e.message || e);
  }
}

async function run() {
  await test('gemini-1.5-flash');
  await test('gemini-2.5-flash');
}

run();
