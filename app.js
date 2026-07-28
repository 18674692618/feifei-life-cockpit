const STORAGE_KEY = "feifei-life-cockpit-v1";
const oldTripKey = "feifei-travel-world-v1";

const today = new Date();
const currentMonth = today.toISOString().slice(0, 7);
const todayISO = today.toISOString().slice(0, 10);

const defaultState = {
  workouts: [
    { id: uid(), date: todayISO, type: "力量", minutes: 45, intensity: "适中", note: "下肢和核心，深蹲 4 组，状态不错。" },
    { id: uid(), date: shiftDate(-2), type: "散步", minutes: 50, intensity: "轻松", note: "晚饭后快走，顺便整理思路。" },
    { id: uid(), date: shiftDate(-4), type: "普拉提", minutes: 40, intensity: "较累", note: "肩颈打开很多。" }
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
  ]
};

let state = loadState();
let pendingPhotos = [];
let selectedWorkoutMonth = currentMonth;
let selectedWorkoutDate = todayISO;
let deferredInstallPrompt = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const money = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 });

init();

function init() {
  setDefaultDates();
  bindNavigation();
  bindFitness();
  bindAssets();
  bindTravel();
  bindDataTools();
  bindInstall();
  registerServiceWorker();
  renderAll();
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...defaultState, ...JSON.parse(saved) };

    const oldTrips = localStorage.getItem(oldTripKey);
    if (oldTrips) {
      const parsedTrips = JSON.parse(oldTrips);
      if (Array.isArray(parsedTrips)) return { ...defaultState, trips: parsedTrips };
    }
  } catch {
    return structuredClone(defaultState);
  }
  return structuredClone(defaultState);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setDefaultDates() {
  $("#workoutDate").value = todayISO;
  $("#assetMonth").value = currentMonth;
}

function bindNavigation() {
  $$(".module-tab").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      $$(".module-tab").forEach((tab) => {
        const isActive = tab.dataset.view === view;
        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
      });
      $$(".view").forEach((panel) => panel.classList.toggle("active", panel.dataset.viewPanel === view));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function bindFitness() {
  $("#fitnessForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const date = $("#workoutDate").value;
    state.workouts.unshift({
      id: uid(),
      date,
      type: $("#workoutType").value,
      minutes: Number($("#workoutMinutes").value || 30),
      intensity: $("#workoutIntensity").value,
      note: $("#workoutNote").value.trim()
    });
    selectedWorkoutDate = date;
    selectedWorkoutMonth = date.slice(0, 7);
    saveState();
    $("#fitnessForm").reset();
    $("#workoutDate").value = todayISO;
    renderAll();
    toast("训练已保存");
  });

  $("#clearWorkoutsBtn").addEventListener("click", () => {
    if (!confirm("清空所有训练记录吗？")) return;
    state.workouts = [];
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
}

function bindAssets() {
  $("#assetForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.financeItems.push({
      id: uid(),
      month: $("#assetMonth").value,
      kind: $("#financeKind").value,
      category: $("#financeCategory").value,
      name: $("#financeName").value.trim(),
      amount: Number($("#financeAmount").value),
      owner: $("#financeOwner").value.trim() || "家庭",
      note: $("#financeNote").value.trim()
    });
    saveState();
    $("#assetForm").reset();
    $("#assetMonth").value = currentMonth;
    renderAll();
    toast("已写入月度快照");
  });

  $("#snapshotMonthFilter").addEventListener("change", renderAssets);

  $("#copySnapshotBtn").addEventListener("click", () => {
    const months = financeMonths();
    const latest = months[0];
    const sourceMonth = months[1] || latest;
    if (!sourceMonth) return;
    const copied = state.financeItems
      .filter((item) => item.month === sourceMonth && ["asset", "debt"].includes(item.kind))
      .map((item) => ({ ...item, id: uid(), month: currentMonth, note: `${item.note || ""} 由 ${sourceMonth} 复制。`.trim() }));
    state.financeItems = state.financeItems.filter((item) => !(item.month === currentMonth && ["asset", "debt"].includes(item.kind))).concat(copied);
    saveState();
    renderAll();
    toast("已复制上月资产与负债");
  });

  $("#simulateVoiceBtn").addEventListener("click", () => {
    const drafts = [
      { kind: "income", category: "工资奖金", name: "语音草稿：工资", amount: 20000, note: "模拟：工资两万。" },
      { kind: "debt", category: "房贷", name: "语音草稿：房贷余额下降", amount: 5000, note: "模拟：房贷还了五千，正式版本应确认后入账。" },
      { kind: "gain", category: "投资盈亏", name: "语音草稿：股票收益", amount: 3000, note: "模拟：股票涨了三千。" }
    ];
    state.financeItems.push(...drafts.map((item) => ({ id: uid(), month: selectedFinanceMonth(), owner: "家庭", ...item })));
    saveState();
    renderAll();
    toast("已生成待确认语音草稿");
  });
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
    renderAll();
    toast("旅行已保存");
  });

  $("#resetTripBtn").addEventListener("click", resetTripForm);
  $("#travelSearch").addEventListener("input", renderTravel);
  $("#travelYearFilter").addEventListener("change", renderTravel);
  $("#photos").addEventListener("change", async (event) => {
    pendingPhotos = await Promise.all([...event.target.files].map(readFile));
    renderPhotoPreview();
  });
}

