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

【関連ファイル】
・pages/faq.html
・pages/answer.html
・js/question.js
・js/answer.js
==================================================
*/

"use strict";

// ==================================================
// 設定
// ==================================================

const STORAGE_KEY = "lumia_current_question";
const ANSWER_PAGE_URL = "./answer.html";

// ==================================================
// DOM要素
// ==================================================

const elements = {
  searchInput: document.querySelector("#faq-search-input"),
  faqItems: document.querySelectorAll(".faq-item"),
  categories: document.querySelectorAll(".faq-category"),
  emptyMessage: document.querySelector("#faq-empty"),
};

// ==================================================
// 初期化
// ==================================================

document.addEventListener("DOMContentLoaded", initializeFaqPage);

function initializeFaqPage() {
  if (
    !elements.searchInput ||
    !elements.faqItems.length ||
    !elements.emptyMessage
  ) {
    console.error("LumiA: FAQ画面に必要なHTML要素が見つかりません。");
    return;
  }

  setupEventListeners();
}

// ==================================================
// イベント設定
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
// 質問検索
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
// 質問選択
// ==================================================

function handleQuestionSelect(event) {
  const button = event.currentTarget;

  const question = button.dataset.question;

  if (!question || !question.trim()) {
    console.error("LumiA: 選択された質問が正しくありません。");
    return;
  }

  // 二重操作を防止
  button.disabled = true;

  try {
    // 質問内容を保存
    sessionStorage.setItem(STORAGE_KEY, question.trim());

    // 回答画面へ移動
    window.location.href = ANSWER_PAGE_URL;
  } catch (error) {
    console.error("LumiA: 質問内容を保存できませんでした。", error);

    button.disabled = false;

    alert("質問を送信できませんでした。もう一度お試しください。");
  }
}
