/* ==================================================

   LumiA
   ファイル名：about.js

   【ファイル概要】
   LumiA紹介ページの動作を管理するJavaScript。

   【主な役割】
   ・モバイルメニューの開閉
   ・メニュー外クリックで閉じる
   ・Escapeキーでメニューを閉じる
   ・スクロールに応じた表示アニメーション
   ・動きを減らす設定への対応

================================================== */

/* ==================================================
   1. 初期化
================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initializeMobileMenu();
  initializeScrollAnimation();
});

/* ==================================================
   2. モバイルメニュー
================================================== */

function initializeMobileMenu() {
  const menuButton = document.getElementById("about-menu-button");

  const mobileNavigation = document.getElementById("about-mobile-navigation");

  if (!menuButton || !mobileNavigation) {
    return;
  }

  /**
   * メニューを開く
   */
  function openMenu() {
    mobileNavigation.hidden = false;

    menuButton.setAttribute("aria-expanded", "true");

    menuButton.setAttribute("aria-label", "メニューを閉じる");
  }

  /**
   * メニューを閉じる
   */
  function closeMenu() {
    mobileNavigation.hidden = true;

    menuButton.setAttribute("aria-expanded", "false");

    menuButton.setAttribute("aria-label", "メニューを開く");
  }

  /**
   * メニューの開閉
   */
  menuButton.addEventListener("click", () => {
    const isExpanded = menuButton.getAttribute("aria-expanded") === "true";

    if (isExpanded) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  /**
   * メニュー内のリンクを押したら閉じる
   */
  mobileNavigation.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      closeMenu();
    });
  });

  /**
   * Escapeキーで閉じる
   */
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  /**
   * メニュー外をクリックしたら閉じる
   */
  document.addEventListener("click", (event) => {
    const isExpanded = menuButton.getAttribute("aria-expanded") === "true";

    if (!isExpanded) {
      return;
    }

    const clickedInsideMenu = mobileNavigation.contains(event.target);

    const clickedMenuButton = menuButton.contains(event.target);

    if (!clickedInsideMenu && !clickedMenuButton) {
      closeMenu();
    }
  });

  /**
   * PCサイズに戻った場合はメニューを閉じる
   */
  window.addEventListener("resize", () => {
    if (window.innerWidth > 700) {
      closeMenu();
    }
  });
}

/* ==================================================
   3. スクロール表示アニメーション
================================================== */

function initializeScrollAnimation() {
  const animatedElements = document.querySelectorAll(
    [
      ".about-section",
      ".about-hero__content",
      ".about-hero__mascot",
      ".about-ending__content",
    ].join(","),
  );

  if (!animatedElements.length) {
    return;
  }

  /**
   * 動きを減らす設定が有効な場合は
   * アニメーションを適用しない
   */
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

  if (prefersReducedMotion.matches) {
    return;
  }

  /**
   * IntersectionObserverが利用できない場合
   * すべて表示する
   */
  if (!("IntersectionObserver" in window)) {
    animatedElements.forEach((element) => {
      element.classList.add("is-visible");
    });

    return;
  }

  /**
   * アニメーション監視
   */
  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");

        currentObserver.unobserve(entry.target);
      });
    },
    {
      root: null,
      rootMargin: "0px 0px -50px 0px",
      threshold: 0.08,
    },
  );

  /**
   * 各要素の監視を開始
   */
  animatedElements.forEach((element) => {
    observer.observe(element);
  });

  /**
   * CSSアニメーションを有効化
   * 初期化後にクラスを付けることで、
   * JavaScript無効時にコンテンツが消えるのを防ぐ
   */
  requestAnimationFrame(() => {
    document.body.classList.add("about-js-ready");
  });
}
