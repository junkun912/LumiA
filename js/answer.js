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
・回答エラー処理
・コーギくんの状態切り替え

【関連ファイル】
・pages/answer.html
・js/question.js
・js/api.js
・js/corgi.js
==================================================
*/

"use strict";

import { initializeCorgi, setCorgiState } from "./corgi.js";
import { sendGuestQuestion } from "./api.js";

// ==================================================
// 設定
// ==================================================

const STORAGE_KEY = "lumia_current_question";

// 回答画面の状態
const ANSWER_STATE = {
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error",
};

// ==================================================
// DOM要素
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
// 状態管理
// ==================================================

let isGenerating = false;

// ==================================================
// 初期化
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
    return;
  }

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
}

// ==================================================
// 質問内容の取得
// ==================================================

function getStoredQuestion() {
  try {
    const question = sessionStorage.getItem(STORAGE_KEY);

    if (typeof question !== "string") {
      return "";
    }

    return question.trim();
  } catch (error) {
    console.error("LumiA: 質問内容を取得できませんでした。", error);
    return "";
  }
}

// ==================================================
// 質問内容の表示
// ==================================================

function displayQuestion(question) {
  elements.question.textContent = question;
}

// ==================================================
// 質問が存在しない場合
// ==================================================

function showEmptyQuestionMessage() {
  elements.question.textContent = "質問が入力されていません。";

  elements.answerBody.textContent = "ホーム画面から質問を入力してください。";

  elements.questionForm.hidden = true;

  setAnswerState(ANSWER_STATE.ERROR);
}

// ==================================================
// イベント設定
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
// 追加質問処理
// ==================================================

async function handleAdditionalQuestion(event) {
  event.preventDefault();

  if (isGenerating) {
    return;
  }

  const question = elements.questionInput.value.trim();

  if (!question) {
    elements.questionInput.focus();
    return;
  }

  // 質問内容を更新
  displayQuestion(question);

  // 入力欄を空にする
  elements.questionInput.value = "";

  // 回答生成
  await generateAnswer(question);
}

// ==================================================
// 回答生成処理
// ==================================================

async function generateAnswer(question) {
  if (isGenerating) {
    return;
  }

  isGenerating = true;

  // 調べ中の状態へ切り替え
  setLoadingState();

  try {
    // 前の回答・参考資料をクリア
    clearPreviousAnswer();

    // APIから回答を取得
    const result = await requestAnswer(question);

    // 回答内容を表示
    displayAnswer(result);

    // 回答完了の状態へ切り替え
    setAnswerState(ANSWER_STATE.SUCCESS);
  } catch (error) {
    console.error("LumiA: 回答の取得に失敗しました。", error);

    // エラー状態へ切り替え
    showAnswerError(error);
  } finally {
    isGenerating = false;

    // 入力欄を再び有効にする
    setQuestionFormDisabled(false);
  }
}

// ==================================================
// 回答状態の切り替え
// ==================================================

function setAnswerState(state) {
  document.body.dataset.answerState = state;

  switch (state) {
    case ANSWER_STATE.LOADING:
      setCorgiState("reading");

      if (elements.questionModeLabel) {
        elements.questionModeLabel.textContent =
          "学校の資料を確認しています...";
      }
      break;

    case ANSWER_STATE.SUCCESS:
      setCorgiState("explaining");

      if (elements.questionModeLabel) {
        elements.questionModeLabel.textContent = "ほかの質問はありますか？";
      }
      break;

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
// 調べ中の表示
// ==================================================

function setLoadingState() {
  setAnswerState(ANSWER_STATE.LOADING);

  elements.answerBody.textContent =
    "学校の資料を確認し、回答を準備しています。";

  setQuestionFormDisabled(true);
}

// ==================================================
// 質問フォームの有効・無効
// ==================================================

function setQuestionFormDisabled(disabled) {
  elements.questionInput.disabled = disabled;

  if (elements.submitButton) {
    elements.submitButton.disabled = disabled;
  }
}

// ==================================================
// 前の回答・参考資料をクリア
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
// API接続処理
// ==================================================

async function requestAnswer(question) {
  // ゲスト向け質問APIへ送信
  const result = await sendGuestQuestion(question);

  return result;
}

// ==================================================
// AI回答の表示
// ==================================================

function displayAnswer(result) {
  if (!result || typeof result.answer !== "string" || !result.answer.trim()) {
    throw new Error("回答データの形式が正しくありません。");
  }

  // AI回答を表示
  elements.answerBody.textContent = result.answer;

  // 参照資料を表示
  displayReferences(result.citations || []);
}

// ==================================================
// 参照情報の表示
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
    const item = document.createElement("li");

    // S3 URIから資料名を取得
    let title = "参照資料";

    if (citation && typeof citation.sourceUri === "string") {
      const fileName = citation.sourceUri.split("/").pop();

      if (fileName) {
        try {
          title = decodeURIComponent(fileName);
        } catch (error) {
          title = fileName;
        }
      }
    }

    // 資料名
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

  elements.references.hidden = false;
}

// ==================================================
// エラー表示
// ==================================================

function showAnswerError(error) {
  elements.answerBody.textContent =
    "申し訳ありません。回答を取得できませんでした。時間をおいて、もう一度お試しください。";

  // 参考資料を非表示
  if (elements.references) {
    elements.references.hidden = true;
  }

  // エラー状態へ切り替え
  setAnswerState(ANSWER_STATE.ERROR);
}
