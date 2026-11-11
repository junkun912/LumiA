/*
==================================================
LumiA
ファイル名：home.js

【ファイル概要】
LumiAホーム画面のJavaScript管理。

【主な役割】
・コーギくん共通管理機能との連携
・ホーム画面の初期表示
・コーギくん切り替えテスト

==================================================
*/

"use strict";

import { initializeCorgi, setCorgiState } from "./corgi.js";
import { initializeQuestionForm } from "./question.js";

// ==================================================
// キャラクター一覧
// ==================================================

const CORGI_TEST_STATES = [
  { state: "basic", label: "通常" },
  { state: "welcome", label: "歓迎" },
  { state: "idea", label: "ひらめき" },
  { state: "thinking", label: "考え中" },
  { state: "studying", label: "学習" },
  { state: "reading", label: "読書" },
  { state: "explaining", label: "説明" },
  { state: "cheer", label: "応援" },
  { state: "surprised", label: "驚き" },
  { state: "apology", label: "お詫び" },
  { state: "thanks", label: "感謝" },
  { state: "rest", label: "休憩" },
];

// ==================================================
// コーギくんテストパネル
// ==================================================

function createCorgiTestPanel() {
  const panel = document.createElement("div");

  panel.setAttribute("aria-label", "コーギくん切り替えテスト");

  Object.assign(panel.style, {
    position: "fixed",
    top: "12px",
    right: "12px",
    zIndex: "9999",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "6px",
    maxWidth: "420px",
    padding: "10px",
    background: "rgba(255, 255, 255, 0.96)",
    border: "1px solid #d9c5a6",
    borderRadius: "12px",
    boxShadow: "0 3px 12px rgba(0, 0, 0, 0.12)",
  });

  const heading = document.createElement("span");

  heading.textContent = "コーギくんテスト";

  Object.assign(heading.style, {
    width: "100%",
    color: "#173f5f",
    fontSize: "12px",
    fontWeight: "700",
  });

  panel.appendChild(heading);

  CORGI_TEST_STATES.forEach(({ state, label }) => {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;

    Object.assign(button.style, {
      padding: "6px 9px",
      color: "#173f5f",
      background: "#fffaf2",
      border: "1px solid #d9c5a6",
      borderRadius: "6px",
      fontSize: "12px",
      cursor: "pointer",
    });

    button.addEventListener("click", () => {
      setCorgiState(state);
    });

    panel.appendChild(button);
  });

  document.body.appendChild(panel);
}

// ==================================================
// ホーム画面初期化
// ==================================================

document.addEventListener("DOMContentLoaded", () => {
  initializeQuestionForm();
  const corgiElement = document.querySelector(".home-intro__mascot");

  if (!corgiElement) {
    console.error("LumiA: コーギくんの表示領域が見つかりません。");

    return;
  }

  // 初期表示
  initializeCorgi(corgiElement, "idea");

  // テスト用URLの場合だけテストパネルを表示
  const params = new URLSearchParams(window.location.search);

  if (params.get("corgi-test") === "1") {
    createCorgiTestPanel();
  }
});
