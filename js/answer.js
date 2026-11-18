/*
==================================================
LumiA
ファイル名：answer.js

【ファイル概要】
LumiAの回答画面に関するJavaScriptファイル。

【主な役割】
・質問内容の表示
・AI回答の表示
・参照情報の表示
・追加質問処理
・回答生成中の状態管理
・共通エラー処理との連携
・回答失敗時の再試行
・APIエラーの種類に応じた処理
・コーギくんの状態切り替え
・回答可能／未回答の判定

【関連ファイル】
・pages/answer.html
・js/question.js
・js/api.js
・js/corgi.js
・js/error-handler.js

【回答状態】
LOADING   ：資料を確認中
SUCCESS   ：回答できた
UNANSWERED：公開資料から回答を確認できなかった
ERROR     ：通信・システムなどのエラー

==================================================
*/

"use strict";

import { initializeCorgi, setCorgiState } from "./corgi.js";
import { sendGuestQuestion, ApiError } from "./api.js";

// ==================================================
// 1. 設定
// ==================================================

const STORAGE_KEY = "lumia_current_question";

// 回答状態
const ANSWER_STATE = {
  LOADING: "loading",
  SUCCESS: "success",
  UNANSWERED: "unanswered",
  ERROR: "error",
};

// 現在のAPI応答で使用されている未回答メッセージ
// API側に専用ステータスが実装されるまでの暫定判定
const UNANSWERED_MESSAGES = ["公開資料から確認できませんでした。"];

// ==================================================
// 2. DOM要素
// ==================================================

const elements = {
  question: document.querySelector("#answer-question"),
  answerBody: document.querySelector("#answer-body"),
  references: document.querySelector("#answer-references"),
  referencesList: document.querySelector("#answer-references-list"),

  questionForm: document.querySelector("#answer-question-form"),
  questionInput: document.querySelector("#answer-question-input"),
  questionModeLabel: document.querySelector("#question-mode-label"),

  submitButton: document.querySelector(
    "#answer-question-form button[type='submit']",
  ),

  homeButton: document.querySelector("#home-button"),
  historyButton: document.querySelector("#history-button"),

  corgi: document.querySelector(".answer-book__mascot"),
};

// ==================================================
// 3. 状態管理
// ==================================================

let isGenerating = false;

// ==================================================
// 4. 初期化
// ==================================================

document.addEventListener("DOMContentLoaded", initializeAnswerPage);

function initializeAnswerPage() {
  // 必要なHTML要素を確認
  if (
    !elements.question ||
    !elements.answerBody ||
    !elements.questionForm ||
    !elements.questionInput ||
    !elements.corgi
  ) {
    console.error("LumiA: 回答画面に必要なHTML要素が見つかりません。");

    redirectToError("system");
    return;
  }

  try {
    // コーギくん初期化
    initializeCorgi(elements.corgi, "reading");

    // イベント設定
    setupEventListeners();

    // 質問内容を取得
    const question = getStoredQuestion();

    if (!question) {
      showEmptyQuestionMessage();
      return;
    }

    // 質問内容を表示
    displayQuestion(question);

    // 最初の質問に対する回答生成を開始
    generateAnswer(question);
  } catch (error) {
    console.error(
      "LumiA: 回答画面の初期化に失敗しました。",
      error?.name || "InitializationError",
    );

    redirectToError("system");
  }
}

// ==================================================
// 5. 質問内容の取得
// ==================================================

function getStoredQuestion() {
  try {
    const question = sessionStorage.getItem(STORAGE_KEY);

    if (typeof question !== "string") {
      return "";
    }

    return question.trim();
  } catch (error) {
    throw new ApiError(
      "質問内容を取得できませんでした。",
      0,
      null,
      "DATA",
      error,
    );
  }
}

// ==================================================
// 6. 質問内容の保存
// ==================================================

function preserveQuestion(question) {
  if (typeof question !== "string" || !question.trim()) {
    return false;
  }

  try {
    sessionStorage.setItem(STORAGE_KEY, question.trim());
    return true;
  } catch (error) {
    console.error(
      "LumiA: 質問内容を保存できませんでした。",
      error?.name || "StorageError",
    );

    return false;
  }
}

