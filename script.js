/* ====== STORAGE (existing) ====== */
function saveTasks() {
    const data = {
        autoId,
        tasks: Array.from(tasksById.values())
    };
    localStorage.setItem("calendarTasks", JSON.stringify(data));
}

function loadTasks() {
    const raw = localStorage.getItem("calendarTasks");
    if (!raw) return;
    try {
        const data = JSON.parse(raw);
        autoId = data.autoId || 1;
        (data.tasks || []).forEach(t => {
            insertTask(t);
        });
    } catch (e) {
        console.error("Failed to load tasks", e);
    }
}

/* ====== DATE HELPERS (existing) ====== */
const fmtMonth = new Intl.DateTimeFormat(undefined, { month: 'long' });
const fmtMonthShort = new Intl.DateTimeFormat(undefined, { month: 'short' });
const fmtYear = new Intl.DateTimeFormat(undefined, { year: 'numeric' });

const today = new Date();
const todayKey = ymdKey(today);

function ymdKey(d) {
    return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addWeeks(d, n) { return addDays(d, n * 7); }
function startOfWeekMonday(d) {
    const tmp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    let day = tmp.getDay();
    if (day === 0) day = 7;
    tmp.setDate(tmp.getDate() - (day - 1));
    tmp.setHours(0, 0, 0, 0);
    return tmp;
}

/* ====== ELEMENTS (existing + notepad) ====== */
const scrollEl = document.getElementById('scroll');
const weeksEl = document.getElementById('weeks');
const backToTodayBtn = document.getElementById('backToToday');

const dialogOverlay = document.getElementById('dialogOverlay');
const taskNameInput = document.getElementById('taskName');
const colorOptions = document.getElementById('colorOptions');
const createTaskBtn = document.getElementById('createTaskBtn');
const cancelBtn = document.getElementById('cancelBtn');
const dialogTitle = document.getElementById('dialogTitle');

/* Notepad elements */
const notepadHandle = document.getElementById('notepadHandle');
const notepadPanel = document.getElementById('notepadPanel');
const closeNotepadBtn = document.getElementById('closeNotepad');
const notepadText = document.getElementById('notepadText');

/* ====== STATE (existing) ====== */
let autoId = 1;
const tasksById = new Map();
const tasksByDate = new Map();

function ensureDateList(key) { if (!tasksByDate.has(key)) tasksByDate.set(key, []); }

function insertTask(task) {
    tasksById.set(task.id, task);
    ensureDateList(task.dateKey);
    tasksByDate.get(task.dateKey).push(task.id);
    sortTasksForDate(task.dateKey);
    saveTasks();
}
function removeTask(task) {
    tasksById.delete(task.id);
    const list = tasksByDate.get(task.dateKey) || [];
    const i = list.indexOf(task.id);
    if (i >= 0) list.splice(i, 1);
    saveTasks();
}
function moveTask(task, newDateKey) {
    const oldKey = task.dateKey;
    if (oldKey === newDateKey) return;
    const oldList = tasksByDate.get(oldKey) || [];
    const idx = oldList.indexOf(task.id);
    if (idx >= 0) oldList.splice(idx, 1);
    ensureDateList(newDateKey);
    tasksByDate.get(newDateKey).push(task.id);
    task.dateKey = newDateKey;
    sortTasksForDate(oldKey);
    sortTasksForDate(newDateKey);
    saveTasks();
}
function sortTasksForDate(key) {
    const ids = tasksByDate.get(key) || [];
    ids.sort((a, b) => {
        const A = tasksById.get(a), B = tasksById.get(b);
        if ((A.completed ? 1 : 0) !== (B.completed ? 1 : 0)) return (A.completed ? 1 : 0) - (B.completed ? 1 : 0);
        return A.createdAt - B.createdAt;
    });
}

/* ====== RENDER CALENDAR (existing) ====== */
const initialWeek = startOfWeekMonday(today);
const PRELOAD_WEEKS_EACH_SIDE = 52;
let firstWeekStart, lastWeekStart;

function renderInitial() {
    weeksEl.innerHTML = '';
    const start = addWeeks(initialWeek, -PRELOAD_WEEKS_EACH_SIDE);
    const end = addWeeks(initialWeek, PRELOAD_WEEKS_EACH_SIDE);
    firstWeekStart = new Date(start);
    lastWeekStart = new Date(end);

    const frag = document.createDocumentFragment();
    for (let w = 0;; w++) {
        const weekStart = addWeeks(start, w);
        if (weekStart > end) break;
        frag.appendChild(renderWeek(weekStart));
    }
    weeksEl.appendChild(frag);

    requestAnimationFrame(() => {
        const weekEl = weeksEl.querySelector(`[data-week='${ymdKey(initialWeek)}']`);
        if (weekEl) {
            const weekHeight = weekEl.getBoundingClientRect().height;
            scrollEl.scrollTop = weekEl.offsetTop - weekHeight;
        }
    });
}

function renderWeek(weekStart) {
    const week = document.createElement('div');
    week.className = 'week';
    week.dataset.week = ymdKey(weekStart);

    let newMonthLabel = '';
    const refMonth = addDays(weekStart, 3).getMonth();

    for (let i = 0; i < 7; i++) {
        const d = addDays(weekStart, i);
        const dateKey = ymdKey(d);

        const day = document.createElement('div');
        day.className = 'day';
        day.dataset.date = dateKey;

        if (d.getMonth() !== refMonth) day.classList.add('out-month');
        if (dateKey === todayKey) day.classList.add('today');

        const dateRow = document.createElement('div');
        dateRow.className = 'date-row';
        const num = document.createElement('div');
        num.className = 'date-num';
        num.textContent = String(d.getDate());
        dateRow.appendChild(num);
        day.appendChild(dateRow);

        if (d.getDate() === 1) {
            const pill = document.createElement('div');
            pill.className = 'month-pill';
            pill.textContent = `${fmtMonthShort.format(d)} ${fmtYear.format(d)}`;
            day.appendChild(pill);
            if (!newMonthLabel) newMonthLabel = `${fmtMonth.format(d)} ${fmtYear.format(d)}`;
        }

        const tasksWrap = document.createElement('div');
        tasksWrap.className = 'tasks';
        day.appendChild(tasksWrap);

        day.addEventListener('click', () => {
            const [y, m] = day.dataset.date.split("-").map(Number);
            activeMonth = y + "-" + String(m).padStart(2, "0");
            updateMonthHighlight();
        });

        day.addEventListener('dblclick', (e) => {
            const isTask = e.target.closest && e.target.closest('.task');
            if (!isTask) openDialog(day, null);
        });

        day.addEventListener('dragover', (e) => {
            e.preventDefault();
            day.classList.add('drag-over');
        });
        day.addEventListener('dragleave', () => day.classList.remove('drag-over'));
        day.addEventListener('drop', (e) => {
            e.preventDefault();
            day.classList.remove('drag-over');
            const id = e.dataTransfer.getData('text/plain');
            const task = tasksById.get(Number(id));
            if (task) {
                const oldKey = task.dateKey;
                moveTask(task, dateKey);
                renderTasksForDate(oldKey);
                renderTasksForDate(dateKey);
            }
        });

        renderTasksIntoDay(day, dateKey);
        week.appendChild(day);
    }

    if (newMonthLabel) {
        week.classList.add('has-new-month');
        week.setAttribute('data-month-label', newMonthLabel);
    }

    return week;
}

function renderTasksIntoDay(dayEl, dateKey) {
    const wrap = dayEl.querySelector('.tasks');
    wrap.innerHTML = '';
    const ids = tasksByDate.get(dateKey) || [];
    ids.forEach(id => wrap.appendChild(buildTaskElement(tasksById.get(id))));
}
function renderTasksForDate(dateKey) {
    const dayEl = weeksEl.querySelector(`.day[data-date='${dateKey}']`);
    if (dayEl) renderTasksIntoDay(dayEl, dateKey);
}

function prependWeeks(count = 26) {
    const frag = document.createDocumentFragment();
    for (let i = count; i > 0; i--) {
        const wk = addWeeks(firstWeekStart, -1);
        frag.insertBefore(renderWeek(wk), frag.firstChild);
        firstWeekStart = wk;
    }
    weeksEl.insertBefore(frag, weeksEl.firstChild);
}
function appendWeeks(count = 26) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
        const wk = addWeeks(lastWeekStart, 1);
        frag.appendChild(renderWeek(wk));
        lastWeekStart = wk;
    }
    weeksEl.appendChild(frag);
}

