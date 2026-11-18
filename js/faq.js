/*
==================================================
LumiA
ファイル名：faq.js

【ファイル概要】
FAQ画面の質問検索・選択に関するJavaScript。

【主な役割】
・質問一覧の取得
・質問検索
・質問選択
・質問内容の保存
・回答画面への遷移
・共通エラーハンドラーとの連携

【関連ファイル】
・pages/faq.html
・pages/answer.html
・js/question.js
・js/answer.js
・js/error-handler.js

【エラー処理方針】
・質問内容の保存に失敗した場合は画面内に表示する。
・画面の初期化に失敗した場合は共通エラー画面へ遷移する。
・内部エラー情報を画面に表示しない。

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

const elements = {
  searchInput: document.querySelector("#faq-search-input"),
  faqItems: document.querySelectorAll(".faq-item"),
  categories: document.querySelectorAll(".faq-category"),
  emptyMessage: document.querySelector("#faq-empty"),
  errorContainer: document.querySelector("#faq-error-container"),
};

// ==================================================
// 3. 状態管理
// ==================================================

let isNavigating = false;

// ==================================================
// 4. 初期化
// ==================================================

document.addEventListener("DOMContentLoaded", initializeFaqPage);

function initializeFaqPage() {
  // 必要なHTML要素を確認
  if (
    !elements.searchInput ||
    elements.faqItems.length === 0 ||
    !elements.emptyMessage ||
    !elements.errorContainer
  ) {
    console.error("LumiA: FAQ画面に必要なHTML要素を初期化できません。");

    redirectToError("system");
    return;
  }

  setupEventListeners();
}

// ==================================================
// 5. 共通エラー画面への遷移
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
// 6. インラインエラー表示
// ==================================================

/**
 * FAQ画面内にエラーを表示する。
 *
 * 共通エラーハンドラーを優先して利用する。
 */
function showFaqError(message) {
  if (!elements.errorContainer) {
    return;
  }

  if (window.LumiAError?.clearInline && window.LumiAError?.showInline) {
    window.LumiAError.clearInline(elements.errorContainer);

    window.LumiAError.showInline(elements.errorContainer, message);

    return;
  }

  // 共通エラーハンドラーが利用できない場合
  const errorElement = document.createElement("div");

  errorElement.className = "lumia-inline-error";
  errorElement.setAttribute("role", "alert");
  errorElement.setAttribute("aria-live", "assertive");

  const messageElement = document.createElement("p");

  messageElement.className = "lumia-inline-error__message";
  messageElement.textContent = message;

  errorElement.appendChild(messageElement);

  elements.errorContainer.replaceChildren(errorElement);
}

/**
 * 表示中のエラーを削除する。
 */
function clearFaqError() {
  if (!elements.errorContainer) {
    return;
  }

  if (window.LumiAError?.clearInline) {
    window.LumiAError.clearInline(elements.errorContainer);
    return;
  }

  elements.errorContainer.replaceChildren();
}

// ==================================================
// 7. イベント設定
// ==================================================

function setupEventListeners() {
  // 質問検索
  elements.searchInput.addEventListener("input", handleSearch);

  // 質問選択
  elements.faqItems.forEach((item) => {
    item.addEventListener("click", handleQuestionSelect);
  });
}

// ==================================================
// 8. 質問検索
// ==================================================

function handleSearch() {
  const keyword = elements.searchInput.value.trim().toLowerCase();

  let visibleCount = 0;

  elements.faqItems.forEach((item) => {
    const question = item.textContent.trim().toLowerCase();

    const isMatch = question.includes(keyword);

    item.hidden = !isMatch;

    if (isMatch) {
      visibleCount++;
    }
  });

  // 質問が1件もない場合
  elements.emptyMessage.hidden = visibleCount !== 0;

  // 質問がないカテゴリーを非表示
  elements.categories.forEach((category) => {
    const visibleItems = category.querySelectorAll(".faq-item:not([hidden])");

    category.hidden = visibleItems.length === 0;
  });
}

// ==================================================
// 9. 質問選択
// ==================================================

function handleQuestionSelect(event) {
  event.preventDefault();

  // 二重操作を防止
  if (isNavigating) {
    return;
  }

  const button = event.currentTarget;
  const question = button.dataset.question;

  clearFaqError();

  // ----------------------------------------------
  // 質問内容の確認
  // ----------------------------------------------

  if (typeof question !== "string" || !question.trim()) {
    showFaqError(
      "質問内容を取得できませんでした。別の質問を選択してください。",
    );

    return;
  }

  // ----------------------------------------------
  // 画面遷移の準備
  // ----------------------------------------------

  isNavigating = true;
  button.disabled = true;

  try {
    // 質問内容を保存
    sessionStorage.setItem(STORAGE_KEY, question.trim());

    // 保存成功後に回答画面へ移動
    window.location.href = ANSWER_PAGE_URL;
  } catch (error) {
    console.error(
      "LumiA: 質問内容を保存できませんでした。",
      error?.name || "StorageError",
    );

    // 遷移状態を解除
    isNavigating = false;
    button.disabled = false;

    // 画面内にエラーを表示
    showFaqError(
      "質問を保存できませんでした。ブラウザの設定やストレージの状態を確認して、もう一度お試しください。",
    );
  }
}
