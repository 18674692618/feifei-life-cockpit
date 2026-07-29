const STORAGE_KEY = "feifei-life-cockpit-v1";
const STORAGE_BACKUP_KEY = "feifei-life-cockpit-backup-v1";
const STORAGE_MIRROR_KEY = "feifei-life-cockpit-data";
const CLOUD_SYNC_URL_KEY = "feifei-life-cockpit-cloud-url";
const oldTripKey = "feifei-travel-world-v1";

const today = new Date();
const currentMonth = today.toISOString().slice(0, 7);
const todayISO = today.toISOString().slice(0, 10);
const APP_VERSION = "v23";

const defaultState = {
  workouts: [
    { id: uid(), date: todayISO },
    { id: uid(), date: shiftDate(-2) },
    { id: uid(), date: shiftDate(-4) }
  ],
  loveDays: [],
  monthlyRecords: [
    {
      month: currentMonth,
      income: 58000,
      expense: 15691,
      familyBalance: 50700,
      housingFund: 180000,
      debt: 620000,
      investment: 143000
    }
  ],
  financeItems: [
    { id: uid(), month: currentMonth, kind: "asset", category: "固定资产", name: "自住房估值", amount: 4800000, owner: "家庭", note: "参考 Nestworth 原型：固定资产建议按季度更新估值。" },
    { id: uid(), month: currentMonth, kind: "asset", category: "现金资产", name: "银行卡与零钱", amount: 50700, owner: "家庭", note: "现金安全垫。" },
    { id: uid(), month: currentMonth, kind: "asset", category: "投资资产", name: "股票账户", amount: 86200, owner: "家庭", note: "本月小幅回撤。" },
    { id: uid(), month: currentMonth, kind: "asset", category: "投资资产", name: "指数基金", amount: 56800, owner: "家庭", note: "按月记录市值。" },
    { id: uid(), month: currentMonth, kind: "debt", category: "房贷", name: "住房贷款余额", amount: 620000, owner: "家庭", note: "负债项计入净资产计算。" },
    { id: uid(), month: currentMonth, kind: "income", category: "工资奖金", name: "工资与奖金", amount: 58000, owner: "家庭", note: "本月收入。" },
    { id: uid(), month: currentMonth, kind: "expense", category: "家庭支出", name: "日常支出", amount: 15691, owner: "家庭", note: "本月支出。" },
    { id: uid(), month: currentMonth, kind: "gain", category: "投资盈亏", name: "投资净变化", amount: 1070, owner: "家庭", note: "基金收益与股票回撤合并示例。" }
  ],
  trips: [
    {
      id: uid(),
      destination: "京都",
      startDate: "2025-11-18",
      endDate: "2025-11-23",
      budget: 12000,
      cost: 13680,
      companions: "妈妈",
      guide: "岚山留半天，伏见稻荷建议早上去。住四条河原町，吃饭和坐车都方便。",
      memory: "傍晚从鸭川边走回酒店，风很凉，妈妈说以后还想再来一次。",
      photos: []
    },
    {
      id: uid(),
      destination: "阿勒泰",
      startDate: "2024-06-04",
      endDate: "2024-06-10",
      budget: 9000,
      cost: 8420,
      companions: "朋友们",
      guide: "喀纳斯和禾木之间不要排太满，留一天给发呆。",
      memory: "晚上在木屋外面看星星，大家都安静了很久。",
      photos: []
    }
  ],
  birthdays: []
};

let state = loadState();
let pendingPhotos = [];
let selectedWorkoutMonth = currentMonth;
let selectedWorkoutDate = todayISO;
let selectedBirthdayFilter = "all";
let deferredInstallPrompt = null;
let cloudSyncTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const money = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 });
const viewTitles = {
  fitness: { title: "健身", copy: "记录每月运动和爱爱" },
  assets: { title: "资产", copy: "家庭收入、支出和余额" },
  travel: { title: "旅行", copy: "费用、攻略和回忆" },
  dashboard: { title: "生日", copy: "家人生日提醒" }
};

init();

function init() {
  setDefaultDates();
  bindNavigation();
  bindFitness();
  bindAssets();
  bindTravel();
  bindBirthdays();
  bindDataTools();
  bindInstall();
  registerServiceWorker();
  renderAll();
}

function loadState() {
  const candidates = [STORAGE_KEY, STORAGE_BACKUP_KEY, STORAGE_MIRROR_KEY]
    .map(readStoredState)
    .filter(Boolean);

  if (!candidates.length) {
    const oldTrips = readOldTripState();
    if (oldTrips) candidates.push(oldTrips);
  }

  const best = candidates.sort((a, b) => stateScore(b) - stateScore(a))[0];
  const normalized = normalizeState(best ? { ...defaultState, ...best } : structuredClone(defaultState));
  try {
    persistState(normalized);
  } catch {
    // The app can still run with in-memory data if browser storage is temporarily unavailable.
  }
  return normalized;
}

function readStoredState(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.state || parsed;
  } catch {
    return null;
  }
}

function readOldTripState() {
  try {
    const raw = localStorage.getItem(oldTripKey);
    if (!raw) return null;
    const parsedTrips = JSON.parse(raw);
    return Array.isArray(parsedTrips) ? { trips: parsedTrips } : null;
  } catch {
    return null;
  }
}

