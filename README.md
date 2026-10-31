# 1vs다수 낱말 대결

초등학교 교실에서 크롬북으로 진행하는 실시간 낱말 게임입니다.
- 교사: 방 생성, 학생 확인, 술래/초성 선택, 3분 게임 시작, 결과 낱말 공개
- 학생: 방 번호로 입장, 낱말 입력
- Firebase Authentication(학생 익명 로그인 + 교사 Custom Token), Firestore 실시간 동기화
- Vercel 배포 지원

## 0. 준비물
- GitHub 계정
- Firebase 계정
- Vercel 계정
- PC에 Node.js 20 이상, Git, Firebase CLI 설치

## 1. Firebase 프로젝트 만들기
1. Firebase Console에서 새 프로젝트를 만듭니다.
2. Authentication > Sign-in method에서 **Anonymous**를 사용 설정합니다.
3. Firestore Database를 만들고 Production mode로 시작합니다.
4. 프로젝트 설정 > 내 앱 > 웹 앱을 추가하고 Firebase 설정값을 복사합니다.
5. `src/firebase.js`의 `firebaseConfig`를 실제 값으로 교체합니다.

## 2. 교사 비밀번호 설정 및 함수 배포
터미널에서 프로젝트 폴더로 이동합니다.

```bash
npm install
npm install -g firebase-tools
firebase login
firebase use --add
```

Firebase 프로젝트를 선택한 뒤 교사 PIN을 Secret으로 등록합니다.

```bash
firebase functions:secrets:set TEACHER_PIN
```

프롬프트에 `3313`을 입력합니다. 실제 운영에서는 학교 내부에서만 공유하고, 배포 전 다른 PIN으로 변경하는 것을 권장합니다.

Cloud Functions 배포에는 Firebase 요금제/결제 계정 설정(Blaze)이 필요할 수 있습니다.

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

## 3. Firestore 보안 규칙 배포

```bash
firebase deploy --only firestore:rules
```

## 4. 로컬에서 실행

```bash
npm install
npm run dev
```

터미널에 표시되는 로컬 주소를 브라우저에서 엽니다.

## 5. GitHub에 올리기

GitHub에서 빈 저장소를 만든 뒤:

```bash
git init
git add .
git commit -m "Initial 1vs다수 classroom game"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_ID/YOUR_REPOSITORY.git
git push -u origin main
```

## 6. Vercel 배포
1. Vercel에서 GitHub 저장소를 Import합니다.
2. Framework Preset은 Vite로 선택합니다.
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Deploy를 누릅니다.

배포 후 Vercel이 제공하는 주소를 학생들에게 공유하면 됩니다.

## 7. 게임 진행
1. 교사는 교사 모드에서 PIN으로 인증합니다.
2. 교사 이름을 입력하고 새 게임방을 만듭니다.
3. 화면의 6자리 방 번호를 학생들에게 알려줍니다.
4. 학생은 학생 모드에서 이름과 방 번호를 입력합니다.
5. 교사가 접속 학생 중 술래와 초성을 선택하고 시작합니다.
6. 학생은 3분 동안 낱말을 한 개씩 제출합니다.
7. 교사가 결과 공개를 진행하면 모든 기기에 공개 상황이 동기화됩니다.

## 운영 전 확인할 점
- Firestore 보안 규칙은 기본적인 역할/쓰기 권한을 제한합니다. 실제 학교 배포 전 테스트 계정으로 권한을 점검하세요.
- 교사 PIN 인증 함수는 공개 호출이므로 PIN을 충분히 안전하게 관리하고, 필요하면 Firebase App Check 및 추가적인 호출 제한을 적용하세요.
- 현재 방 번호는 6자리 숫자입니다. 학교에서 사용하기 전에는 방 코드 만료/재사용 방지와 접속자 퇴장 처리를 추가하는 것을 권장합니다.
- 브라우저 시계 오차가 있을 수 있습니다. 정밀한 동기화가 중요하다면 서버 기준 타이머 함수로 보강하세요.
- 이 프로젝트는 수업용 이름과 낱말만 저장합니다. 학생 실명 등 개인정보는 필요한 최소한으로 사용하고, 수업 종료 후 방/데이터 삭제 정책을 마련하세요.