function bindDataTools() {
  $("#privacyBtn").addEventListener("click", () => {
    document.body.classList.toggle("hide-money");
  });

  $("#exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), state }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `feifei-life-cockpit-${todayISO}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  $("#importInput").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      state = data.state || data;
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
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

function renderAll() {
  renderDashboard();
  renderFitness();
  renderAssets();
  renderTravel();
}

function renderDashboard() {
  const finance = financeSummary(selectedFinanceMonth());
  const travelCost = state.trips.reduce((sum, trip) => sum + Number(trip.cost || 0), 0);
  const recentTrip = [...state.trips].sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];
  const week = workoutsThisWeek();

  $("#dashNetWorth").textContent = formatMoney(finance.net);
  $("#dashAssetChange").textContent = `较上月 ${formatSigned(finance.change)}`;
  $("#dashDebtRatio").textContent = `负债率 ${finance.debtRatio.toFixed(1)}%`;
  $("#dashWorkoutCount").textContent = `${uniqueWorkoutDays(week)} 天`;
  $("#dashWorkoutProgress").style.width = `${Math.min((uniqueWorkoutDays(week) / 4) * 100, 100)}%`;
  $("#dashTravelCost").textContent = formatMoney(travelCost);
  $("#dashTripCount").textContent = `${state.trips.length} 次旅行`;
  $("#dashLastTrip").textContent = recentTrip ? `最近：${recentTrip.destination}` : "暂无记录";

  $("#focusList").innerHTML = [
    ["练", uniqueWorkoutDays(week) >= 4 ? "本周锻炼已达标" : `本周还差 ${4 - uniqueWorkoutDays(week)} 天锻炼`, "日历点一下，就能把这个月哪些天动了记下来。"],
    ["资", "更新本月资产快照", "资产方案采用每月一次盘点，不追求高频流水。"],
    ["旅", recentTrip ? `补完 ${recentTrip.destination} 的照片或回忆` : "记录最近一次旅行", "以后按年份回看成本和回忆。"]
  ]
    .map(([icon, title, copy]) => `<div class="focus-item"><span class="focus-icon">${icon}</span><div><strong>${title}</strong><div class="muted">${copy}</div></div></div>`)
    .join("");

  $("#signalList").innerHTML = [
    ["资产健康", finance.debtRatio > 45 ? "负债率偏高，适合重点复盘。" : "负债率处在可观察区间。"],
    ["现金安全垫", finance.cash < 120000 ? "现金安全垫未达 12 万目标。" : "现金安全垫已达标。"],
    ["旅行预算", travelCost > 0 ? `历史单次平均 ${formatMoney(Math.round(travelCost / state.trips.length))}` : "还没有旅行成本记录。"]
  ]
    .map(([title, copy]) => `<div class="signal-item"><strong>${title}</strong><span class="muted">${copy}</span></div>`)
    .join("");
}

function renderFitness() {
  const week = workoutsThisWeek();
  const monthWorkouts = state.workouts.filter((item) => item.date.startsWith(selectedWorkoutMonth));
  $("#fitMonthDays").textContent = uniqueWorkoutDays(monthWorkouts);
  $("#fitWeekCount").textContent = uniqueWorkoutDays(week);
  $("#fitWeekMinutes").textContent = week.reduce((sum, item) => sum + item.minutes, 0);
  $("#fitnessMonthTitle").textContent = `${formatMonthTitle(selectedWorkoutMonth)} 训练日历`;
  renderFitnessCalendar();
  renderSelectedWorkoutList();
}

function renderFitnessCalendar() {
  const days = getCalendarDays(selectedWorkoutMonth);
  const workoutsByDate = state.workouts.reduce((map, item) => {
    if (!map.has(item.date)) map.set(item.date, []);
    map.get(item.date).push(item);
    return map;
  }, new Map());

  $("#fitnessCalendar").innerHTML = days
    .map((day) => {
      if (!day) return `<div class="calendar-cell empty" aria-hidden="true"></div>`;
      const date = `${selectedWorkoutMonth}-${String(day).padStart(2, "0")}`;
      const items = workoutsByDate.get(date) || [];
      const minutes = items.reduce((sum, item) => sum + item.minutes, 0);
      const isToday = date === todayISO;
      const isSelected = date === selectedWorkoutDate;
      return `
        <button class="calendar-cell ${items.length ? "trained" : ""} ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}" type="button" data-workout-date="${date}" aria-label="${date}，${items.length} 次训练">
          <span class="calendar-day">${day}</span>
          ${items.length ? `<strong>已锻炼</strong><small>${items.length} 次 · ${minutes} 分钟</small><i style="--dots:${Math.min(items.length, 4)}"></i>` : `<small class="tap-copy">点击记录</small>`}
        </button>
      `;
    })
    .join("");

  $$("[data-workout-date]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedWorkoutDate = button.dataset.workoutDate;
      $("#workoutDate").value = selectedWorkoutDate;
      const alreadyRecorded = state.workouts.some((item) => item.date === selectedWorkoutDate);
      if (!alreadyRecorded) {
        addWorkoutCheckin(selectedWorkoutDate);
        toast("已记录锻炼");
      } else {
        renderFitness();
      }
    });
  });
}

