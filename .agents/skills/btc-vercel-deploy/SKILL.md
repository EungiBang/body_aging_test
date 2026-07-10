---
name: btc-vercel-deploy
description: BTC 프로젝트(Outdoor Lite, PC 버전, USA 등)를 Vercel에 프로덕션 배포합니다. 빌드, Git 커밋/푸시, Vercel 자동 배포까지의 전체 파이프라인을 안전하게 수행합니다. 배포 시 발생하는 PowerShell stderr 오인 문제와 Vite 경고를 올바르게 처리합니다.
---

# BTC Vercel 배포 스킬

## 프로젝트별 배포 정보

| 프로젝트 | 디렉토리 | Vercel 프로젝트명 | 배포 URL | Git 브랜치 |
|----------|----------|-------------------|----------|-----------|
| Outdoor Lite | `d:\antigravity_vibecoding\BT_3Body_Outdoor_Lite` | `btc-3body-outdoor-lite` | `https://btc-3body-outdoor-lite.vercel.app/` | `master` |
| PC 버전 | `d:\antigravity_vibecoding\BT 3바디 ai테스트` | 별도 확인 필요 | 별도 확인 필요 | 별도 확인 필요 |
| USA 버전 | `d:\antigravity_vibecoding\BT 3바디 USA` | 별도 확인 필요 | 별도 확인 필요 | 별도 확인 필요 |

## 배포 파이프라인 (필수 순서)

### 1단계: 타입 체크
```powershell
npx.cmd tsc --noEmit 2>&1
```
- 타입 에러가 있으면 **절대 다음 단계로 진행하지 않는다**.
- 에러를 먼저 수정한 후 재실행한다.

### 2단계: 프로덕션 빌드
```powershell
npm.cmd run build 2>&1
```

**⚠️ 핵심 주의사항: PowerShell stderr 오인 문제**
- Vite의 경고 메시지(chunking warnings, dynamic import warnings)는 **stderr**로 출력된다.
- PowerShell은 stderr 출력을 에러로 인식하여 `exit code 1`을 반환한다.
- **이것은 실제 빌드 실패가 아니다!**
- 빌드 성공 판단 기준은 **로그에 `✓ built in`** 문자열이 포함되어 있는지 여부이다.
- `dist/index.html` 파일이 정상적으로 존재하는지 확인하면 된다.

**빌드 성공 확인 방법:**
```powershell
# 빌드 출력물 존재 확인
if (Test-Path "dist\index.html") { "빌드 성공" } else { "빌드 실패" }
```

### 3단계: Vercel에 prebuilt 배포 (권장 — 가장 안정적)

로컬에서 Vercel 빌드 출력 구조를 생성한 뒤, 그 결과물을 직접 업로드합니다.
Vercel 서버 빌드를 건너뛰므로 **Blocked 없이 즉시 배포**됩니다.

```powershell
# ① Vercel 빌드 출력 구조 생성 (필수! 생략하면 이전 빌드가 배포됨)
npx.cmd vercel build --prod 2>&1

# ② prebuilt 결과물로 프로덕션 배포
npx.cmd vercel deploy --prod --prebuilt --yes 2>&1
```

> ⚠️ **`vercel build --prod`를 생략하면 안 됩니다!** `.vercel/output/`에 이전 빌드가 남아 있어, 코드 변경이 반영되지 않은 채 배포됩니다. (실제 2026-07-05 경험)

**성공 판단 기준:**
- 출력에 `"readyState": "READY"` 포함
- `Aliased https://btc-3body-outdoor-lite.vercel.app` 출력
- exit code 1이어도 위 내용이 출력되면 **성공** (PowerShell stderr 오인)

### 4단계: Git 커밋 (배포와 별도로 소스 관리)

배포와 별도로 소스코드를 Git에 보관합니다.

```powershell
git add -A
git commit -m "feat: 변경사항 설명"
git push origin master
```

> ⚠️ **`git push`만으로는 배포되지 않을 수 있습니다!** Vercel 서버 빌드가 Blocked될 수 있기 때문입니다.
> 반드시 `vercel deploy --prod --prebuilt` 방식을 사용하세요.

### 5단계: 배포 확인

배포 URL로 직접 접속하여 동작 확인합니다.
- **프로덕션 URL**: `https://btc-3body-outdoor-lite.vercel.app/`

## 아키텍처 참고

### Vercel 서버리스 함수
- `api/gemini.ts`: Gemini AI 프록시 서버리스 함수 (API 키를 서버 측에서 관리).
- 로컬 개발 시에는 `vite.config.ts`의 `local-gemini-proxy` 미들웨어가 같은 역할을 수행.
- 프로덕션 배포 시 `api/` 디렉토리는 Vercel Serverless Functions로 자동 인식됨.

### 환경 변수
- `GEMINI_API_KEY`: Vercel 프로젝트 설정(Settings > Environment Variables)에서 관리.
- 로컬 개발 시에는 `.env.local` 파일에서 관리.
- **절대로 클라이언트 빌드에 API 키가 포함되지 않도록** `vite.config.ts`의 `define` 설정에서 빈 문자열로 교체됨.

### `.vercelignore`
배포 시 제외되는 파일/디렉토리:
- `node_modules`, `dist`, `.git`, `.vercel`, `.vscode`, `.gemini`
- `*.exe`, `*.dmg`, `*.zip`, `*.msi`
- `members-db.json`

## 트러블슈팅

### 1. "exit code 1" 이지만 빌드는 성공한 경우
- Vite 경고(dynamic import, chunk size)가 stderr로 출력되어 PowerShell이 실패로 인식.
- `dist/index.html`이 존재하면 실제 빌드는 성공한 것이므로 무시하고 진행.

### 2. Vercel 배포 후 API 호출 실패 (502/500)
- Vercel 프로젝트의 환경 변수에 `GEMINI_API_KEY`가 설정되어 있는지 확인.
- `api/gemini.ts` 파일이 정상적으로 존재하는지 확인.

### 3. 배포 URL 혼동 주의
- 실제 프로덕션 URL: `https://btc-3body-outdoor-lite.vercel.app/`
- 프리뷰 URL(배포마다 다름): `https://btc-3body-outdoor-lite-xxxxx-eungibangs-projects.vercel.app`
- **사용자에게 안내할 때는 프로덕션 URL을 사용한다.**

### 4. Git push 인증 실패 시
- Windows Credential Manager에 GitHub 토큰이 저장되어 있어야 함.
- `git remote -v`로 origin URL 확인.
- HTTPS 방식 사용 중: `https://github.com/EungiBang/BT_3Body_Outdoor_Lite.git`

## 체크리스트 (배포 전 필수 확인)

- [ ] `npx.cmd tsc --noEmit` 타입 에러 0개
- [ ] `npm.cmd run build` 후 `dist/index.html` 존재
- [ ] `git add .` → `git commit` → `git push origin master` 완료
- [ ] 배포 URL에서 정상 동작 확인
