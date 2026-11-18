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

  // 質問内容の保存と画面遷移
  saveQuestionAndNavigate(question);
}

// ==================================================
// 質問内容の保存・画面遷移
// ==================================================

function saveQuestionAndNavigate(question) {
  try {
    // 質問内容を保存
    sessionStorage.setItem(STORAGE_KEY, question);

    // インラインエラーを解除
    if (window.LumiAError) {
      window.LumiAError.clearInline(elements.form);
    }

    // 回答画面へ移動
    window.location.href = "./answer.html";
  } catch (error) {
    console.error("LumiA: 質問内容を保存できませんでした。", error);

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
        "質問を保存できませんでした。入力内容は保持されています。ページを再読み込みせず、もう一度お試しください。";
    }
  }
}
