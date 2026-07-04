// Firebase ai_feedbacks_v1 컬렉션에서 피드백 데이터를 추출하여 통계 분석하는 스크립트
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');

const firebaseConfig = {
  apiKey: "AIzaSyAqxJeIxtz8Ta36llqp47VZuSpFo0JX4Y4",
  authDomain: "btc-3body-server.firebaseapp.com",
  projectId: "btc-3body-server",
  storageBucket: "btc-3body-server.firebasestorage.app",
  messagingSenderId: "671751957894",
  appId: "1:671751957894:web:1e0ae3e3291197dc3c5007"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function analyzeFeedbacks() {
  console.log('=== AI 피드백 데이터 분석 ===\n');

  const snapshot = await getDocs(collection(db, 'ai_feedbacks_v1'));
  console.log(`전체 피드백 수: ${snapshot.size}건\n`);

  const feedbacks = [];
  snapshot.forEach(doc => {
    feedbacks.push({ id: doc.id, ...doc.data() });
  });

  // 피드백 유형별 분류
  const byType = {};
  feedbacks.forEach(fb => {
    const type = fb.feedbackType || 'unknown';
    if (!byType[type]) byType[type] = [];
    byType[type].push(fb);
  });

  console.log('--- 피드백 유형별 건수 ---');
  Object.entries(byType).forEach(([type, items]) => {
    console.log(`  ${type}: ${items.length}건`);
  });

  // 만족도 분석 (body 피드백)
  const ratingMap = { very_satisfied: 5, satisfied: 4, normal: 3, dissatisfied: 2, very_dissatisfied: 1 };
  const ratingLabels = { very_satisfied: '매우만족', satisfied: '만족', normal: '보통', dissatisfied: '불만족', very_dissatisfied: '매우불만족' };

  const analyzeRatings = (items, ratingField) => {
    const dist = {};
    let sum = 0, count = 0;
    items.forEach(fb => {
      const rating = fb.feedback?.[ratingField];
      if (rating) {
        dist[rating] = (dist[rating] || 0) + 1;
        sum += ratingMap[rating] || 0;
        count++;
      }
    });
    return { distribution: dist, average: count > 0 ? (sum / count).toFixed(2) : 'N/A', count };
  };

  // Body 피드백 상세 분석
  if (byType.body) {
    console.log('\n--- Body(신체) 피드백 상세 분석 ---');
    const bodyFeedbacks = byType.body;

    const physicalRatings = analyzeRatings(bodyFeedbacks, 'physicalRating');
    console.log(`\n[신체 측정 만족도] (응답: ${physicalRatings.count}건, 평균: ${physicalRatings.average}/5)`);
    Object.entries(physicalRatings.distribution).forEach(([rating, count]) => {
      console.log(`  ${ratingLabels[rating] || rating}: ${count}건`);
    });

    const brainRatings = analyzeRatings(bodyFeedbacks, 'brainRating');
    console.log(`\n[뇌 측정 만족도] (응답: ${brainRatings.count}건, 평균: ${brainRatings.average}/5)`);
    Object.entries(brainRatings.distribution).forEach(([rating, count]) => {
      console.log(`  ${ratingLabels[rating] || rating}: ${count}건`);
    });

    // 점수 교정 분석
    let correctedScoreCount = 0;
    let correctedAgeCount = 0;
    const scoreDiffs = [];
    const ageDiffs = [];

    bodyFeedbacks.forEach(fb => {
      const feedback = fb.feedback || {};
      const snapshot = fb.reportSnapshot || {};
      
      if (feedback.correctedOverallScore != null && snapshot.overallScore != null) {
        correctedScoreCount++;
        scoreDiffs.push({
          original: snapshot.overallScore,
          corrected: feedback.correctedOverallScore,
          diff: feedback.correctedOverallScore - snapshot.overallScore
        });
      }
      if (feedback.correctedPhysicalAge != null && snapshot.physicalAge != null) {
        correctedAgeCount++;
        ageDiffs.push({
          original: snapshot.physicalAge,
          corrected: feedback.correctedPhysicalAge,
          diff: feedback.correctedPhysicalAge - snapshot.physicalAge
        });
      }
    });

    if (correctedScoreCount > 0) {
      const avgDiff = scoreDiffs.reduce((s, d) => s + d.diff, 0) / scoreDiffs.length;
      const overEstimated = scoreDiffs.filter(d => d.diff < 0).length;
      const underEstimated = scoreDiffs.filter(d => d.diff > 0).length;
      console.log(`\n[종합 점수 교정] (${correctedScoreCount}건)`);
      console.log(`  평균 교정 차이: ${avgDiff.toFixed(1)}점`);
      console.log(`  AI가 과대평가(점수 낮춰야): ${overEstimated}건`);
      console.log(`  AI가 과소평가(점수 높여야): ${underEstimated}건`);
      // 상세 내역
      scoreDiffs.forEach(d => {
        console.log(`    원본: ${d.original} → 교정: ${d.corrected} (차이: ${d.diff > 0 ? '+' : ''}${d.diff})`);
      });
    }

    if (correctedAgeCount > 0) {
      const avgAgeDiff = ageDiffs.reduce((s, d) => s + d.diff, 0) / ageDiffs.length;
      const tooYoung = ageDiffs.filter(d => d.diff > 0).length;
      const tooOld = ageDiffs.filter(d => d.diff < 0).length;
      console.log(`\n[신체 나이 교정] (${correctedAgeCount}건)`);
      console.log(`  평균 교정 차이: ${avgAgeDiff.toFixed(1)}세`);
      console.log(`  AI가 너무 젊게 평가(나이 높여야): ${tooYoung}건`);
      console.log(`  AI가 너무 늙게 평가(나이 낮춰야): ${tooOld}건`);
      ageDiffs.forEach(d => {
        console.log(`    원본: ${d.original}세 → 교정: ${d.corrected}세 (차이: ${d.diff > 0 ? '+' : ''}${d.diff}세)`);
      });
    }

    // 텍스트 메모 분석
    const notes = bodyFeedbacks.filter(fb => fb.feedback?.notes && fb.feedback.notes.trim().length > 0);
    if (notes.length > 0) {
      console.log(`\n[관리자 텍스트 메모] (${notes.length}건)`);
      notes.forEach((fb, i) => {
        const ui = fb.userInfo || {};
        console.log(`  ${i+1}. [${ui.gender === 'male' ? '남' : '여'}/${ui.age}세] "${fb.feedback.notes}"`);
      });
    }
  }

  // Face 피드백 분석
  if (byType.face) {
    console.log('\n--- Face(관상) 피드백 상세 분석 ---');
    const faceFeedbacks = byType.face;

    const faceRatings = analyzeRatings(faceFeedbacks, 'faceRating');
    console.log(`[관상 분석 만족도] (응답: ${faceRatings.count}건, 평균: ${faceRatings.average}/5)`);
    Object.entries(faceRatings.distribution).forEach(([rating, count]) => {
      console.log(`  ${ratingLabels[rating] || rating}: ${count}건`);
    });

    const faceNotes = faceFeedbacks.filter(fb => fb.feedback?.notes && fb.feedback.notes.trim().length > 0);
    if (faceNotes.length > 0) {
      console.log(`\n[관상 텍스트 메모] (${faceNotes.length}건)`);
      faceNotes.forEach((fb, i) => {
        const ui = fb.userInfo || {};
        console.log(`  ${i+1}. [${ui.gender === 'male' ? '남' : '여'}/${ui.age}세] "${fb.feedback.notes}"`);
      });
    }
  }

  // Tarot 피드백 분석
  if (byType.tarot) {
    console.log('\n--- Tarot(타로) 피드백 상세 분석 ---');
    const tarotFeedbacks = byType.tarot;

    const tarotRatings = analyzeRatings(tarotFeedbacks, 'tarotRating');
    console.log(`[타로 분석 만족도] (응답: ${tarotRatings.count}건, 평균: ${tarotRatings.average}/5)`);
    Object.entries(tarotRatings.distribution).forEach(([rating, count]) => {
      console.log(`  ${ratingLabels[rating] || rating}: ${count}건`);
    });

    const tarotNotes = tarotFeedbacks.filter(fb => fb.feedback?.notes && fb.feedback.notes.trim().length > 0);
    if (tarotNotes.length > 0) {
      console.log(`\n[타로 텍스트 메모] (${tarotNotes.length}건)`);
      tarotNotes.forEach((fb, i) => {
        const ui = fb.userInfo || {};
        console.log(`  ${i+1}. [${ui.gender === 'male' ? '남' : '여'}/${ui.age}세] "${fb.feedback.notes}"`);
      });
    }
  }

  // 불만족 사례 집중 분석
  console.log('\n\n=== 불만족(dissatisfied/very_dissatisfied) 사례 집중 분석 ===');
  let dissatisfiedCount = 0;
  feedbacks.forEach(fb => {
    const f = fb.feedback || {};
    const isDissatisfied = [f.physicalRating, f.faceRating, f.brainRating, f.tarotRating]
      .some(r => r === 'dissatisfied' || r === 'very_dissatisfied');
    
    if (isDissatisfied) {
      dissatisfiedCount++;
      const ui = fb.userInfo || {};
      console.log(`\n[불만족 #${dissatisfiedCount}] type=${fb.feedbackType}, ${ui.gender === 'male' ? '남' : '여'}/${ui.age}세`);
      if (f.physicalRating) console.log(`  신체: ${ratingLabels[f.physicalRating]}`);
      if (f.faceRating) console.log(`  관상: ${ratingLabels[f.faceRating]}`);
      if (f.brainRating) console.log(`  뇌: ${ratingLabels[f.brainRating]}`);
      if (f.tarotRating) console.log(`  타로: ${ratingLabels[f.tarotRating]}`);
      if (f.notes) console.log(`  메모: "${f.notes}"`);
      if (f.correctedOverallScore != null) console.log(`  점수교정: ${fb.reportSnapshot?.overallScore} → ${f.correctedOverallScore}`);
      if (f.correctedPhysicalAge != null) console.log(`  나이교정: ${fb.reportSnapshot?.physicalAge}세 → ${f.correctedPhysicalAge}세`);
    }
  });
  if (dissatisfiedCount === 0) console.log('  불만족 사례 없음');

  console.log('\n\n=== 분석 완료 ===');
  process.exit(0);
}

analyzeFeedbacks().catch(e => { console.error(e); process.exit(1); });
