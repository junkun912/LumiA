/**
 * LumiA - Home
 * ----------------------------------------
 * ホーム画面の操作・演出を担当
 *
 * 【役割】
 * ・ページ表示時の演出
 * ・質問入力の状態管理
 * ・質問内容の簡易チェック
 * ・個人情報らしき入力のチェック
 * ・質問送信時のUI制御
 *
 * AWS / API処理は api.js に分離する。
 */

"use strict";

/* ========================================
   Home 初期化
======================================== */

document.addEventListener("DOMContentLoaded", () => {
  initHome();
});

function initHome() {
  const form = document.getElementById("question-form");
  const input = document.getElementById("question-input");
  const button = document.getElementById("question-submit");

  if (!form || !input || !button) {
    console.warn("LumiA: ホーム画面の必要な要素が見つかりません。");
    return;
  }

  setupPageEntrance();
  setupQuestionInput(input);
  setupQuestionForm(form, input, button);
}

/* ========================================
   ページ表示アニメーション
======================================== */

function setupPageEntrance() {
  /*
   * ユーザーが「視差効果を減らす」を
   * 設定している場合は無理に動かさない。
   */

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (reducedMotion) {
    document.body.classList.add("motion-reduced");
    return;
  }

  /*
   * ブラウザが描画してから
   * is-readyを付けることで自然に表示する。
   */

  requestAnimationFrame(() => {
    document.body.classList.add("is-ready");
  });
}

/* ========================================
   質問入力
======================================== */

function setupQuestionInput(input) {
  /*
   * 入力中
   */

  input.addEventListener("input", () => {
    /*
     * 一度エラーを表示したあと、
     * 入力し直したらエラー表示を消す。
     */

    input.classList.remove("is-error");

    removeQuestionStatus();
  });

  /*
   * フォーカス時
   */

  input.addEventListener("focus", () => {
    const questionArea = input.closest(".question-area");

    questionArea?.classList.add("is-focus");
  });

  /*
   * フォーカスが外れたとき
   */

  input.addEventListener("blur", () => {
    const questionArea = input.closest(".question-area");

    questionArea?.classList.remove("is-focus");
  });

  /*
   * Enterで送信
   *
   * Shift + Enterは改行。
   */

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      /*
       * ボタンのclickではなく、
       * フォームのsubmitを発生させる。
       */

      input.closest("form")?.requestSubmit();
    }
  });
}

/* ========================================
   質問フォーム
======================================== */

function setupQuestionForm(form, input, button) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    /*
     * 送信中なら二重送信しない。
     */

    if (button.classList.contains("is-loading")) {
      return;
    }

    /*
     * 入力内容を取得
     */

    const question = input.value.trim();

    /* --------------------------------
       空欄チェック
    -------------------------------- */

    if (!question) {
      showQuestionError(input, "質問を入力してみてください。");

      return;
    }

    /* --------------------------------
       個人情報チェック
    -------------------------------- */

    if (containsPersonalInformation(question)) {
      showQuestionError(
        input,
        "個人情報を含む質問は送信できません。内容を変えてもう一度試してください。",
      );

      return;
    }

    /* --------------------------------
       送信開始
    -------------------------------- */

    setSubmittingState(button, input, true);

    try {
      /*
       * --------------------------------
       * 現在はAPI未接続
       * --------------------------------
       *
       * 質問内容だけ保存して、
       * 回答画面へ進む。
       *
       * AWS / Bedrock / API処理は
       * 後から api.js に実装する。
       */

      sessionStorage.setItem("lumia_question", question);

      /*
       * 現段階では、
       * UIの送信演出を確認するため
       * 少しだけ待つ。
       */

      await wait(350);

      /*
       * 回答画面へ
       */

      window.location.href = "answer.html";
    } catch (error) {
      console.error("LumiA: 質問送信中にエラーが発生しました。", error);

      /*
       * 送信状態を元に戻す。
       */

      setSubmittingState(button, input, false);

      showQuestionError(
        input,
        "うまく処理できませんでした。もう一度試してください。",
      );
    }
  });
}

/* ========================================
   個人情報チェック
======================================== */

function containsPersonalInformation(text) {
  const patterns = [
    /*
     * メールアドレス
     */

    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,

    /*
     * 電話番号
     *
     * 例：
     * 090-1234-5678
     * 09012345678
     * 059-123-4567
     */

    /0\d{1,4}[-ー－]?\d{2,4}[-ー－]?\d{3,4}/,

    /*
     * 郵便番号
     *
     * 例：
     * 〒514-0000
     * 514-0000
     */

    /〒?\d{3}[-ー－]?\d{4}/,

    /*
     * クレジットカード番号などを想定した
     * 非常に長い数字。
     */

    /\d{13,19}/,
  ];

  return patterns.some((pattern) => pattern.test(text));
}

/* ========================================
   エラー表示
======================================== */

function showQuestionError(input, message) {
  /*
   * 入力欄をエラー状態にする。
   */

  input.classList.remove("is-error");

  /*
   * 再描画後にアニメーションを
   * もう一度発生させる。
   */

  void input.offsetWidth;

  input.classList.add("is-error");

  /*
   * 既存メッセージを削除
   */

  removeQuestionStatus();

  /*
   * エラーメッセージ作成
   */

  const status = document.createElement("p");

  status.className = "question-status question-status--error";

  status.setAttribute("role", "alert");

  status.textContent = message;

  /*
   * フォーム内の適切な位置に表示する。
   *
   * 「Enterでは送信されません」の
   * question-form-bottom より前に配置することで、
   * エラー表示が下部説明と重ならないようにする。
   */

  const form = input.closest(".question-form");

  const formBottom = form?.querySelector(".question-form-bottom");

  if (form) {
    if (formBottom) {
      /*
       * textarea
       * ↓
       * エラーメッセージ
       * ↓
       * フォーム下部
       *
       * という自然な順番にする。
       */

      form.insertBefore(status, formBottom);
    } else {
      /*
       * 万が一 question-form-bottom が
       * 見つからない場合はフォーム末尾へ。
       */

      form.appendChild(status);
    }
  }

  /*
   * 入力欄へ戻す。
   */

  input.focus();
}

/* ========================================
   エラーメッセージ削除
======================================== */

function removeQuestionStatus() {
  const status = document.querySelector(".question-status");

  if (status) {
    status.remove();
  }
}

/* ========================================
   送信中UI
======================================== */

function setSubmittingState(button, input, isSubmitting) {
  /*
   * 元のHTMLを一度だけ保存。
   *
   * textContentではなくinnerHTMLを保存することで、
   * ボタン内の矢印なども元に戻せる。
   */

  if (!button.dataset.originalHtml) {
    button.dataset.originalHtml = button.innerHTML;
  }

  if (isSubmitting) {
    /*
     * 送信中
     */

    button.classList.add("is-loading");

    button.setAttribute("aria-busy", "true");

    button.disabled = true;

    input.disabled = true;

    /*
     * ボタン表示
     */

    button.textContent = "考えています…";
  } else {
    /*
     * 通常状態へ戻す。
     */

    button.classList.remove("is-loading");

    button.removeAttribute("aria-busy");

    button.disabled = false;

    input.disabled = false;

    /*
     * 元のボタン表示へ戻す。
     */

    button.innerHTML = button.dataset.originalHtml;
  }
}

/* ========================================
   待機
======================================== */

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