// ==================================================
// 7. 質問内容の表示
// ==================================================

function displayQuestion(question) {
  elements.question.textContent = question;
}

// ==================================================
// 8. 質問が存在しない場合
// ==================================================

function showEmptyQuestionMessage() {
  if (window.LumiAError?.redirect) {
    window.LumiAError.redirect("not-found");
    return;
  }

  elements.question.textContent = "質問が入力されていません。";

  elements.answerBody.textContent = "ホーム画面から質問を入力してください。";

  elements.questionForm.hidden = true;

  setAnswerState(ANSWER_STATE.ERROR);
}

// ==================================================
// 9. イベント設定
// ==================================================

function setupEventListeners() {
  // 追加質問フォーム
  elements.questionForm.addEventListener("submit", handleAdditionalQuestion);

  // ホームへ戻る
  if (elements.homeButton) {
    elements.homeButton.addEventListener("click", () => {
      window.location.href = "./home.html";
    });
  }
}

// ==================================================
// 10. 追加質問処理
// ==================================================

async function handleAdditionalQuestion(event) {
  event.preventDefault();

  if (isGenerating) {
    return;
  }

  const question = elements.questionInput.value.trim();

  // 空欄チェック
  if (!question) {
    elements.questionInput.focus();
    return;
  }

  // 質問内容を保存
  if (!preserveQuestion(question)) {
    showInlineError("質問を保存できませんでした。もう一度お試しください。");

    return;
  }

  // 質問内容を表示
  displayQuestion(question);

  // 回答生成
  // 回答できた場合のみ入力欄をクリアする
  await generateAnswer(question, {
    clearInputOnSuccess: true,
  });
}

// ==================================================
// 11. 回答生成処理
// ==================================================

async function generateAnswer(question, options = {}) {
  if (isGenerating) {
    return false;
  }

  isGenerating = true;

  try {
    // 質問内容を保持
    if (!preserveQuestion(question)) {
      throw new ApiError("質問内容を保存できませんでした。", 0, null, "DATA");
    }

    // 前の回答・参考資料をクリア
    clearPreviousAnswer();

    // 調べ中の状態へ切り替え
    setLoadingState();

    // APIから回答を取得
    const result = await requestAnswer(question);

    // 回答データの確認
    validateAnswerResult(result);

    // 回答内容を表示
    displayAnswer(result);

    // 回答できなかった場合
    if (isUnansweredResult(result)) {
      setAnswerState(ANSWER_STATE.UNANSWERED);

      // 未回答の場合は入力内容を保持
      return false;
    }

    // 追加質問の場合、回答成功後に入力欄をクリア
    if (
      options.clearInputOnSuccess &&
      elements.questionInput.value.trim() === question
    ) {
      elements.questionInput.value = "";
    }

    // 回答完了の状態へ切り替え
    setAnswerState(ANSWER_STATE.SUCCESS);

    return true;
  } catch (error) {
    console.error(
      "LumiA: 回答の取得に失敗しました。",
      error?.name || "UnknownError",
      error?.code || "",
    );

    // エラーの種類に応じて処理
    showAnswerError(error, () => generateAnswer(question, options), question);

    return false;
  } finally {
    isGenerating = false;

    // 入力欄を再び有効にする
    setQuestionFormDisabled(false);
  }
}

// ==================================================
// 12. 回答データの確認
// ==================================================

function validateAnswerResult(result) {
  if (!result || typeof result.answer !== "string" || !result.answer.trim()) {
    throw new ApiError("回答データの形式が正しくありません。", 0, null, "DATA");
  }
}

// ==================================================
// 13. 未回答判定
// ==================================================

function isUnansweredResult(result) {
  if (!result || typeof result.answer !== "string") {
    return false;
  }

  const answer = result.answer.replace(/\s+/g, "").trim();

  return UNANSWERED_MESSAGES.some((message) => {
    const normalizedMessage = message.replace(/\s+/g, "").trim();

    return answer === normalizedMessage;
  });
}

// ==================================================
// 14. 回答状態の切り替え
// ==================================================