function stateScore(nextState) {
  const workouts = Array.isArray(nextState?.workouts) ? nextState.workouts.length : 0;
  const loveDays = Array.isArray(nextState?.loveDays) ? nextState.loveDays.length : 0;
  const birthdays = Array.isArray(nextState?.birthdays) ? nextState.birthdays.length : 0;
  const monthlyRecords = Array.isArray(nextState?.monthlyRecords)
    ? nextState.monthlyRecords.filter((record) => !isDefaultMonthlyRecord(record)).length
    : 0;
  const trips = Array.isArray(nextState?.trips)
    ? nextState.trips.filter((trip) => !isDefaultTrip(trip)).length
    : 0;
  return workouts + loveDays * 2 + birthdays * 4 + monthlyRecords * 5 + trips * 4;
}

function isDefaultMonthlyRecord(record) {
  return record?.month === currentMonth
    && Number(record.income) === 58000
    && Number(record.expense) === 15691
    && Number(record.familyBalance) === 50700
    && Number(record.housingFund) === 180000
    && Number(record.debt) === 620000
    && Number(record.investment) === 143000;
}

function isDefaultTrip(trip) {
  return (trip?.destination === "京都" && trip?.startDate === "2025-11-18")
    || (trip?.destination === "阿勒泰" && trip?.startDate === "2024-06-04");
}

function normalizeState(nextState) {
  nextState.workouts = dedupeWorkoutDates(nextState.workouts || defaultState.workouts);
  nextState.loveDays = dedupeDateRecords(nextState.loveDays || []);
  nextState.trips = Array.isArray(nextState.trips) ? nextState.trips : defaultState.trips;
  nextState.birthdays = normalizeBirthdays(nextState.birthdays || []);
  nextState.financeItems = Array.isArray(nextState.financeItems) ? nextState.financeItems : [];
  nextState.monthlyRecords = Array.isArray(nextState.monthlyRecords) && nextState.monthlyRecords.length
    ? nextState.monthlyRecords.map(normalizeMonthlyRecord)
    : migrateFinanceItemsToMonthlyRecords(nextState.financeItems);
  return nextState;
}

function normalizeBirthdays(birthdays) {
  return (birthdays || [])
    .filter((item) => item?.name && item?.date)
    .map((item) => ({
      id: item.id || uid(),
      name: String(item.name).trim(),
      relation: String(item.relation || "").trim(),
      calendar: item.calendar === "lunar" ? "lunar" : "solar",
      date: item.date,
      note: String(item.note || "").trim()
    }));
}

function normalizeMonthlyRecord(record) {
  return {
    month: record.month || currentMonth,
    income: Number(record.income || 0),
    expense: Number(record.expense || 0),
    familyBalance: Number(record.familyBalance || 0),
    housingFund: Number(record.housingFund || 0),
    debt: Number(record.debt || 0),
    investment: Number(record.investment || 0)
  };
}

function migrateFinanceItemsToMonthlyRecords(items) {
  if (!items?.length) return structuredClone(defaultState.monthlyRecords);
  const months = [...new Set(items.map((item) => item.month || currentMonth))];
  return months.map((month) => {
    const monthItems = items.filter((item) => (item.month || currentMonth) === month);
    const categorySum = (category) => monthItems
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const kindSum = (kind) => monthItems
      .filter((item) => item.kind === kind)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return {
      month,
      income: kindSum("income"),
      expense: kindSum("expense"),
      familyBalance: categorySum("现金资产"),
      housingFund: 0,
      debt: kindSum("debt"),
      investment: categorySum("投资资产")
    };
  });
}

function dedupeWorkoutDates(workouts) {
  return dedupeDateRecords(workouts);
}

function dedupeDateRecords(records) {
  const seen = new Set();
  return (records || []).filter((item) => {
    if (!item?.date || seen.has(item.date)) return false;
    seen.add(item.date);
    return true;
  }).map((item) => ({ id: item.id || uid(), date: item.date }));
}

function saveState() {
  try {
    persistState(state);
    scheduleCloudSync();
  } catch {
    toast("保存失败，请先导出数据备份");
  }
}

function persistState(nextState) {
  const normalized = normalizeState(structuredClone(nextState));
  const payload = JSON.stringify(normalized);
  const backup = JSON.stringify({ savedAt: new Date().toISOString(), state: normalized });
  localStorage.setItem(STORAGE_KEY, payload);
  try {
    localStorage.setItem(STORAGE_MIRROR_KEY, payload);
  } catch {
    // Primary save already succeeded; mirror storage is best-effort.
  }
  try {
    localStorage.setItem(STORAGE_BACKUP_KEY, backup);
  } catch {
    // Primary save already succeeded; backup storage is best-effort.
  }
}

function setDefaultDates() {
  $("#assetMonth").value = currentMonth;
}

