/*
==================================================
LumiA
ファイル名：history.js

質問履歴画面専用JavaScript

【主な機能】
・質問履歴の表示
・回答済み／未回答の絞り込み
・キーワード検索
・最初の5件表示
・すべて表示／5件に戻す
・履歴なし／検索結果なしの表示
・未回答理由の表示
・次の質問への改善ヒント表示

【現在の状態】
・フロントエンド動作確認用の仮データを使用
・AWS API未接続
・AWS連携時はAPIのデータ形式に合わせて接続する

==================================================
*/

"use strict";

// ==================================================
// 1. 設定
// ==================================================

const HISTORY_DISPLAY_LIMIT = 5;

// ==================================================
// 2. 仮データ
// ==================================================

/*
status:
  answered   = 回答済み
  unanswered = 未回答

reasonCode:
  insufficient_material = 資料不足
  unclear_question      = 質問内容が曖昧
  out_of_scope           = 対応範囲外
  system_error           = システムエラー
*/

const mockHistoryData = [
  {
    id: "Q008",
    question: "Amazon BedrockのKnowledge Basesについて教えてください。",
    date: "2026-11-18 15:30",
    status: "answered",
  },
  {
    id: "Q007",
    question: "AWS LambdaとAPI Gatewayの役割の違いは何ですか？",
    date: "2026-11-18 13:15",
    status: "answered",
  },
  {
    id: "Q006",
    question: "RAGの仕組みについて分かりやすく説明してください。",
    date: "2026-11-17 16:40",
    status: "answered",
  },
  {
    id: "Q005",
    question: "DynamoDBのGSIとは何ですか？",
    date: "2026-11-17 10:20",
    status: "unanswered",
    reasonCode: "insufficient_material",
    reasonTitle: "資料不足",
    reason:
      "登録されている学校資料から、質問に該当する情報を十分に見つけられませんでした。",
    suggestion:
      "「DynamoDBのGSIの仕組みを、具体例を使って説明してください」のように質問すると、回答できる可能性があります。",
  },
  {
    id: "Q004",
    question: "HTMLとCSSの役割の違いを教えてください。",
    date: "2026-11-16 14:05",
    status: "answered",
  },
  {
    id: "Q003",
    question: "JavaScriptの非同期処理について教えてください。",
    date: "2026-11-15 11:30",
    status: "answered",
  },
  {
    id: "Q002",
    question: "Amazon Cognitoの認証の仕組みを知りたいです。",
    date: "2026-11-14 09:45",
    status: "unanswered",
    reasonCode: "unclear_question",
    reasonTitle: "質問内容が曖昧",
    reason:
      "質問の対象や知りたい内容を特定できず、適切な回答を作成できませんでした。",
    suggestion:
      "「Amazon Cognitoのユーザー認証の流れを、ログインから認証完了まで順番に説明してください」のように、知りたい範囲を具体的にすると伝わりやすくなります。",
  },
  {
    id: "Q001",
    question: "AWS Amplify Hostingとは何ですか？",
    date: "2026-11-13 16:10",
    status: "answered",
  },
];

// ==================================================
// 3. DOM取得
// ==================================================

const historyList = document.getElementById("history-list");
const historyCount = document.getElementById("history-count");

const historySearchInput = document.getElementById("history-search-input");

const historyFilterButtons = document.querySelectorAll(
  ".history-filter__button",
);

const historyMore = document.getElementById("history-more");
const historyMoreButton = document.getElementById("history-more-button");
const historyMoreLabel = document.getElementById("history-more-label");

const historyEmpty = document.getElementById("history-empty");
const historyEmptyTitle = document.getElementById("history-empty-title");
const historyEmptyDescription = document.getElementById(
  "history-empty-description",
);

// ==================================================
// 4. 状態管理
// ==================================================

let historyData = [...mockHistoryData];

let currentFilter = "all";
let currentKeyword = "";
let isShowingAll = false;

// ==================================================
// 5. 初期化
// ==================================================

