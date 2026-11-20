/*
==================================================
LumiA
ファイル名：answer.js
バージョン：v2.2

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
・未回答専用メッセージの表示
・質問履歴画面への遷移

【回答状態】
LOADING    ：資料を確認中
SUCCESS    ：回答できた
UNANSWERED ：公開資料から回答を確認できなかった
ERROR      ：通信・システムなどのエラー

==================================================
*/

"use strict";

import { initializeCorgi, setCorgiState } from "./corgi.js";
import { sendGuestQuestion, ApiError } from "./api.js";

// ==================================================
// 1. 設定
// ==================================================

const STORAGE_KEY = "lumia_current_question";

const ANSWER_PAGE_URL = "./answer.html";
const HOME_PAGE_URL = "./home.html";
const HISTORY_PAGE_URL = "./history.html";
const ERROR_PAGE_URL = "./error.html";

// 回答状態
const ANSWER_STATE = Object.freeze({
  LOADING: "loading",
  SUCCESS: "success",
  UNANSWERED: "unanswered",
  ERROR: "error",
});

// APIの未回答メッセージ
const UNANSWERED_MESSAGES = ["公開資料から確認できませんでした。"];

// 絵本風エラー表示の共通設定
// 通信・システムエラー専用
const STORYBOOK_ERROR_OPTIONS = Object.freeze({
  description:
    "ごめんなさい。今は学校の資料をうまく確認できなかったようです。質問はちゃんと残っています。通信やシステムが落ち着いたら、もう一度答えを探してみますね。",
  retryLabel: "もう一度、答えを探す",
  note: "入力した質問は保持されています。",
  variant: "storybook",
});

// ==================================================
// 2. DOM要素
// ==================================================

const elements = {
  question: null,
  answerBody: null,
  references: null,
  referencesList: null,

  questionForm: null,
  questionInput: null,
  questionModeLabel: null,
  submitButton: null,

  homeButton: null,
  historyButton: null,

  corgi: null,
};

// ==================================================
// 3. 状態管理
// ==================================================

let isGenerating = false;
let isAnswerPageInitialized = false;

// ==================================================
// 4. 初期化
// ==================================================

