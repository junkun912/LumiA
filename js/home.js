/*
==================================================
LumiA
ファイル名：home.js

【ファイル概要】
LumiAホーム画面のJavaScript管理。

【主な役割】
・コーギくん共通管理機能との連携
・ホーム画面の初期表示
・質問フォームの初期化

==================================================
*/

"use strict";

import { initializeCorgi } from "./corgi.js";

import { initializeQuestionForm } from "./question.js";

// ==================================================
// 1. 初期化状態
// ==================================================

let isHomeInitialized = false;

// ==================================================
// 2. 質問フォーム初期化
// ==================================================

function initializeHomeQuestion() {
  try {
    initializeQuestionForm();
  } catch (error) {
    console.error(
      "LumiA: 質問フォームを初期化できませんでした。",
      error?.name || "QuestionFormError",
    );
  }
}

// ==================================================
// 3. コーギくん初期化
// ==================================================

function initializeHomeCorgi() {
  const corgiElement = document.querySelector(".home-intro__mascot");

  if (!corgiElement) {
    console.error("LumiA: コーギくんの表示領域が見つかりません。");

    return false;
  }

  try {
    // 初期表示
    initializeCorgi(corgiElement, "idea");

    return true;
  } catch (error) {
    console.error(
      "LumiA: コーギくんを初期化できませんでした。",
      error?.name || "CorgiError",
    );

    return false;
  }
}

// ==================================================
// 4. ホーム画面初期化
// ==================================================

function initializeHomePage() {
  // 二重初期化を防止
  if (isHomeInitialized) {
    return;
  }

  isHomeInitialized = true;

  // 質問フォームを初期化
  initializeHomeQuestion();

  // コーギくんを初期化
  initializeHomeCorgi();
}

// ==================================================
// 5. 初期化処理の実行
// ==================================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeHomePage, {
    once: true,
  });
} else {
  initializeHomePage();
}
