/*
==================================================
LumiA
ファイル名：question.js

【ファイル概要】
ユーザーからの質問入力・送信に関するJavaScriptファイル。

【主な役割】
・質問入力の取得
・質問文字数の確認
・質問送信
・質問送信中のUI制御
・回答画面への受け渡し

【関連ファイル】
・pages/home.html
・pages/answer.html
・js/api.js
・js/answer.js
==================================================
*/

"use strict";

// ==================================================
// 設定
// ==================================================

const STORAGE_KEY = "lumia_current_question";

// ==================================================
// DOM要素
// ==================================================

const elements = {
  form: document.querySelector("#home-question-form"),
  input: document.querySelector("#home-question-input"),
  submitButton: document.querySelector(
    "#home-question-form button[type='submit']",
  ),
};

// ==================================================
// 初期化
// ==================================================

export function initializeQuestionForm() {
  if (!elements.form || !elements.input || !elements.submitButton) {
    console.error("LumiA: 質問フォームのHTML要素が見つかりません。");
    return;
  }

  elements.form.addEventListener("submit", handleQuestionSubmit);
}

// ==================================================
// 質問送信処理
// ==================================================

function handleQuestionSubmit(event) {
  event.preventDefault();

  const question = elements.input.value.trim();

  // 空欄チェック
  if (!question) {
    elements.input.focus();
    return;
  }

  // 送信中の二重操作を防止
  elements.submitButton.disabled = true;

  try {
    // 質問内容を保存
    sessionStorage.setItem(STORAGE_KEY, question);

    // 回答画面へ移動
    window.location.href = "./answer.html";
  } catch (error) {
    console.error("LumiA: 質問内容を保存できませんでした。", error);

    elements.submitButton.disabled = false;

    alert("質問を送信できませんでした。もう一度お試しください。");
  }
}
