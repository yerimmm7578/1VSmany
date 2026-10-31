const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { randomUUID } = require("crypto");

initializeApp();
const teacherPin = defineSecret("TEACHER_PIN");

// The PIN is stored as a Firebase Secret and is never sent to the browser.
exports.teacherLogin = onCall(
  { region: "asia-northeast3", secrets: [teacherPin] },
  async (request) => {
    const supplied = String(request.data?.pin || "");
    if (!supplied || supplied !== teacherPin.value()) {
      throw new HttpsError("unauthenticated", "교사 비밀번호가 올바르지 않습니다.");
    }
    const uid = `teacher-${randomUUID()}`;
    const token = await getAuth().createCustomToken(uid, { teacher: true });
    return { token };
  }
);