function trimOffscreen(maxKeep = 160) {
    const todayWeekKey = ymdKey(initialWeek);
    const weeks = weeksEl.children;
    if (weeks.length <= maxKeep) return;

    while (weeks.length > maxKeep) {
        const first = weeks[0];
        if (first.dataset.week === todayWeekKey) break;
        const rect = first.getBoundingClientRect();
        const contRect = scrollEl.getBoundingClientRect();
        if (rect.bottom < contRect.top - 200) {
            weeksEl.removeChild(first);
            firstWeekStart = addWeeks(firstWeekStart, 1);
        } else break;
    }

    while (weeks.length > maxKeep) {
        const last = weeks[weeks.length - 1];
        if (last.dataset.week === todayWeekKey) break;
        const rect = last.getBoundingClientRect();
        const contRect = scrollEl.getBoundingClientRect();
        if (rect.top > contRect.bottom + 200) {
            weeksEl.removeChild(last);
            lastWeekStart = addWeeks(lastWeekStart, -1);
        } else break;
    }
}

/* ====== SCROLL (existing) ====== */
let ticking = false;
scrollEl.addEventListener('scroll', () => {
    if (ticking) return;
    window.requestAnimationFrame(() => {
        const nearTop = scrollEl.scrollTop < 500;
        const nearBottom = (scrollEl.scrollHeight - (scrollEl.scrollTop + scrollEl.clientHeight)) < 500;
        if (nearTop) {
            const oldHeight = scrollEl.scrollHeight;
            const oldTop = scrollEl.scrollTop;
            prependWeeks(26);
            const newHeight = scrollEl.scrollHeight;
            scrollEl.scrollTop = oldTop + (newHeight - oldHeight);
        }
        if (nearBottom) appendWeeks(26);
        trimOffscreen();

        const todayEl = weeksEl.querySelector('.day.today');
        if (todayEl) {
            const tRect = todayEl.getBoundingClientRect();
            const cRect = scrollEl.getBoundingClientRect();
            const outOfView = (tRect.bottom < cRect.top) || (tRect.top > cRect.bottom);
            backToTodayBtn.classList.toggle('show', outOfView);
        }
        ticking = false;
    });
    ticking = true;
}, { passive: true });

