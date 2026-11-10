/*
==================================================
LumiA
ファイル名：corgi.js

【ファイル概要】
LumiA全体で使用するコーギくんの共通表示管理。

【主な役割】
・12種類のキャラクター画像の管理
・キャラクターの表示切り替え
・初期表示の設定
・画像読み込みエラーへの対応
・フェードアニメーションの制御
・連続切り替え時の競合防止

==================================================
*/

"use strict";

// ==================================================
// キャラクター画像の定義
// ==================================================

const CORGI_IMAGES = {
  basic: "corgi_basic.png",
  welcome: "corgi_welcome.png",
  idea: "corgi_idea.png",
  thinking: "corgi_thinking.png",
  studying: "corgi_studying.png",
  reading: "corgi_reading.png",
  explaining: "corgi_explaining.png",
  cheer: "corgi_cheer.png",
  surprised: "corgi_surprised.png",
  apology: "corgi_apology.png",
  thanks: "corgi_thanks.png",
  rest: "corgi_rest.png",
};

// ==================================================
// キャラクター画像の保存先
// ==================================================

const CORGI_IMAGE_PATH = new URL(
  "../assets/images/characters/",
  import.meta.url,
);

// ==================================================
// キャラクターの代替テキスト
// ==================================================

const CORGI_ALT_TEXTS = {
  basic: "通常のコーギくん",
  welcome: "歓迎するコーギくん",
  idea: "ひらめいたコーギくん",
  thinking: "考え中のコーギくん",
  studying: "学習するコーギくん",
  reading: "資料を読むコーギくん",
  explaining: "説明するコーギくん",
  cheer: "応援するコーギくん",
  surprised: "驚いたコーギくん",
  apology: "お詫びするコーギくん",
  thanks: "感謝するコーギくん",
  rest: "休憩するコーギくん",
};

// ==================================================
// コーギくん共通管理クラス
// ==================================================

class CorgiManager {
  constructor() {
    this.element = null;
    this.currentState = null;
    this.isInitialized = false;

    // 切り替え処理の管理
    this.requestId = 0;
    this.transitionTimer = null;
  }

  // ----------------------------------------------
  // 初期化
  // ----------------------------------------------

  initialize(element) {
    if (!element) {
      console.error("LumiA: コーギくんの表示要素が指定されていません。");

      return false;
    }

    if (this.isInitialized) {
      console.error("LumiA: コーギくんはすでに初期化されています。");

      return false;
    }

    this.element = element;
    this.isInitialized = true;

    return true;
  }

  // ----------------------------------------------
  // キャラクター切り替え
  // ----------------------------------------------

  setState(state) {
    if (!this.isInitialized || !this.element) {
      console.error("LumiA: コーギくんが初期化されていません。");

      return false;
    }

    const imageName = CORGI_IMAGES[state];

    if (!imageName) {
      console.error(`LumiA: 未定義のコーギくん状態です。${state}`);

      return false;
    }

    // 同じ状態なら再読み込みしない
    if (this.currentState === state) {
      return true;
    }

    // 古い切り替え処理を無効化
    this.requestId += 1;

    const currentRequestId = this.requestId;

    if (this.transitionTimer !== null) {
      window.clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }

    const imageUrl = new URL(imageName, CORGI_IMAGE_PATH);

    // 画像を先読み
    const preloadImage = new Image();

    preloadImage.onload = () => {
      // 古いリクエストなら処理しない
      if (currentRequestId !== this.requestId) {
        return;
      }

      // フェードアウト開始
      this.element.classList.add("is-changing");

      this.transitionTimer = window.setTimeout(() => {
        // 処理中に新しい指示が来ていないか確認
        if (currentRequestId !== this.requestId) {
          return;
        }

        // 画像と代替テキストを更新
        this.element.src = imageUrl.href;
        this.element.alt = CORGI_ALT_TEXTS[state];

        // 現在の状態を更新
        this.currentState = state;

        // フェードイン開始
        this.element.classList.remove("is-changing");

        this.transitionTimer = null;
      }, 180);
    };

    preloadImage.onerror = () => {
      // 古いリクエストのエラーは無視
      if (currentRequestId !== this.requestId) {
        return;
      }

      console.error(
        `LumiA: コーギくんの画像を読み込めませんでした。${imageName}`,
      );

      // 表示が消えたままにならないようにする
      this.element.classList.remove("is-changing");

      this.transitionTimer = null;
    };

    preloadImage.src = imageUrl.href;

    return true;
  }

  // ----------------------------------------------
  // 現在の状態を取得
  // ----------------------------------------------

  getState() {
    return this.currentState;
  }
}

// ==================================================
// 共通インスタンス
// ==================================================

const corgiManager = new CorgiManager();

// ==================================================
// 外部公開API
// ==================================================

/**
 * コーギくんを初期化する。
 *
 * @param {HTMLImageElement} element 表示する画像要素
 * @param {string} initialState 初期状態
 * @returns {boolean} 初期化結果
 */
export function initializeCorgi(element, initialState = "basic") {
  const initialized = corgiManager.initialize(element);

  if (!initialized) {
    return false;
  }

  return corgiManager.setState(initialState);
}

/**
 * コーギくんの表示状態を変更する。
 *
 * @param {string} state 表示する状態
 * @returns {boolean} 切り替え処理の開始結果
 */
export function setCorgiState(state) {
  return corgiManager.setState(state);
}

/**
 * 現在表示している状態を取得する。
 *
 * @returns {string|null} 現在の状態
 */
export function getCorgiState() {
  return corgiManager.getState();
}