function bindNavigation() {
  $$(".module-tab").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      showView(view);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function bindFitness() {
  $("#clearWorkoutsBtn").addEventListener("click", () => {
    if (!confirm("清空所有健身和爱爱记录吗？")) return;
    state.workouts = [];
    state.loveDays = [];
    saveState();
    renderAll();
  });

  $("#prevFitnessMonth").addEventListener("click", () => {
    selectedWorkoutMonth = addMonths(selectedWorkoutMonth, -1);
    selectedWorkoutDate = firstWorkoutDateInMonth(selectedWorkoutMonth) || `${selectedWorkoutMonth}-01`;
    renderFitness();
  });

  $("#nextFitnessMonth").addEventListener("click", () => {
    selectedWorkoutMonth = addMonths(selectedWorkoutMonth, 1);
    selectedWorkoutDate = firstWorkoutDateInMonth(selectedWorkoutMonth) || `${selectedWorkoutMonth}-01`;
    renderFitness();
  });

  $("#todayFitnessMonth").addEventListener("click", () => {
    selectedWorkoutMonth = currentMonth;
    selectedWorkoutDate = todayISO;
    renderFitness();
  });

  $("#toggleWorkoutBtn").addEventListener("click", () => {
    toggleWorkoutCheckin(selectedWorkoutDate);
  });

  $("#toggleLoveBtn").addEventListener("click", () => {
    toggleLoveCheckin(selectedWorkoutDate);
  });
}

function bindAssets() {
  $("#assetForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const record = normalizeMonthlyRecord({
      month: $("#assetMonth").value,
      income: $("#monthlyIncome").value,
      expense: $("#monthlyExpense").value,
      familyBalance: $("#familyBalance").value,
      housingFund: $("#housingFund").value,
      debt: $("#monthlyDebt").value,
      investment: $("#investmentBalance").value
    });
    state.monthlyRecords = [
      record,
      ...state.monthlyRecords.filter((item) => item.month !== record.month)
    ].sort((a, b) => b.month.localeCompare(a.month));
    saveState();
    renderAll();
    toast("本月家庭快照已保存");
  });

  $("#snapshotMonthFilter").addEventListener("change", renderAssets);
}

function bindTravel() {
  $("#tripForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (new Date($("#startDate").value) > new Date($("#endDate").value)) {
      toast("回来日期不能早于出发日期");
      return;
    }

    const id = $("#tripId").value;
    const existing = state.trips.find((trip) => trip.id === id);
    const nextTrip = {
      id: id || uid(),
      destination: $("#destination").value.trim(),
      startDate: $("#startDate").value,
      endDate: $("#endDate").value,
      budget: Number($("#budget").value || 0),
      cost: Number($("#cost").value || 0),
      companions: $("#companions").value.trim(),
      guide: $("#guide").value.trim(),
      memory: $("#memory").value.trim(),
      photos: pendingPhotos.length ? pendingPhotos : existing?.photos || []
    };

    state.trips = existing ? state.trips.map((trip) => (trip.id === id ? nextTrip : trip)) : [nextTrip, ...state.trips];
    saveState();
    resetTripForm();
    $("#tripEditor").classList.add("is-collapsed");
    renderAll();
    toast("旅行已保存");
  });

  $("#resetTripBtn").addEventListener("click", resetTripForm);
  $("#newTripBtn").addEventListener("click", () => {
    resetTripForm();
    openTripEditor();
  });
  $("#closeTripBtn").addEventListener("click", () => {
    $("#tripEditor").classList.add("is-collapsed");
  });
  $("#travelSearch").addEventListener("input", renderTravel);
  $("#travelYearFilter").addEventListener("change", renderTravel);
  $("#photos").addEventListener("change", async (event) => {
    pendingPhotos = await Promise.all([...event.target.files].map(readFile));
    renderPhotoPreview();
  });
}

function bindBirthdays() {
  $("#birthdayForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const id = $("#birthdayId").value;
    const existing = state.birthdays.find((item) => item.id === id);
    const birthday = {
      id: id || uid(),
      name: $("#birthdayName").value.trim(),
      relation: $("#birthdayRelation").value.trim(),
      calendar: $("#birthdayCalendar").value,
      date: $("#birthdayDate").value,
      note: $("#birthdayNote").value.trim()
    };
    state.birthdays = existing
      ? state.birthdays.map((item) => (item.id === id ? birthday : item))
      : [birthday, ...state.birthdays];
    saveState();
    resetBirthdayForm();
    closeBirthdayEditor();
    renderAll();
    toast("生日已保存");
  });

  $("#newBirthdayBtn").addEventListener("click", () => {
    resetBirthdayForm();
    openBirthdayEditor();
  });
  $("#cancelBirthdayBtn").addEventListener("click", () => {
    resetBirthdayForm();
    closeBirthdayEditor();
  });
  $("#birthdayEditor").addEventListener("click", (event) => {
    if (event.target.id === "birthdayEditor") {
      resetBirthdayForm();
      closeBirthdayEditor();
    }
  });
  $("#birthdaySearch").addEventListener("input", renderBirthdays);
  $("[data-birthday-filter='all']").classList.add("active");
  $$("[data-birthday-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedBirthdayFilter = button.dataset.birthdayFilter;
      renderBirthdays();
    });
  });
  $$("[data-relation-value]").forEach((button) => {
    button.addEventListener("click", () => setBirthdayRelation(button.dataset.relationValue));
  });
  $$("[data-calendar-value]").forEach((button) => {
    button.addEventListener("click", () => setBirthdayCalendar(button.dataset.calendarValue));
  });
}