function renderSelectedWorkoutList() {
  const selectedItems = sortedWorkouts().filter((item) => item.date === selectedWorkoutDate);
  const totalMinutes = selectedItems.reduce((sum, item) => sum + item.minutes, 0);
  $("#selectedWorkoutTitle").textContent = `${formatDate(selectedWorkoutDate)} · ${selectedItems.length} 次 · ${totalMinutes} 分钟`;
  $("#selectedWorkoutList").innerHTML = selectedItems
    .map((item) => `
      <article class="log-item">
        <div><strong>${escapeHtml(item.type)} · ${item.minutes} 分钟</strong><div class="muted">${item.intensity}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</div></div>
        <button class="text-button danger" type="button" data-delete-workout="${item.id}">删除</button>
      </article>
    `)
    .join("") || `<div class="muted">这一天还没有锻炼记录。点日历上的日期就能直接打卡。</div>`;

  $$("[data-delete-workout]").forEach((button) => {
    button.addEventListener("click", () => {
      state.workouts = state.workouts.filter((item) => item.id !== button.dataset.deleteWorkout);
      saveState();
      renderAll();
    });
  });
}

function addWorkoutCheckin(date) {
  state.workouts.unshift({
    id: uid(),
    date,
    type: "锻炼打卡",
    minutes: 30,
    intensity: "适中",
    note: "日历点击记录。"
  });
  selectedWorkoutMonth = date.slice(0, 7);
  saveState();
  renderAll();
}

function renderAssets() {
  renderFinanceMonthOptions();
  const month = selectedFinanceMonth();
  const summary = financeSummary(month);
  $("#assetTotal").textContent = formatMoney(summary.assets);
  $("#debtTotal").textContent = formatMoney(summary.debts);
  $("#netWorth").textContent = formatMoney(summary.net);

  const composition = groupByCategory(state.financeItems.filter((item) => item.month === month && ["asset", "debt"].includes(item.kind)));
  const max = Math.max(...composition.map((item) => item.amount), 1);
  $("#assetBars").innerHTML = composition
    .map((item) => `
      <div class="asset-bar">
        <div class="asset-bar-top"><strong>${item.category}</strong><span class="money-text">${formatMoney(item.amount)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max((item.amount / max) * 100, 4)}%;background:${item.kind === "debt" ? "var(--red)" : "var(--green)"}"></div></div>
        <div class="muted">${item.count} 项 · ${item.kind === "debt" ? "负债" : "资产"}</div>
      </div>
    `)
    .join("");

  $("#changeGrid").innerHTML = [
    ["收入", summary.income, "green"],
    ["支出", -summary.expense, "red"],
    ["投资盈亏", summary.gain, summary.gain >= 0 ? "green" : "red"],
    ["净资产变化", summary.change, summary.change >= 0 ? "green" : "red"]
  ]
    .map(([label, value, color]) => `<div class="change-card"><span class="muted">${label}</span><strong style="color:var(--${color})">${formatSigned(value)}</strong></div>`)
    .join("");
}