backToTodayBtn.addEventListener('click', () => {
    const weekEl = weeksEl.querySelector(`[data-week='${ymdKey(initialWeek)}']`);
    if (weekEl) {
        weekEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
});

/* ====== TASK UI (existing) ====== */
let selectedTaskId = null;

function buildTaskElement(task) {
    const el = document.createElement('div');
    el.className = 'task';
    el.dataset.id = task.id;
    el.draggable = true;
    el.style.borderLeft = `4px solid ${task.color}`;

    const label = document.createElement('label');
    label.className = 'check-wrap';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'check';
    input.checked = !!task.completed;
    const box = document.createElement('span');
    box.className = 'check-box';
    label.appendChild(input);
    label.appendChild(box);

    const text = document.createElement('div');
    text.className = 'task-text';
    text.textContent = task.name;

    const star = document.createElement('span');
    star.className = 'star';
    star.innerHTML = task.important ? '★' : '☆';
    if (task.important) {
        star.classList.add('filled');
        el.classList.add('important');
    }
    star.addEventListener('click', (e) => {
        e.stopPropagation();
        task.important = !task.important;
        if (task.important) {
            star.innerHTML = '★';
            star.classList.add('filled');
            el.classList.add('important');
        } else {
            star.innerHTML = '☆';
            star.classList.remove('filled');
            el.classList.remove('important');
        }
        saveTasks();
    });

    if (task.completed) el.classList.add('completed');

    label.addEventListener('mouseenter', () => {
        if (!input.checked) el.classList.add('preview-complete');
    });
    label.addEventListener('mouseleave', () => {
        el.classList.remove('preview-complete');
    });

    input.addEventListener('change', () => {
        task.completed = input.checked;
        el.classList.toggle('completed', task.completed);
        el.classList.remove('preview-complete');
        sortTasksForDate(task.dateKey);
        renderTasksForDate(task.dateKey);
        saveTasks();
    });

    el.addEventListener('click', (e) => {
        if (e.target === input || e.target === box || e.target === label) return;
        document.querySelectorAll('.task.selected').forEach(n => n.classList.remove('selected'));
        el.classList.add('selected');
        selectedTaskId = task.id;
    });

    el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const dayEl = el.closest('.day');
        openDialog(dayEl, el);
        saveTasks();
    });

    el.addEventListener('dragstart', (e) => {
        el.classList.add('dragging');
        e.dataTransfer.setData('text/plain', String(task.id));
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));

    el.appendChild(label);
    el.appendChild(text);
    el.appendChild(star);
    return el;
}

