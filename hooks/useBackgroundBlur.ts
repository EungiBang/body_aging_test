import { useEffect, useRef, useState } from 'react';
import * as bodySegmentation from '@tensorflow-models/body-segmentation';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

// Global instance to prevent rapid create/dispose crashes
let globalSegmenter: bodySegmentation.BodySegmenter | null = null;
let isGlobalSegmenterLoading = false;
let globalSegmenterPromise: Promise<bodySegmentation.BodySegmenter> | null = null;

export const useBackgroundBlur = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  isActive: boolean
) => {
  const requestRef = useRef<number>(0);
  const [isModelLoaded, setIsModelLoaded] = useState(!!globalSegmenter);

  useEffect(() => {
    let isMounted = true;

    const initModel = async () => {
      if (globalSegmenter) {
        if (isMounted) setIsModelLoaded(true);
        return;
      }

      if (isGlobalSegmenterLoading && globalSegmenterPromise) {
        try {
          await globalSegmenterPromise;
          if (isMounted) setIsModelLoaded(true);
        } catch (e) {
          console.error("Failed to wait for global segmenter:", e);
        }
        return;
      }

      isGlobalSegmenterLoading = true;
      globalSegmenterPromise = (async () => {
        await tf.ready();
        const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
        const segmenterConfig: bodySegmentation.MediaPipeSelfieSegmentationMediaPipeModelConfig = {
          runtime: 'tfjs',
          modelType: 'general',
        };
        const segmenter = await bodySegmentation.createSegmenter(model, segmenterConfig);
        globalSegmenter = segmenter;
        return segmenter;
      })();

      try {
        await globalSegmenterPromise;
        if (isMounted) setIsModelLoaded(true);
      } catch (e) {
        console.error("Body segmentation init error:", e);
      } finally {
        isGlobalSegmenterLoading = false;
      }
    };

    initModel();

    return () => {
      isMounted = false;
      // Do not dispose the global segmenter here to allow reuse across steps
    };
  }, []);

  useEffect(() => {
    if (!isActive || !isModelLoaded) {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      return;
    }

    let isMounted = true;

    const processVideo = async () => {
      if (!videoRef.current || !canvasRef.current || !globalSegmenter || !isMounted) return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video.readyState < 2) {
        requestRef.current = requestAnimationFrame(processVideo);
        return;
      }

      try {
        // Ensure canvas matches video dimensions
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const segmentation = await globalSegmenter.segmentPeople(video);
        
        if (!isMounted) return;

        const foregroundThreshold = 0.5;
        const edgeBlurAmount = 3;
        const flipHorizontal = false; // Handled by CSS on the canvas if needed

        await bodySegmentation.drawBokehEffect(
          canvas,
          video,
          segmentation,
          foregroundThreshold,
          10, // backgroundBlurAmount
          edgeBlurAmount,
          flipHorizontal
        );
      } catch (e) {
        console.error("Bokeh effect error:", e);
      }

      if (isMounted) {
        requestRef.current = requestAnimationFrame(processVideo);
      }
    };

    processVideo();

    return () => {
      isMounted = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive, isModelLoaded, videoRef, canvasRef]);

  return { isReady: isModelLoaded };
};