function renderTravel() {
  const sorted = [...state.trips].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  renderTravelYearOptions(sorted);
  const filtered = filterTrips(sorted);
  const total = state.trips.reduce((sum, trip) => sum + Number(trip.cost || 0), 0);
  $("#travelTotal").textContent = formatMoney(total);
  $("#travelCount").textContent = state.trips.length;
  $("#travelAvg").textContent = formatMoney(state.trips.length ? Math.round(total / state.trips.length) : 0);

  const byYear = groupTripCostByYear(sorted);
  const max = Math.max(...Object.values(byYear), 1);
  $("#travelYearChart").innerHTML = Object.entries(byYear)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, amount]) => `
      <div class="asset-bar">
        <div class="asset-bar-top"><strong>${year}</strong><span class="money-text">${formatMoney(amount)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max((amount / max) * 100, 4)}%;background:var(--gold)"></div></div>
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
  const items = state.financeItems.filter((item) => item.month === month);
  const assets = sumByKind(items, "asset");
  const debts = sumByKind(items, "debt");
  const income = sumByKind(items, "income");
  const expense = sumByKind(items, "expense");
  const gain = sumByKind(items, "gain");
  const previous = previousMonth(month);
  const previousNet = previous ? sumByKind(state.financeItems.filter((item) => item.month === previous), "asset") - sumByKind(state.financeItems.filter((item) => item.month === previous), "debt") : assets - debts;
  const net = assets - debts;
  return {
    assets,
    debts,
    net,
    income,
    expense,
    gain,
    change: net - previousNet,
    debtRatio: assets ? (debts / assets) * 100 : 0,
    cash: items.filter((item) => item.category === "现金资产").reduce((sum, item) => sum + item.amount, 0)
  };
}

function renderFinanceMonthOptions() {
  const selected = $("#snapshotMonthFilter").value || currentMonth;
  $("#snapshotMonthFilter").innerHTML = financeMonths()
    .map((month) => `<option value="${month}">${month}</option>`)
    .join("");
  $("#snapshotMonthFilter").value = financeMonths().includes(selected) ? selected : financeMonths()[0];
}

function renderTravelYearOptions(trips) {
  const selected = $("#travelYearFilter").value || "all";
  const years = [...new Set(trips.map((trip) => new Date(trip.startDate).getFullYear().toString()))].sort((a, b) => b.localeCompare(a));
  $("#travelYearFilter").innerHTML = `<option value="all">全部年份</option>${years.map((year) => `<option value="${year}">${year} 年</option>`).join("")}`;
  $("#travelYearFilter").value = years.includes(selected) ? selected : "all";
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

function groupTripCostByYear(trips) {
  return trips.reduce((acc, trip) => {
    const year = new Date(trip.startDate).getFullYear();
    acc[year] = (acc[year] || 0) + Number(trip.cost || 0);
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
  return new Set(workouts.map((item) => item.date)).size;
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

function financeMonths() {
  return [...new Set(state.financeItems.map((item) => item.month))].sort((a, b) => b.localeCompare(a));
}

function selectedFinanceMonth() {
  return $("#snapshotMonthFilter")?.value || financeMonths()[0] || currentMonth;
}

function previousMonth(month) {
  const months = financeMonths().sort((a, b) => b.localeCompare(a));
  return months[months.indexOf(month) + 1];
}

function editTrip(id) {
  const trip = state.trips.find((item) => item.id === id);
  if (!trip) return;
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

function deleteTrip(id) {
  if (!confirm("删除这次旅行吗？")) return;
  state.trips = state.trips.filter((item) => item.id !== id);
  saveState();
  renderAll();
}

function resetTripForm() {
  $("#tripForm").reset();
  $("#tripId").value = "";
  $("#tripFormTitle").textContent = "记录一次旅行";
  pendingPhotos = [];
  renderPhotoPreview();
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
