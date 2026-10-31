# 1vs다수 낱말 대결 (간편 Firebase 버전)

초등학교 학급에서 사용하는 실시간 낱말 게임입니다. Cloud Functions나 PC에 Node.js/Firebase CLI를 설치하지 않고, Firebase Authentication과 Firestore를 사용합니다.

## 포함 기능
- 교사: PIN 입력, 게임방 생성, 학생 확인, 술래/초성 선택, 3분 게임 시작, 결과 낱말 공개
- 학생: 익명 로그인, 방 번호로 입장, 낱말 입력
- Firestore 실시간 동기화 및 중복 낱말 제거
- GitHub + Vercel 배포 지원

## 1. Firebase 설정
1. Firebase Console에서 프로젝트 `vsmany`를 엽니다.
2. Authentication > 로그인 방법에서 **익명(Anonymous)** 로그인을 사용 설정합니다.
3. Firestore Database를 생성합니다.
4. `src/firebase.js`에 Firebase 웹 앱 설정값이 입력되어 있는지 확인합니다.
5. Firestore Database > 규칙(Rules)에서 이 저장소의 `firestore.rules` 내용을 붙여넣고 게시합니다.

## 2. 교사 PIN 안내
- 교사용 PIN은 `src/App.jsx`의 `teacherLogin` 함수에서 `3313`으로 확인합니다.
- 이 간편 모드는 PIN 확인이 브라우저에서 이루어지므로, 개발자 도구를 사용하는 사람이 PIN을 알아내거나 우회할 수 있습니다.
- Firestore는 방을 만든 익명 계정의 UID만 그 방의 상태/결과를 수정하도록 제한합니다. 학생은 다른 사람의 방을 관리할 수 없습니다.
- 학급 수업용 편의 설정이며, 민감한 개인정보나 공개 서비스에는 사용하지 마세요.

## 3. GitHub 및 Vercel 배포
1. 이 폴더의 파일 전체를 GitHub 저장소에 업로드합니다.
2. Vercel에서 해당 GitHub 저장소를 Import합니다.
3. Framework Preset: **Vite**
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Deploy를 누릅니다.

Vercel이 빌드 환경을 제공하므로 선생님 PC에 Node.js를 설치할 필요가 없습니다. 다만 소스 코드를 수정하거나 로컬에서 실행하려는 경우에는 개발 도구가 필요할 수 있습니다.

## 4. 게임 진행
1. 교사는 교사 모드에서 PIN `3313`을 입력합니다.
2. 교사 이름을 입력하고 새 게임방을 만듭니다.
3. 화면의 6자리 방 번호를 학생들에게 알려줍니다.
4. 학생은 이름과 방 번호를 입력해 입장합니다.
5. 교사가 술래와 초성을 선택하고 게임을 시작합니다.
6. 학생들은 3분 동안 낱말을 입력합니다.
7. 교사가 결과를 하나씩 공개합니다.

## 참고
- 이 버전은 기존 서버 인증 버전에서 Cloud Functions를 제거한 간편 버전입니다.
- 교사 PIN은 강력한 보안 수단이 아닙니다. 교사용 브라우저/링크를 학급 안에서만 공유하고, 게임방 번호도 외부에 공개하지 마세요.
- 게임이 끝난 뒤 불필요한 Firestore 방 데이터는 Firebase 콘솔에서 삭제할 수 있습니다.
- 기존 게임 로직과 마찬가지로 3초 교대 구호 방식은 구현되어 있지 않으며, 제출한 고유 낱말 수로 점수를 계산합니다.