function bindDataTools() {
  $("#cloudSyncUrl").value = localStorage.getItem(CLOUD_SYNC_URL_KEY) || "";
  updateCloudStatus();

  $("#cloudBtn").addEventListener("click", () => {
    showView("dashboard");
    openCloudSyncPanel();
  });
  $("#closeCloudSyncBtn").addEventListener("click", closeCloudSyncPanel);
  $("#cloudSyncPanel").addEventListener("click", (event) => {
    if (event.target.id === "cloudSyncPanel") closeCloudSyncPanel();
  });

  $("#saveCloudUrlBtn").addEventListener("click", () => {
    const url = $("#cloudSyncUrl").value.trim();
    if (url) {
      localStorage.setItem(CLOUD_SYNC_URL_KEY, url);
      toast("同步地址已保存");
      syncToCloud(true);
    } else {
      localStorage.removeItem(CLOUD_SYNC_URL_KEY);
      updateCloudStatus("未配置");
      toast("已关闭云端同步");
    }
  });

  $("#uploadCloudBtn").addEventListener("click", () => syncToCloud(true));

  $("#restoreCloudBtn").addEventListener("click", async () => {
    if (!confirm("用云端数据覆盖本机数据吗？")) return;
    await restoreFromCloud();
  });

  $("#privacyBtn").addEventListener("click", () => {
    document.body.classList.toggle("hide-money");
  });

  $("#exportBtn")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), state }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `feifei-life-cockpit-${todayISO}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  $("#importInput")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      state = normalizeState(data.state || data);
      saveState();
      renderAll();
      toast("数据已导入");
    } catch {
      toast("导入失败，请选择工作台导出的 JSON");
    } finally {
      event.target.value = "";
    }
  });
}

function showView(view) {
  $$(".module-tab").forEach((tab) => {
    const isActive = tab.dataset.view === view;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
  $$(".view").forEach((panel) => panel.classList.toggle("active", panel.dataset.viewPanel === view));
  updateHeaderTitle(view);
}

function updateHeaderTitle(view) {
  const header = viewTitles[view] || viewTitles.dashboard;
  $("#appHeaderTitle").textContent = header.title;
  $("#appHeaderCopy").textContent = header.copy;
}

function scheduleCloudSync() {
  const url = localStorage.getItem(CLOUD_SYNC_URL_KEY);
  if (!url) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => syncToCloud(false), 900);
}

async function syncToCloud(showToast) {
  const url = localStorage.getItem(CLOUD_SYNC_URL_KEY);
  if (!url) {
    updateCloudStatus("未配置");
    if (showToast) toast("先填写同步地址");
    return;
  }

  updateCloudStatus("同步中...");
  try {
    const payload = {
      savedAt: new Date().toISOString(),
      state: normalizeState(structuredClone(state))
    };
    await postCloudPayload(url, payload);
    updateCloudStatus(`已同步 ${formatTime(new Date())}`);
    if (showToast) toast("已上传云端");
  } catch {
    updateCloudStatus("同步失败");
    if (showToast) toast("云端同步失败");
  }
}

async function restoreFromCloud() {
  const url = localStorage.getItem(CLOUD_SYNC_URL_KEY);
  if (!url) {
    toast("先填写同步地址");
    return;
  }

  updateCloudStatus("恢复中...");
  try {
    const data = await fetchCloudPayload(url);
    state = normalizeState(data.state || data);
    saveState();
    renderAll();
    updateCloudStatus(`已恢复 ${formatTime(new Date())}`);
    toast("已从云端恢复");
  } catch {
    updateCloudStatus("恢复失败");
    toast("云端恢复失败");
  }
}

function updateCloudStatus(text) {
  const el = $("#cloudSyncStatus");
  if (!el) return;
  const url = localStorage.getItem(CLOUD_SYNC_URL_KEY);
  el.textContent = text || (url ? "已配置" : "未配置");
}

async function postCloudPayload(url, payload) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("cloud post failed");
  } catch {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(payload)
    });
  }
}

async function fetchCloudPayload(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("cloud fetch failed");
    return response.json();
  } catch {
    return fetchCloudJsonp(url);
  }
}

function fetchCloudJsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `feifeiCloud${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("cloud jsonp timeout"));
    }, 12000);

    function cleanup() {
      clearTimeout(timer);
      script.remove();
      delete window[callbackName];
    }

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("cloud jsonp failed"));
    };
    script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${callbackName}`;
    document.body.appendChild(script);
  });
}

function bindInstall() {
  const installBtn = $("#installBtn");
  if (!installBtn) return;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installBtn.hidden = false;
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      toast("手机浏览器里可通过分享菜单添加到主屏幕");
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    installBtn.hidden = true;
    toast("已安装到桌面");
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register(`./service-worker.js?version=${APP_VERSION}`, { updateViaCache: "none" }).then((registration) => {
      registration.update();

      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            worker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    }).catch(() => {});
  });
}

function renderAll() {
  renderBirthdays();
  renderFitness();
  renderAssets();
  renderTravel();
}

function renderBirthdays() {
  const sorted = sortedBirthdays();
  const filtered = filterBirthdays(sorted);
  const next = sorted[0];
  const thisMonth = state.birthdays.filter((item) => item.date.slice(5, 7) === String(today.getMonth() + 1).padStart(2, "0"));
  const relationCounts = birthdayRelationCounts();

  $("#birthdayMonthCount").textContent = thisMonth.length;
  $("#birthdayNextName").textContent = next ? next.name : "暂无";
  $("#birthdayTotalCount").textContent = state.birthdays.length;
  $$("[data-birthday-count]").forEach((item) => {
    item.textContent = relationCounts[item.dataset.birthdayCount] || 0;
  });
  $$("[data-birthday-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.birthdayFilter === selectedBirthdayFilter);
  });

  $("#birthdayList").innerHTML = filtered
    .map((item) => {
      const nextInfo = nextBirthdayInfo(item.date);
      const age = birthdayAge(item.date, nextInfo.nextDate);
      return `
        <button class="birthday-card" type="button" data-open-birthday="${item.id}" aria-label="编辑 ${escapeHtml(item.name)} 的生日">
          <div class="birthday-body">
            <div class="birthday-top">
              <div>
                <h3>${escapeHtml(item.name)} <span>${escapeHtml(item.relation || "家人")}</span></h3>
                <div class="muted">${birthdayCalendarLabel(item.calendar)}：${formatBirthdayMonthDay(item.date)}${age ? ` · ${age}岁生日` : ""}</div>
              </div>
              <div class="birthday-countdown"><strong>${nextInfo.daysLeft === 0 ? "今天" : nextInfo.daysLeft}</strong><span>${nextInfo.daysLeft === 0 ? "生日" : "天后"}</span></div>
            </div>
          </div>
        </button>
      `;
    })
    .join("") || `<div class="muted">还没有生日记录。</div>`;

  $$("[data-open-birthday]").forEach((button) => button.addEventListener("click", () => editBirthday(button.dataset.openBirthday)));
}

function renderFitness() {
  const week = workoutsThisWeek();
  const monthWorkouts = state.workouts.filter((item) => item.date.startsWith(selectedWorkoutMonth));
  const monthLoveDays = state.loveDays.filter((item) => item.date.startsWith(selectedWorkoutMonth));
  $("#fitMonthDays").textContent = uniqueWorkoutDays(monthWorkouts);
  $("#fitWeekCount").textContent = uniqueWorkoutDays(week);
  $("#fitLoveCount").textContent = uniqueDateRecords(monthLoveDays);
  $("#fitnessMonthTitle").textContent = formatMonthTitle(selectedWorkoutMonth);
  renderSelectedDayControls();
  renderFitnessCalendar();
  renderSelectedWorkoutList();
}

function renderSelectedDayControls() {
  const hasWorkout = state.workouts.some((item) => item.date === selectedWorkoutDate);
  const hasLove = state.loveDays.some((item) => item.date === selectedWorkoutDate);
  $("#selectedQuickTitle").textContent = formatDate(selectedWorkoutDate);
  $("#toggleWorkoutBtn").textContent = hasWorkout ? "取消健身" : "标记健身";
  $("#toggleWorkoutBtn").classList.toggle("active", hasWorkout);
  $("#toggleLoveBtn").textContent = hasLove ? "取消爱爱" : "标记爱爱";
  $("#toggleLoveBtn").classList.toggle("active", hasLove);
}

function renderFitnessCalendar() {
  const days = getCalendarDays(selectedWorkoutMonth);
  const workoutsByDate = state.workouts.reduce((map, item) => {
    if (!map.has(item.date)) map.set(item.date, []);
    map.get(item.date).push(item);
    return map;
  }, new Map());
  const loveDates = new Set(state.loveDays.map((item) => item.date));

  $("#fitnessCalendar").innerHTML = days
    .map((day) => {
      if (!day) return `<div class="calendar-cell empty" aria-hidden="true"></div>`;
      const date = `${selectedWorkoutMonth}-${String(day).padStart(2, "0")}`;
      const items = workoutsByDate.get(date) || [];
      const hasLove = loveDates.has(date);
      const isToday = date === todayISO;
      const isSelected = date === selectedWorkoutDate;
      return `
        <button class="calendar-cell ${items.length ? "trained" : ""} ${hasLove ? "loved" : ""} ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}" type="button" data-workout-date="${date}" aria-label="${date}，${items.length ? "已健身" : "未健身"}，${hasLove ? "有爱爱" : "无爱爱"}">
          <span class="calendar-day">${day}</span>
          <span class="calendar-marks">
            ${items.length ? `<strong class="workout-mark" aria-hidden="true">●</strong>` : ""}
            ${hasLove ? `<strong class="love-mark" aria-hidden="true">♥</strong>` : ""}
          </span>
          ${!items.length && !hasLove ? `<small class="tap-copy">选择</small>` : ""}
        </button>
      `;
    })
    .join("");

  $$("[data-workout-date]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedWorkoutDate = button.dataset.workoutDate;
      renderFitness();
    });
  });
}

function renderSelectedWorkoutList() {
  const selectedItems = sortedWorkouts().filter((item) => item.date === selectedWorkoutDate);
  const hasLove = state.loveDays.some((item) => item.date === selectedWorkoutDate);
  const status = [
    selectedItems.length ? "已健身" : "未健身",
    hasLove ? "有爱爱" : ""
  ].filter(Boolean).join(" · ");
  $("#selectedWorkoutTitle").textContent = `${formatDate(selectedWorkoutDate)} · ${status}`;
  $("#selectedWorkoutList").innerHTML = `
      <article class="log-item">
        <div><strong>${selectedItems.length ? "今天健身了" : "今天还没健身"}</strong></div>
      </article>
      <article class="log-item">
        <div><strong>${hasLove ? "今天有爱爱" : "今天没有爱爱"}</strong></div>
      </article>
    `;
}

function toggleWorkoutCheckin(date) {
  if (state.workouts.some((item) => item.date === date)) {
    state.workouts = state.workouts.filter((item) => item.date !== date);
    toast("已取消健身记录");
  } else {
    state.workouts.unshift({ id: uid(), date });
    toast("已记录健身");
  }
  selectedWorkoutMonth = date.slice(0, 7);
  saveState();
  renderAll();
}

function toggleLoveCheckin(date) {
  if (state.loveDays.some((item) => item.date === date)) {
    state.loveDays = state.loveDays.filter((item) => item.date !== date);
    toast("已取消爱爱");
  } else {
    state.loveDays.unshift({ id: uid(), date });
    toast("已标记爱爱");
  }
  selectedWorkoutMonth = date.slice(0, 7);
  saveState();
  renderAll();
}

function renderAssets() {
  renderFinanceMonthOptions();
  const month = selectedFinanceMonth();
  const summary = financeSummary(month);
  const record = monthlyRecord(month);
  fillMonthlyForm(record);
  $("#monthlySurplus").textContent = formatSigned(summary.surplus);
  $("#totalBalance").textContent = formatMoney(summary.totalBalance);
  $("#netWorth").textContent = formatMoney(summary.net);

  $("#snapshotGrid").innerHTML = [
    ["家庭收入", record.income],
    ["总支出", record.expense],
    ["家庭余额", record.familyBalance],
    ["公积金余额", record.housingFund],
    ["负债", record.debt],
    ["理财", record.investment]
  ]
    .map(([label, value]) => `<div class="snapshot-item"><span>${label}</span><strong class="money-text">${formatMoney(value)}</strong></div>`)
    .join("");

  const trend = [...state.monthlyRecords].sort((a, b) => b.month.localeCompare(a.month)).slice(0, 6);
  const max = Math.max(...trend.map((item) => Math.abs(financeSummary(item.month).net)), 1);
  $("#monthlyTrend").innerHTML = trend
    .map((item) => {
      const itemSummary = financeSummary(item.month);
      return `
        <div class="asset-bar">
          <div class="asset-bar-top"><strong>${item.month}</strong><span class="money-text">${formatMoney(itemSummary.net)}</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.max((Math.abs(itemSummary.net) / max) * 100, 4)}%;background:var(--green)"></div></div>
          <div class="muted">收入 ${formatMoney(item.income)} · 支出 ${formatMoney(item.expense)}</div>
        </div>
      `;
    })
    .join("");
}

function renderTravel() {
  const sorted = [...state.trips].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  renderTravelYearOptions(sorted);
  const filtered = filterTrips(sorted);
  const annualYear = selectedTravelYear(sorted);
  const annualTrips = sorted.filter((trip) => new Date(trip.startDate).getFullYear().toString() === annualYear);
  const annualTotal = annualTrips.reduce((sum, trip) => sum + Number(trip.cost || 0), 0);
  $("#travelYearCount").textContent = `${annualTrips.length} 次`;
  $("#travelYearTotal").textContent = formatMoney(annualTotal);
  $("#travelCount").textContent = state.trips.length;

  const byYear = groupTripStatsByYear(sorted);
  const max = Math.max(...Object.values(byYear).map((item) => item.cost), 1);
  $("#travelYearChart").innerHTML = Object.entries(byYear)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, item]) => `
      <div class="asset-bar">
        <div class="asset-bar-top"><strong>${year} · ${item.count} 次</strong><span class="money-text">${formatMoney(item.cost)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max((item.cost / max) * 100, 4)}%;background:var(--green)"></div></div>
      </div>
    `)
    .join("");

  $("#timeline").innerHTML = filtered
    .map((trip) => `
      <article class="trip-card">
        <div class="trip-date">${new Date(trip.startDate).getFullYear()}<strong>${formatMonthDay(trip.startDate)}</strong></div>
        <div class="trip-body">
          <div class="trip-top">
            <div><h3>${escapeHtml(trip.destination)}</h3><div class="muted">${formatDate(trip.startDate)} - ${formatDate(trip.endDate)} · ${trip.companions || "自己"}</div></div>
            <div class="trip-cost money-text">${formatMoney(trip.cost)}</div>
          </div>
          <div class="trip-notes">
            <div><strong>攻略</strong><div>${escapeHtml(trip.guide || "还没有写攻略。")}</div></div>
            <div><strong>回忆</strong><div>${escapeHtml(trip.memory || "还没有写回忆。")}</div></div>
          </div>
          ${trip.photos?.length ? `<div class="photo-grid">${trip.photos.map((src) => `<img src="${src}" alt="${escapeHtml(trip.destination)} 的旅行照片">`).join("")}</div>` : ""}
          <div class="trip-actions">
            <button class="text-button" type="button" data-edit-trip="${trip.id}">编辑</button>
            <button class="text-button danger" type="button" data-delete-trip="${trip.id}">删除</button>
          </div>
        </div>
      </article>
    `)
    .join("") || `<div class="muted">还没有符合条件的旅行记录。</div>`;

  $$("[data-edit-trip]").forEach((button) => button.addEventListener("click", () => editTrip(button.dataset.editTrip)));
  $$("[data-delete-trip]").forEach((button) => button.addEventListener("click", () => deleteTrip(button.dataset.deleteTrip)));
}

function financeSummary(month) {
  const record = monthlyRecord(month);
  const totalBalance = record.familyBalance + record.housingFund + record.investment;
  const net = totalBalance - record.debt;
  return {
    income: record.income,
    expense: record.expense,
    familyBalance: record.familyBalance,
    housingFund: record.housingFund,
    investment: record.investment,
    debt: record.debt,
    totalBalance,
    net,
    surplus: record.income - record.expense
  };
}

function renderFinanceMonthOptions() {
  const selected = $("#snapshotMonthFilter").value || currentMonth;
  $("#snapshotMonthFilter").innerHTML = monthlyRecordMonths()
    .map((month) => `<option value="${month}">${month}</option>`)
    .join("");
  $("#snapshotMonthFilter").value = monthlyRecordMonths().includes(selected) ? selected : monthlyRecordMonths()[0];
}

function renderTravelYearOptions(trips) {
  const selected = $("#travelYearFilter").value || "all";
  const years = [...new Set(trips.map((trip) => new Date(trip.startDate).getFullYear().toString()))].sort((a, b) => b.localeCompare(a));
  $("#travelYearFilter").innerHTML = `<option value="all">全部年份</option>${years.map((year) => `<option value="${year}">${year} 年</option>`).join("")}`;
  $("#travelYearFilter").value = years.includes(selected) ? selected : "all";
}

function selectedTravelYear(trips) {
  const selected = $("#travelYearFilter").value;
  if (selected && selected !== "all") return selected;
  const thisYear = today.getFullYear().toString();
  const years = [...new Set(trips.map((trip) => new Date(trip.startDate).getFullYear().toString()))];
  return years.includes(thisYear) ? thisYear : years.sort((a, b) => b.localeCompare(a))[0] || thisYear;
}

function filterTrips(trips) {
  const year = $("#travelYearFilter").value;
  const query = $("#travelSearch").value.trim().toLowerCase();
  return trips.filter((trip) => {
    const haystack = [trip.destination, trip.guide, trip.memory, trip.companions].join(" ").toLowerCase();
    return (year === "all" || new Date(trip.startDate).getFullYear().toString() === year) && (!query || haystack.includes(query));
  });
}

function groupByCategory(items) {
  const map = new Map();
  items.forEach((item) => {
    const key = `${item.kind}-${item.category}`;
    const current = map.get(key) || { kind: item.kind, category: item.category, amount: 0, count: 0 };
    current.amount += Number(item.amount || 0);
    current.count += 1;
    map.set(key, current);
  });
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

function groupTripStatsByYear(trips) {
  return trips.reduce((acc, trip) => {
    const year = new Date(trip.startDate).getFullYear();
    if (!acc[year]) acc[year] = { count: 0, cost: 0 };
    acc[year].count += 1;
    acc[year].cost += Number(trip.cost || 0);
    return acc;
  }, {});
}

function workoutsThisWeek() {
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() + 1);
  start.setHours(0, 0, 0, 0);
  return state.workouts.filter((item) => new Date(item.date) >= start);
}

function uniqueWorkoutDays(workouts) {
  return uniqueDateRecords(workouts);
}

function uniqueDateRecords(records) {
  return new Set(records.map((item) => item.date)).size;
}

function sortedWorkouts() {
  return [...state.workouts].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function getCalendarDays(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  const first = new Date(year, monthIndex - 1, 1);
  const last = new Date(year, monthIndex, 0);
  const mondayOffset = (first.getDay() + 6) % 7;
  return [...Array(mondayOffset).fill(null), ...Array.from({ length: last.getDate() }, (_, index) => index + 1)];
}

function firstWorkoutDateInMonth(month) {
  return sortedWorkouts().find((item) => item.date.startsWith(month))?.date;
}

function addMonths(month, delta) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function calcWorkoutStreak() {
  const dates = new Set(state.workouts.map((item) => item.date));
  let streak = 0;
  const cursor = new Date(todayISO);
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function sumByKind(items, kind) {
  return items.filter((item) => item.kind === kind).reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function monthlyRecord(month) {
  return state.monthlyRecords.find((item) => item.month === month) || normalizeMonthlyRecord({ month });
}

function fillMonthlyForm(record) {
  $("#assetMonth").value = record.month;
  $("#monthlyIncome").value = record.income || "";
  $("#monthlyExpense").value = record.expense || "";
  $("#familyBalance").value = record.familyBalance || "";
  $("#housingFund").value = record.housingFund || "";
  $("#monthlyDebt").value = record.debt || "";
  $("#investmentBalance").value = record.investment || "";
}

function monthlyRecordMonths() {
  const months = [...new Set([currentMonth, ...state.monthlyRecords.map((item) => item.month)])];
  return months.sort((a, b) => b.localeCompare(a));
}

function selectedFinanceMonth() {
  return $("#snapshotMonthFilter")?.value || monthlyRecordMonths()[0] || currentMonth;
}

function previousMonth(month) {
  const months = monthlyRecordMonths().sort((a, b) => b.localeCompare(a));
  return months[months.indexOf(month) + 1];
}

function editTrip(id) {
  const trip = state.trips.find((item) => item.id === id);
  if (!trip) return;
  openTripEditor();
  $("#tripId").value = trip.id;
  $("#destination").value = trip.destination;
  $("#startDate").value = trip.startDate;
  $("#endDate").value = trip.endDate;
  $("#budget").value = trip.budget || "";
  $("#cost").value = trip.cost || "";
  $("#companions").value = trip.companions || "";
  $("#guide").value = trip.guide || "";
  $("#memory").value = trip.memory || "";
  pendingPhotos = trip.photos || [];
  renderPhotoPreview();
  $("#tripFormTitle").textContent = "编辑这次旅行";
}

function openTripEditor() {
  $("#tripEditor").classList.remove("is-collapsed");
}

function deleteTrip(id) {
  if (!confirm("删除这次旅行吗？")) return;
  state.trips = state.trips.filter((item) => item.id !== id);
  saveState();
  renderAll();
}

function editBirthday(id) {
  const birthday = state.birthdays.find((item) => item.id === id);
  if (!birthday) return;
  $("#birthdayId").value = birthday.id;
  $("#birthdayName").value = birthday.name;
  $("#birthdayDate").value = birthday.date;
  $("#birthdayNote").value = birthday.note || "";
  $("#birthdayFormTitle").textContent = "编辑生日";
  setBirthdayRelation(birthday.relation || "家人");
  setBirthdayCalendar(birthday.calendar || "solar");
  openBirthdayEditor();
  $("#birthdayName").focus();
}

function deleteBirthday(id) {
  if (!confirm("删除这个生日吗？")) return;
  state.birthdays = state.birthdays.filter((item) => item.id !== id);
  saveState();
  resetBirthdayForm();
  renderAll();
}

function resetTripForm() {
  $("#tripForm").reset();
  $("#tripId").value = "";
  $("#tripFormTitle").textContent = "记录一次旅行";
  pendingPhotos = [];
  renderPhotoPreview();
}

function resetBirthdayForm() {
  $("#birthdayForm").reset();
  $("#birthdayId").value = "";
  $("#birthdayFormTitle").textContent = "新增生日";
  setBirthdayRelation("家人");
  setBirthdayCalendar("solar");
}

function openBirthdayEditor() {
  const editor = $("#birthdayEditor");
  editor.classList.remove("is-collapsed");
  editor.setAttribute("aria-hidden", "false");
}

function closeBirthdayEditor() {
  const editor = $("#birthdayEditor");
  editor.classList.add("is-collapsed");
  editor.setAttribute("aria-hidden", "true");
}

function openCloudSyncPanel() {
  const panel = $("#cloudSyncPanel");
  panel.classList.remove("is-collapsed");
  panel.setAttribute("aria-hidden", "false");
}

function closeCloudSyncPanel() {
  const panel = $("#cloudSyncPanel");
  panel.classList.add("is-collapsed");
  panel.setAttribute("aria-hidden", "true");
}

function renderPhotoPreview() {
  $("#photoPreview").innerHTML = pendingPhotos.map((src) => `<img src="${src}" alt="待保存的旅行照片">`).join("");
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatMoney(value) {
  return money.format(Number(value || 0));
}

function sortedBirthdays() {
  return [...state.birthdays].sort((a, b) => nextBirthdayInfo(a.date).daysLeft - nextBirthdayInfo(b.date).daysLeft);
}

function filterBirthdays(birthdays) {
  const query = $("#birthdaySearch").value.trim().toLowerCase();
  return birthdays.filter((item) => {
    const relation = item.relation || "家人";
    const haystack = [item.name, relation, item.note].join(" ").toLowerCase();
    const matchesFilter = selectedBirthdayFilter === "all" || relation === selectedBirthdayFilter;
    return matchesFilter && (!query || haystack.includes(query));
  });
}

function birthdayRelationCounts() {
  return state.birthdays.reduce((counts, item) => {
    const relation = item.relation || "家人";
    counts[relation] = (counts[relation] || 0) + 1;
    return counts;
  }, {});
}

function setBirthdayRelation(relation) {
  $("#birthdayRelation").value = relation;
  $$("[data-relation-value]").forEach((button) => {
    button.classList.toggle("active", button.dataset.relationValue === relation);
  });
}

function setBirthdayCalendar(calendar) {
  const value = calendar === "lunar" ? "lunar" : "solar";
  $("#birthdayCalendar").value = value;
  $$("[data-calendar-value]").forEach((button) => {
    button.classList.toggle("active", button.dataset.calendarValue === value);
  });
}

function nextBirthdayInfo(dateString) {
  const [, month, day] = dateString.split("-").map(Number);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let nextDate = new Date(today.getFullYear(), month - 1, day);
  if (nextDate < start) nextDate = new Date(today.getFullYear() + 1, month - 1, day);
  const daysLeft = Math.round((nextDate - start) / 86400000);
  return { nextDate, daysLeft };
}

function birthdayAge(dateString, nextDate) {
  const [year] = dateString.split("-").map(Number);
  if (!year || year < 1900) return "";
  return nextDate.getFullYear() - year;
}

function formatBirthdayMonthDay(dateString) {
  const [, month, day] = dateString.split("-").map(Number);
  return `${month}月${day}日`;
}

function birthdayCalendarLabel(calendar) {
  return calendar === "lunar" ? "阴历" : "阳历";
}

function formatSigned(value) {
  const prefix = value >= 0 ? "+" : "-";
  return `${prefix}${formatMoney(Math.abs(value))}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date(date));
}

function formatMonthTitle(month) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(new Date(`${month}-01`));
}

function formatMonthDay(date) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(date));
}

function formatTime(date) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function shiftDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function uid() {
  return crypto.randomUUID();
}

function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 1800);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