document.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement && document.activeElement.tagName;
    if (e.key === 'Backspace' && selectedTaskId && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
        const task = tasksById.get(selectedTaskId);
        if (task) {
            const dateKey = task.dateKey;
            removeTask(task);
            renderTasksForDate(dateKey);
            selectedTaskId = null;
            saveTasks();
        }
    }
});

/* ====== DIALOG (existing) ====== */
let selectedColor = '#f4b4b4';
let dialogDayEl = null;
let editingTaskEl = null;

function openDialog(dayEl, taskEl) {
    dialogDayEl = dayEl;
    editingTaskEl = taskEl;
    const dateKey = dayEl.dataset.date;
    dialogTitle.textContent = taskEl ? 'Edit task' : 'Create task';
    createTaskBtn.textContent = taskEl ? 'Save Changes' : 'Create Task';

    if (taskEl) {
        const id = Number(taskEl.dataset.id);
        const t = tasksById.get(id);
        taskNameInput.value = t ? t.name : '';
        selectedColor = t ? t.color : selectedColor;
    } else {
        taskNameInput.value = '';
        selectedColor = '#f4b4b4';
    }

    [...colorOptions.children].forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.color === selectedColor);
    });

    dialogOverlay.style.display = 'flex';
    saveTasks();
    requestAnimationFrame(() => {
        taskNameInput.focus();
        taskNameInput.select();
    });
}
function closeDialog() {
    dialogOverlay.style.display = 'none';
    dialogDayEl = null;
    editingTaskEl = null;
}

colorOptions.addEventListener('click', (e) => {
    const opt = e.target.closest('.color-option');
    if (!opt) return;
    selectedColor = opt.dataset.color;
    [...colorOptions.children].forEach(o => o.classList.toggle('selected', o === opt));
});
createTaskBtn.addEventListener('click', confirmTask);
cancelBtn.addEventListener('click', closeDialog);
dialogOverlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDialog();
    if (e.key === 'Enter') confirmTask();
});
dialogOverlay.addEventListener('click', (e) => {
    if (e.target === dialogOverlay) closeDialog();
});
function confirmTask() {
    if (!dialogDayEl) return;
    const name = taskNameInput.value.trim();
    if (!name) { taskNameInput.focus(); return; }
    const dateKey = dialogDayEl.dataset.date;

    if (editingTaskEl) {
        const id = Number(editingTaskEl.dataset.id);
        const t = tasksById.get(id);
        if (t) {
            t.name = name;
            t.color = selectedColor;
            renderTasksForDate(t.dateKey);
        }
    } else {
        const task = {
            id: autoId++,
            name,
            color: selectedColor,
            completed: false,
            important: false,
            dateKey,
            createdAt: Date.now()
        };
        insertTask(task);
        renderTasksForDate(dateKey);
    }
    saveTasks();
    closeDialog();
}

/* ====== INIT (existing) ====== */
loadTasks();
renderInitial();