function initializeHistory() {
  if (!historyList || !historyCount || !historySearchInput || !historyEmpty) {
    console.error("LumiA: 質問履歴画面の必要なHTML要素が見つかりません。");
    return;
  }

  setupSearch();
  setupFilter();
  setupMoreButton();

  renderHistory();
}

// ==================================================
// 6. 検索機能
// ==================================================

function setupSearch() {
  historySearchInput.addEventListener("input", (event) => {
    currentKeyword = event.target.value.trim().toLowerCase();

    // 検索条件変更時は5件表示に戻す
    isShowingAll = false;

    renderHistory();
  });
}

// ==================================================
// 7. 絞り込み機能
// ==================================================

function setupFilter() {
  historyFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const selectedFilter = button.dataset.filter;

      if (!["all", "answered", "unanswered"].includes(selectedFilter)) {
        return;
      }

      currentFilter = selectedFilter;

      // ボタンの選択状態を更新
      historyFilterButtons.forEach((filterButton) => {
        const isActive = filterButton.dataset.filter === currentFilter;

        filterButton.classList.toggle(
          "history-filter__button--active",
          isActive,
        );

        filterButton.setAttribute("aria-pressed", String(isActive));
      });

      // 絞り込み変更時は5件表示に戻す
      isShowingAll = false;

      renderHistory();
    });
  });
}

// ==================================================
// 8. すべて表示ボタン
// ==================================================

function setupMoreButton() {
  if (!historyMoreButton) {
    return;
  }

  historyMoreButton.addEventListener("click", () => {
    isShowingAll = !isShowingAll;

    renderHistory();
  });
}

// ==================================================
// 9. 履歴データの絞り込み
// ==================================================

