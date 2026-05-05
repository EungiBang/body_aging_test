import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign MediaPipe/TFLite info logs
const originalInfo = console.info;
console.info = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Created TensorFlow Lite XNNPACK delegate')) {
    return;
  }
  originalInfo(...args);
};

const originalLog = console.log;
console.log = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Created TensorFlow Lite XNNPACK delegate')) {
    return;
  }
  originalLog(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
