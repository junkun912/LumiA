/*
==================================================
LumiA
ファイル名：question.js
バージョン：v2.2

【ファイル概要】
ユーザーからの質問入力・送信に関するJavaScriptファイル。

【主な役割】
・質問入力の取得
・質問文字数の確認
・質問送信
・質問送信中のUI制御
・回答画面への受け渡し
・共通エラー処理との連携

【関連ファイル】
・pages/home.html
・pages/answer.html
・js/api.js
・js/answer.js
・js/error-handler.js

==================================================
*/

"use strict";

// ==================================================
// 1. 設定
// ==================================================

const STORAGE_KEY = "lumia_current_question";

const ANSWER_PAGE_URL = "./answer.html";

// ==================================================
// 2. DOM要素
// ==================================================

let elements = {
  form: null,
  input: null,
  submitButton: null,
};

// ==================================================
// 3. 初期化状態
// ==================================================

let isQuestionFormInitialized = false;

let isSubmitting = false;

// ==================================================
// 4. 初期化
// ==================================================

export function initializeQuestionForm() {
  // 二重初期化を防止
  if (isQuestionFormInitialized) {
    return;
  }

  // DOM要素を取得
  elements = {
    form: document.querySelector("#home-question-form"),
    input: document.querySelector("#home-question-input"),
    submitButton: document.querySelector(
      "#home-question-form button[type='submit']",
    ),
  };

  // 必要なHTML要素を確認
  if (!elements.form || !elements.input || !elements.submitButton) {
    console.error("LumiA: 質問フォームのHTML要素が見つかりません。");

    return;
  }

  // 質問送信イベントを登録
  elements.form.addEventListener("submit", handleQuestionSubmit);

  isQuestionFormInitialized = true;
}

// ==================================================
// 5. 質問送信処理
// ==================================================

function handleQuestionSubmit(event) {
  event.preventDefault();

  // 送信中の二重操作を防止
  if (isSubmitting) {
    return;
  }

  const question = elements.input.value.trim();

  // 空欄チェック
  if (!question) {
    elements.input.focus();
    return;
  }

  // 質問内容の保存と画面遷移
  saveQuestionAndNavigate(question);
}

// ==================================================
// 6. 質問内容の保存・画面遷移
// ==================================================

function saveQuestionAndNavigate(question) {
  // 送信中の二重操作を防止
  if (isSubmitting) {
    return;
  }

  isSubmitting = true;

  // 送信ボタンを無効化
  elements.submitButton.disabled = true;

  try {
    // 質問内容を保存
    sessionStorage.setItem(STORAGE_KEY, question);

    // インラインエラーを解除
    if (window.LumiAError) {
      window.LumiAError.clearInline(elements.form);
    }

    // 回答画面へ移動
    window.location.href = ANSWER_PAGE_URL;
  } catch (error) {
    console.error(
      "LumiA: 質問内容を保存できませんでした。",
      error?.name || "QuestionStorageError",
    );

    // 送信状態を解除
    isSubmitting = false;

    // 送信ボタンを再び操作可能にする
    elements.submitButton.disabled = false;

    // 共通エラー処理
    if (window.LumiAError) {
      window.LumiAError.showInline(
        elements.form,
        "質問を保存できませんでした。入力内容は保持されています。もう一度お試しください。",
        () => saveQuestionAndNavigate(question),
      );
    } else {
      // 共通エラー処理が利用できない場合の代替表示
      let errorMessage = elements.form.querySelector(".lumia-inline-error");

      if (!errorMessage) {
        errorMessage = document.createElement("p");

        errorMessage.className = "lumia-inline-error";

        errorMessage.setAttribute("role", "alert");

        elements.form.appendChild(errorMessage);
      }

      errorMessage.textContent =
        "質問を保存できませんでした。入力内容は保持されています。もう一度お試しください。";
    }
  }
}
