/*
==================================================
LumiA
ファイル名：common.js

【ファイル概要】
LumiA Webアプリ全体で共通して使用するJavaScript。

【主な役割】
・スマートフォン用ハンバーガーメニュー
・サイドメニューの開閉
・キーボード操作への対応
・共通UI状態の管理

【注意】
特定画面だけで使用する処理は、
各機能専用JavaScriptへ記述する。

==================================================
*/

(() => {
  "use strict";

  // ==================================================
  // 1. 基本設定
  // ==================================================

  const MENU_BREAKPOINT = 600;

  // ==================================================
  // 2. 初期化
  // ==================================================

  function initializeCommonUI() {
    const menuToggle = document.getElementById("menu-toggle");
    const sideMenu = document.getElementById("side-menu");
    const menuOverlay = document.getElementById("menu-overlay");

    /*
     * ハンバーガーメニューがないページでは
     * 何もしない。
     */

    if (!menuToggle || !sideMenu || !menuOverlay) {
      return;
    }

    // メニューとボタンの関連付け
    menuToggle.setAttribute("aria-controls", "side-menu");

    // 初期状態を統一
    initializeMenuState(menuToggle, sideMenu, menuOverlay);

    // メニュー操作を設定
    setupMenuEvents(menuToggle, sideMenu, menuOverlay);

    // 画面サイズ変更への対応
    setupResponsiveMenu(menuToggle, sideMenu, menuOverlay);
  }

  // ==================================================
  // 3. メニューの初期状態
  // ==================================================

  function initializeMenuState(menuToggle, sideMenu, menuOverlay) {
    menuToggle.classList.remove("is-open");
    sideMenu.classList.remove("is-open");
    menuOverlay.classList.remove("is-open");

    document.body.classList.remove("is-menu-open");

    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "メニューを開く");

    sideMenu.setAttribute("aria-hidden", "true");
    menuOverlay.setAttribute("aria-hidden", "true");
  }

  // ==================================================
  // 4. メニューを開く
  // ==================================================

  function openMenu(menuToggle, sideMenu, menuOverlay) {
    if (sideMenu.classList.contains("is-open")) {
      return;
    }

    menuToggle.classList.add("is-open");
    sideMenu.classList.add("is-open");
    menuOverlay.classList.add("is-open");

    document.body.classList.add("is-menu-open");

    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "メニューを閉じる");

    sideMenu.setAttribute("aria-hidden", "false");
    menuOverlay.setAttribute("aria-hidden", "false");

    // メニュー内の最初のリンクにフォーカス
    const firstMenuLink = sideMenu.querySelector("a[href]");

    if (firstMenuLink) {
      firstMenuLink.focus();
    } else if (sideMenu.hasAttribute("tabindex")) {
      sideMenu.focus();
    }
  }

  // ==================================================
  // 5. メニューを閉じる
  // ==================================================

  function closeMenu(menuToggle, sideMenu, menuOverlay, restoreFocus = false) {
    if (!sideMenu.classList.contains("is-open")) {
      return;
    }

    menuToggle.classList.remove("is-open");
    sideMenu.classList.remove("is-open");
    menuOverlay.classList.remove("is-open");

    document.body.classList.remove("is-menu-open");

    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "メニューを開く");

    sideMenu.setAttribute("aria-hidden", "true");
    menuOverlay.setAttribute("aria-hidden", "true");

    // 必要な場合のみボタンへフォーカスを戻す
    if (restoreFocus) {
      menuToggle.focus();
    }
  }

  // ==================================================
  // 6. メニューの開閉切り替え
  // ==================================================

  function toggleMenu(menuToggle, sideMenu, menuOverlay) {
    if (sideMenu.classList.contains("is-open")) {
      closeMenu(menuToggle, sideMenu, menuOverlay, true);
    } else {
      openMenu(menuToggle, sideMenu, menuOverlay);
    }
  }

  // ==================================================
  // 7. メニューイベント設定
  // ==================================================

  function setupMenuEvents(menuToggle, sideMenu, menuOverlay) {
    // ----------------------------------------------
    // ハンバーガーボタン
    // ----------------------------------------------

    menuToggle.addEventListener("click", () => {
      toggleMenu(menuToggle, sideMenu, menuOverlay);
    });

    // ----------------------------------------------
    // 背景をクリックして閉じる
    // ----------------------------------------------

    menuOverlay.addEventListener("click", () => {
      closeMenu(menuToggle, sideMenu, menuOverlay, true);
    });

    // ----------------------------------------------
    // メニュー項目をクリックしたら閉じる
    // ----------------------------------------------

    sideMenu.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");

      if (!link || !sideMenu.contains(link)) {
        return;
      }

      closeMenu(menuToggle, sideMenu, menuOverlay);
    });

    // ----------------------------------------------
    // Escキーで閉じる
    // ----------------------------------------------

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && sideMenu.classList.contains("is-open")) {
        closeMenu(menuToggle, sideMenu, menuOverlay, true);
      }
    });
  }

  // ==================================================
  // 8. レスポンシブ対応
  // ==================================================

  function setupResponsiveMenu(menuToggle, sideMenu, menuOverlay) {
    const mediaQuery = window.matchMedia(
      `(min-width: ${MENU_BREAKPOINT + 1}px)`,
    );

    const handleBreakpointChange = (event) => {
      if (event.matches && sideMenu.classList.contains("is-open")) {
        closeMenu(menuToggle, sideMenu, menuOverlay);
      }
    };

    // 画面幅の変化を監視
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleBreakpointChange);
    } else {
      // 古いブラウザ向け
      mediaQuery.addListener(handleBreakpointChange);
    }
  }

  // ==================================================
  // 9. 初期化処理の実行
  // ==================================================

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeCommonUI, {
      once: true,
    });
  } else {
    initializeCommonUI();
  }
})();
