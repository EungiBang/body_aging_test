import { NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface PhysiognomyMetrics {
  samjeong: {
    upper: number;
    middle: number;
    lower: number;
  };
  facialIndex: number;
  eyeDistanceRatio: number;
  noseWidthRatio: number;
  mouthWidthRatio: number;
  geometricRatio: number; // L1 (horizontal) / L2 (vertical)
  energyZones: {
    root: number;        // Jaw
    sacral: number;      // Mouth
    solarPlexus: number; // Cheeks
    heart: number;       // Forehead
    throat: number;      // Jawline/Neck
    thirdEye: number;    // Between eyebrows
    crown: number;       // Top of forehead
  };
  brightness: number;    // Overall facial brightness
  blendshapes: Record<string, number>;
}

function distance(p1: NormalizedLandmark, p2: NormalizedLandmark) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
}

export function calculateMetrics(landmarks: NormalizedLandmark[], blendshapes: any): PhysiognomyMetrics {
  // 10: Top of head (hairline approx), 152: Chin
  // 8: Between eyebrows (Glabella), 1: Nose tip
  const faceHeight = distance(landmarks[10], landmarks[152]);
  const faceWidth = distance(landmarks[234], landmarks[454]);
  
  const upperFace = distance(landmarks[10], landmarks[8]);
  const middleFace = distance(landmarks[8], landmarks[1]);
  const lowerFace = distance(landmarks[1], landmarks[152]);
  
  const eyeDistance = distance(landmarks[133], landmarks[362]);
  const noseWidth = distance(landmarks[129], landmarks[358]); // Alar width
  const mouthWidth = distance(landmarks[61], landmarks[291]);

  // Geometric Ratio (L1: Horizontal Eye end-to-end / L2: Vertical Forehead-to-Chin)
  const L1 = distance(landmarks[33], landmarks[263]);
  const L2 = upperFace + middleFace + lowerFace; 
  const geometricRatio = L1 / L2;
  
  const blendshapeDict: Record<string, number> = {};
  if (blendshapes && blendshapes.categories) {
    blendshapes.categories.forEach((cat: any) => {
      blendshapeDict[cat.categoryName] = cat.score;
    });
  }

  // Energy Zone Mapping (Heuristics based on facial features + blendshapes)
  // Since we can't easily sample pixel luminance here without passing the whole canvas context,
  // we'll calculate "Activity" scores based on landmarker positions and blendshapes
  // as a proxy for "Energized" states.
  const energyZones = {
    root: (blendshapeDict['jawOpen'] || 0) + (1 - (lowerFace / faceHeight)), 
    sacral: (blendshapeDict['mouthSmileLeft'] || 0 + blendshapeDict['mouthSmileRight'] || 0) / 2,
    solarPlexus: (blendshapeDict['cheekPuff'] || 0) + 0.5, // Proxy
    heart: (1 - (blendshapeDict['browDownLeft'] || 0)), 
    throat: (1 - (blendshapeDict['jawOpen'] || 0)),
    thirdEye: (1 - (blendshapeDict['browInnerUp'] || 0)), 
    crown: (upperFace / faceHeight) * 2,
  };

  return {
    samjeong: {
      upper: upperFace / faceHeight,
      middle: middleFace / faceHeight,
      lower: lowerFace / faceHeight,
    },
    facialIndex: faceHeight / faceWidth,
    eyeDistanceRatio: eyeDistance / faceWidth,
    noseWidthRatio: noseWidth / faceWidth,
    mouthWidthRatio: mouthWidth / faceWidth,
    geometricRatio,
    energyZones,
    brightness: 0.8, // Placeholder, will be refined in analysis prompt
    blendshapes: blendshapeDict
  };
}

export function averageMetrics(metricsList: PhysiognomyMetrics[]): PhysiognomyMetrics {
  if (metricsList.length === 0) throw new Error("No metrics to average");

  const count = metricsList.length;
  const avg: PhysiognomyMetrics = {
    samjeong: { upper: 0, middle: 0, lower: 0 },
    facialIndex: 0,
    eyeDistanceRatio: 0,
    noseWidthRatio: 0,
    mouthWidthRatio: 0,
    geometricRatio: 0,
    energyZones: { root: 0, sacral: 0, solarPlexus: 0, heart: 0, throat: 0, thirdEye: 0, crown: 0 },
    brightness: 0,
    blendshapes: {}
  };

  metricsList.forEach(m => {
    avg.samjeong.upper += m.samjeong.upper;
    avg.samjeong.middle += m.samjeong.middle;
    avg.samjeong.lower += m.samjeong.lower;
    avg.facialIndex += m.facialIndex;
    avg.eyeDistanceRatio += m.eyeDistanceRatio;
    avg.noseWidthRatio += m.noseWidthRatio;
    avg.mouthWidthRatio += m.mouthWidthRatio;
    avg.geometricRatio += m.geometricRatio;
    avg.brightness += m.brightness;

    Object.keys(avg.energyZones).forEach(key => {
      (avg.energyZones as any)[key] += (m.energyZones as any)[key];
    });

    for (const [key, value] of Object.entries(m.blendshapes)) {
      avg.blendshapes[key] = (avg.blendshapes[key] || 0) + value;
    }
  });

  avg.samjeong.upper /= count;
  avg.samjeong.middle /= count;
  avg.samjeong.lower /= count;
  avg.facialIndex /= count;
  avg.eyeDistanceRatio /= count;
  avg.noseWidthRatio /= count;
  avg.mouthWidthRatio /= count;
  avg.geometricRatio /= count;
  avg.brightness /= count;

  Object.keys(avg.energyZones).forEach(key => {
    (avg.energyZones as any)[key] /= count;
  });

  for (const key of Object.keys(avg.blendshapes)) {
    avg.blendshapes[key] /= count;
  }

  return avg;
}