function setAnswerState(state) {
  document.body.dataset.answerState = state;

  switch (state) {
    // ----------------------------------------------
    // 資料を確認中
    // ----------------------------------------------

    case ANSWER_STATE.LOADING:
      setCorgiState("reading");

      if (elements.questionModeLabel) {
        elements.questionModeLabel.textContent =
          "学校の資料を確認しています...";
      }
      break;

    // ----------------------------------------------
    // 回答成功
    // ----------------------------------------------

    case ANSWER_STATE.SUCCESS:
      setCorgiState("explaining");

      if (elements.questionModeLabel) {
        elements.questionModeLabel.textContent = "ほかの質問はありますか？";
      }
      break;

    // ----------------------------------------------
    // 公開資料から回答を確認できなかった
    // ----------------------------------------------

    case ANSWER_STATE.UNANSWERED:
      setCorgiState("apology");

      if (elements.questionModeLabel) {
        elements.questionModeLabel.textContent = "別の質問も試してみてね。";
      }
      break;

    // ----------------------------------------------
    // 通信・システムなどのエラー
    // ----------------------------------------------

    case ANSWER_STATE.ERROR:
      setCorgiState("apology");

      if (elements.questionModeLabel) {
        elements.questionModeLabel.textContent =
          "もう一度質問することができます。";
      }
      break;

    default:
      console.error("LumiA: 不明な回答状態です。", state);
  }
}

// ==================================================
// 15. 調べ中の表示
// ==================================================

function setLoadingState() {
  setAnswerState(ANSWER_STATE.LOADING);

  elements.answerBody.textContent =
    "学校の資料を確認し、回答を準備しています。";

  setQuestionFormDisabled(true);
}

// ==================================================
// 16. 質問フォームの有効・無効
// ==================================================

function setQuestionFormDisabled(disabled) {
  elements.questionInput.disabled = disabled;

  if (elements.submitButton) {
    elements.submitButton.disabled = disabled;
  }
}

// ==================================================
// 17. 前の回答・参考資料をクリア
// ==================================================

function clearPreviousAnswer() {
  elements.answerBody.replaceChildren();

  if (elements.referencesList) {
    elements.referencesList.replaceChildren();
  }

  if (elements.references) {
    elements.references.hidden = true;
  }
}

// ==================================================
// 18. API接続処理
// ==================================================

async function requestAnswer(question) {
  // ゲスト向け質問APIへ送信
  return await sendGuestQuestion(question);
}

// ==================================================
// 19. AI回答の表示
// ==================================================

function displayAnswer(result) {
  // 回答データの確認
  validateAnswerResult(result);

  // AI回答を表示
  elements.answerBody.textContent = result.answer;

  // 参照資料を表示
  displayReferences(result.citations || []);
}

// ==================================================
// 20. 参照情報の表示
// ==================================================

function displayReferences(citations) {
  if (!elements.references || !elements.referencesList) {
    return;
  }

  elements.referencesList.replaceChildren();

  if (!Array.isArray(citations) || citations.length === 0) {
    elements.references.hidden = true;
    return;
  }

  citations.forEach((citation) => {
    if (!citation || typeof citation !== "object") {
      return;
    }

    const item = document.createElement("li");

    // S3 URIから資料名を取得
    let title = "参照資料";

    if (typeof citation.sourceUri === "string") {
      const fileName = citation.sourceUri.split("/").pop();

      if (fileName) {
        try {
          title = decodeURIComponent(fileName);
        } catch {
          title = fileName;
        }
      }
    }

    const titleElement = document.createElement("strong");

    titleElement.textContent = title;

    item.appendChild(titleElement);

    // 参照箇所の抜粋
    if (typeof citation.excerpt === "string" && citation.excerpt.trim()) {
      const excerptElement = document.createElement("p");

      excerptElement.textContent = citation.excerpt;

      item.appendChild(excerptElement);
    }

    elements.referencesList.appendChild(item);
  });

  // 有効な参考資料がある場合だけ表示
  elements.references.hidden = elements.referencesList.children.length === 0;
}

// ==================================================
// 21. エラーの種類に応じた処理
// ==================================================