function getFilteredHistory() {
  return historyData.filter((item) => {
    // 回答状態による絞り込み
    const matchesStatus =
      currentFilter === "all" || item.status === currentFilter;

    // 質問内容・未回答理由・改善ヒントを検索対象にする
    const searchableText = [
      item.question,
      item.reasonTitle,
      item.reason,
      item.suggestion,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesKeyword =
      !currentKeyword || searchableText.includes(currentKeyword);

    return matchesStatus && matchesKeyword;
  });
}

// ==================================================
// 10. HTMLエスケープ
// ==================================================

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

// ==================================================
// 11. 日付表示
// ==================================================

function formatHistoryDate(dateValue) {
  return escapeHTML(dateValue);
}

// ==================================================
// 12. 未回答理由・改善ヒント生成
// ==================================================

function createUnansweredDetails(item) {
  if (item.status !== "unanswered") {
    return "";
  }

  const reasonTitle = item.reasonTitle || "回答できなかった理由";

  const reason = item.reason
    ? escapeHTML(item.reason)
    : "回答できなかった理由の詳細は、現在確認できません。";

  const suggestion = item.suggestion
    ? escapeHTML(item.suggestion)
    : "質問内容を少し具体的にして、もう一度質問してみてください。";

  return `
    <div class="history-item__details">

      <section
        class="history-item__reason"
        aria-label="回答できなかった理由"
      >
        <div class="history-item__details-heading">

          <span
            class="history-item__details-icon"
            aria-hidden="true"
          >
            !
          </span>

          <h3 class="history-item__details-title">
            回答できなかった理由
          </h3>

        </div>

        <span class="history-item__reason-label">
          ${escapeHTML(reasonTitle)}
        </span>

        <p class="history-item__details-text">
          ${reason}
        </p>
      </section>

      <section
        class="history-item__suggestion"
        aria-label="次の質問へのヒント"
      >
        <div class="history-item__details-heading">

          <span
            class="history-item__suggestion-icon"
            aria-hidden="true"
          >
            ?
          </span>

          <h3 class="history-item__details-title">
            次の質問へのヒント
          </h3>

        </div>

        <p class="history-item__details-text">
          ${suggestion}
        </p>
      </section>

    </div>
  `;
}

// ==================================================
// 13. 履歴カード生成
// ==================================================

function createHistoryItem(item) {
  const isAnswered = item.status === "answered";

  const statusClass = isAnswered
    ? "history-item__status--answered"
    : "history-item__status--unanswered";

  const statusLabel = isAnswered ? "回答済み" : "未回答";

  const statusIcon = isAnswered
    ? ""
    : `
    <span
      class="history-item__status-icon"
      aria-hidden="true"
    >
      !
    </span>
  `;

  const unansweredDetails = createUnansweredDetails(item);

  return `
    <article
      class="history-item ${
        isAnswered ? "history-item--answered" : "history-item--unanswered"
      }"
      data-history-id="${escapeHTML(item.id)}"
    >

      <div class="history-item__main">

        <div class="history-item__meta">

          <time class="history-item__date">
            ${formatHistoryDate(item.date)}
          </time>

          <span class="history-item__status ${statusClass}">
            ${statusIcon}
            ${statusLabel}
          </span>

        </div>

        <p class="history-item__question">
          ${escapeHTML(item.question)}
        </p>

      </div>

      ${unansweredDetails}

    </article>
  `;
}

// ==================================================
// 14. 履歴件数表示
// ==================================================

function updateHistoryCount(totalCount) {
  historyCount.textContent = `${totalCount}件の質問`;
}

// ==================================================
// 15. 展開ボタン表示
// ==================================================

function updateMoreButton(totalCount) {
  if (!historyMore || !historyMoreButton || !historyMoreLabel) {
    return;
  }

  // 5件以下ならボタンを表示しない
  const shouldShowButton = totalCount > HISTORY_DISPLAY_LIMIT;

  historyMore.hidden = !shouldShowButton;

  if (!shouldShowButton) {
    return;
  }

  if (isShowingAll) {
    historyMoreLabel.textContent = "5件に戻す";

    historyMoreButton.setAttribute("aria-expanded", "true");
  } else {
    historyMoreLabel.textContent = "すべて表示";

    historyMoreButton.setAttribute("aria-expanded", "false");
  }
}

// ==================================================
// 16. 履歴なし・検索結果なし
// ==================================================

function updateEmptyState(totalCount) {
  const isEmpty = totalCount === 0;

  historyEmpty.hidden = !isEmpty;

  if (!isEmpty) {
    return;
  }

  if (historyData.length === 0) {
    if (historyEmptyTitle) {
      historyEmptyTitle.textContent = "質問履歴はまだありません";
    }

    if (historyEmptyDescription) {
      historyEmptyDescription.textContent =
        "LumiAに質問すると、ここに履歴が表示されます。";
    }
  } else {
    if (historyEmptyTitle) {
      historyEmptyTitle.textContent = "該当する質問が見つかりませんでした";
    }

    if (historyEmptyDescription) {
      historyEmptyDescription.textContent =
        "検索キーワードや絞り込み条件を変更してみてください。";
    }
  }
}

// ==================================================
// 17. 履歴一覧の描画
// ==================================================


function renderHistory() {
  if (!historyList) {
    return;
  }

  // 描画中であることを通知
  historyList.setAttribute("aria-busy", "true");

  try {
    // 検索・絞り込み後の履歴を取得
    const filteredHistory = getFilteredHistory();

    const totalCount = filteredHistory.length;

    // 初期表示は5件、展開後は全件
    const displayHistory = isShowingAll
      ? filteredHistory
      : filteredHistory.slice(0, HISTORY_DISPLAY_LIMIT);

    // 履歴カードを生成
    historyList.innerHTML = displayHistory
      .map((item) => createHistoryItem(item))
      .join("");

    // 件数を更新
    updateHistoryCount(totalCount);

    // 展開ボタンを更新
    updateMoreButton(totalCount);

    // 空状態を更新
    updateEmptyState(totalCount);

    // 履歴がない場合は一覧を非表示
    historyList.hidden = totalCount === 0;
  } finally {
    // 描画完了を通知
    historyList.setAttribute("aria-busy", "false");
  }
}

// ==================================================
// 18. 初期化実行
// ==================================================

initializeHistory();
