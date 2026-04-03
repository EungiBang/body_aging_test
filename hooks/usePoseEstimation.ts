import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as poseDetection from '@tensorflow-models/pose-detection';

// Global instance to prevent rapid create/dispose crashes
let globalDetector: poseDetection.PoseDetector | null = null;
let isGlobalDetectorLoading = false;
let globalDetectorPromise: Promise<poseDetection.PoseDetector> | null = null;

export const usePoseEstimation = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  isActive: boolean,
  type: 'squat' | 'pushup' | 'none'
) => {
  const [reps, setReps] = useState(0);
  const [feedback, setFeedback] = useState<string>('');
  const requestRef = useRef<number>(0);
  const stateRef = useRef<'up' | 'down'>('up');
  const repIndicatorRef = useRef<number>(0);
  const [isModelLoaded, setIsModelLoaded] = useState(!!globalDetector);

  const calculateAngle = (a: {x: number, y: number}, b: {x: number, y: number}, c: {x: number, y: number}) => {
    let radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) {
      angle = 360 - angle;
    }
    return angle;
  };

  useEffect(() => {
    let isMounted = true;

    const initModel = async () => {
      if (globalDetector) {
        if (isMounted) setIsModelLoaded(true);
        return;
      }

      if (isGlobalDetectorLoading && globalDetectorPromise) {
        try {
          await globalDetectorPromise;
          if (isMounted) setIsModelLoaded(true);
        } catch (e) {
          console.error("Failed to wait for global detector:", e);
        }
        return;
      }

      isGlobalDetectorLoading = true;
      globalDetectorPromise = (async () => {
        await tf.ready();
        const detectorConfig = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
        const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);
        globalDetector = detector;
        return detector;
      })();

      try {
        await globalDetectorPromise;
        if (isMounted) setIsModelLoaded(true);
      } catch (e) {
        console.error("Pose detection init error:", e);
      } finally {
        isGlobalDetectorLoading = false;
      }
    };

    initModel();

    return () => {
      isMounted = false;
      // Do not dispose the global detector here to allow reuse across steps
    };
  }, []);

  useEffect(() => {
    if (!isActive || type === 'none' || !isModelLoaded) {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      return;
    }

    let isMounted = true;

    const detectPose = async () => {
      if (!videoRef.current || !canvasRef.current || !globalDetector || !isMounted) return;
      
      const video = videoRef.current;
      if (video.readyState < 2) {
        requestRef.current = requestAnimationFrame(detectPose);
        return;
      }

      try {
        const poses = await globalDetector.estimatePoses(video);
        if (!isMounted) return; // Prevent state updates if unmounted during await
        drawPoses(poses);
        analyzeMovement(poses);
      } catch (e) {
        console.error("Pose estimation error:", e);
      }

      if (isMounted) {
        requestRef.current = requestAnimationFrame(detectPose);
      }
    };

    const drawPoses = (poses: poseDetection.Pose[]) => {
      const canvas = canvasRef.current;
      if (!canvas || !videoRef.current) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Match canvas size to video display size
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const now = Date.now();
      const timeSinceRep = now - repIndicatorRef.current;
      const showIndicator = timeSinceRep < 800; // show for 800ms

      poses.forEach(pose => {
        // Draw skeleton
        const adjacentKeyPoints = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
        adjacentKeyPoints.forEach(([i, j]) => {
          const kp1 = pose.keypoints[i];
          const kp2 = pose.keypoints[j];
          if ((kp1.score || 0) > 0.3 && (kp2.score || 0) > 0.3) {
            ctx.beginPath();
            ctx.moveTo(kp1.x, kp1.y);
            ctx.lineTo(kp2.x, kp2.y);
            ctx.strokeStyle = showIndicator ? '#10b981' : 'rgba(34, 211, 238, 0.8)'; // emerald-500 if rep counted, else cyan-400
            ctx.lineWidth = showIndicator ? 6 : 4;
            ctx.stroke();
          }
        });

        // Draw keypoints
        pose.keypoints.forEach(keypoint => {
          if ((keypoint.score || 0) > 0.3) {
            ctx.beginPath();
            ctx.arc(keypoint.x, keypoint.y, showIndicator ? 8 : 6, 0, 2 * Math.PI);
            ctx.fillStyle = showIndicator ? '#10b981' : '#f43f5e'; // emerald-500 or rose-500
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        });
      });

      // Draw +1 Text
      if (showIndicator) {
        const alpha = Math.max(0, 1 - timeSinceRep / 800);
        ctx.save();
        ctx.fillStyle = `rgba(16, 185, 129, ${alpha})`; // emerald-500
        ctx.font = 'bold 120px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Add a slight upward animation
        const yOffset = (timeSinceRep / 800) * 100;
        
        // Draw text shadow for better visibility
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;
        
        ctx.fillText('+1', canvas.width / 2, canvas.height / 3 - yOffset);
        ctx.restore();
      }
    };

    const analyzeMovement = (poses: poseDetection.Pose[]) => {
      if (poses.length === 0) return;
      const pose = poses[0];
      
      const getKp = (name: string) => pose.keypoints.find(kp => kp.name === name);
      
      if (type === 'squat') {
        const hip = getKp('left_hip') || getKp('right_hip');
        const knee = getKp('left_knee') || getKp('right_knee');
        const ankle = getKp('left_ankle') || getKp('right_ankle');
        
        if (hip && knee && ankle && (hip.score || 0) > 0.4 && (knee.score || 0) > 0.4 && (ankle.score || 0) > 0.4) {
          const angle = calculateAngle(hip, knee, ankle);
          
          if (angle < 100 && stateRef.current === 'up') {
            stateRef.current = 'down';
            setFeedback('좋습니다! 올라오세요.');
          } else if (angle > 150 && stateRef.current === 'down') {
            stateRef.current = 'up';
            setReps(r => r + 1);
            repIndicatorRef.current = Date.now();
            setFeedback('완벽합니다!');
          }
        }
      } else if (type === 'pushup') {
        const shoulder = getKp('left_shoulder') || getKp('right_shoulder');
        const elbow = getKp('left_elbow') || getKp('right_elbow');
        const wrist = getKp('left_wrist') || getKp('right_wrist');
        
        if (shoulder && elbow && wrist && (shoulder.score || 0) > 0.4 && (elbow.score || 0) > 0.4 && (wrist.score || 0) > 0.4) {
          const angle = calculateAngle(shoulder, elbow, wrist);
          
          if (angle < 90 && stateRef.current === 'up') {
            stateRef.current = 'down';
            setFeedback('밀어 올리세요!');
          } else if (angle > 150 && stateRef.current === 'down') {
            stateRef.current = 'up';
            setReps(r => r + 1);
            repIndicatorRef.current = Date.now();
            setFeedback('좋습니다!');
          }
        }
      }
    };

    detectPose();

    return () => {
      isMounted = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive, type, isModelLoaded, videoRef, canvasRef]);

  return { reps, feedback, isModelLoaded };
};
