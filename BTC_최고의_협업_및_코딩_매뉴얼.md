<!-- BTC 프로젝트의 최고 품질 협업 및 최신 기술 코딩 표준 매뉴얼 -->
# BTC 최고의 협업 및 코딩 매뉴얼

본 매뉴얼은 BTC 프로젝트의 모든 기획, 마케팅 및 개발 프로세스에서 오류를 최소화하고 보안을 최고 수준으로 유지하기 위해 정의된 표준 가이드라인입니다.

---

## 1. 기획 및 마케팅 통합 가이드라인

### 1.1 비즈니스 가치 우선 검토
- 모든 기능 개발 전, 이 기능이 사용자 유입이나 전환(Conversion)에 어떤 영향을 미치는지 먼저 평가합니다.
- 복잡한 로직이 추가되기 전, "이것이 정말 사용자에게 필수적인가?"를 자문하고 기획을 단순화합니다.

### 1.2 마케팅 관점의 UX 설계
- **퍼널 최적화**: 사용자가 진단 정보를 입력하고 결과를 보기까지의 이탈률을 줄이기 위해, 단계별 진행 표시바(Progress bar)를 기본 탑재합니다.
- **공유 및 전파**: 결과 화면에는 사용자가 본인의 분석 결과를 이미지로 저장하거나 링크로 전송할 수 있는 버튼을 눈에 띄게 배치합니다.
- **로딩 최적화**: AI 연산 및 데이터 페칭 중 사용자가 대기하는 시간 동안, 정적인 스피너 대신 실시간 상태 안내(예: "AI가 관상을 분석하는 중입니다...")와 유려한 스켈레톤 애니메이션을 제공합니다.

---

## 2. 보안 최우선주의 정책 (Zero Trust)

### 2.1 자격 증명(Credential) 관리
- 어떠한 경우에도 API Key, 비밀번호, 서비스 계정 키를 코드 내부에 하드코딩하지 않습니다.
- 모든 환경변수는 `.env.local`에 작성하고 `.gitignore`에 등록하여 Git 저장소에 절대 유출되지 않도록 통제합니다.
- 빌드 시스템 및 CI/CD(Vercel 등) 환경에 보안 변수로 안전하게 등록하여 참조합니다.

### 2.2 Firebase 및 데이터베이스 보안
- Firestore 및 Storage 규칙(Security Rules)은 오직 인증된 사용자만 본인의 데이터에 접근할 수 있도록 설계합니다.
```javascript
// firestore.rules 예시
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
- 클라이언트 단에서 쿼리를 날릴 때도 현재 인증 상태를 반드시 검증한 뒤 수행합니다.

### 2.3 입력 데이터 살균 및 Injection 방지
- 외부에서 입력된 데이터나 마크다운 렌더링 결과는 XSS(Cross-Site Scripting) 취약점을 유발할 수 있으므로, 렌더링 전 반드시 정형화하거나 정유화(Sanitization)를 거칩니다.
- 폼 입력 단계에서 이메일, 전화번호, 텍스트 크기 등의 유효성(Validation)을 정규표현식이나 스키마 정의를 통해 엄격하게 검사합니다.

---

## 3. 오류 최소화 및 복원력(Resilience) 설계

### 3.1 예외 처리 표준
- 외부 API 호출, 파일 읽기/쓰기, Firebase 연동 등 실패 가능성이 있는 모든 비동기 작업은 반드시 `try-catch` 블록으로 예외를 제어합니다.
- 에러 발생 시 사용자 화면이 멈추지 않도록 명확한 에러 메시지와 함께 대체 화면(Fallback UI) 또는 재시도 버튼을 제공합니다.

### 3.2 React Error Boundary 활용
- 컴포넌트 계층 최상위 및 핵심 모듈 주변에 `ErrorBoundary`를 배치하여, 특정 컴포넌트의 런타임 에러가 앱 전체의 붕괴(White Screen)로 이어지지 않게 격리합니다.

---

## 4. 최신 코딩 표준 및 모범 사례

### 4.1 React 19 Action API 적극 활용
- 폼 데이터를 서버나 Firebase로 보낼 때, 기존의 수동 `isLoading`, `error` 상태 관리를 배제하고 `useActionState`를 사용합니다.
- 비동기 상태 전환 시 UI가 멈추는 현상을 방지하기 위해 `useTransition`을 적용합니다.

```tsx
// React 19 비동기 폼 제어 예시
import React, { useActionState } from "react";

interface FormState {
  success: boolean;
  error: string | null;
}

async function handleProfileUpdate(prevState: FormState, formData: FormData): Promise<FormState> {
  try {
    const username = formData.get("username") as string;
    if (!username || username.length < 2) {
      return { success: false, error: "이름은 2글자 이상이어야 합니다." };
    }
    // Firebase 또는 API 요청 수행
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: "프로필 업데이트에 실패했습니다." };
  }
}

