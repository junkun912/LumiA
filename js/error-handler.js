/**
 * LumiA Error Handler
 *
 * エラー表示・エラー画面への遷移を共通管理する。
 *
 * 主な機能
 * - エラー画面へのリダイレクト
 * - インラインエラー表示
 * - 再試行ボタン
 * - 絵本の世界観に合わせたエラー表示
 * - 既存エラー表示の削除
 */

(() => {
  "use strict";

  // ==================================================
  // 1. 基本設定
  // ==================================================

  const ERROR_STORAGE_KEY = "lumia_error_state";
  const ERROR_PAGE_URL = "./error.html";

  const ALLOWED_ERROR_TYPES = Object.freeze([
    "auth",
    "system",
    "not-found",
    "network",
    "permission",
    "data",
  ]);

  const DEFAULT_ERROR_MESSAGE = "エラーが発生しました。";
  const DEFAULT_RETRY_LABEL = "もう一度試す";

  // ==================================================
  // 2. 共通ユーティリティ
  // ==================================================

  /**
   * 表示先の要素を取得する
   *
   * @param {HTMLElement|string} target
   * @returns {HTMLElement|null}
   */
  function resolveTarget(target) {
    if (typeof target === "string") {
      try {
        return document.querySelector(target);
      } catch (error) {
        return null;
      }
    }

    if (
      target &&
      target.nodeType === Node.ELEMENT_NODE &&
      typeof target.appendChild === "function"
    ) {
      return target;
    }

    return null;
  }

  /**
   * 文字列を安全に取得する
   *
   * @param {*} value
   * @param {string} fallback
   * @returns {string}
   */
  function getSafeText(value, fallback = "") {
    if (typeof value !== "string") {
      return fallback;
    }

    return value.trim() || fallback;
  }

  /**
   * 再試行先URLを同一オリジンに制限する
   *
   * @param {string|null} retryUrl
   * @returns {string|null}
   */
  function normalizeRetryUrl(retryUrl) {
    if (typeof retryUrl !== "string" || !retryUrl.trim()) {
      return null;
    }

    try {
      const url = new URL(retryUrl, window.location.href);

      if (url.origin !== window.location.origin) {
        return null;
      }

      return url.href;
    } catch (error) {
      return null;
    }
  }

  // ==================================================
  // 3. エラー画面への遷移
  // ==================================================

  /**
   * エラー画面へ遷移する
   *
   * @param {string} type エラー種別
   * @param {string|null} retryUrl 再試行先URL
   */
  function redirect(type, retryUrl = null) {
    const errorType = ALLOWED_ERROR_TYPES.includes(type) ? type : "system";

    const errorState = {
      type: errorType,
      retryUrl: normalizeRetryUrl(retryUrl),
      timestamp: Date.now(),
    };

    // エラー情報の保存
    try {
      sessionStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(errorState));
    } catch (error) {
      // 保存に失敗しても画面遷移は継続する
    }

    // エラー画面へ遷移
    window.location.href = ERROR_PAGE_URL;
  }

  // ==================================================
  // 4. インラインエラー表示
  // ==================================================

  /**
   * インラインエラーを表示する
   *
   * 従来の呼び出し方にも対応する。
   *
   * LumiAError.showInline(
   *   target,
   *   "エラーメッセージ",
   *   retryCallback
   * );
   *
   * 絵本風表示の場合は第4引数にオプションを指定する。
   *
   * @param {HTMLElement|string} target 表示先
   * @param {string} message エラーメッセージ
   * @param {Function|null} retryCallback 再試行処理
   * @param {Object} options 表示オプション
   * @returns {HTMLElement|null}
   */
  function showInline(target, message, retryCallback = null, options = {}) {
    const targetElement = resolveTarget(target);

    if (!targetElement) {
      return null;
    }

    // 既存のエラー表示を削除
    clearInline(targetElement);

    // オプションの型を確認
    const settings =
      options && typeof options === "object" && !Array.isArray(options)
        ? options
        : {};

    const title = getSafeText(settings.title);
    const description = getSafeText(settings.description);
    const retryLabel = getSafeText(settings.retryLabel, DEFAULT_RETRY_LABEL);
    const note = getSafeText(settings.note);
    const variant = getSafeText(settings.variant, "default");

    const isStorybook = variant === "storybook";

    // --------------------------------------------------
    // 4-1. エラー表示コンテナ
    // --------------------------------------------------

    const container = document.createElement(isStorybook ? "section" : "div");

    container.className = isStorybook
      ? "lumia-inline-error lumia-inline-error--storybook"
      : "lumia-inline-error";

    container.setAttribute("role", "alert");
    container.setAttribute("aria-live", "assertive");

    // --------------------------------------------------
    // 4-2. タイトル
    // --------------------------------------------------

    /*
     * 絵本風エラー表示ではタイトルを生成しない。
     *
     * 回答画面には既に
     * 「LumiAからの答え」
     * というページ見出しがあるため、
     * カード内でタイトルを重複させない。
     *
     * 通常のエラー表示ではタイトルを表示する。
     */

    if (title && !isStorybook) {
      const titleElement = document.createElement("h3");

      titleElement.className = "lumia-inline-error__title";
      titleElement.textContent = title;

      container.appendChild(titleElement);
    }

    // --------------------------------------------------
    // 4-3. メインメッセージ
    // --------------------------------------------------

    const messageElement = document.createElement("p");

    messageElement.className = "lumia-inline-error__message";
    messageElement.textContent = getSafeText(message, DEFAULT_ERROR_MESSAGE);

    container.appendChild(messageElement);

    // --------------------------------------------------
    // 4-4. 補足説明
    // --------------------------------------------------

    if (description) {
      const descriptionElement = document.createElement("p");

      descriptionElement.className = "lumia-inline-error__description";

      descriptionElement.textContent = description;

      container.appendChild(descriptionElement);
    }

    // --------------------------------------------------
    // 4-5. 再試行ボタン
    // --------------------------------------------------

    if (typeof retryCallback === "function") {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "lumia-inline-error__retry";
      button.textContent = retryLabel;

      button.addEventListener("click", async () => {
        if (button.disabled) {
          return;
        }

        // 二重実行を防止
        button.disabled = true;
        button.setAttribute("aria-busy", "true");

        try {
          await retryCallback();
        } catch (error) {
          /*
           * 再試行処理側でエラー表示を管理する。
           * 詳細情報は画面に直接出力しない。
           */
        } finally {
          /*
           * 再試行中にエラー要素が削除されていた場合は
           * ボタンの状態を変更しない。
           */

          if (button.isConnected) {
            button.disabled = false;
            button.removeAttribute("aria-busy");
          }
        }
      });

      container.appendChild(button);
    }

    // --------------------------------------------------
    // 4-6. 注意書き
    // --------------------------------------------------

    if (note) {
      const noteElement = document.createElement("p");

      noteElement.className = "lumia-inline-error__note";
      noteElement.textContent = note;

      container.appendChild(noteElement);
    }

    // --------------------------------------------------
    // 4-7. 画面への追加
    // --------------------------------------------------

    targetElement.appendChild(container);

    return container;
  }

  // ==================================================
  // 5. インラインエラーの削除
  // ==================================================

  /**
   * 指定した要素内のインラインエラーを削除する
   *
   * @param {HTMLElement|string} target 対象要素
   */
  function clearInline(target) {
    const targetElement = resolveTarget(target);

    if (!targetElement) {
      return;
    }

    const errorElements = targetElement.querySelectorAll(".lumia-inline-error");

    errorElements.forEach((element) => {
      element.remove();
    });
  }

  // ==================================================
  // 6. 共通エラーハンドラーを公開
  // ==================================================

  window.LumiAError = Object.freeze({
    redirect,
    showInline,
    clearInline,
  });
})();
