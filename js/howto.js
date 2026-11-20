/**
 * ==================================================
 * LumiA
 * ファイル名：howto.js
 * バージョン：3.0
 *
 * 【機能】
 * ・スクロールに合わせたフェードアップ表示
 * ・カードの時間差表示
 * ・一度表示した要素は表示状態を維持
 * ・IntersectionObserverによる軽量な監視
 * ・動きを減らす設定への対応
 *
 * 【関連ファイル】
 * ・howto.html
 * ・howto.css
 * ==================================================
 */

(() => {
  "use strict";

  /**
   * Howtoページの初期化
   */
  const initializeHowto = () => {
    const page = document.querySelector(".howto-page");

    // Howtoページ以外では実行しない
    if (!page) {
      return;
    }

    // 二重初期化を防止
    if (page.dataset.revealInitialized === "true") {
      return;
    }

    page.dataset.revealInitialized = "true";

    /**
     * 動きを減らす設定を確認
     */
    const reduceMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    /**
     * 表示対象
     *
     * HTML側で data-reveal を設定した要素を対象にする。
     */
    const revealElements = page.querySelectorAll("[data-reveal]");

    if (!revealElements.length) {
      return;
    }

    /**
     * 動きを減らす設定、または
     * IntersectionObserver非対応の場合は通常表示
     */
    if (reduceMotionQuery.matches || !("IntersectionObserver" in window)) {
      revealElements.forEach((element) => {
        element.classList.add("is-visible");
      });

      return;
    }

    /**
     * カードの表示順を設定
     *
     * 同じグループ内のカードを少しずつ遅らせる。
     */
    const setStaggerDelay = (selector, delay = 110) => {
      const groups = page.querySelectorAll(selector);

      groups.forEach((group) => {
        const cards = Array.from(group.children).filter((child) =>
          child.hasAttribute("data-reveal"),
        );

        cards.forEach((card, index) => {
          card.style.setProperty("--howto-reveal-delay", `${index * delay}ms`);
        });
      });
    };

    // 基本の3ステップ
    setStaggerDelay(".howto-steps__list", 120);

    // 質問のコツ
    setStaggerDelay(".howto-tips__grid", 120);

    /**
     * IntersectionObserverの設定
     */
    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          // 表示状態にする
          entry.target.classList.add("is-visible");

          // 一度表示した要素は監視を終了する
          currentObserver.unobserve(entry.target);
        });
      },
      {
        root: null,

        // 画面下部から少し入った位置で表示
        rootMargin: "0px 0px -8% 0px",

        // 要素が12%表示されたら実行
        threshold: 0.12,
      },
    );

    /**
     * 表示前の状態を設定して監視を開始
     */
    revealElements.forEach((element) => {
      element.classList.add("howto-reveal");

      observer.observe(element);
    });

    /**
     * OS設定が実行中に変更された場合の対応
     */
    const handleMotionPreferenceChange = (event) => {
      if (!event.matches) {
        return;
      }

      // 動きを減らす設定が有効になった場合
      observer.disconnect();

      revealElements.forEach((element) => {
        element.classList.add("is-visible");
      });
    };

    if (typeof reduceMotionQuery.addEventListener === "function") {
      reduceMotionQuery.addEventListener(
        "change",
        handleMotionPreferenceChange,
      );
    } else if (typeof reduceMotionQuery.addListener === "function") {
      // 古いブラウザ向け
      reduceMotionQuery.addListener(handleMotionPreferenceChange);
    }
  };

  /**
   * DOMの読み込み状態に応じて初期化
   */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeHowto, {
      once: true,
    });
  } else {
    initializeHowto();
  }
})();