export function ProfileForm() {
  const [state, formAction, isPending] = useActionState(handleProfileUpdate, {
    success: false,
    error: null,
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input name="username" type="text" className="border p-2 rounded" />
      <button type="submit" disabled={isPending} className="bg-blue-600 text-white p-2 rounded">
        {isPending ? "저장 중..." : "저장"}
      </button>
      {state.error && <p className="text-red-500 text-sm">{state.error}</p>}
      {state.success && <p className="text-green-500 text-sm">성공적으로 저장되었습니다.</p>}
    </form>
  );
}
```

### 4.2 Tailwind CSS v4 CSS-First 테마 설정
- Tailwind v4의 사양에 따라, 자바스크립트 설정 파일 대신 메인 CSS 파일에서 직접 `@theme` 디렉티브를 사용하여 글로벌 테마 변수를 선언합니다.

```css
/* index.css 예시 */
@import "tailwindcss";

@theme {
  --color-brand-primary: #1e3a8a;
  --color-brand-secondary: #0d9488;
  --color-brand-dark: #0f172a;
  
  --font-sans: "Inter", "Noto Sans KR", sans-serif;
}
```

### 4.3 TypeScript 5.8 안정성 극대화
- `any` 타입의 사용을 엄격히 금지하며, 알 수 없는 데이터는 `unknown`으로 선언한 뒤 타입 가드(`typeof`, `instanceof`, 사용자 정의 타입 가드 함수 등)를 통해 명확히 타입을 좁혀 사용합니다.
- 타입 단언(`as`)은 런타임 에러의 원인이 되므로, 가급적 인터페이스와 가드 함수를 사용해 안전하게 처리합니다.

---

## 5. 성능 및 리소스 관리

### 5.1 TensorFlow.js 및 MediaPipe 메모리 제어
- 이미지나 영상 기반 AI 분석 수행 시, 텐서 객체가 메모리에 잔존해 앱이 느려지는 현상을 막기 위해 연산 단위를 `tf.tidy()`로 묶고, 루프 밖에서는 `tf.dispose()`를 명시적으로 실행합니다.
```typescript
import * as tf from "@tensorflow/tfjs-core";

const analyzeImage = (imageElement: HTMLImageElement) => {
  tf.tidy(() => {
    const tensor = tf.browser.fromPixels(imageElement);
    const normalized = tensor.div(255.0);
    // AI 모델 예측 수행
  });
};
```

### 5.2 Firebase Realtime Listener 관리
- `onSnapshot` 등으로 실시간 데이터 감지를 시작한 경우, 컴포넌트 언마운트 시 반드시 구독을 해제(Unsubscribe)하여 메모리 누수와 불필요한 Firebase 읽기 비용을 예방합니다.
```typescript
useEffect(() => {
  const unsubscribe = onSnapshot(docRef, (doc) => {
    // 데이터 처리
  });
  return () => unsubscribe();
}, []);
```

---

## 6. 대규모 프로젝트 컨텍스트 보존 및 에이전트 오케스트레이션

### 6.1 컨텍스트 영속성 관리
- **태스크 추적**: 대규모 프로젝트의 분량을 다룰 때 기억력 한계를 극복하기 위해 `task.md`를 적극 활용하여 작업의 세부 단계를 정밀하게 관리합니다.
- **상태 동기화**: 모든 작업 세션이 끝날 때마다 `.agents/memory/current_status.md`와 `work_log.md`를 수동으로 갱신하여, 다음 대화 시 에이전트가 이전의 개발 흐름을 완벽히 이어받을 수 있도록 조치합니다.

### 6.2 최신 에이전트 기술 기반 협업
- **하네스(Harness) 실행 격리 및 예외 통제**:
  - 외부 도구(Browser subagent, Python script, OS Command 등) 실행 과정에서 생길 수 있는 잠재적 충돌을 독립적으로 격리합니다.
  - 빌드 오류나 툴 에러가 검출되면 자율적으로 로그를 파싱하고 원인을 진단한 뒤 self-healing(자가치유)을 3회 한도로 시도합니다.
  - 동일한 에러가 3회 이상 발생하면 즉시 스스로 해결하려는 시도를 멈추고 사용자에게 보고합니다.
- **헤르메스(Hermes) 통신 프로토콜**:
  - 서브 에이전트에 작업을 위임할 때는, 과도한 컨텍스트 전달로 인한 토큰 낭비와 의도 왜곡을 막기 위해 목표(Goal), 제약사항, 출력 형식(JSON, Markdown 등)만을 압축한 명세서 형태로 프롬프트를 보냅니다.
- **오케스트레이션 및 자율 검증 루프**:
  - 큰 기능 구현 시 스스로 "전략 기획 -> 마케팅 UX 검토 -> 보안 검증 -> 코딩 구현 -> 빌드 테스트"의 오케스트레이션 파이프라인을 머릿속으로 시뮬레이션하여 단계별 결함을 자율 검증합니다.