function showAnswerError(error, retryCallback, question) {
  // 参考資料を非表示
  if (elements.references) {
    elements.references.hidden = true;
  }

  // エラー状態へ切り替え
  setAnswerState(ANSWER_STATE.ERROR);

  const errorCode = error?.code || "UNKNOWN";

  // ----------------------------------------------
  // 認証エラー
  // ----------------------------------------------

  if (errorCode === "AUTH_REQUIRED") {
    // ログイン画面へ移動する前に質問を保存
    preserveQuestion(question);

    if (window.LumiAError?.redirect) {
      window.LumiAError.redirect("auth");
      return;
    }

    showInlineError("ログインが必要です。ログイン画面から認証してください。");

    return;
  }

  // ----------------------------------------------
  // API設定エラー
  // ----------------------------------------------

  if (errorCode === "CONFIG") {
    redirectToError("system");
    return;
  }

  // ----------------------------------------------
  // アクセス権限エラー
  // ----------------------------------------------

  if (errorCode === "FORBIDDEN") {
    showInlineError(
      "この操作を行う権限がありません。必要に応じて管理者にお問い合わせください。",
    );

    return;
  }

  // ----------------------------------------------
  // 認証セッション取得エラー
  // ----------------------------------------------

  if (errorCode === "AUTH_SESSION_FAILED") {
    preserveQuestion(question);

    redirectToError("auth");
    return;
  }

  // ----------------------------------------------
  // 認証設定エラー
  // ----------------------------------------------

  if (errorCode === "AUTH_CONFIG_ERROR") {
    redirectToError("system");
    return;
  }

  // ----------------------------------------------
  // 認証処理エラー
  // ----------------------------------------------

  if (errorCode === "AUTH_OPERATION_FAILED") {
    redirectToError("system");
    return;
  }

  // ----------------------------------------------
  // 通信・サーバーエラー
  // ----------------------------------------------

  if (errorCode === "NETWORK" || errorCode === "SERVER") {
    showInlineError(
      "サーバーとの通信に問題が発生しました。質問内容は保持されています。時間をおいて、もう一度お試しください。",
      retryCallback,
    );

    return;
  }

  // ----------------------------------------------
  // データエラー
  // ----------------------------------------------

  if (errorCode === "DATA") {
    showInlineError(
      "回答データを正しく処理できませんでした。質問内容を確認して、もう一度お試しください。",
      retryCallback,
    );

    return;
  }

  // ----------------------------------------------
  // その他のエラー
  // ----------------------------------------------

  showInlineError(
    "申し訳ありません。回答を取得できませんでした。質問内容は保持されています。時間をおいて、もう一度お試しください。",
    retryCallback,
  );
}

// ==================================================
// 22. 共通エラー画面への遷移
// ==================================================

function redirectToError(type) {
  if (window.LumiAError?.redirect) {
    window.LumiAError.redirect(type);
    return;
  }

  // 共通エラーハンドラーが利用できない場合
  window.location.href = "./error.html";
}

// ==================================================
// 23. 共通インラインエラー表示
// ==================================================

function showInlineError(message, retryCallback = null) {
  // 共通エラーハンドラーを利用
  if (window.LumiAError?.showInline) {
    window.LumiAError.showInline(elements.answerBody, message, retryCallback);

    return;
  }

  // 共通エラーハンドラーが利用できない場合
  const errorContainer = document.createElement("div");

  errorContainer.className = "lumia-inline-error";
  errorContainer.setAttribute("role", "alert");
  errorContainer.setAttribute("aria-live", "assertive");

  const messageElement = document.createElement("p");

  messageElement.className = "lumia-inline-error__message";
  messageElement.textContent = message;

  errorContainer.appendChild(messageElement);

  // 再試行ボタン
  if (typeof retryCallback === "function") {
    const retryButton = document.createElement("button");

    retryButton.type = "button";
    retryButton.className = "lumia-inline-error__retry";
    retryButton.textContent = "もう一度試す";

    retryButton.addEventListener("click", async () => {
      if (retryButton.disabled) {
        return;
      }

      retryButton.disabled = true;

      try {
        await retryCallback();
      } finally {
        if (retryButton.isConnected) {
          retryButton.disabled = false;
        }
      }
    });

    errorContainer.appendChild(retryButton);
  }

  elements.answerBody.appendChild(errorContainer);
}
