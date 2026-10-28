/*
==================================================
LumiA
ファイル名：login.js

【役割】
・パスワードの表示切り替え
・ログインフォームの入力確認
・ページめくり演出
・ゲスト利用時の画面遷移
・認証処理との連携準備

【重要】
現時点では認証機能は未接続。
認証成功を確認する前にログイン演出を開始しない。
==================================================
*/

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("toggle-password");
  const loginMessage = document.getElementById("login-status");
  const guestLink = document.querySelector(".login-form__guest");
  const loginScreen = document.querySelector(".login-screen");
  const loginButton = loginForm?.querySelector(
    '.login-form__submit[type="submit"]',
  );

  if (!loginScreen) {
    console.error("LumiA: ログイン画面が見つかりません。");
    return;
  }

  // ==================================================
  // ページめくり演出
  // ==================================================

  let isTransitioning = false;

  /**
   * ページめくり演出後に指定先へ移動する。
   * 認証成功後、またはゲスト利用時に使用する。
   */

  function startPageTurn(destination) {
    if (isTransitioning || !destination) {
      return;
    }

    const pageSheet = loginScreen.querySelector(".page-turn__sheet");

    // アニメーション用の要素がなければ通常遷移
    if (!pageSheet) {
      window.location.href = destination;
      return;
    }

    isTransitioning = true;

    if (loginButton) {
      loginButton.disabled = true;
    }

    if (guestLink) {
      guestLink.setAttribute("aria-disabled", "true");
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion) {
      window.location.href = destination;
      return;
    }

    // 古いアニメーション状態をリセット
    loginScreen.classList.remove("is-page-turning");

    // CSSの再計算後にアニメーションを開始
    void pageSheet.offsetWidth;

    const handleAnimationEnd = (event) => {
      if (
        event.target !== pageSheet ||
        event.animationName !== "lumi-page-turn"
      ) {
        return;
      }

      pageSheet.removeEventListener("animationend", handleAnimationEnd);
      window.location.href = destination;
    };

    pageSheet.addEventListener("animationend", handleAnimationEnd);

    loginScreen.classList.add("is-page-turning");
  }

  // 認証処理から呼び出せるように公開する。
  // 認証成功が確認できた後にだけ使用すること。
  window.LumiAStartPageTurn = startPageTurn;

  // ==================================================
  // パスワード表示・非表示
  // ==================================================

  if (passwordInput && passwordToggle) {
    passwordToggle.addEventListener("click", () => {
      const isVisible = passwordInput.type === "text";

      passwordInput.type = isVisible ? "password" : "text";

      passwordToggle.setAttribute("aria-pressed", String(!isVisible));

      passwordToggle.setAttribute(
        "aria-label",
        isVisible ? "パスワードを表示" : "パスワードを隠す",
      );
    });
  }

  // ==================================================
  // ログインフォーム
  // ==================================================

  if (loginForm && loginMessage) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (isTransitioning) {
        return;
      }

      loginMessage.textContent = "";
      loginMessage.classList.remove("is-success");

      const formData = new FormData(loginForm);
      const username = String(formData.get("username") || "").trim();
      const password = String(formData.get("password") || "");

      if (!username || !password) {
        loginMessage.textContent = "ユーザー名とパスワードを入力してください。";
        return;
      }

      /*
       * TODO: Amazon Cognitoなどの認証処理を接続する。
       *
       * 認証に成功した場合のみ、
       * 次の関数を呼び出す。
       *
       * window.LumiAStartPageTurn("../index.html");
       *
       * 認証に失敗した場合はページをめくらず、
       * loginMessageにエラーメッセージを表示する。
       *
       * 現在は認証未接続のため、
       * 成功したものとして扱わない。
       */

      loginMessage.textContent = "認証機能はまだ接続されていません。";

      console.info("LumiA: 認証機能の接続待ちです。");
    });
  } else {
    console.error(
      "LumiA: ログインフォームまたはメッセージ欄が見つかりません。",
    );
  }

  // ==================================================
  // ゲスト利用
  // ==================================================

  if (guestLink) {
    guestLink.addEventListener("click", (event) => {
      if (isTransitioning) {
        event.preventDefault();
        return;
      }

      const destination = guestLink.getAttribute("href");

      if (!destination) {
        event.preventDefault();
        return;
      }

      event.preventDefault();

      // ゲスト用ホーム画面へページめくり演出で移動
      startPageTurn(destination);
    });
  }
});
