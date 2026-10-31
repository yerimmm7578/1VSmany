import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc, collection, doc, getDoc, getDocs, onSnapshot, query,
  serverTimestamp, setDoc, updateDoc, where
} from "firebase/firestore";
import {
  onAuthStateChanged, signInAnonymously
} from "firebase/auth";
import { auth, db } from "./firebase";

const CONSONANTS = ["ㄱ","ㄴ","ㄷ","ㄹ","ㅁ","ㅂ","ㅅ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const INITIALS = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const initialOf = (word) => {
  const n = word.trim().charCodeAt(0) - 44032;
  return n >= 0 && n <= 11171 ? INITIALS[Math.floor(n / 588)] : "";
};
const normalize = (word) => word.trim().replace(/\s+/g, "").toLocaleLowerCase();
const makeRoomCode = () => String(Math.floor(100000 + Math.random() * 900000));

export default function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState("home");
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [roomId, setRoomId] = useState("");
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [catcherUid, setCatcherUid] = useState("");
  const [consonant, setConsonant] = useState("ㄱ");
  const [word, setWord] = useState("");
  const [myWords, setMyWords] = useState([]);
  const [seconds, setSeconds] = useState(180);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const finishLock = useRef(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!roomId || !user) return;
    const unsubRoom = onSnapshot(doc(db, "rooms", roomId), (snap) => {
      if (!snap.exists()) { setError("게임방을 찾을 수 없습니다."); return; }
      const data = snap.data();
      setRoom(data);
      if (data.status === "lobby") setScreen(role === "teacher" ? "teacherLobby" : "studentLobby");
      if (data.status === "playing") setScreen("game");
      if (data.status === "results") setScreen("results");
    }, (e) => setError(e.message));
    const unsubPlayers = onSnapshot(collection(db, "rooms", roomId, "players"), (snap) => {
      setPlayers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    }, (e) => setError(e.message));
    const unsubResult = onSnapshot(doc(db, "rooms", roomId, "results", "summary"), (snap) => {
      setResult(snap.exists() ? snap.data() : null);
    });
    return () => { unsubRoom(); unsubPlayers(); unsubResult(); };
  }, [roomId, user, role]);

  useEffect(() => {
    if (room?.status !== "playing" || !room.endsAt) return;
    const update = () => {
      const end = room.endsAt.toMillis ? room.endsAt.toMillis() : new Date(room.endsAt).getTime();
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setSeconds(left);
      if (left === 0 && role === "teacher") finishGame();
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [room?.status, room?.endsAt, role]);

  async function ensureAnonymous() {
    if (auth.currentUser) return auth.currentUser;
    return (await signInAnonymously(auth)).user;
  }

  async function teacherLogin() {
    setBusy(true); setError("");
    try {
      // 간편 학급용 모드: PIN은 화면에서만 확인합니다.
      // 교사 권한의 데이터 수정은 Firestore에서 방 생성자의 UID로 제한합니다.
      if (pin !== "3313") throw new Error("교사 비밀번호가 올바르지 않습니다.");
      await ensureAnonymous();
      setRole("teacher");
      setScreen("teacherHome");
    } catch (e) { setError(e.message || "교사 인증에 실패했습니다."); }
    finally { setBusy(false); }
  }

  async function createRoom() {
    if (!name.trim()) return setError("교사 이름을 입력해 주세요.");
    setBusy(true); setError("");
    try {
      const current = auth.currentUser || (await teacherLoginForRoom());
      const id = makeRoomCode();
      await setDoc(doc(db, "rooms", id), {
        teacherUid: current.uid, teacherName: name.trim(),
        status: "lobby", createdAt: serverTimestamp(),
        durationMs: 180000, consonant: "ㄱ", catcherUid: "",
        endsAt: null, revealIndex: 0
      });
      setRoomId(id); setRole("teacher"); setScreen("teacherLobby");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function teacherLoginForRoom() {
    // 로그인 화면에서 이미 교사 인증을 마친 계정이어야 합니다.
    if (!auth.currentUser) throw new Error("교사 인증을 먼저 해주세요.");
    return auth.currentUser;
  }

  async function joinRoom() {
    if (!name.trim() || !roomInput.trim()) return setError("이름과 방 번호를 입력해 주세요.");
    setBusy(true); setError("");
    try {
      const current = await ensureAnonymous();
      const id = roomInput.trim();
      const snap = await getDoc(doc(db, "rooms", id));
      if (!snap.exists()) throw new Error("방 번호를 확인해 주세요.");
      if (snap.data().status !== "lobby") throw new Error("이미 시작된 게임방입니다.");
      await setDoc(doc(db, "rooms", id, "players", current.uid), {
        name: name.trim(), joinedAt: serverTimestamp()
      });
      setRoomId(id); setRole("student"); setMyWords([]); setScreen("studentLobby");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function startGame() {
    if (!catcherUid) return setError("술래를 선택해 주세요.");
    setBusy(true); setError("");
    try {
      const endsAt = new Date(Date.now() + 180000);
      await updateDoc(doc(db, "rooms", roomId), {
        status: "playing", catcherUid, consonant, durationMs: 180000,
        startedAt: serverTimestamp(), endsAt
      });
      setSeconds(180); finishLock.current = false;
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function submitWord(e) {
    e.preventDefault();
    const value = word.trim();
    if (!value || !user || room?.status !== "playing") return;
    if (initialOf(value) !== room.consonant) return setError(`'${room.consonant}' 초성으로 시작하는 낱말을 입력해 주세요.`);
    if (myWords.some(w => normalize(w) === normalize(value))) return setError("이미 입력한 낱말입니다.");
    setError("");
    try {
      await addDoc(collection(db, "rooms", roomId, "entries"), {
        uid: user.uid, word: value, createdAt: serverTimestamp()
      });
      setMyWords(v => [...v, value]); setWord("");
    } catch (e) { setError(e.message); }
  }

  async function finishGame() {
    if (finishLock.current || role !== "teacher" || !roomId || room?.status !== "playing") return;
    finishLock.current = true;
    try {
      const snap = await getDocs(collection(db, "rooms", roomId, "entries"));
      const seen = new Set(); const unique = [];
      snap.docs.forEach(d => {
        const item = d.data();
        const value = String(item.word || "").trim();
        if (!value || initialOf(value) !== room.consonant) return;
        const key = normalize(value);
        if (seen.has(key)) return;
        seen.add(key);
        unique.push({ word: value, side: item.uid === room.catcherUid ? "catcher" : "group" });
      });
      for (let i = unique.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [unique[i], unique[j]] = [unique[j], unique[i]];
      }
      await setDoc(doc(db, "rooms", roomId, "results", "summary"), {
        words: unique, revealIndex: 0, finished: unique.length === 0,
        updatedAt: serverTimestamp()
      });
      await updateDoc(doc(db, "rooms", roomId), { status: "results" });
    } catch (e) { finishLock.current = false; setError("결과 처리 실패: " + e.message); }
  }

  async function revealNext() {
    if (!result || result.finished) return;
    const next = Math.min(result.revealIndex + 1, result.words.length);
    await updateDoc(doc(db, "rooms", roomId, "results", "summary"), {
      revealIndex: next, finished: next >= result.words.length
    });
  }

  async function resetRoom() {
    if (role !== "teacher") return;
    await updateDoc(doc(db, "rooms", roomId), {
      status: "lobby", catcherUid: "", endsAt: null, revealIndex: 0
    });
    // 새 라운드는 entries를 비워야 하므로 새 방을 만드는 것을 권장합니다.
    setMyWords([]);
  }

  const isTeacher = role === "teacher";
  const isCatcher = user?.uid === room?.catcherUid;
  const shownWords = result?.words?.slice(0, result.revealIndex) || [];
  const catcherCount = shownWords.filter(x => x.side === "catcher").length;
  const groupCount = shownWords.filter(x => x.side === "group").length;
  const currentWord = shownWords.at(-1)?.word;

  function leave() {
    setRoomId(""); setRoom(null); setPlayers([]); setResult(null);
    setRole(""); setScreen("home"); setError(""); setMyWords([]);
  }

  return <main className="app">
    <header className="hero">
      <div className="eyebrow">CLASSROOM WORD BATTLE</div>
      <h1>1 vs 다수</h1>
      <p>한 명의 도전자 VS 우리 반 친구들!</p>
    </header>

    {error && <div className="error" role="alert">{error}<button onClick={() => setError("")}>확인</button></div>}

    {screen === "home" && <section className="card stack">
      <h2>입장할 모드를 선택하세요</h2>
      <button className="primary" onClick={() => setScreen("studentLogin")}>🙋 학생으로 입장하기</button>
      <button className="secondary" onClick={() => setScreen("teacherLogin")}>👩‍🏫 교사로 입장하기</button>
    </section>}

    {screen === "studentLogin" && <section className="card stack">
      <h2>학생 입장</h2>
      <label>이름<input value={name} onChange={e=>setName(e.target.value)} maxLength={15} placeholder="이름 입력"/></label>
      <label>게임방 번호<input value={roomInput} onChange={e=>setRoomInput(e.target.value)} inputMode="numeric" maxLength={6} placeholder="교사가 알려준 6자리 번호"/></label>
      <button className="primary" disabled={busy} onClick={joinRoom}>대기방 입장</button>
      <button className="secondary" onClick={()=>setScreen("home")}>뒤로</button>
    </section>}

    {screen === "teacherLogin" && <section className="card stack">
      <h2>교사 입장</h2>
      <label>교사 이름<input value={name} onChange={e=>setName(e.target.value)} placeholder="교사 이름"/></label>
      <label>비밀번호<input value={pin} onChange={e=>setPin(e.target.value)} type="password" inputMode="numeric" placeholder="교사 비밀번호"/></label>
      <button className="primary" disabled={busy} onClick={teacherLogin}>교사 인증하기</button>
      <button className="secondary" onClick={()=>setScreen("home")}>뒤로</button>
    </section>}

    {screen === "teacherHome" && <section className="card stack">
      <h2>교사 대시보드</h2>
      <p className="muted">새 게임방을 만들면 6자리 방 번호가 발급됩니다.</p>
      <button className="primary" disabled={busy} onClick={createRoom}>새 게임방 만들기</button>
    </section>}

    {(screen === "teacherLobby" || screen === "studentLobby") && <section className="stack">
      <div className="card center">
        <h2>⏳ 대기방</h2>
        <div className="room-code">{roomId}</div>
        <p className="muted">학생들에게 이 방 번호를 알려주세요.</p>
        <p><b>{players.length}명</b> 접속</p>
      </div>
      <div className="card">
        <h3>접속한 친구들</h3>
        <div className="chips">{players.map(p=><span className="chip" key={p.uid}>🙋 {p.name}</span>)}</div>
      </div>
      {isTeacher && <div className="card stack">
        <h3>① 술래 선택</h3>
        <select value={catcherUid} onChange={e=>setCatcherUid(e.target.value)}>
          <option value="">술래를 선택하세요</option>
          {players.map(p=><option key={p.uid} value={p.uid}>{p.name}</option>)}
        </select>
        <h3>② 초성 선택</h3>
        <div className="letters">{CONSONANTS.map(c=><button key={c} className={c===consonant?"primary":"secondary"} onClick={()=>setConsonant(c)}>{c}</button>)}</div>
        <button className="primary" disabled={busy || !players.length || !catcherUid} onClick={startGame}>🚀 놀이 시작 (3분)</button>
      </div>}
      {!isTeacher && <div className="card center"><h3>선생님이 술래를 선택하고 있어요!</h3><p className="muted">놀이가 시작되면 화면이 자동으로 바뀝니다.</p></div>}
      <button className="secondary" onClick={leave}>나가기</button>
    </section>}

    {screen === "game" && <section className="stack">
      <div className="card center">
        <p className="muted">오늘의 초성</p>
        <div className="consonant">{room?.consonant}</div>
        <div className="timer">{String(Math.floor(seconds/60)).padStart(2,"0")}:{String(seconds%60).padStart(2,"0")}</div>
        <p className="muted">{isTeacher ? "학생들이 낱말을 입력하고 있습니다." : isCatcher ? "🥷 나의 역할: 술래" : "👥 나의 역할: 다수 팀"}</p>
      </div>
      {!isTeacher && <div className="card stack">
        <form onSubmit={submitWord} className="word-form">
          <input value={word} onChange={e=>setWord(e.target.value)} placeholder="낱말 입력 후 엔터" disabled={seconds<=0}/>
          <button className="primary" disabled={seconds<=0}>입력</button>
        </form>
        <p className="muted">내가 입력한 낱말: {myWords.length}개</p>
        <div className="chips">{myWords.map((w,i)=><span className="chip" key={i}>{w}</span>)}</div>
      </div>}
      {isTeacher && <div className="card stack">
        <h3>진행 중인 게임</h3><p className="muted">학생들이 입력한 낱말은 결과 발표 때 공개됩니다.</p>
        <button className="secondary" onClick={finishGame}>시간 종료 및 결과 확인</button>
      </div>}
    </section>}

    {screen === "results" && <section className="stack">
      <div className="hero"><div className="eyebrow">BATTLE FINISHED</div><h2>두근두근 결과 발표!</h2><p>낱말을 하나씩 공개합니다.</p></div>
      <div className="card center">
        <p className="muted">대결 초성</p><div className="consonant">{room?.consonant}</div>
        <p className="muted">공개 {result?.revealIndex || 0} / {result?.words?.length || 0}</p>
        <div className="revealed">{currentWord || (result?.finished ? "모든 낱말 공개 완료" : "❓")}</div>
        <div className="score-row"><span>🥷 술래 <b>{catcherCount}</b>개</span><span>👥 다수 <b>{groupCount}</b>개</span></div>
        {isTeacher && !result?.finished && <button className="primary full" onClick={revealNext}>다음 낱말 공개하기</button>}
        {result?.finished && <>
          <div className="final-score">
            <div><small>🥷 술래</small><strong>{result.words.filter(x=>x.side==="catcher").length}</strong><small>개</small></div>
            <div><small>👥 다수</small><strong>{result.words.filter(x=>x.side==="group").length}</strong><small>개</small></div>
          </div>
          <h2>{result.words.filter(x=>x.side==="catcher").length > result.words.filter(x=>x.side==="group").length ? "🏆 술래 승리!" : result.words.filter(x=>x.side==="catcher").length < result.words.filter(x=>x.side==="group").length ? "🎉 다수 팀 승리!" : "🤝 무승부!"}</h2>
          <p className="muted">중복 낱말은 한 번만 계산했습니다.</p>
        </>}
      </div>
      {isTeacher && result?.finished && <button className="primary" onClick={()=>{setScreen("teacherHome");setRoomId("");setRoom(null);setResult(null);setPlayers([]);}}>새 게임방 만들기</button>}
    </section>}
    <footer>1vs다수 · 실시간 교실 낱말 대결</footer>
  </main>;
}