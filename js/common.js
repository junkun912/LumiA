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

  document.addEventListener("DOMContentLoaded", () => {
    const menuToggle = document.getElementById("menu-toggle");
    const sideMenu = document.getElementById("side-menu");
    const menuOverlay = document.getElementById("menu-overlay");

    /*
      ハンバーガーメニューがないページでは
      何もしない。
    */
    if (!menuToggle || !sideMenu || !menuOverlay) {
      return;
    }

    const menuLinks = sideMenu.querySelectorAll("a");

    /*
    ==================================================
      メニューを開く
    ==================================================
    */

    const openMenu = () => {
      menuToggle.classList.add("is-open");

      sideMenu.classList.add("is-open");

      menuOverlay.classList.add("is-open");

      document.body.classList.add("is-menu-open");

      menuToggle.setAttribute("aria-expanded", "true");

      menuToggle.setAttribute(
        "aria-label",
        "メニューを閉じる"
      );

      sideMenu.setAttribute(
        "aria-hidden",
        "false"
      );

      menuOverlay.setAttribute(
        "aria-hidden",
        "false"
      );
    };

    /*
    ==================================================
      メニューを閉じる
    ==================================================
    */

    const closeMenu = () => {
      menuToggle.classList.remove("is-open");

      sideMenu.classList.remove("is-open");

      menuOverlay.classList.remove("is-open");

      document.body.classList.remove("is-menu-open");

      menuToggle.setAttribute(
        "aria-expanded",
        "false"
      );

      menuToggle.setAttribute(
        "aria-label",
        "メニューを開く"
      );

      sideMenu.setAttribute(
        "aria-hidden",
        "true"
      );

      menuOverlay.setAttribute(
        "aria-hidden",
        "true"
      );
    };

    /*
    ==================================================
      開閉切り替え
    ==================================================
    */

    const toggleMenu = () => {
      if (sideMenu.classList.contains("is-open")) {
        closeMenu();
      } else {
        openMenu();
      }
    };

    /*
    ==================================================
      ハンバーガーボタン
    ==================================================
    */

    menuToggle.addEventListener(
      "click",
      toggleMenu
    );

    /*
    ==================================================
      背景をクリックして閉じる
    ==================================================
    */

    menuOverlay.addEventListener(
      "click",
      closeMenu
    );

    /*
    ==================================================
      メニュー項目をクリックしたら閉じる
    ==================================================
    */

    menuLinks.forEach((link) => {
      link.addEventListener(
        "click",
        closeMenu
      );
    });

    /*
    ==================================================
      Escキーで閉じる
    ==================================================
    */

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape" &&
          sideMenu.classList.contains("is-open")
        ) {
          closeMenu();

          menuToggle.focus();
        }
      }
    );

    /*
    ==================================================
      PC表示へ戻った場合
      メニュー状態をリセット
    ==================================================
    */

    window.addEventListener(
      "resize",
      () => {
        if (
          window.innerWidth > 600 &&
          sideMenu.classList.contains("is-open")
        ) {
          closeMenu();
        }
      }
    );
  });
})();