let activeMonth = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0");
function updateMonthHighlight() {
    const allDays = weeksEl.querySelectorAll('.day');
    allDays.forEach(dayEl => {
        const [y, m, d] = dayEl.dataset.date.split("-").map(Number);
        const date = new Date(y, m - 1, d);
        const ym = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
        if (ym === activeMonth) {
            dayEl.classList.remove('dimmed');
        } else {
            dayEl.classList.add('dimmed');
        }
    });
}
updateMonthHighlight();
tasksByDate.forEach((_, dateKey) => renderTasksForDate(dateKey));
const clearAllBtn = document.getElementById('clearAllTasks');
clearAllBtn.addEventListener('click', () => {
    if (confirm("⚠️ This will permanently delete ALL tasks. Are you sure?")) {
        localStorage.removeItem("calendarTasks");
        tasksById.clear();
        tasksByDate.clear();
        weeksEl.querySelectorAll('.tasks').forEach(wrap => wrap.innerHTML = '');
        autoId = 1;
        alert("All tasks cleared.");
    }
});

/* ====== NOTEPAD: behavior & autosave ====== */
const NOTEPAD_STORAGE_KEY = 'calendarNotepad';
const NOTEPAD_OPEN_KEY = 'calendarNotepadOpen';

function openNotepad() {
    document.body.classList.add('notepad-open');
    localStorage.setItem(NOTEPAD_OPEN_KEY, '1');
    notepadText.focus();
}
function closeNotepad() {
    document.body.classList.remove('notepad-open');
    localStorage.setItem(NOTEPAD_OPEN_KEY, '0');
}
function toggleNotepad() {
    if (document.body.classList.contains('notepad-open')) closeNotepad(); else openNotepad();
}

/* Show handle when mouse is near right edge */
let handleHideTimer = null;
function maybeShowHandle(ev) {
    if (document.body.classList.contains('notepad-open')) return;
    const threshold = 80; // px from the right edge
    const fromRight = window.innerWidth - ev.clientX;
    if (fromRight <= threshold) {
        notepadHandle.classList.add('show');
        if (handleHideTimer) clearTimeout(handleHideTimer);
        handleHideTimer = setTimeout(() => {
            notepadHandle.classList.remove('show');
        }, 500);
    }
}
window.addEventListener('mousemove', maybeShowHandle, { passive: true });

/* Clicks */
notepadHandle.addEventListener('click', openNotepad);
closeNotepadBtn.addEventListener('click', closeNotepad);

/* Keyboard: ESC closes if focused in notepad */
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('notepad-open')) {
        // If dialog is open, let it handle escape
        const dialogVisible = dialogOverlay && dialogOverlay.style.display === 'flex';
        if (!dialogVisible) closeNotepad();
    }
});

/* Autosave notes */
function loadNotepad() {
    const saved = localStorage.getItem(NOTEPAD_STORAGE_KEY);
    if (typeof saved === 'string') notepadText.value = saved;
    const openSaved = localStorage.getItem(NOTEPAD_OPEN_KEY);
    if (openSaved === '1') {
        openNotepad();
        // focus after open to avoid scroll jank
        setTimeout(() => notepadText.focus(), 50);
    }
}
let saveNoteTimer = null;
notepadText.addEventListener('input', () => {
    // light debounce to avoid thrashing
    if (saveNoteTimer) cancelAnimationFrame(saveNoteTimer);
    saveNoteTimer = requestAnimationFrame(() => {
        localStorage.setItem(NOTEPAD_STORAGE_KEY, notepadText.value);
    });
});
loadNotepad();

/* Touch support: reveal handle when swiping from right edge */
let touchStartX = null;
window.addEventListener('touchstart', (e) => {
    if (document.body.classList.contains('notepad-open')) return;
    const t = e.touches[0];
    touchStartX = t.clientX;
    const fromRight = window.innerWidth - touchStartX;
    if (fromRight < 24) {
        notepadHandle.classList.add('show');
    }
}, { passive: true });

window.addEventListener('touchend', () => {
    if (!document.body.classList.contains('notepad-open')) {
        notepadHandle.classList.remove('show');
    }
}, { passive: true });

/* Optional: click outside notepad to close (but not when clicking inside) */
notepadPanel.addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('click', (e) => {
    // If clicking on the panel/handle/close button, ignore.
    if (e.target === notepadPanel || e.target === notepadHandle || e.target === closeNotepadBtn) return;
    // If notepad open and click happened outside panel, close it.
    if (document.body.classList.contains('notepad-open')) {
        // Avoid closing when clicking Back to Today or Clear All, etc.
        const withinPanel = e.target.closest && e.target.closest('#notepadPanel');
        if (!withinPanel) closeNotepad();
    }
});