function initializeAnswerPage() {
  // 二重初期化を防止
  if (isAnswerPageInitialized) {
    return;
  }

  // DOM要素を取得
  elements.question = document.querySelector("#answer-question");
  elements.answerBody = document.querySelector("#answer-body");
  elements.references = document.querySelector("#answer-references");
  elements.referencesList = document.querySelector("#answer-references-list");

  elements.questionForm = document.querySelector("#answer-question-form");
  elements.questionInput = document.querySelector("#answer-question-input");
  elements.questionModeLabel = document.querySelector("#question-mode-label");

  elements.submitButton = document.querySelector(
    "#answer-question-form button[type='submit']",
  );

  elements.homeButton = document.querySelector("#home-button");
  elements.historyButton = document.querySelector("#history-button");

  elements.corgi = document.querySelector(".answer-book__mascot");

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

  // 初期化済みにする
  isAnswerPageInitialized = true;

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
      window.location.href = HOME_PAGE_URL;
    });
  }

  // 質問履歴へ移動
  if (elements.historyButton) {
    elements.historyButton.addEventListener("click", () => {
      window.location.href = HISTORY_PAGE_URL;
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
    showInlineError(
      "質問を保存できませんでした。もう一度お試しください。",
      null,
      {
        title: "質問を保存できませんでした",
        description:
          "入力した質問を保存できなかったため、もう一度入力内容をご確認ください。",
        retryLabel: "もう一度試す",
        note: "入力欄の内容はそのまま残しています。",
      },
    );

    return;
  }

  // 質問内容を表示
  displayQuestion(question);

  // 回答生成
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

    // 未回答かどうかを判定
    if (isUnansweredResult(result)) {
      displayUnansweredMessage();

      setAnswerState(ANSWER_STATE.UNANSWERED);

      // 未回答の場合は入力内容を保持
      return false;
    }

    // 通常の回答内容を表示
    displayAnswer(result);

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
// 14. 未回答専用メッセージ
// ==================================================

function displayUnansweredMessage() {
  // 回答欄をクリア
  elements.answerBody.replaceChildren();

  // 未回答専用エリア
  const container = document.createElement("section");

  container.className = "lumia-unanswered";
  container.setAttribute("role", "status");
  container.setAttribute("aria-live", "polite");

  // ----------------------------------------------
  // メインメッセージ
  // ----------------------------------------------

  const title = document.createElement("h3");

  title.className = "lumia-unanswered__title";
  title.textContent = "今回は答えが見つからなかったよ。";

  container.appendChild(title);

  // ----------------------------------------------
  // 説明文
  // ----------------------------------------------

  const description = document.createElement("p");

  description.className = "lumia-unanswered__description";

  // 前半部分
  description.append(
    document.createTextNode(
      "ごめんなさい。今公開されている学校資料からは、答えを見つける",
    ),
  );

  // 意味のつながる語句をひとまとまりにする
  const keepTogether = document.createElement("span");

  keepTogether.className = "lumia-no-break";
  keepTogether.textContent = "ことが";

  description.appendChild(keepTogether);

  // 後半部分
  description.append(document.createTextNode("できませんでした。"));

  container.appendChild(description);

  // ----------------------------------------------
  // 次の行動への案内
  // ----------------------------------------------

  const guide = document.createElement("div");

  guide.className = "lumia-unanswered__guide";

  const guideTitle = document.createElement("p");

  guideTitle.className = "lumia-unanswered__guide-title";

  guideTitle.textContent = "質問を少し変えてみると、見つかるかもしれません。";

  guide.appendChild(guideTitle);

  const guideDescription = document.createElement("p");

  guideDescription.className = "lumia-unanswered__guide-description";

  guideDescription.textContent =
    "言葉を変えたり、もう少し詳しく聞いてみたりしてね。";

  guide.appendChild(guideDescription);

  container.appendChild(guide);

  // ----------------------------------------------
  // 補足
  // ----------------------------------------------

  const note = document.createElement("p");

  note.className = "lumia-unanswered__note";
  note.textContent = "入力した質問は残っています。";

  container.appendChild(note);

  // 回答欄に追加
  elements.answerBody.appendChild(container);
}

// ==================================================
// 15. コーギくんの状態切り替え
// ==================================================

function updateCorgiState(state) {
  try {
    setCorgiState(state);
  } catch (error) {
    // コーギくんの表示エラーで回答処理を止めない
    console.error(
      "LumiA: コーギくんの状態を変更できませんでした。",
      error?.name || "CorgiError",
    );
  }
}

// ==================================================
// 16. 回答状態の切り替え
// ==================================================

function setAnswerState(state) {
  document.body.dataset.answerState = state;

  switch (state) {
    // ----------------------------------------------
    // 資料を確認中
    // ----------------------------------------------

    case ANSWER_STATE.LOADING:
      updateCorgiState("reading");

      if (elements.questionModeLabel) {
        elements.questionModeLabel.textContent =
          "学校の資料を確認しています...";
      }

      break;

    // ----------------------------------------------
    // 回答成功
    // ----------------------------------------------

    case ANSWER_STATE.SUCCESS:
      updateCorgiState("explaining");

      if (elements.questionModeLabel) {
        elements.questionModeLabel.textContent = "ほかの質問はありますか？";
      }

      break;

    // ----------------------------------------------
    // 公開資料から回答を確認できなかった
    // ----------------------------------------------

    case ANSWER_STATE.UNANSWERED:
      updateCorgiState("apology");

      if (elements.questionModeLabel) {
        elements.questionModeLabel.textContent = "別の質問も試してみてね。";
      }

      break;

    // ----------------------------------------------
    // 通信・システムなどのエラー
    // ----------------------------------------------

    case ANSWER_STATE.ERROR:
      updateCorgiState("apology");

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
// 17. 調べ中の表示
// ==================================================

function setLoadingState() {
  setAnswerState(ANSWER_STATE.LOADING);

  elements.answerBody.textContent =
    "学校の資料を確認し、回答を準備しています。";

  setQuestionFormDisabled(true);
}

// ==================================================
// 18. 質問フォームの有効・無効
// ==================================================

function setQuestionFormDisabled(disabled) {
  if (elements.questionInput) {
    elements.questionInput.disabled = disabled;
  }

  if (elements.submitButton) {
    elements.submitButton.disabled = disabled;
  }
}

// ==================================================
// 19. 前の回答・参考資料をクリア
// ==================================================

function clearPreviousAnswer() {
  elements.answerBody.replaceChildren();

  // 既存のインラインエラーも削除
  if (window.LumiAError?.clearInline) {
    window.LumiAError.clearInline(elements.answerBody);
  }

  if (elements.referencesList) {
    elements.referencesList.replaceChildren();
  }

  if (elements.references) {
    elements.references.hidden = true;
  }
}

// ==================================================
// 20. API接続処理
// ==================================================

async function requestAnswer(question) {
  // ゲスト向け質問APIへ送信
  return sendGuestQuestion(question);
}

// ==================================================
// 21. AI回答の表示
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
// 22. 参照情報の表示
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
// 23. エラーの種類に応じた処理
// ==================================================

function showAnswerError(error, retryCallback, question) {
  // 参考資料を非表示
  if (elements.references) {
    elements.references.hidden = true;
  }

  if (elements.referencesList) {
    elements.referencesList.replaceChildren();
  }

  // エラー状態へ切り替え
  setAnswerState(ANSWER_STATE.ERROR);

  const errorCode = error?.code || "UNKNOWN";

  // ----------------------------------------------
  // 認証エラー
  // ----------------------------------------------

  if (errorCode === "AUTH_REQUIRED") {
    preserveQuestion(question);

    if (window.LumiAError?.redirect) {
      window.LumiAError.redirect("auth");
      return;
    }

    showInlineError(
      "ログインが必要です。ログイン画面から認証してください。",
      null,
      {
        title: "ログインが必要です",
        description: "ログイン後、もう一度質問をお試しください。",
        note: "入力した質問は保持されています。",
      },
    );

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
    showInlineError("この操作を行う権限がありません。", null, {
      title: "アクセスできませんでした",
      description:
        "この操作を行う権限がないようです。必要に応じて管理者にお問い合わせください。",
      note: "入力した質問は保持されています。",
    });

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

  if (
    errorCode === "NETWORK" ||
    errorCode === "TIMEOUT" ||
    errorCode === "SERVER"
  ) {
    showInlineError(
      "少し時間をおいて、もう一度。",
      retryCallback,
      STORYBOOK_ERROR_OPTIONS,
    );

    return;
  }

  // ----------------------------------------------
  // データエラー
  // ----------------------------------------------

  if (errorCode === "DATA") {
    showInlineError("回答をうまく準備できませんでした。", retryCallback, {
      ...STORYBOOK_ERROR_OPTIONS,
      description:
        "回答データを正しく処理できなかったようです。質問内容は残っていますので、もう一度答えを探してみましょう。",
    });

    return;
  }

  // ----------------------------------------------
  // その他のエラー
  // ----------------------------------------------

  showInlineError(
    "少し時間をおいて、もう一度。",
    retryCallback,
    STORYBOOK_ERROR_OPTIONS,
  );
}

// ==================================================
// 24. 共通エラー画面への遷移
// ==================================================

function redirectToError(type) {
  if (window.LumiAError?.redirect) {
    window.LumiAError.redirect(type);
    return;
  }

  // 共通エラーハンドラーが利用できない場合
  window.location.href = ERROR_PAGE_URL;
}

// ==================================================
// 25. 共通インラインエラー表示
// ==================================================

function showInlineError(message, retryCallback = null, options = {}) {
  /*
   * 重要：
   * 調べ中の表示や古い回答を残さない。
   * エラー表示を行う前に回答欄を一度空にする。
   */

  elements.answerBody.replaceChildren();

  // 共通エラーハンドラーを利用
  if (window.LumiAError?.showInline) {
    window.LumiAError.showInline(
      elements.answerBody,
      message,
      retryCallback,
      options,
    );

    return;
  }

  // ----------------------------------------------
  // 共通エラーハンドラーが利用できない場合
  // ----------------------------------------------

  const errorContainer = document.createElement("section");

  const isStorybook = options.variant === "storybook";

  errorContainer.className = isStorybook
    ? "lumia-inline-error lumia-inline-error--storybook"
    : "lumia-inline-error";

  errorContainer.setAttribute("role", "alert");
  errorContainer.setAttribute("aria-live", "assertive");

  // タイトル
  // Storybook形式ではタイトルを表示しない
  if (!isStorybook && options.title) {
    const titleElement = document.createElement("h3");

    titleElement.className = "lumia-inline-error__title";

    titleElement.textContent = options.title;

    errorContainer.appendChild(titleElement);
  }

  // メッセージ
  const messageElement = document.createElement("p");

  messageElement.className = "lumia-inline-error__message";

  messageElement.textContent = message;

  errorContainer.appendChild(messageElement);

  // 説明文
  if (options.description) {
    const descriptionElement = document.createElement("p");

    descriptionElement.className = "lumia-inline-error__description";

    descriptionElement.textContent = options.description;

    errorContainer.appendChild(descriptionElement);
  }

  // 再試行ボタン
  if (typeof retryCallback === "function") {
    const retryButton = document.createElement("button");

    retryButton.type = "button";
    retryButton.className = "lumia-inline-error__retry";

    retryButton.textContent = options.retryLabel || "もう一度試す";

    retryButton.addEventListener("click", async () => {
      if (retryButton.disabled) {
        return;
      }

      retryButton.disabled = true;

      retryButton.setAttribute("aria-busy", "true");

      try {
        await retryCallback();
      } catch (error) {
        // 再試行処理側でエラー表示を管理する
      } finally {
        if (retryButton.isConnected) {
          retryButton.disabled = false;
          retryButton.removeAttribute("aria-busy");
        }
      }
    });

    errorContainer.appendChild(retryButton);
  }

  // 注意書き
  if (options.note) {
    const noteElement = document.createElement("p");

    noteElement.className = "lumia-inline-error__note";

    noteElement.textContent = options.note;

    errorContainer.appendChild(noteElement);
  }

  elements.answerBody.appendChild(errorContainer);
}

// ==================================================
// 26. 初期化処理の実行
// ==================================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeAnswerPage, {
    once: true,
  });
} else {
  initializeAnswerPage();
}
