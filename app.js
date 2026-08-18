"use strict";

(() => {
  const STORAGE_KEY = "workPlanner.state.v1";
  const STATE_VERSION = 1;
  const MAX_ORGANIZATIONS = 5;
  const MAX_ORGANIZATION_NAME_LENGTH = 100;
  const MAX_DESCRIPTION_LENGTH = 3000;
  const PLANNING_YEARS_AHEAD = 1;
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  const MONTH_FORMATTER = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
  const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("ru-RU", { weekday: "long" });
  const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

  const elements = {
    app: document.getElementById("app"),
    monthTitle: document.getElementById("monthTitle"),
    previousMonthButton: document.getElementById("previousMonthButton"),
    nextMonthButton: document.getElementById("nextMonthButton"),
    todayButton: document.getElementById("todayButton"),
    displayTasksButton: document.getElementById("displayTasksButton"),
    displayTasksButtonLabel: document.getElementById("displayTasksButtonLabel"),
    createTaskButton: document.getElementById("createTaskButton"),
    notebookButton: document.getElementById("notebookButton"),
    calendarHint: document.getElementById("calendarHint"),
    searchInput: document.getElementById("searchInput"),
    organizationFilter: document.getElementById("organizationFilter"),
    statusFilter: document.getElementById("statusFilter"),
    resetFiltersButton: document.getElementById("resetFiltersButton"),
    appMain: document.getElementById("appMain"),
    daySidebar: document.getElementById("daySidebar"),
    daySidebarEyebrow: document.getElementById("daySidebarEyebrow"),
    daySidebarTitle: document.getElementById("daySidebarTitle"),
    createSidebarTaskButton: document.getElementById("createSidebarTaskButton"),
    daySidebarTaskList: document.getElementById("daySidebarTaskList"),
    calendarPanel: document.getElementById("calendarPanel"),
    calendarGrid: document.getElementById("calendarGrid"),
    storageError: document.getElementById("storageError"),
    storageErrorTitle: document.getElementById("storageErrorTitle"),
    storageErrorText: document.getElementById("storageErrorText"),
    retryStorageButton: document.getElementById("retryStorageButton"),
    clearStorageButton: document.getElementById("clearStorageButton"),
    clearStorageDialog: document.getElementById("clearStorageDialog"),
    confirmClearStorageButton: document.getElementById("confirmClearStorageButton"),
    dayDialog: document.getElementById("dayDialog"),
    dayDialogTitle: document.getElementById("dayDialogTitle"),
    closeDayDialogButton: document.getElementById("closeDayDialogButton"),
    createDayTaskButton: document.getElementById("createDayTaskButton"),
    dayTaskList: document.getElementById("dayTaskList"),
    taskFormDialog: document.getElementById("taskFormDialog"),
    taskForm: document.getElementById("taskForm"),
    taskFormModeLabel: document.getElementById("taskFormModeLabel"),
    taskFormTitle: document.getElementById("taskFormTitle"),
    closeTaskFormButton: document.getElementById("closeTaskFormButton"),
    cancelTaskFormButton: document.getElementById("cancelTaskFormButton"),
    saveTaskButton: document.getElementById("saveTaskButton"),
    organizationTags: document.getElementById("organizationTags"),
    organizationInput: document.getElementById("organizationInput"),
    addOrganizationButton: document.getElementById("addOrganizationButton"),
    organizationSuggestions: document.getElementById("organizationSuggestions"),
    organizationError: document.getElementById("organizationError"),
    taskDateInput: document.getElementById("taskDateInput"),
    clearTaskDateButton: document.getElementById("clearTaskDateButton"),
    dateHelp: document.getElementById("dateHelp"),
    dateError: document.getElementById("dateError"),
    taskDescriptionInput: document.getElementById("taskDescriptionInput"),
    descriptionCounter: document.getElementById("descriptionCounter"),
    descriptionError: document.getElementById("descriptionError"),
    taskFormError: document.getElementById("taskFormError"),
    notebookDialog: document.getElementById("notebookDialog"),
    notebookList: document.getElementById("notebookList"),
    closeNotebookButton: document.getElementById("closeNotebookButton"),
    organizationEditDialog: document.getElementById("organizationEditDialog"),
    organizationEditForm: document.getElementById("organizationEditForm"),
    organizationEditNameInput: document.getElementById("organizationEditNameInput"),
    organizationEditError: document.getElementById("organizationEditError"),
    closeOrganizationEditButton: document.getElementById("closeOrganizationEditButton"),
    cancelOrganizationEditButton: document.getElementById("cancelOrganizationEditButton"),
    transferDialog: document.getElementById("transferDialog"),
    transferTaskLabel: document.getElementById("transferTaskLabel"),
    transferDateInput: document.getElementById("transferDateInput"),
    transferDateHelp: document.getElementById("transferDateHelp"),
    transferDateError: document.getElementById("transferDateError"),
    cancelTransferButton: document.getElementById("cancelTransferButton"),
    confirmTransferButton: document.getElementById("confirmTransferButton"),
    unsavedDialog: document.getElementById("unsavedDialog"),
    cancelUnsavedButton: document.getElementById("cancelUnsavedButton"),
    discardUnsavedButton: document.getElementById("discardUnsavedButton"),
    saveUnsavedButton: document.getElementById("saveUnsavedButton"),
    confirmActionDialog: document.getElementById("confirmActionDialog"),
    confirmActionTitle: document.getElementById("confirmActionTitle"),
    confirmActionText: document.getElementById("confirmActionText"),
    cancelActionButton: document.getElementById("cancelActionButton"),
    confirmActionButton: document.getElementById("confirmActionButton"),
    toast: document.getElementById("toast"),
  };

  const initialDate = new Date();
  let currentState = null;
  let displayedMonth = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  let selectedDateKey = null;
  let expandedTaskId = null;
  let daySidebarVisible = false;
  let dayDialogOrigin = null;
  let notebookDialogOrigin = null;
  let organizationEditId = null;
  let organizationEditOrigin = null;
  let taskFormContext = null;
  let taskFormOrigin = null;
  let taskFormInitialSnapshot = null;
  let suppressUnsavedPrompt = false;
  let selectedOrganizations = [];
  let transferTaskId = null;
  let pendingConfirmation = null;
  let toastTimer = null;
  let calendarWheelLockedUntil = 0;
  let filterState = {
    search: "",
    organizationId: "",
    status: "all",
  };
  let lastKnownTodayKey = toDateKey(initialDate.getFullYear(), initialDate.getMonth(), initialDate.getDate());

  function createId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (symbol) => {
      const random = Math.floor(Math.random() * 16);
      const value = symbol === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeOrganizationName(value) {
    return String(value ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("ru-RU");
  }

  function prepareOrganizationName(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }

  function createOrganization(name) {
    const preparedName = prepareOrganizationName(name);

    if (!preparedName || preparedName.length > MAX_ORGANIZATION_NAME_LENGTH) {
      throw new RangeError("Название организации должно содержать от 1 до 100 символов.");
    }

    const timestamp = nowIso();
    return {
      id: createId(),
      name: preparedName,
      normalizedName: normalizeOrganizationName(preparedName),
      archived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  function prepareOrganizationIds(value) {
    if (!Array.isArray(value)) {
      throw new TypeError("Список организаций должен быть массивом.");
    }

    const uniqueIds = [...new Set(value.map((id) => String(id).trim()).filter(Boolean))];
    if (uniqueIds.length > MAX_ORGANIZATIONS) {
      throw new RangeError("В задаче может быть не более пяти организаций.");
    }

    return uniqueIds;
  }

  function prepareDescription(value) {
    const description = String(value ?? "").trim();
    if (!description || description.length > MAX_DESCRIPTION_LENGTH) {
      throw new RangeError("Описание должно содержать от 1 до 3000 символов.");
    }

    return description;
  }

  function createTask(input = {}) {
    const date = input.date === null || input.date === undefined || input.date === ""
      ? null
      : String(input.date);
    const organizationIds = prepareOrganizationIds(input.organizationIds ?? []);

    if (date !== null && (!DATE_PATTERN.test(date) || !parseDateKey(date))) {
      throw new TypeError("Дата задачи должна иметь формат YYYY-MM-DD и существовать в календаре.");
    }

    if (date !== null && organizationIds.length === 0) {
      throw new RangeError("Для календарной задачи требуется хотя бы одна организация.");
    }

    const timestamp = nowIso();
    return {
      id: createId(),
      organizationIds,
      date,
      description: prepareDescription(input.description),
      completed: date === null ? false : Boolean(input.completed),
      order: date === null ? null : (Number.isInteger(input.order) ? input.order : 0),
      edited: Boolean(input.edited),
      autoCarried: date === null ? false : Boolean(input.autoCarried),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  function createEmptyState() {
    return {
      version: STATE_VERSION,
      organizations: [],
      tasks: [],
    };
  }

  function hasValidRootShape(value) {
    return Boolean(
      value
      && typeof value === "object"
      && !Array.isArray(value)
      && value.version === STATE_VERSION
      && Array.isArray(value.organizations)
      && Array.isArray(value.tasks)
    );
  }

  function cloneState(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function technicalErrorName(error) {
    return error && typeof error.name === "string" && error.name ? error.name : "UnknownError";
  }

  function padNumber(value) {
    return String(value).padStart(2, "0");
  }

  function toDateKey(year, monthIndex, day) {
    return `${year}-${padNumber(monthIndex + 1)}-${padNumber(day)}`;
  }

  function parseDateKey(dateKey) {
    if (!DATE_PATTERN.test(String(dateKey))) {
      return null;
    }

    const [year, month, day] = String(dateKey).split("-").map(Number);
    const parsedDate = new Date(year, month - 1, day);
    if (
      parsedDate.getFullYear() !== year
      || parsedDate.getMonth() !== month - 1
      || parsedDate.getDate() !== day
    ) {
      return null;
    }

    return parsedDate;
  }

  function localToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function addCalendarYearsClamped(date, numberOfYears) {
    const targetYear = date.getFullYear() + numberOfYears;
    const targetMonth = date.getMonth();
    const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    return new Date(targetYear, targetMonth, Math.min(date.getDate(), lastDayOfTargetMonth));
  }

  function getPlanningRange(referenceDate = localToday()) {
    const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    const end = addCalendarYearsClamped(start, PLANNING_YEARS_AHEAD);
    return {
      start,
      end,
      min: toDateKey(start.getFullYear(), start.getMonth(), start.getDate()),
      max: toDateKey(end.getFullYear(), end.getMonth(), end.getDate()),
    };
  }

  function isDateInPlanningRange(dateKey, referenceDate = localToday()) {
    if (!parseDateKey(dateKey)) {
      return false;
    }
    const range = getPlanningRange(referenceDate);
    return dateKey >= range.min && dateKey <= range.max;
  }

  function capitalize(value) {
    const text = String(value);
    return text ? text.charAt(0).toLocaleUpperCase("ru-RU") + text.slice(1) : text;
  }

  function formatMonthTitle(date) {
    return capitalize(MONTH_FORMATTER.format(date));
  }

  function formatShortDate(dateKey) {
    const date = parseDateKey(dateKey);
    return date ? SHORT_DATE_FORMATTER.format(date) : "";
  }

  function formatDayTitle(dateKey) {
    const date = parseDateKey(dateKey);
    return date ? `${capitalize(WEEKDAY_FORMATTER.format(date))}, ${SHORT_DATE_FORMATTER.format(date)}` : "Выбранный день";
  }

  function buildMonthMatrix(year, monthIndex) {
    const normalizedMonth = new Date(year, monthIndex, 1);
    const normalizedYear = normalizedMonth.getFullYear();
    const normalizedMonthIndex = normalizedMonth.getMonth();
    const firstWeekday = (normalizedMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(normalizedYear, normalizedMonthIndex + 1, 0).getDate();
    const cells = Array(42).fill(null);

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(normalizedYear, normalizedMonthIndex, day);
      cells[firstWeekday + day - 1] = {
        year: normalizedYear,
        monthIndex: normalizedMonthIndex,
        day,
        date,
        dateKey: toDateKey(normalizedYear, normalizedMonthIndex, day),
      };
    }

    return cells;
  }

  function getOrganizationMap(state = currentState) {
    const organizations = state?.organizations ?? [];
    return new Map(organizations.map((organization) => [organization.id, organization]));
  }

  function normalizedSearchQuery() {
    return String(filterState.search ?? "").trim().toLocaleLowerCase("ru-RU");
  }

  function hasActiveFilters(options = {}) {
    const includeStatus = options.includeStatus !== false;
    return Boolean(
      normalizedSearchQuery()
      || filterState.organizationId
      || (includeStatus && filterState.status !== "all")
    );
  }

  function taskMatchesFilters(task, options = {}) {
    const includeStatus = options.includeStatus !== false;
    const query = normalizedSearchQuery();
    if (query && !String(task.description ?? "").toLocaleLowerCase("ru-RU").includes(query)) {
      return false;
    }
    if (
      filterState.organizationId
      && !(Array.isArray(task.organizationIds) && task.organizationIds.includes(filterState.organizationId))
    ) {
      return false;
    }
    if (includeStatus && filterState.status === "incomplete" && task.completed) {
      return false;
    }
    if (includeStatus && filterState.status === "completed" && !task.completed) {
      return false;
    }
    return true;
  }

  function getTasksForDate(dateKey) {
    return (currentState?.tasks ?? [])
      .filter((task) => task.date === dateKey && taskMatchesFilters(task))
      .sort((firstTask, secondTask) => {
        if (Boolean(firstTask.completed) !== Boolean(secondTask.completed)) {
          return firstTask.completed ? 1 : -1;
        }
        return (firstTask.order ?? 0) - (secondTask.order ?? 0);
      });
  }

  function getFilteredDatedTasks() {
    return (currentState?.tasks ?? [])
      .filter((task) => task.date && taskMatchesFilters(task))
      .sort((firstTask, secondTask) => {
        const dateDifference = firstTask.date.localeCompare(secondTask.date);
        if (dateDifference !== 0) {
          return dateDifference;
        }
        if (Boolean(firstTask.completed) !== Boolean(secondTask.completed)) {
          return firstTask.completed ? 1 : -1;
        }
        return (firstTask.order ?? 0) - (secondTask.order ?? 0);
      });
  }

  function getNotebookTasks() {
    return (currentState?.tasks ?? [])
      .filter((task) => task.date === null && taskMatchesFilters(task, { includeStatus: false }))
      .sort((firstTask, secondTask) => String(secondTask.updatedAt).localeCompare(String(firstTask.updatedAt)));
  }

  function getDaySummary(dateKey) {
    const organizationMap = getOrganizationMap();
    const tasks = getTasksForDate(dateKey);
    const taskLabels = [];

    tasks.forEach((task) => {
      const organizationIds = Array.isArray(task.organizationIds) ? task.organizationIds : [];
      const organization = organizationIds.length === 1 ? organizationMap.get(organizationIds[0]) : null;
      const label = organizationIds.length > 1 ? "Общая задача" : organization?.name;
      if (label) {
        taskLabels.push({ name: label, completed: Boolean(task.completed) });
      }
    });

    const visibleLabels = taskLabels.slice(0, 4);
    return {
      count: tasks.length,
      organizationNames: visibleLabels.map((item) => item.name),
      taskLabels: visibleLabels,
    };
  }

  function validationError(field, message) {
    const error = new Error(message);
    error.name = "TaskValidationError";
    error.field = field;
    return error;
  }

  function prepareTaskDraft(draft, options = {}) {
    const rawNames = Array.isArray(draft.organizationNames) ? draft.organizationNames : [];
    const organizationNames = [];
    const normalizedNames = new Set();

    rawNames.forEach((rawName) => {
      const name = prepareOrganizationName(rawName);
      if (!name) {
        return;
      }
      if (name.length > MAX_ORGANIZATION_NAME_LENGTH) {
        throw validationError("organization", "Название организации не должно превышать 100 символов.");
      }
      const normalizedName = normalizeOrganizationName(name);
      if (!normalizedNames.has(normalizedName)) {
        normalizedNames.add(normalizedName);
        organizationNames.push(name);
      }
    });

    if (organizationNames.length > MAX_ORGANIZATIONS) {
      throw validationError("organization", "Не более 5 организаций.");
    }

    const description = String(draft.description ?? "").trim();
    if (!description) {
      throw validationError("description", "Введите описание задачи.");
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      throw validationError("description", "Описание не должно превышать 3000 символов.");
    }

    const date = draft.date === null || draft.date === undefined || draft.date === "" ? null : String(draft.date);
    if (date !== null && !isDateInPlanningRange(date)) {
      throw validationError("date", "Выберите дату от сегодня до этой же даты следующего года включительно.");
    }
    if (options.requireDate && date === null) {
      throw validationError("date", "Выберите дату.");
    }
    if (date !== null && organizationNames.length === 0) {
      throw validationError("organization", "Для календарной задачи добавьте хотя бы одну организацию.");
    }

    return { organizationNames, description, date };
  }

  function resolveOrganizationNames(nextState, organizationNames, options = {}) {
    const ids = [];
    organizationNames.forEach((name) => {
      const normalizedName = normalizeOrganizationName(name);
      let organization = nextState.organizations.find((item) => item.normalizedName === normalizedName);
      if (organization?.archived && !options.allowArchived) {
        throw validationError("organization", "Эта организация удалена из выбора для новых задач.");
      }
      if (!organization) {
        organization = createOrganization(name);
        nextState.organizations.push(organization);
      }
      ids.push(organization.id);
    });
    return ids;
  }

  function firstOrderForDate(tasks, dateKey, excludedTaskId = null) {
    const orders = tasks
      .filter((task) => task.id !== excludedTaskId && task.date === dateKey && !task.completed)
      .map((task) => Number.isInteger(task.order) ? task.order : 0);
    return orders.length === 0 ? 0 : Math.min(...orders) - 1;
  }

  function pruneUnusedOrganizations(nextState) {
    const usedIds = new Set(nextState.tasks.flatMap((task) => Array.isArray(task.organizationIds) ? task.organizationIds : []));
    nextState.organizations = nextState.organizations.filter((organization) => usedIds.has(organization.id));
  }

  function sortedTaskGroup(tasks, dateKey, completed, excludedTaskId = null) {
    return tasks
      .filter((task) => task.id !== excludedTaskId && task.date === dateKey && Boolean(task.completed) === completed)
      .sort((first, second) => {
        const orderDifference = (first.order ?? 0) - (second.order ?? 0);
        return orderDifference !== 0 ? orderDifference : String(first.createdAt).localeCompare(String(second.createdAt));
      });
  }

  function assignGroupOrders(group) {
    group.forEach((task, index) => {
      task.order = index;
    });
  }

  function moveTaskWithinGroup(taskId, direction) {
    const nextState = cloneState(currentState);
    const task = nextState.tasks.find((item) => item.id === taskId && item.date !== null);
    if (!task || ![-1, 1].includes(direction)) {
      throw new Error("OrderedTaskNotFound");
    }
    const group = sortedTaskGroup(nextState.tasks, task.date, Boolean(task.completed));
    const index = group.findIndex((item) => item.id === taskId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= group.length) {
      return false;
    }
    [group[index], group[targetIndex]] = [group[targetIndex], group[index]];
    assignGroupOrders(group);
    return saveState(nextState);
  }

  function setTaskCompleted(taskId, completed) {
    const nextState = cloneState(currentState);
    const task = nextState.tasks.find((item) => item.id === taskId && item.date !== null);
    if (!task) {
      throw new Error("CalendarTaskNotFound");
    }

    const nextCompleted = Boolean(completed);
    const today = localToday();
    const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
    task.completed = nextCompleted;
    task.autoCarried = false;
    task.updatedAt = nowIso();

    if (nextCompleted) {
      const completedGroup = sortedTaskGroup(nextState.tasks, task.date, true, task.id);
      assignGroupOrders(completedGroup);
      task.order = completedGroup.length;
    } else {
      if (task.date < todayKey) {
        task.date = todayKey;
        task.autoCarried = true;
      }
      task.order = firstOrderForDate(nextState.tasks, task.date, task.id);
    }

    return saveState(nextState) ? cloneState(task) : null;
  }

  function transferTask(taskId, targetDate) {
    if (!isDateInPlanningRange(targetDate)) {
      throw validationError("date", "Выберите дату в пределах одного года от сегодня.");
    }
    const nextState = cloneState(currentState);
    const task = nextState.tasks.find((item) => item.id === taskId && item.date !== null && !item.completed);
    if (!task) {
      throw new Error("MovableTaskNotFound");
    }
    if (task.date === targetDate) {
      throw validationError("date", "Выберите другой день.");
    }
    task.date = targetDate;
    task.order = firstOrderForDate(nextState.tasks, targetDate, task.id);
    task.autoCarried = false;
    task.updatedAt = nowIso();
    return saveState(nextState) ? cloneState(task) : null;
  }

  function carryOverdueTasks(nextState, todayKey) {
    const overdue = nextState.tasks
      .filter((task) => task.date !== null && task.date < todayKey && !task.completed)
      .sort((first, second) => {
        const dateDifference = first.date.localeCompare(second.date);
        return dateDifference !== 0 ? dateDifference : (first.order ?? 0) - (second.order ?? 0);
      });
    if (overdue.length === 0) {
      return 0;
    }

    const overdueIds = new Set(overdue.map((task) => task.id));
    const existingToday = sortedTaskGroup(nextState.tasks, todayKey, false)
      .filter((task) => !overdueIds.has(task.id));
    overdue.forEach((task) => {
      task.date = todayKey;
      task.completed = false;
      task.autoCarried = true;
      task.updatedAt = nowIso();
    });
    assignGroupOrders([...overdue, ...existingToday]);
    return overdue.length;
  }

  function runAutomaticCarry() {
    if (!currentState) {
      return 0;
    }
    const today = localToday();
    const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
    lastKnownTodayKey = todayKey;
    const nextState = cloneState(currentState);
    const carriedCount = carryOverdueTasks(nextState, todayKey);
    if (carriedCount > 0 && !saveState(nextState)) {
      return 0;
    }
    return carriedCount;
  }

  const storage = {
    read() {
      try {
        const rawValue = localStorage.getItem(STORAGE_KEY);
        if (rawValue === null) {
          return { ok: true, isNew: true, state: createEmptyState() };
        }
        const parsedValue = JSON.parse(rawValue);
        if (!hasValidRootShape(parsedValue)) {
          const error = new Error("InvalidStateShape");
          error.name = "InvalidStateShape";
          throw error;
        }
        return { ok: true, isNew: false, state: parsedValue };
      } catch (error) {
        return { ok: false, kind: "read", error };
      }
    },

    write(nextState) {
      if (!hasValidRootShape(nextState)) {
        const error = new Error("InvalidStateShape");
        error.name = "InvalidStateShape";
        return { ok: false, kind: "write", error };
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
        return { ok: true };
      } catch (error) {
        return { ok: false, kind: "write", error };
      }
    },

    clear() {
      try {
        localStorage.removeItem(STORAGE_KEY);
        return { ok: true };
      } catch (error) {
        return { ok: false, kind: "write", error };
      }
    },
  };

  function setText(element, value) {
    element.textContent = value;
  }

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (text !== undefined) {
      setText(element, text);
    }
    return element;
  }

  function createTaskIconButton(label, symbol, additionalClass = "") {
    const className = ["button", "button--quiet", "task-icon-button", additionalClass]
      .filter(Boolean)
      .join(" ");
    const button = createElement("button", className, symbol);
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.dataset.tooltip = label;
    return button;
  }

  function setFilterControlsDisabled(disabled) {
    elements.searchInput.disabled = disabled;
    elements.organizationFilter.disabled = disabled;
    elements.statusFilter.disabled = disabled;
    elements.resetFiltersButton.disabled = disabled || !hasActiveFilters();
  }

  function renderFilterControls() {
    const organizations = [...(currentState?.organizations ?? [])]
      .sort((first, second) => first.name.localeCompare(second.name, "ru-RU"));
    if (
      filterState.organizationId
      && !organizations.some((organization) => organization.id === filterState.organizationId)
    ) {
      filterState.organizationId = "";
    }

    const allOrganizationsOption = createElement("option", "", "Все организации");
    allOrganizationsOption.value = "";
    elements.organizationFilter.replaceChildren(allOrganizationsOption);
    organizations.forEach((organization) => {
      const option = createElement("option", "", organization.name);
      option.value = organization.id;
      elements.organizationFilter.append(option);
    });

    elements.searchInput.value = filterState.search;
    elements.organizationFilter.value = filterState.organizationId;
    elements.statusFilter.value = filterState.status;
    setFilterControlsDisabled(false);
  }

  function updateCalendarHint() {
    const monthPrefix = `${displayedMonth.getFullYear()}-${padNumber(displayedMonth.getMonth() + 1)}-`;
    const hasMatchingMonthTasks = (currentState?.tasks ?? []).some(
      (task) => task.date?.startsWith(monthPrefix) && taskMatchesFilters(task),
    );
    if (hasActiveFilters() && !hasMatchingMonthTasks) {
      setText(elements.calendarHint, "Задачи не найдены");
      elements.calendarHint.hidden = false;
      return;
    }
    setText(elements.calendarHint, "Выберите день или создайте задачу в блокноте");
    elements.calendarHint.hidden = (currentState?.tasks.length ?? 0) > 0;
  }

  function renderFilteredViews() {
    elements.resetFiltersButton.disabled = !hasActiveFilters();
    renderCalendar();
    if (elements.dayDialog.open) {
      renderDayDialog();
    }
    renderDaySidebar();
    if (elements.notebookDialog.open) {
      renderNotebook();
    }
    updateCalendarHint();
  }

  function resetFilters() {
    filterState = {
      search: "",
      organizationId: "",
      status: "all",
    };
    renderFilterControls();
    renderFilteredViews();
  }

  function renderListEmptyState(container, defaultMessage, filtered) {
    if (!filtered) {
      container.append(createElement("p", "day-task-empty", defaultMessage));
      return;
    }
    const emptyState = createElement("div", "filter-empty-state");
    emptyState.append(createElement("p", "", "Задачи не найдены"));
    const resetButton = createElement("button", "button button--quiet", "Сбросить");
    resetButton.type = "button";
    resetButton.addEventListener("click", resetFilters);
    emptyState.append(resetButton);
    container.append(emptyState);
  }

  function showModal(dialog) {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeModal(dialog) {
    if (dialog.open && typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  function showToast(message, type = "default") {
    window.clearTimeout(toastTimer);
    setText(elements.toast, message);
    elements.toast.classList.toggle("toast--error", type === "error");
    elements.toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      elements.toast.hidden = true;
    }, 3000);
  }

  function taskOrganizations(task, state = currentState) {
    const organizationMap = getOrganizationMap(state);
    return (Array.isArray(task.organizationIds) ? task.organizationIds : [])
      .map((organizationId) => organizationMap.get(organizationId))
      .filter(Boolean);
  }

  function taskHeading(task, state = currentState) {
    const organizations = taskOrganizations(task, state);
    if (organizations.length === 1) {
      return organizations[0].name;
    }
    if (organizations.length > 1) {
      return `Общая задача · ${organizations.length}`;
    }
    return "Без организации";
  }

  function appendOrganizationChips(container, organizations, className) {
    if (organizations.length === 0) {
      return;
    }
    const chips = createElement("div", className);
    organizations.forEach((organization) => {
      if (organization.id) {
        const chip = createElement(
          "button",
          "organization-chip organization-chip--editable",
          organization.name,
        );
        chip.type = "button";
        chip.dataset.organizationId = organization.id;
        chip.dataset.tooltip = "Двойной щелчок — переименовать";
        chip.setAttribute(
          "aria-label",
          `${organization.name}. Двойной щелчок или Enter — переименовать организацию`,
        );
        const openEditor = () => openOrganizationEditDialog(organization.id, chip);
        chip.addEventListener("dblclick", openEditor);
        chip.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            openEditor();
          }
        });
        chips.append(chip);
      } else {
        chips.append(createElement("span", "organization-chip", organization.name));
      }
    });
    container.append(chips);
  }

  function findRenderedDayButton(dateKey) {
    return [...elements.calendarGrid.children].find((child) => child.dataset?.date === dateKey) ?? null;
  }

  function renderDayTaskList(listElement, options = {}) {
    const filterOverview = Boolean(options.filterOverview && hasActiveFilters());
    if (!filterOverview && !selectedDateKey) {
      return;
    }

    listElement.replaceChildren();
    const tasks = filterOverview
      ? getFilteredDatedTasks()
      : getTasksForDate(selectedDateKey);

    if (tasks.length === 0) {
      renderListEmptyState(
        listElement,
        filterOverview ? "Подходящих задач с датой нет" : "На этот день задач нет",
        hasActiveFilters(),
      );
      return;
    }

    if (!tasks.some((task) => task.id === expandedTaskId)) {
      expandedTaskId = null;
    }

    const fragment = document.createDocumentFragment();
    let renderedMonthKey = "";
    const displayedMonthKey = `${displayedMonth.getFullYear()}-${padNumber(displayedMonth.getMonth() + 1)}`;
    tasks.forEach((task) => {
      if (filterOverview) {
        const taskMonthKey = task.date.slice(0, 7);
        if (taskMonthKey !== renderedMonthKey) {
          const taskDate = parseDateKey(task.date);
          const monthHeading = createElement(
            "div",
            "day-task-month-heading",
            taskDate ? formatMonthTitle(taskDate) : taskMonthKey,
          );
          monthHeading.classList.toggle("day-task-month-heading--current", taskMonthKey === displayedMonthKey);
          monthHeading.setAttribute("role", "heading");
          monthHeading.setAttribute("aria-level", "3");
          listElement.append(monthHeading);
          renderedMonthKey = taskMonthKey;
        }
      }
      const card = createElement("article", "day-task-card");
      card.dataset.taskId = task.id;
      card.classList.toggle("day-task-card--completed", Boolean(task.completed));
      card.classList.toggle("day-task-card--auto-carried", Boolean(task.autoCarried));
      card.classList.toggle("day-task-card--expanded", task.id === expandedTaskId);

      const summary = createElement("div", "day-task-card__summary");
      const summaryToggle = createElement("button", "day-task-card__summary-toggle");
      summaryToggle.type = "button";
      summaryToggle.setAttribute("aria-expanded", String(task.id === expandedTaskId));
      summaryToggle.setAttribute(
        "aria-label",
        `${task.id === expandedTaskId ? "Свернуть" : "Раскрыть"}: ${taskHeading(task)}${filterOverview ? `, ${formatShortDate(task.date)}` : ""}`,
      );
      summaryToggle.append(createElement("span", "day-task-card__summary-title", taskHeading(task)));
      if (filterOverview) {
        summaryToggle.append(createElement("span", "day-task-card__summary-date", formatShortDate(task.date)));
      }
      const excerpt = String(task.description ?? "").replace(/\s+/g, " ").trim();
      summaryToggle.append(createElement("span", "day-task-card__summary-excerpt", excerpt));

      if (task.edited || task.autoCarried) {
        const markers = createElement("span", "day-task-card__markers");
        if (task.edited) {
          markers.append(createElement("span", "task-marker task-marker--edited", "★ изменено"));
        }
        if (task.autoCarried) {
          markers.append(createElement("span", "task-marker task-marker--carried", "↷ перенесено"));
        }
        summaryToggle.append(markers);
      }
      summaryToggle.addEventListener("click", () => {
        expandedTaskId = expandedTaskId === task.id ? null : task.id;
        renderSelectedDayView();
      });

      const checkboxLabel = createElement("label", "day-task-card__summary-checkbox");
      const checkbox = createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = Boolean(task.completed);
      checkbox.setAttribute("aria-label", `Выполнено: ${taskHeading(task)}`);
      checkbox.addEventListener("change", () => {
        const result = setTaskCompleted(task.id, checkbox.checked);
        if (result) {
          showToast(checkbox.checked ? "Задача выполнена" : "Задача возвращена в работу");
        }
      });
      checkboxLabel.append(checkbox);
      summary.append(summaryToggle, checkboxLabel);
      card.append(summary);

      if (task.id === expandedTaskId) {
        const details = createElement("div", "day-task-card__details");
        details.append(createElement("p", "day-task-card__date", `Дата: ${formatShortDate(task.date)}`));
        appendOrganizationChips(details, taskOrganizations(task), "day-task-card__organizations");
        details.append(createElement("p", "day-task-card__description", task.description ?? ""));

        const actions = createElement("div", "day-task-card__actions");
        const orderActions = createElement("span", "day-task-card__order-actions");
        const group = tasks.filter((item) => Boolean(item.completed) === Boolean(task.completed));
        const groupIndex = group.findIndex((item) => item.id === task.id);
        const upButton = createTaskIconButton("Переместить задачу выше", "↑", "task-icon-button--order");
        const downButton = createTaskIconButton("Переместить задачу ниже", "↓", "task-icon-button--order");
        const orderLocked = hasActiveFilters();
        upButton.disabled = orderLocked || groupIndex <= 0;
        downButton.disabled = orderLocked || groupIndex < 0 || groupIndex >= group.length - 1;
        upButton.addEventListener("click", () => moveTaskWithinGroup(task.id, -1));
        downButton.addEventListener("click", () => moveTaskWithinGroup(task.id, 1));
        orderActions.append(upButton, downButton);
        actions.append(orderActions);
        if (orderLocked) {
          actions.append(createElement(
            "span",
            "day-task-card__order-hint",
            "Сбросьте поиск и фильтры, чтобы изменить порядок",
          ));
        }

        const editButton = createTaskIconButton("Редактировать", "✎");
        const copyButton = createTaskIconButton("Копировать", "⧉");
        const deleteButton = createTaskIconButton("Удалить", "×", "task-icon-button--danger");
        editButton.addEventListener("click", () => openTaskForm({ mode: "edit-calendar", taskId: task.id, origin: editButton }));
        copyButton.addEventListener("click", () => openTaskForm({ mode: "copy-calendar", taskId: task.id, origin: copyButton }));
        deleteButton.addEventListener("click", () => confirmDeleteTask(task.id));

        if (!task.completed) {
          const transferButton = createTaskIconButton("Перенести", "↪");
          const notebookAction = createTaskIconButton("Перенести в блокнот", "▤");
          transferButton.addEventListener("click", () => openTransferDialog(task.id));
          notebookAction.addEventListener("click", () => confirmMoveToNotebook(task.id));
          actions.append(editButton, transferButton, notebookAction, copyButton, deleteButton);
        } else {
          actions.append(editButton, copyButton, deleteButton);
        }
        details.append(actions);
        card.append(details);
      }
      fragment.append(card);
    });
    listElement.append(fragment);
  }

  function configureDayCreateButton(button) {
    button.disabled = !selectedDateKey || !isDateInPlanningRange(selectedDateKey);
    button.title = button.disabled
      ? "Создание возможно с сегодняшнего дня до этой же даты следующего года"
      : "";
  }

  function renderDayDialog() {
    if (!selectedDateKey) {
      return;
    }
    setText(elements.dayDialogTitle, formatDayTitle(selectedDateKey));
    configureDayCreateButton(elements.createDayTaskButton);
    renderDayTaskList(elements.dayTaskList);
  }

  function renderDaySidebar() {
    if (!daySidebarVisible) {
      return;
    }
    if (hasActiveFilters()) {
      setText(elements.daySidebarEyebrow, "Задачи по фильтру");
      setText(elements.daySidebarTitle, "Результаты по всем датам");
      elements.createSidebarTaskButton.disabled = true;
      elements.createSidebarTaskButton.title = "Сбросьте фильтры и выберите конкретный день для создания задачи";
      renderDayTaskList(elements.daySidebarTaskList, { filterOverview: true });
      return;
    }
    setText(elements.daySidebarEyebrow, "Задачи на день");
    if (!selectedDateKey) {
      setText(elements.daySidebarTitle, "Выберите день");
      configureDayCreateButton(elements.createSidebarTaskButton);
      elements.daySidebarTaskList.replaceChildren(
        createElement("p", "day-task-empty", "Выберите день в календаре"),
      );
      return;
    }
    setText(elements.daySidebarTitle, formatDayTitle(selectedDateKey));
    configureDayCreateButton(elements.createSidebarTaskButton);
    renderDayTaskList(elements.daySidebarTaskList);
  }

  function renderSelectedDayView() {
    if (daySidebarVisible) {
      renderDaySidebar();
    } else if (elements.dayDialog.open) {
      renderDayDialog();
    }
  }

  function returnFocusToDay() {
    const origin = dayDialogOrigin;
    dayDialogOrigin = null;
    if (origin) {
      origin.classList.toggle("calendar-day--selected", false);
    }
    if (origin && origin.isConnected && typeof origin.focus === "function") {
      origin.focus();
    }
  }

  function closeDayDialog(returnFocus = true) {
    if (!returnFocus) {
      dayDialogOrigin = null;
    }
    closeModal(elements.dayDialog);
    if (returnFocus && !elements.dayDialog.open) {
      returnFocusToDay();
    }
    expandedTaskId = null;
  }

  function defaultSidebarDate() {
    const today = localToday();
    if (
      displayedMonth.getFullYear() === today.getFullYear()
      && displayedMonth.getMonth() === today.getMonth()
    ) {
      return toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
    }
    return null;
  }

  function setDaySidebarVisibility(visible) {
    daySidebarVisible = Boolean(visible);
    elements.daySidebar.hidden = !daySidebarVisible;
    elements.appMain.classList.toggle("app-main--with-day-panel", daySidebarVisible);
    elements.displayTasksButton.setAttribute("aria-pressed", String(daySidebarVisible));
    setText(elements.displayTasksButtonLabel, daySidebarVisible ? "Скрыть задачи" : "Отобразить задачи");

    if (daySidebarVisible) {
      closeDayDialog(false);
      selectedDateKey = selectedDateKey ?? defaultSidebarDate();
    } else {
      expandedTaskId = null;
    }
    renderCalendar();
    renderDaySidebar();
  }

  function openDayDialog(dateKey, origin) {
    selectedDateKey = dateKey;
    expandedTaskId = null;
    dayDialogOrigin = origin;
    if (daySidebarVisible) {
      renderCalendar();
      renderDaySidebar();
      return;
    }
    origin.classList.toggle("calendar-day--selected", true);
    renderDayDialog();
    showModal(elements.dayDialog);
  }

  function renderCalendar() {
    setText(elements.monthTitle, formatMonthTitle(displayedMonth));
    elements.calendarGrid.replaceChildren();

    const today = localToday();
    const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
    const matrix = buildMonthMatrix(displayedMonth.getFullYear(), displayedMonth.getMonth());
    const fragment = document.createDocumentFragment();

    matrix.forEach((cell) => {
      if (!cell) {
        const outsideCell = createElement("div", "calendar-day--outside");
        outsideCell.setAttribute("aria-hidden", "true");
        fragment.append(outsideCell);
        return;
      }

      const summary = getDaySummary(cell.dateKey);
      const button = createElement("button", "calendar-day");
      button.type = "button";
      button.dataset.date = cell.dateKey;
      button.classList.toggle("calendar-day--today", cell.dateKey === todayKey);
      button.classList.toggle(
        "calendar-day--selected",
        cell.dateKey === selectedDateKey && (elements.dayDialog.open || daySidebarVisible),
      );
      button.setAttribute(
        "aria-label",
        `${formatDayTitle(cell.dateKey)}. ${summary.count === 0 ? "Задач нет" : `Задач: ${summary.count}`}`,
      );

      const top = createElement("span", "calendar-day__top");
      top.append(createElement("span", "calendar-day__number", String(cell.day)));
      if (summary.count > 0) {
        top.append(createElement("span", "calendar-day__count", String(summary.count)));
      }
      button.append(top);

      if (summary.taskLabels.length > 0) {
        const organizations = createElement("span", "calendar-day__organizations");
        summary.taskLabels.forEach((item) => {
          const organization = createElement("span", "calendar-day__organization", item.name);
          organization.classList.toggle("calendar-day__organization--completed", item.completed);
          organizations.append(organization);
        });
        button.append(organizations);
      }

      button.addEventListener("click", () => openDayDialog(cell.dateKey, button));
      button.addEventListener("keydown", (event) => handleCalendarDayKeydown(event, cell.dateKey));
      fragment.append(button);
    });

    elements.calendarGrid.append(fragment);
    if ((elements.dayDialog.open || daySidebarVisible) && selectedDateKey) {
      dayDialogOrigin = findRenderedDayButton(selectedDateKey);
    }
  }

  function renderNotebook() {
    elements.notebookList.replaceChildren();
    const tasks = getNotebookTasks();
    if (tasks.length === 0) {
      renderListEmptyState(
        elements.notebookList,
        "Здесь будут задачи без назначенной даты",
        hasActiveFilters({ includeStatus: false }),
      );
      return;
    }

    const fragment = document.createDocumentFragment();
    tasks.forEach((task) => {
      const card = createElement("article", "notebook-card");
      card.dataset.taskId = task.id;
      card.append(createElement("h3", "notebook-card__title", `${taskHeading(task)}${task.edited ? " ★" : ""}`));
      appendOrganizationChips(card, taskOrganizations(task), "notebook-card__organizations");
      card.append(createElement("p", "notebook-card__description", task.description ?? ""));

      const actions = createElement("div", "notebook-card__actions");
      const editButton = createTaskIconButton("Редактировать", "✎");
      const copyButton = createTaskIconButton("Копировать", "⧉");
      const deleteButton = createTaskIconButton("Удалить", "×", "task-icon-button--danger");
      const assignButton = createElement("button", "button button--primary", "Назначить дату");
      assignButton.type = "button";
      editButton.addEventListener("click", () => openTaskForm({ mode: "edit-notebook", taskId: task.id, origin: editButton }));
      copyButton.addEventListener("click", () => openTaskForm({ mode: "copy-notebook", taskId: task.id, origin: copyButton }));
      deleteButton.addEventListener("click", () => confirmDeleteTask(task.id));
      assignButton.addEventListener("click", () => openTaskForm({ mode: "assign-date", taskId: task.id, origin: assignButton }));
      actions.append(editButton, copyButton, deleteButton, assignButton);
      card.append(actions);
      fragment.append(card);
    });
    elements.notebookList.append(fragment);
  }

  function showReadyState() {
    elements.app.dataset.appState = "ready";
    elements.calendarPanel.hidden = false;
    elements.daySidebar.hidden = !daySidebarVisible;
    elements.appMain.classList.toggle("app-main--with-day-panel", daySidebarVisible);
    elements.storageError.hidden = true;
    renderFilterControls();
    renderCalendar();
    if (elements.dayDialog.open) {
      renderDayDialog();
    }
    renderDaySidebar();
    if (elements.notebookDialog.open) {
      renderNotebook();
    }
    updateCalendarHint();
  }

  function showStorageError(result) {
    const isReadError = result.kind === "read";
    elements.app.dataset.appState = "error";
    elements.calendarPanel.hidden = true;
    elements.daySidebar.hidden = true;
    elements.appMain.classList.toggle("app-main--with-day-panel", false);
    elements.storageError.hidden = false;
    setFilterControlsDisabled(true);
    elements.clearStorageButton.hidden = !isReadError;

    if (isReadError) {
      setText(elements.storageErrorTitle, "Данные планировщика повреждены");
      setText(elements.storageErrorText, "Локальные данные не были изменены. Повторите чтение или подтвердите очистку.");
    } else {
      setText(elements.storageErrorTitle, "Не удалось сохранить данные");
      setText(elements.storageErrorText, "Локальные данные не были изменены. Повторите попытку после проверки настроек браузера.");
      showToast("Не удалось сохранить данные", "error");
    }
    console.error(`[Рабочий планировщик] Ошибка localStorage: ${technicalErrorName(result.error)}`);
  }

  function saveState(nextState) {
    const result = storage.write(nextState);
    if (!result.ok) {
      showStorageError(result);
      return false;
    }
    currentState = cloneState(nextState);
    showReadyState();
    return true;
  }

  function createTaskFromDraft(draft) {
    const prepared = prepareTaskDraft(draft);
    const nextState = cloneState(currentState);
    const organizationIds = resolveOrganizationNames(nextState, prepared.organizationNames);
    const task = createTask({
      organizationIds,
      date: prepared.date,
      description: prepared.description,
      completed: false,
      order: prepared.date === null ? null : firstOrderForDate(nextState.tasks, prepared.date),
    });
    nextState.tasks.unshift(task);
    return saveState(nextState) ? cloneState(task) : null;
  }

  function updateNotebookTask(taskId, draft) {
    const prepared = prepareTaskDraft({ ...draft, date: null });
    const nextState = cloneState(currentState);
    const task = nextState.tasks.find((item) => item.id === taskId && item.date === null);
    if (!task) {
      throw new Error("NotebookTaskNotFound");
    }
    task.organizationIds = resolveOrganizationNames(nextState, prepared.organizationNames, { allowArchived: true });
    task.description = prepared.description;
    task.completed = false;
    task.order = null;
    task.edited = true;
    task.autoCarried = false;
    task.updatedAt = nowIso();
    pruneUnusedOrganizations(nextState);
    return saveState(nextState) ? cloneState(task) : null;
  }

  function copyNotebookTask(taskId, draft) {
    const original = currentState.tasks.find((item) => item.id === taskId && item.date === null);
    if (!original) {
      throw new Error("NotebookTaskNotFound");
    }
    const prepared = prepareTaskDraft(draft);
    const nextState = cloneState(currentState);
    const organizationIds = resolveOrganizationNames(nextState, prepared.organizationNames);
    const copy = createTask({
      organizationIds,
      date: prepared.date,
      description: prepared.description,
      completed: false,
      order: prepared.date === null ? null : firstOrderForDate(nextState.tasks, prepared.date),
    });
    nextState.tasks.unshift(copy);
    if (prepared.date !== null && prepared.date === original.date && !original.completed) {
      const groupWithoutCopy = sortedTaskGroup(nextState.tasks, prepared.date, false, copy.id);
      const originalIndex = groupWithoutCopy.findIndex((task) => task.id === original.id);
      groupWithoutCopy.splice(originalIndex + 1, 0, copy);
      assignGroupOrders(groupWithoutCopy);
    }
    return saveState(nextState) ? cloneState(copy) : null;
  }

  function updateCalendarTask(taskId, draft) {
    const prepared = prepareTaskDraft(draft);
    const nextState = cloneState(currentState);
    const task = nextState.tasks.find((item) => item.id === taskId && item.date !== null);
    if (!task) {
      throw new Error("CalendarTaskNotFound");
    }
    if (task.completed && prepared.date !== task.date) {
      throw validationError("date", "Дату выполненной задачи изменять нельзя.");
    }

    const previousDate = task.date;
    task.organizationIds = resolveOrganizationNames(nextState, prepared.organizationNames, { allowArchived: true });
    task.description = prepared.description;
    task.date = prepared.date;
    task.edited = true;
    task.autoCarried = false;
    task.updatedAt = nowIso();

    if (prepared.date === null) {
      task.completed = false;
      task.order = null;
    } else if (prepared.date !== previousDate) {
      task.order = firstOrderForDate(nextState.tasks, prepared.date, task.id);
    }

    pruneUnusedOrganizations(nextState);
    return saveState(nextState) ? cloneState(task) : null;
  }

  function copyCalendarTask(taskId, draft) {
    const original = currentState.tasks.find((item) => item.id === taskId && item.date !== null);
    if (!original) {
      throw new Error("CalendarTaskNotFound");
    }
    const prepared = prepareTaskDraft(draft);
    const nextState = cloneState(currentState);
    const organizationIds = resolveOrganizationNames(nextState, prepared.organizationNames);
    const copy = createTask({
      organizationIds,
      date: prepared.date,
      description: prepared.description,
      completed: false,
      order: prepared.date === null ? null : firstOrderForDate(nextState.tasks, prepared.date),
      edited: false,
      autoCarried: false,
    });
    nextState.tasks.unshift(copy);
    if (prepared.date !== null && prepared.date === original.date && !original.completed) {
      const groupWithoutCopy = sortedTaskGroup(nextState.tasks, prepared.date, false, copy.id);
      const originalIndex = groupWithoutCopy.findIndex((task) => task.id === original.id);
      groupWithoutCopy.splice(originalIndex + 1, 0, copy);
      assignGroupOrders(groupWithoutCopy);
    }
    return saveState(nextState) ? cloneState(copy) : null;
  }

  function assignNotebookTaskDate(taskId, draft) {
    const prepared = prepareTaskDraft(draft, { requireDate: true });
    const nextState = cloneState(currentState);
    const task = nextState.tasks.find((item) => item.id === taskId && item.date === null);
    if (!task) {
      throw new Error("NotebookTaskNotFound");
    }
    const previousOrganizations = JSON.stringify(task.organizationIds);
    const previousDescription = task.description;
    task.organizationIds = resolveOrganizationNames(nextState, prepared.organizationNames, { allowArchived: true });
    task.description = prepared.description;
    task.date = prepared.date;
    task.completed = false;
    task.order = firstOrderForDate(nextState.tasks, prepared.date, task.id);
    task.edited = Boolean(
      task.edited
      || previousDescription !== task.description
      || previousOrganizations !== JSON.stringify(task.organizationIds)
    );
    task.autoCarried = false;
    task.updatedAt = nowIso();
    pruneUnusedOrganizations(nextState);
    return saveState(nextState) ? cloneState(task) : null;
  }

  function moveTaskToNotebook(taskId) {
    const nextState = cloneState(currentState);
    const task = nextState.tasks.find((item) => item.id === taskId && item.date !== null && !item.completed);
    if (!task) {
      throw new Error("MovableTaskNotFound");
    }
    task.date = null;
    task.completed = false;
    task.order = null;
    task.autoCarried = false;
    task.updatedAt = nowIso();
    return saveState(nextState) ? cloneState(task) : null;
  }

  function deleteTask(taskId) {
    const nextState = cloneState(currentState);
    const taskIndex = nextState.tasks.findIndex((item) => item.id === taskId);
    if (taskIndex === -1) {
      throw new Error("TaskNotFound");
    }
    nextState.tasks.splice(taskIndex, 1);
    pruneUnusedOrganizations(nextState);
    return saveState(nextState);
  }

  function renameOrganization(organizationId, rawName) {
    const name = prepareOrganizationName(rawName);
    if (!name || name.length > MAX_ORGANIZATION_NAME_LENGTH) {
      throw validationError("organization-edit", "Название должно содержать от 1 до 100 символов.");
    }

    const nextState = cloneState(currentState);
    const organization = nextState.organizations.find((item) => item.id === organizationId);
    if (!organization) {
      throw new Error("OrganizationNotFound");
    }

    const normalizedName = normalizeOrganizationName(name);
    const duplicate = nextState.organizations.some(
      (item) => item.id !== organizationId && item.normalizedName === normalizedName,
    );
    if (duplicate) {
      throw validationError("organization-edit", "Организация с таким названием уже существует.");
    }

    organization.name = name;
    organization.normalizedName = normalizedName;
    organization.updatedAt = nowIso();
    return saveState(nextState) ? cloneState(organization) : null;
  }

  function initialize() {
    elements.app.dataset.appState = "loading";
    const result = storage.read();
    if (!result.ok) {
      currentState = null;
      showStorageError(result);
      return;
    }
    currentState = cloneState(result.state);
    if (result.isNew) {
      const writeResult = storage.write(currentState);
      if (!writeResult.ok) {
        currentState = null;
        showStorageError(writeResult);
        return;
      }
    }
    const today = localToday();
    lastKnownTodayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
    const carriedCount = carryOverdueTasks(currentState, lastKnownTodayKey);
    if (carriedCount > 0) {
      const carryWriteResult = storage.write(currentState);
      if (!carryWriteResult.ok) {
        currentState = null;
        showStorageError(carryWriteResult);
        return;
      }
    }
    showReadyState();
  }

  function changeMonth(offset) {
    closeDayDialog(false);
    selectedDateKey = null;
    displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + offset, 1);
    renderCalendar();
    renderDaySidebar();
  }

  function handleCalendarWheel(event) {
    if (event.ctrlKey || event.metaKey || event.deltaY === 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      return;
    }
    event.preventDefault();
    const timestamp = Date.now();
    if (timestamp < calendarWheelLockedUntil) {
      return;
    }
    calendarWheelLockedUntil = timestamp + 350;
    changeMonth(event.deltaY > 0 ? 1 : -1);
  }

  function handleCalendarDayKeydown(event, dateKey) {
    const offsets = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const offset = offsets[event.key];
    if (!offset) {
      return;
    }
    event.preventDefault();
    const date = parseDateKey(dateKey);
    if (!date) {
      return;
    }
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
    const targetKey = toDateKey(target.getFullYear(), target.getMonth(), target.getDate());
    if (
      displayedMonth.getFullYear() !== target.getFullYear()
      || displayedMonth.getMonth() !== target.getMonth()
    ) {
      displayedMonth = new Date(target.getFullYear(), target.getMonth(), 1);
      renderCalendar();
    }
    findRenderedDayButton(targetKey)?.focus();
  }

  function goToToday() {
    closeDayDialog(false);
    const today = localToday();
    selectedDateKey = daySidebarVisible
      ? toDateKey(today.getFullYear(), today.getMonth(), today.getDate())
      : null;
    displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    renderCalendar();
    renderDaySidebar();
  }

  function setDisplayedMonth(year, monthIndex) {
    closeDayDialog(false);
    selectedDateKey = null;
    displayedMonth = new Date(year, monthIndex, 1);
    renderCalendar();
    renderDaySidebar();
  }

  function renderOrganizationTags() {
    elements.organizationTags.replaceChildren();
    selectedOrganizations.forEach((organization) => {
      const tag = createElement("span", "organization-tag");
      tag.append(createElement("span", "organization-tag__name", organization.name));
      const removeButton = createElement("button", "organization-tag__remove", "×");
      removeButton.type = "button";
      removeButton.setAttribute("aria-label", `Удалить организацию ${organization.name}`);
      removeButton.addEventListener("click", () => {
        selectedOrganizations = selectedOrganizations.filter((item) => item.normalizedName !== organization.normalizedName);
        renderOrganizationTags();
        renderOrganizationSuggestions();
        clearFieldError("organization");
      });
      tag.append(removeButton);
      elements.organizationTags.append(tag);
    });
  }

  function renderOrganizationSuggestions() {
    elements.organizationSuggestions.replaceChildren();
    const selectedNames = new Set(selectedOrganizations.map((organization) => organization.normalizedName));
    [...(currentState?.organizations ?? [])]
      .filter((organization) => !organization.archived && !selectedNames.has(organization.normalizedName))
      .sort((first, second) => first.name.localeCompare(second.name, "ru-RU"))
      .forEach((organization) => {
        const option = createElement("option");
        option.value = organization.name;
        elements.organizationSuggestions.append(option);
      });
  }

  function setFieldError(field, message) {
    const target = field === "organization"
      ? elements.organizationError
      : field === "date"
        ? elements.dateError
        : field === "description"
          ? elements.descriptionError
          : elements.taskFormError;
    setText(target, message);
    target.hidden = false;
  }

  function clearFieldError(field) {
    const target = field === "organization"
      ? elements.organizationError
      : field === "date"
        ? elements.dateError
        : field === "description"
          ? elements.descriptionError
          : elements.taskFormError;
    setText(target, "");
    target.hidden = true;
  }

  function clearTaskFormErrors() {
    ["organization", "date", "description", "summary"].forEach(clearFieldError);
  }

  function addOrganizationFromInput() {
    const name = prepareOrganizationName(elements.organizationInput.value);
    if (!name) {
      return true;
    }
    if (name.length > MAX_ORGANIZATION_NAME_LENGTH) {
      setFieldError("organization", "Название организации не должно превышать 100 символов.");
      return false;
    }
    if (selectedOrganizations.length >= MAX_ORGANIZATIONS) {
      setFieldError("organization", "Не более 5 организаций.");
      return false;
    }
    const normalizedName = normalizeOrganizationName(name);
    if (selectedOrganizations.some((organization) => organization.normalizedName === normalizedName)) {
      setFieldError("organization", "Эта организация уже добавлена.");
      return false;
    }
    const existing = currentState.organizations.find((organization) => organization.normalizedName === normalizedName);
    if (existing?.archived) {
      setFieldError("organization", "Эта организация удалена из выбора для новых задач.");
      return false;
    }
    selectedOrganizations.push({
      id: existing?.id ?? null,
      name: existing?.name ?? name,
      normalizedName,
    });
    elements.organizationInput.value = "";
    clearFieldError("organization");
    renderOrganizationTags();
    renderOrganizationSuggestions();
    return true;
  }

  function taskForForm(taskId) {
    return currentState.tasks.find((task) => task.id === taskId) ?? null;
  }

  function openTaskForm(options) {
    const mode = options.mode;
    const task = options.taskId ? taskForForm(options.taskId) : null;
    if (options.taskId && !task) {
      return;
    }

    taskFormContext = { mode, taskId: options.taskId ?? null };
    taskFormOrigin = options.origin ?? null;
    const isCopyMode = mode === "copy-calendar" || mode === "copy-notebook";
    selectedOrganizations = task
      ? taskOrganizations(task)
        .filter((organization) => !isCopyMode || !organization.archived)
        .map((organization) => ({
        id: organization.id,
        name: organization.name,
        normalizedName: organization.normalizedName,
        }))
      : [];

    const range = getPlanningRange();
    elements.taskDateInput.min = range.min;
    elements.taskDateInput.max = range.max;
    elements.organizationInput.value = "";
    elements.taskDescriptionInput.value = task?.description ?? "";
    elements.taskDateInput.value = options.date ?? (mode === "assign-date" ? "" : task?.date ?? "");
    elements.taskFormDialog.dataset.mode = mode;
    clearTaskFormErrors();
    renderOrganizationTags();
    renderOrganizationSuggestions();
    updateDescriptionCounter();

    const dateLocked = mode === "edit-calendar" && Boolean(task?.completed);
    elements.taskDateInput.disabled = dateLocked;
    elements.clearTaskDateButton.disabled = dateLocked || mode === "assign-date";

    if (mode === "edit-calendar") {
      setText(elements.taskFormModeLabel, "Редактирование");
      setText(elements.taskFormTitle, "Изменить задачу");
      setText(elements.saveTaskButton, "Сохранить изменения");
      setText(
        elements.dateHelp,
        task?.completed
          ? "Дата выполненной задачи не изменяется."
          : "Можно выбрать допустимую дату или очистить её для отправки в блокнот.",
      );
    } else if (mode === "copy-calendar") {
      setText(elements.taskFormModeLabel, "Независимая копия");
      setText(elements.taskFormTitle, "Копировать задачу");
      setText(elements.saveTaskButton, "Создать копию");
      setText(elements.dateHelp, "Можно изменить дату или сохранить копию в блокноте без даты.");
    } else if (mode === "edit-notebook") {
      setText(elements.taskFormModeLabel, "Редактирование");
      setText(elements.taskFormTitle, "Изменить задачу блокнота");
      setText(elements.saveTaskButton, "Сохранить изменения");
      setText(elements.dateHelp, "Укажите дату для переноса в календарь или оставьте поле пустым.");
    } else if (mode === "copy-notebook") {
      setText(elements.taskFormModeLabel, "Независимая копия");
      setText(elements.taskFormTitle, "Копировать задачу");
      setText(elements.saveTaskButton, "Создать копию");
      setText(elements.dateHelp, "Можно назначить копии дату или оставить её в блокноте.");
    } else if (mode === "assign-date") {
      setText(elements.taskFormModeLabel, "Перемещение в календарь");
      setText(elements.taskFormTitle, "Назначить дату");
      setText(elements.saveTaskButton, "Добавить в календарь");
      setText(elements.dateHelp, "Выберите день от сегодня до этой же даты следующего года.");
    } else {
      setText(elements.taskFormModeLabel, options.date ? "Задача выбранного дня" : "Новая задача");
      setText(elements.taskFormTitle, "Создать задачу");
      setText(elements.saveTaskButton, "Сохранить");
      setText(elements.dateHelp, "Без даты задача будет сохранена в блокноте.");
    }

    taskFormInitialSnapshot = currentTaskFormSnapshot();
    showModal(elements.taskFormDialog);
    window.setTimeout(() => elements.organizationInput.focus(), 0);
  }

  function taskFormDateValue() {
    if (!elements.taskDateInput.disabled) {
      return elements.taskDateInput.value || null;
    }
    if (taskFormContext?.mode === "edit-calendar") {
      return taskForForm(taskFormContext.taskId)?.date ?? null;
    }
    return null;
  }

  function currentTaskFormSnapshot() {
    const pendingOrganization = prepareOrganizationName(elements.organizationInput.value);
    return JSON.stringify({
      organizations: [
        ...selectedOrganizations.map((organization) => organization.normalizedName),
        ...(pendingOrganization ? [normalizeOrganizationName(pendingOrganization)] : []),
      ],
      date: taskFormDateValue(),
      description: elements.taskDescriptionInput.value,
    });
  }

  function hasUnsavedTaskFormChanges() {
    return Boolean(
      taskFormContext?.mode?.startsWith("edit")
      && taskFormInitialSnapshot !== null
      && currentTaskFormSnapshot() !== taskFormInitialSnapshot
    );
  }

  function forceCloseTaskForm() {
    suppressUnsavedPrompt = true;
    closeModal(elements.taskFormDialog);
    suppressUnsavedPrompt = false;
  }

  function requestCloseTaskForm() {
    if (!suppressUnsavedPrompt && hasUnsavedTaskFormChanges()) {
      showModal(elements.unsavedDialog);
      return;
    }
    forceCloseTaskForm();
  }

  function updateDescriptionCounter() {
    setText(elements.descriptionCounter, `${elements.taskDescriptionInput.value.length} / ${MAX_DESCRIPTION_LENGTH}`);
    if (elements.taskDescriptionInput.value.length > 0) {
      clearFieldError("description");
    }
  }

  function attemptSaveTaskForm() {
    clearTaskFormErrors();
    if (!addOrganizationFromInput()) {
      return false;
    }

    const draft = {
      organizationNames: selectedOrganizations.map((organization) => organization.name),
      date: taskFormDateValue(),
      description: elements.taskDescriptionInput.value,
    };

    try {
      let result = null;
      let notification = "";
      if (taskFormContext.mode === "edit-calendar") {
        result = updateCalendarTask(taskFormContext.taskId, draft);
        notification = "Изменения сохранены";
      } else if (taskFormContext.mode === "copy-calendar") {
        result = copyCalendarTask(taskFormContext.taskId, draft);
        notification = "Копия создана";
      } else if (taskFormContext.mode === "edit-notebook") {
        result = draft.date === null
          ? updateNotebookTask(taskFormContext.taskId, draft)
          : assignNotebookTaskDate(taskFormContext.taskId, draft);
        notification = draft.date === null ? "Изменения сохранены" : "Задача добавлена в календарь";
      } else if (taskFormContext.mode === "copy-notebook") {
        result = copyNotebookTask(taskFormContext.taskId, draft);
        notification = "Копия создана";
      } else if (taskFormContext.mode === "assign-date") {
        result = assignNotebookTaskDate(taskFormContext.taskId, draft);
        notification = "Задача добавлена в календарь";
      } else {
        result = createTaskFromDraft(draft);
        notification = draft.date === null ? "Задача сохранена в блокноте" : "Задача создана";
      }

      if (result) {
        if (elements.unsavedDialog.open) {
          closeModal(elements.unsavedDialog);
        }
        forceCloseTaskForm();
        showToast(notification);
        return true;
      }
    } catch (error) {
      if (error.name === "TaskValidationError") {
        setFieldError(error.field, error.message);
      } else {
        setFieldError("summary", "Не удалось выполнить действие.");
      }
    }
    return false;
  }

  function handleTaskFormSubmit(event) {
    event.preventDefault();
    attemptSaveTaskForm();
  }

  function openNotebook(origin = elements.notebookButton) {
    notebookDialogOrigin = origin;
    renderNotebook();
    showModal(elements.notebookDialog);
  }

  function closeNotebook() {
    closeModal(elements.notebookDialog);
  }

  function setOrganizationEditError(message = "") {
    setText(elements.organizationEditError, message);
    elements.organizationEditError.hidden = !message;
  }

  function openOrganizationEditDialog(organizationId, origin) {
    const organization = currentState.organizations.find((item) => item.id === organizationId);
    if (!organization) {
      return;
    }
    organizationEditId = organization.id;
    organizationEditOrigin = origin ?? null;
    elements.organizationEditNameInput.value = organization.name;
    setOrganizationEditError();
    showModal(elements.organizationEditDialog);
    window.setTimeout(() => {
      elements.organizationEditNameInput.focus();
      elements.organizationEditNameInput.select();
    }, 0);
  }

  function closeOrganizationEditDialog() {
    closeModal(elements.organizationEditDialog);
  }

  function handleOrganizationEditSubmit(event) {
    event.preventDefault();
    if (!organizationEditId) {
      return;
    }
    setOrganizationEditError();
    try {
      const result = renameOrganization(organizationEditId, elements.organizationEditNameInput.value);
      if (result) {
        showToast("Название организации изменено");
        closeOrganizationEditDialog();
      }
    } catch (error) {
      const message = error.name === "TaskValidationError"
        ? error.message
        : "Не удалось изменить организацию.";
      setOrganizationEditError(message);
      elements.organizationEditNameInput.focus();
    }
  }

  function openTransferDialog(taskId) {
    const task = currentState.tasks.find((item) => item.id === taskId && item.date !== null && !item.completed);
    if (!task) {
      return;
    }
    transferTaskId = taskId;
    const range = getPlanningRange();
    elements.transferDateInput.min = range.min;
    elements.transferDateInput.max = range.max;
    elements.transferDateInput.value = "";
    setText(elements.transferTaskLabel, taskHeading(task));
    setText(elements.transferDateHelp, `Доступно: ${formatShortDate(range.min)}–${formatShortDate(range.max)}. Текущая дата ${formatShortDate(task.date)} недоступна.`);
    setText(elements.transferDateError, "");
    elements.transferDateError.hidden = true;
    showModal(elements.transferDialog);
  }

  function closeTransferDialog() {
    transferTaskId = null;
    closeModal(elements.transferDialog);
  }

  function confirmTransfer() {
    const targetDate = elements.transferDateInput.value;
    try {
      const result = transferTask(transferTaskId, targetDate);
      if (result) {
        expandedTaskId = null;
        closeTransferDialog();
        showToast("Задача перенесена");
      }
    } catch (error) {
      const message = error.name === "TaskValidationError" ? error.message : "Не удалось перенести задачу.";
      setText(elements.transferDateError, message);
      elements.transferDateError.hidden = false;
    }
  }

  function openConfirmation(options) {
    pendingConfirmation = options.onConfirm;
    setText(elements.confirmActionTitle, options.title);
    setText(elements.confirmActionText, options.text);
    setText(elements.confirmActionButton, options.confirmLabel);
    elements.confirmActionButton.classList.toggle("button--danger", Boolean(options.danger));
    elements.confirmActionButton.classList.toggle("button--primary", !options.danger);
    showModal(elements.confirmActionDialog);
  }

  function closeConfirmation() {
    pendingConfirmation = null;
    closeModal(elements.confirmActionDialog);
  }

  function confirmMoveToNotebook(taskId) {
    const task = currentState.tasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }
    openConfirmation({
      title: "Переместить задачу в блокнот?",
      text: `Задача «${taskHeading(task)}» останется без назначенной даты.`,
      confirmLabel: "В блокнот",
      danger: false,
      onConfirm: () => {
        const result = moveTaskToNotebook(taskId);
        if (result) {
          showToast("Задача перемещена в блокнот");
        }
      },
    });
  }

  function deleteConfirmationText(task) {
    const organizations = taskOrganizations(task);
    if (organizations.length === 0) {
      return "Удалить задачу без организации?";
    }
    if (organizations.length > 1) {
      return `Удалить общую задачу для ${organizations.length} организаций?`;
    }
    return `Удалить задачу для организации «${organizations[0].name}»?`;
  }

  function confirmDeleteTask(taskId) {
    const task = currentState.tasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }
    openConfirmation({
      title: "Удаление задачи",
      text: deleteConfirmationText(task),
      confirmLabel: "Удалить",
      danger: true,
      onConfirm: () => {
        if (deleteTask(taskId)) {
          showToast("Удалено");
        }
      },
    });
  }

  function openClearDialog() {
    showModal(elements.clearStorageDialog);
  }

  function clearCorruptedState() {
    const clearResult = storage.clear();
    if (!clearResult.ok) {
      showStorageError(clearResult);
      return;
    }
    const emptyState = createEmptyState();
    if (saveState(emptyState)) {
      showToast("Локальные данные очищены");
    }
  }

  elements.searchInput.addEventListener("input", () => {
    filterState.search = elements.searchInput.value;
    renderFilteredViews();
  });
  elements.organizationFilter.addEventListener("change", () => {
    filterState.organizationId = elements.organizationFilter.value;
    renderFilteredViews();
  });
  elements.statusFilter.addEventListener("change", () => {
    const value = elements.statusFilter.value;
    filterState.status = ["all", "incomplete", "completed"].includes(value) ? value : "all";
    renderFilteredViews();
  });
  elements.resetFiltersButton.addEventListener("click", resetFilters);
  elements.previousMonthButton.addEventListener("click", () => changeMonth(-1));
  elements.nextMonthButton.addEventListener("click", () => changeMonth(1));
  elements.todayButton.addEventListener("click", goToToday);
  elements.calendarPanel.addEventListener("wheel", handleCalendarWheel, { passive: false });
  elements.displayTasksButton.addEventListener("click", () => setDaySidebarVisibility(!daySidebarVisible));
  elements.createTaskButton.addEventListener("click", () => openTaskForm({ mode: "create", date: null, origin: elements.createTaskButton }));
  elements.notebookButton.addEventListener("click", () => openNotebook());
  elements.createDayTaskButton.addEventListener("click", () => {
    if (!selectedDateKey || !isDateInPlanningRange(selectedDateKey)) {
      return;
    }
    const origin = dayDialogOrigin ?? elements.createTaskButton;
    const date = selectedDateKey;
    closeDayDialog(false);
    openTaskForm({ mode: "create", date, origin });
  });
  elements.createSidebarTaskButton.addEventListener("click", () => {
    if (!selectedDateKey || !isDateInPlanningRange(selectedDateKey)) {
      return;
    }
    openTaskForm({
      mode: "create",
      date: selectedDateKey,
      origin: elements.createSidebarTaskButton,
    });
  });
  elements.closeDayDialogButton.addEventListener("click", () => closeDayDialog(true));
  elements.dayDialog.addEventListener("close", returnFocusToDay);
  elements.closeNotebookButton.addEventListener("click", closeNotebook);
  elements.notebookDialog.addEventListener("close", () => {
    const origin = notebookDialogOrigin;
    notebookDialogOrigin = null;
    if (origin && origin.isConnected && typeof origin.focus === "function") {
      origin.focus();
    }
  });
  elements.closeOrganizationEditButton.addEventListener("click", closeOrganizationEditDialog);
  elements.cancelOrganizationEditButton.addEventListener("click", closeOrganizationEditDialog);
  elements.organizationEditForm.addEventListener("submit", handleOrganizationEditSubmit);
  elements.organizationEditNameInput.addEventListener("input", () => setOrganizationEditError());
  elements.organizationEditDialog.addEventListener("close", () => {
    const origin = organizationEditOrigin;
    const organizationId = organizationEditId;
    organizationEditOrigin = null;
    organizationEditId = null;
    elements.organizationEditNameInput.value = "";
    setOrganizationEditError();
    if (origin && origin.isConnected && typeof origin.focus === "function") {
      origin.focus();
      return;
    }
    const replacement = [...document.querySelectorAll(".organization-chip--editable")]
      .find((chip) => chip.dataset.organizationId === organizationId);
    replacement?.focus();
  });
  elements.closeTaskFormButton.addEventListener("click", requestCloseTaskForm);
  elements.cancelTaskFormButton.addEventListener("click", requestCloseTaskForm);
  elements.taskForm.addEventListener("submit", handleTaskFormSubmit);
  elements.taskFormDialog.addEventListener("cancel", (event) => {
    if (hasUnsavedTaskFormChanges()) {
      event.preventDefault();
      showModal(elements.unsavedDialog);
    }
  });
  elements.taskFormDialog.addEventListener("close", () => {
    const origin = taskFormOrigin;
    taskFormOrigin = null;
    taskFormContext = null;
    taskFormInitialSnapshot = null;
    suppressUnsavedPrompt = false;
    selectedOrganizations = [];
    if (origin && origin.isConnected && typeof origin.focus === "function") {
      origin.focus();
    }
  });
  elements.addOrganizationButton.addEventListener("click", addOrganizationFromInput);
  elements.organizationInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addOrganizationFromInput();
    }
  });
  elements.organizationInput.addEventListener("change", addOrganizationFromInput);
  elements.taskDescriptionInput.addEventListener("input", updateDescriptionCounter);
  elements.taskDateInput.addEventListener("input", () => clearFieldError("date"));
  elements.clearTaskDateButton.addEventListener("click", () => {
    elements.taskDateInput.value = "";
    clearFieldError("date");
  });
  elements.cancelTransferButton.addEventListener("click", closeTransferDialog);
  elements.confirmTransferButton.addEventListener("click", confirmTransfer);
  elements.transferDateInput.addEventListener("input", () => {
    elements.transferDateError.hidden = true;
  });
  elements.cancelUnsavedButton.addEventListener("click", () => closeModal(elements.unsavedDialog));
  elements.discardUnsavedButton.addEventListener("click", () => {
    closeModal(elements.unsavedDialog);
    forceCloseTaskForm();
  });
  elements.saveUnsavedButton.addEventListener("click", () => {
    closeModal(elements.unsavedDialog);
    attemptSaveTaskForm();
  });
  elements.cancelActionButton.addEventListener("click", closeConfirmation);
  elements.confirmActionButton.addEventListener("click", () => {
    const action = pendingConfirmation;
    pendingConfirmation = null;
    closeModal(elements.confirmActionDialog);
    if (typeof action === "function") {
      action();
    }
  });
  elements.retryStorageButton.addEventListener("click", initialize);
  elements.clearStorageButton.addEventListener("click", openClearDialog);
  elements.confirmClearStorageButton.addEventListener("click", clearCorruptedState);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      runAutomaticCarry();
    }
  });
  window.addEventListener("focus", runAutomaticCarry);

  const publicApi = Object.freeze({
    storageKey: STORAGE_KEY,
    createEmptyState,
    createOrganization,
    createTask,
    normalizeOrganizationName,
    buildMonthMatrix,
    toDateKey,
    formatShortDate,
    getPlanningRange,
    isDateInPlanningRange,
    getDaySummary,
    getTaskHeading: (taskId) => {
      const task = currentState?.tasks.find((item) => item.id === taskId);
      return task ? taskHeading(task) : null;
    },
    getDisplayedMonth: () => new Date(displayedMonth.getTime()),
    isDaySidebarVisible: () => daySidebarVisible,
    setDisplayedMonth,
    getState: () => currentState === null ? null : cloneState(currentState),
    saveState,
    actions: Object.freeze({
      createTaskFromDraft,
      updateNotebookTask,
      copyNotebookTask,
      updateCalendarTask,
      copyCalendarTask,
      assignNotebookTaskDate,
      moveTaskToNotebook,
      setTaskCompleted,
      moveTaskWithinGroup,
      transferTask,
      runAutomaticCarry,
      deleteTask,
      renameOrganization,
    }),
    render: renderCalendar,
  });

  Object.defineProperty(window, "WorkPlannerApp", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: publicApi,
  });

  initialize();
})();
