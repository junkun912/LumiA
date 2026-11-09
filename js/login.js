/*
==================================================
LumiA
ファイル名：login.js

【役割】
・パスワードの表示切り替え
・ログインフォームの入力確認
・Amazon Cognito認証との連携
・ページめくり演出
・ゲスト利用時の画面遷移

【関連ファイル】
・js/auth.js
・pages/login.html
・pages/home.html

【重要】
認証成功を確認する前にログイン演出を開始しない。
==================================================
*/

"use strict";

import { login } from "./auth.js";

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
  // 状態管理
  // ==================================================

  let isTransitioning = false;
  let isAuthenticating = false;

  // ==================================================
  // ページめくり演出
  // ==================================================

  /**
   * ページめくり演出後に指定先へ移動する。
   * Cognito認証成功後、またはゲスト利用時に使用する。
   */

  function startPageTurn(destination) {
    if (isTransitioning || !destination) {
      return;
    }

    const pageSheet = loginScreen.querySelector(".page-turn__sheet");

    // アニメーション要素がない場合は通常遷移
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

    // アニメーション状態をリセット
    loginScreen.classList.remove("is-page-turning");

    // CSSの再計算
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

  // ==================================================
  // 認証処理から呼び出せるように公開
  // ==================================================

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
  // エラーメッセージ
  // ==================================================

  /**
   * Cognitoのエラーを画面表示用メッセージに変換する。
   */

  function getLoginErrorMessage(error) {
    const errorName = error?.name || "";

    switch (errorName) {
      case "NotAuthorizedException":
      case "UserNotFoundException":
        return "メールアドレスまたはパスワードが正しくありません。";

      case "UserNotConfirmedException":
        return "アカウントの確認が完了していません。管理者にお問い合わせください。";

      case "PasswordResetRequiredException":
        return "パスワードの再設定が必要です。";

      case "TooManyRequestsException":
      case "LimitExceededException":
        return "アクセスが集中しています。しばらくしてから再度お試しください。";

      case "NetworkError":
      case "TypeError":
        return "通信に失敗しました。ネットワークを確認してください。";

      default:
        return "ログインに失敗しました。入力内容と接続状況を確認してください。";
    }
  }

  // ==================================================
  // ログインフォーム
  // ==================================================

  if (loginForm && loginMessage) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (isTransitioning || isAuthenticating) {
        return;
      }

      loginMessage.textContent = "";
      loginMessage.classList.remove("is-success");

      const formData = new FormData(loginForm);

      const email = String(formData.get("username") || "").trim();

      const password = String(formData.get("password") || "");

      // 入力確認
      if (!email || !password) {
        loginMessage.textContent =
          "メールアドレスとパスワードを入力してください。";
        return;
      }

      // メールアドレス形式の確認
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(email)) {
        loginMessage.textContent = "正しいメールアドレスを入力してください。";
        return;
      }

      isAuthenticating = true;

      if (loginButton) {
        loginButton.disabled = true;
      }

      loginMessage.textContent = "ログインしています。";

      try {
        // ----------------------------------------------
        // Amazon Cognito認証
        // ----------------------------------------------

        const result = await login(email, password);

        // ----------------------------------------------
        // 追加認証が必要な場合
        // ----------------------------------------------

        if (!result.success) {
          const step = result.nextStep?.signInStep;

          if (step === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
            loginMessage.textContent =
              "初回ログインのため、パスワード変更が必要です。";
          } else {
            loginMessage.textContent =
              "追加の認証手続きが必要です。管理者にお問い合わせください。";
          }

          return;
        }

        // ----------------------------------------------
        // 認証成功
        // ----------------------------------------------

        loginMessage.textContent = "ログインしました。";
        loginMessage.classList.add("is-success");

        // 認証成功後にだけページめくりを開始
        startPageTurn("../index.html");
      } catch (error) {
        console.error("LumiA: ログイン処理に失敗しました。", error);

        loginMessage.textContent = getLoginErrorMessage(error);
      } finally {
        isAuthenticating = false;

        // ページ遷移中はボタンを無効のままにする
        if (loginButton && !isTransitioning) {
          loginButton.disabled = false;
        }
      }
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
      if (isTransitioning || isAuthenticating) {
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
