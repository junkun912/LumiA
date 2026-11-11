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

【関連ファイル】
・pages/answer.html
・js/question.js
・js/api.js
==================================================
*/

"use strict";

import { initializeCorgi, setCorgiState } from "./corgi.js";

// ==================================================
// 設定
// ==================================================

const STORAGE_KEY = "lumia_current_question";

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

  newQuestionButton: document.querySelector("#new-question-button"),
  historyButton: document.querySelector("#history-button"),

  corgi: document.querySelector(".answer-mascot"),
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
  initializeCorgi(elements.corgi, "explaining");

  // 質問内容を取得
  const question = getStoredQuestion();

  if (!question) {
    showEmptyQuestionMessage();
    return;
  }

  // 質問内容を画面に表示
  displayQuestion(question);

  // イベント設定
  setupEventListeners();
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

  setCorgiState("welcome");

  elements.questionForm.hidden = true;
}

// ==================================================
// イベント設定
// ==================================================

function setupEventListeners() {
  // 追加質問フォーム
  elements.questionForm.addEventListener("submit", handleAdditionalQuestion);

  // 新しい質問
  if (elements.newQuestionButton) {
    elements.newQuestionButton.addEventListener("click", () => {
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

  setLoadingState();

  try {
    /*
     * AWS APIとの接続処理は、
     * AWSチームからAPI仕様を受け取った後に実装します。
     */

    const result = await requestAnswer(question);

    displayAnswer(result);

    setCorgiState("explaining");
  } catch (error) {
    console.error("LumiA: 回答の取得に失敗しました。", error);

    showAnswerError(error);
  } finally {
    isGenerating = false;
    elements.questionInput.disabled = false;
  }
}

// ==================================================
// 回答生成中の表示
// ==================================================

function setLoadingState() {
  elements.questionInput.disabled = true;

  elements.answerBody.textContent = "回答を準備しています。";

  setCorgiState("thinking");
}

// ==================================================
// API接続処理
// ==================================================

async function requestAnswer(question) {
  /*
   * TODO：
   * AWSチームから以下の仕様を受け取った後に実装
   *
   * ・APIエンドポイント
   * ・送信するJSONデータ
   * ・回答データの形式
   * ・参照資料データの形式
   */

  setCorgiState("reading");

  throw new Error("API接続の設定がまだ完了していません。");
}

// ==================================================
// AI回答の表示
// ==================================================

function displayAnswer(result) {
  if (!result || typeof result.answer !== "string") {
    throw new Error("回答データの形式が正しくありません。");
  }

  elements.answerBody.textContent = result.answer;

  displayReferences(result.references || []);
}

// ==================================================
// 参照情報の表示
// ==================================================

function displayReferences(references) {
  if (!elements.references || !elements.referencesList) {
    return;
  }

  elements.referencesList.replaceChildren();

  if (!Array.isArray(references) || references.length === 0) {
    elements.references.hidden = true;
    return;
  }

  references.forEach((reference) => {
    const item = document.createElement("li");

    const title =
      typeof reference.title === "string" ? reference.title : "参照資料";

    item.textContent = title;

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

  setCorgiState("apology");

  if (error.message === "API接続の設定がまだ完了していません。") {
    elements.answerBody.textContent =
      "現在、AI回答機能の接続準備を進めています。";
  }
}
