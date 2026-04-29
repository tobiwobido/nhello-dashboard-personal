var TM_KEY = 'taskmanager_v2';
var TODAY_PROGRESS_SNAPSHOT_KEY = TM_KEY + '_today_progress_snapshot_v1';
var openNotes = {};
var priDropState = { tab: null, taskId: null };
var _donutAnimated = false;
var _pendingDonutAnimation = null;
var activeFilter = 'all';
var pendingTaskInsert = null;
var pendingTaskComplete = null;
var pendingTaskNoteCompletes = null;
var pendingNoteToggle = null;
var pendingFilterEnterIds = null;
var _dashboardEntranceTimer = null;
var _categoryHeaderEntranceTimer = null;
var _columnResizeTimer = null;
var _clearAllDoneTimer = null;
var _clearDoneTimers = {};
var _filterTransitionTimer = null;
var _filterEnterTimer = null;
var _filterEnterCleanupMs = 380;
var _filterNoMotionCols = null;
var _freezeTaskAvailableHeightSync = false;
var _columnScopedToggleTab = null;
var _noteToggleRenderTab = null;
var _pendingFlipReleases = null;
var openChildNoteAdds = {};
var deleteIntentTasks = {};
var deleteIntentParentNotes = {};
var FILTER_ENTER_ANIMATION_MS = 260;
var FILTER_ENTER_DELAY_RATIO = 0.45;
var FILTER_ENTER_DELAY_MAX_MS = 120;
var FILTER_ENTER_CLEANUP_BUFFER_MS = 40;
var taskColumnDragState = {
  activeDragTaskId: null,
  sourceTab: null,
  targetTab: null
};

function resetTaskColumnDragState() {
  taskColumnDragState.activeDragTaskId = null;
  taskColumnDragState.sourceTab = null;
  taskColumnDragState.targetTab = null;
}

function shouldCancelTaskDragStart(evt) {
  var target = evt && evt.target;
  if (!target || !target.closest) return true;
  var handle = target.closest('.task-drag-handle');
  if (!handle) return true;
  var blockedInteractive = target.closest(
    'textarea,input,button,select,.cb-wrap,.note-text-input,.note-add-input,.note-add-btn,.note-del,.notes-icon-btn,.cal-icon-btn,.date-chip,.del-x,.pri-badge'
  );
  if (blockedInteractive && !blockedInteractive.classList.contains('task-drag-handle')) return true;
  return false;
}

function handleTaskDragStart(evt, tab, taskId) {
  if (shouldCancelTaskDragStart(evt)) {
    if (evt && evt.preventDefault) evt.preventDefault();
    resetTaskColumnDragState();
    return false;
  }
  taskColumnDragState.activeDragTaskId = taskId || null;
  taskColumnDragState.sourceTab = tab || null;
  taskColumnDragState.targetTab = null;
  if (evt && evt.dataTransfer) {
    evt.dataTransfer.effectAllowed = 'move';
    evt.dataTransfer.setData('text/plain', String(taskId || ''));
    var handleEl = evt.target && evt.target.closest ? evt.target.closest('.task-drag-handle') : null;
    var taskGroupEl = handleEl && handleEl.closest ? handleEl.closest('.task-group') : null;
    if (taskGroupEl && evt.dataTransfer.setDragImage) {
      var rect = taskGroupEl.getBoundingClientRect();
      var offsetX = Math.max(0, Math.min(rect.width, (evt.clientX || 0) - rect.left));
      var offsetY = Math.max(0, Math.min(rect.height, (evt.clientY || 0) - rect.top));
      evt.dataTransfer.setDragImage(taskGroupEl, offsetX, offsetY);
    }
  }
  return true;
}

function handleTaskDragEnd() {
  document.querySelectorAll('.col-tasks.drag-column-over').forEach(function(el) {
    el.classList.remove('drag-column-over');
    el._dragDepth = 0;
  });
  resetTaskColumnDragState();
}

function getTaskTabFromContainerId(containerId) {
  if (containerId === 'tasks-life') return 'life';
  if (containerId === 'tasks-work') return 'work';
  if (containerId === 'tasks-pd') return 'pd';
  return null;
}

function bindTaskColumnDropZone(container) {
  if (!container || container._taskDropBound) return;
  container._taskDropBound = true;
  container._dragDepth = 0;

  container.addEventListener('dragover', function(evt) {
    if (!taskColumnDragState.activeDragTaskId) return;
    if (evt && evt.preventDefault) evt.preventDefault();
    if (evt && evt.dataTransfer) evt.dataTransfer.dropEffect = 'move';
    taskColumnDragState.targetTab = getTaskTabFromContainerId(container.id);
  });

  container.addEventListener('dragenter', function(evt) {
    if (!taskColumnDragState.activeDragTaskId) return;
    if (evt && evt.preventDefault) evt.preventDefault();
    container._dragDepth = (container._dragDepth || 0) + 1;
    container.classList.add('drag-column-over');
    taskColumnDragState.targetTab = getTaskTabFromContainerId(container.id);
  });

  container.addEventListener('dragleave', function() {
    if (!taskColumnDragState.activeDragTaskId) return;
    container._dragDepth = Math.max(0, (container._dragDepth || 0) - 1);
    if (!container._dragDepth) container.classList.remove('drag-column-over');
  });

  container.addEventListener('drop', function(evt) {
    if (!taskColumnDragState.activeDragTaskId) return;
    if (evt && evt.preventDefault) evt.preventDefault();
    var destTab = getTaskTabFromContainerId(container.id);
    taskColumnDragState.targetTab = destTab;
    container._dragDepth = 0;
    container.classList.remove('drag-column-over');
    var sourceTab = taskColumnDragState.sourceTab;
    var taskId = taskColumnDragState.activeDragTaskId;
    if (!sourceTab || !destTab || !taskId || sourceTab === destTab) {
      resetTaskColumnDragState();
      return;
    }
    var data = getData();
    if (!data[sourceTab] || !data[destTab]) {
      resetTaskColumnDragState();
      return;
    }
    var sourceTasks = data[sourceTab] || [];
    var taskIndex = sourceTasks.findIndex(function(t) { return t && t.id === taskId; });
    if (taskIndex < 0) {
      resetTaskColumnDragState();
      return;
    }
    var taskToMove = sourceTasks[taskIndex];
    if (!taskToMove) {
      resetTaskColumnDragState();
      return;
    }
    sourceTasks.splice(taskIndex, 1);
    data[destTab].push(taskToMove);
    saveData(data);
    render();
    resetTaskColumnDragState();
  });
}

var CB_SVG = '<svg class="cb-svg" viewBox="0 0 22 22" fill="none"><circle class="cb-circle" cx="11" cy="11" r="9.5"/><polyline class="cb-check" points="6,11 9.5,14.5 16.5,7.5"/></svg>';

var ICON_CAL  = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="3" width="13" height="11.5" rx="1.5"/><path d="M5 1.5V4M11 1.5V4M1.5 7h13"/></svg>';
var ICON_NOTE = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/><path d="M5 5.5h6M5 8.5h6M5 11.5h3.5"/></svg>';
var ICON_CLOSE = '<svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 2L8 8M8 2L2 8"/></svg>';

// ── Data ──────────────────────────────────────────────────────────────────────

function getData() {
  try {
    var d = JSON.parse(localStorage.getItem(TM_KEY) || 'null') || { life:[], work:[], pd:[] };
    ['life','work','pd'].forEach(function(tab) {
      (d[tab]||[]).forEach(function(task) {
        if (!Array.isArray(task.noteItems)) {
          task.noteItems = (task.notes && task.notes.trim())
            ? [{ id: genId(), text: task.notes.trim(), done: false, parentNoteId: null }]
            : [];
        }
        task.noteItems = normalizeNoteItems(task.noteItems);
      });
    });
    return d;
  } catch(e) { return { life:[], work:[], pd:[] }; }
}

function getTodayProgressSnapshot() {
  try {
    var snapshot = JSON.parse(localStorage.getItem(TODAY_PROGRESS_SNAPSHOT_KEY) || 'null');
    if (!snapshot || typeof snapshot !== 'object') return null;
    var date = typeof snapshot.date === 'string' ? snapshot.date : null;
    var overdueIds = Array.isArray(snapshot.overdueIds)
      ? snapshot.overdueIds.filter(function(id) { return id !== null && id !== undefined; }).map(String)
      : [];
    if (!date) return null;
    return {
      date: date,
      overdueIds: overdueIds
    };
  } catch(e) {
    return null;
  }
}

function saveTodayProgressSnapshot(snapshot) {
  try {
    localStorage.setItem(TODAY_PROGRESS_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch(e) {}
}
// ── Undo stack ────────────────────────────────────────────────────────────────

var undoStack = [];
var redoStack = [];
var _undoing  = false;
var _undoRedoScopedTabs = null;
var _pendingUndoTaskToggleAnimation = null;
var _pendingUndoNoteToggleAnimation = null;

function _getChangedTabsFromSnapshots(currentSnap, targetSnap) {
  function parseSnap(snap) {
    try {
      return JSON.parse(snap || 'null') || { life:[], work:[], pd:[] };
    } catch (e) {
      return { life:[], work:[], pd:[] };
    }
  }
  var current = parseSnap(currentSnap);
  var target = parseSnap(targetSnap);
  return ['life','work','pd'].filter(function(tab) {
    return JSON.stringify(current[tab] || []) !== JSON.stringify(target[tab] || []);
  });
}

function _collectUndoRedoAnimationState(currentSnap, targetSnap) {
  function parseSnap(snap) {
    try {
      return JSON.parse(snap || 'null') || { life:[], work:[], pd:[] };
    } catch (e) {
      return { life:[], work:[], pd:[] };
    }
  }
  function byId(items) {
    var map = {};
    (items || []).forEach(function(item) {
      if (item && item.id) map[item.id] = item;
    });
    return map;
  }
  var current = parseSnap(currentSnap);
  var target = parseSnap(targetSnap);
  var result = {
    changedTabs: ['life','work','pd'].filter(function(tab) {
      return JSON.stringify(current[tab] || []) !== JSON.stringify(target[tab] || []);
    }),
    taskToggle: null,
    noteToggle: null
  };
  ['life','work','pd'].forEach(function(tab) {
    var currentTasks = byId(current[tab]);
    var targetTasks = byId(target[tab]);
    var taskIds = Object.keys(currentTasks).concat(Object.keys(targetTasks).filter(function(id) {
      return !currentTasks[id];
    }));
    taskIds.forEach(function(taskId) {
      var currentTask = currentTasks[taskId];
      var targetTask = targetTasks[taskId];
      if (!currentTask || !targetTask) return;
      if (!result.taskToggle && !!currentTask.done !== !!targetTask.done) {
        result.taskToggle = { tab: tab, id: taskId, done: !!targetTask.done };
      }
      if (result.noteToggle) return;
      var currentNotes = byId(currentTask.noteItems);
      var targetNotes = byId(targetTask.noteItems);
      var noteIds = Object.keys(currentNotes).concat(Object.keys(targetNotes).filter(function(id) {
        return !currentNotes[id];
      }));
      noteIds.forEach(function(noteId) {
        if (result.noteToggle) return;
        var currentNote = currentNotes[noteId];
        var targetNote = targetNotes[noteId];
        if (!currentNote || !targetNote) return;
        if (!!currentNote.done !== !!targetNote.done) {
          result.noteToggle = {
            tab: tab,
            taskId: taskId,
            noteId: noteId,
            done: !!targetNote.done
          };
        }
      });
    });
  });
  return result;
}

function runUndoRedoStateAnimations() {
  if (_pendingUndoTaskToggleAnimation) {
    var taskAnim = _pendingUndoTaskToggleAnimation;
    if (!taskAnim.done) {
      var taskEl = document.querySelector('.task-group[data-id="'+taskAnim.id+'"]');
      var taskCb = taskEl && taskEl.querySelector('.task-item .cb-wrap');
      var taskTitle = taskEl && taskEl.querySelector('.title-input');
      if (taskCb && taskTitle) {
        runCheckboxTextAnimation(taskCb, taskTitle, false, null, { pop: false });
      }
    }
    _pendingUndoTaskToggleAnimation = null;
  }
  if (_pendingUndoNoteToggleAnimation) {
    var noteAnim = _pendingUndoNoteToggleAnimation;
    var noteCb = document.querySelector('.cb-wrap[data-note-id="'+noteAnim.noteId+'"]');
    var noteInput = noteCb && noteCb.parentElement && noteCb.parentElement.querySelector('.note-text-input');
    if (noteCb && noteInput) {
      runCheckboxTextAnimation(noteCb, noteInput, noteAnim.done, null, { pop: false });
    }
    _pendingUndoNoteToggleAnimation = null;
  }
}

function reconcileTransientNoteUiState(data) {
  data = data || getData();
  var taskExists = {};
  var parentNoteExists = {};
  ['life','work','pd'].forEach(function(tab) {
    (data[tab] || []).forEach(function(task) {
      if (!task || !task.id) return;
      taskExists[task.id] = true;
      (task.noteItems || []).forEach(function(note) {
        if (!note || !note.id) return;
        if (note.parentNoteId == null) {
          parentNoteExists[getChildNoteAddKey(task.id, note.id)] = true;
        }
      });
    });
  });
  Object.keys(openNotes).forEach(function(taskId) {
    if (!taskExists[taskId]) delete openNotes[taskId];
  });
  Object.keys(openChildNoteAdds).forEach(function(key) {
    if (!parentNoteExists[key]) delete openChildNoteAdds[key];
  });
}

function clearOpenChildNoteInputsForParent(taskId, parentNoteId) {
  if (!taskId || !parentNoteId) return;
  var targetKey = getChildNoteAddKey(taskId, parentNoteId);
  Object.keys(openChildNoteAdds).forEach(function(key) {
    if (key === targetKey) delete openChildNoteAdds[key];
  });
}

function pushUndo() {
  if (_undoing) return;
  var snap = localStorage.getItem(TM_KEY) || JSON.stringify({ life:[], work:[], pd:[] });
  if (undoStack[undoStack.length - 1] === snap) return;
  undoStack.push(snap);
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
}

function doUndo() {
  if (!undoStack.length) return false;
  var current = localStorage.getItem(TM_KEY) || JSON.stringify({ life:[], work:[], pd:[] });
  var target = undoStack[undoStack.length - 1];
  var animationState = _collectUndoRedoAnimationState(current, target);
  var changedTabs = animationState.changedTabs;
  _undoing = true;
  redoStack.push(current);
  if (redoStack.length > 50) redoStack.shift();
  localStorage.setItem(TM_KEY, undoStack.pop());
  _undoing = false;
  _undoRedoScopedTabs = changedTabs.length ? changedTabs : null;
  _columnScopedToggleTab = changedTabs.length === 1 ? changedTabs[0] : null;
  _pendingUndoTaskToggleAnimation = animationState.taskToggle;
  _pendingUndoNoteToggleAnimation = animationState.noteToggle;
  if (animationState.taskToggle && animationState.taskToggle.done) {
    pendingTaskComplete = { tab: animationState.taskToggle.tab, id: animationState.taskToggle.id };
  }
  if (animationState.noteToggle) {
    pendingNoteToggle = {
      tab: animationState.noteToggle.tab,
      taskId: animationState.noteToggle.taskId,
      noteId: animationState.noteToggle.noteId
    };
  }
  openChildNoteAdds = {};
  var undoData = getData();
  reconcileTransientNoteUiState(undoData);
  render();
  runUndoRedoStateAnimations();
  return true;
}

function doRedo() {
  if (!redoStack.length) return false;
  var current = localStorage.getItem(TM_KEY) || JSON.stringify({ life:[], work:[], pd:[] });
  var target = redoStack[redoStack.length - 1];
  var animationState = _collectUndoRedoAnimationState(current, target);
  var changedTabs = animationState.changedTabs;
  _undoing = true;
  undoStack.push(current);
  if (undoStack.length > 50) undoStack.shift();
  localStorage.setItem(TM_KEY, redoStack.pop());
  _undoing = false;
  _undoRedoScopedTabs = changedTabs.length ? changedTabs : null;
  _columnScopedToggleTab = changedTabs.length === 1 ? changedTabs[0] : null;
  _pendingUndoTaskToggleAnimation = animationState.taskToggle;
  _pendingUndoNoteToggleAnimation = animationState.noteToggle;
  if (animationState.taskToggle && animationState.taskToggle.done) {
    pendingTaskComplete = { tab: animationState.taskToggle.tab, id: animationState.taskToggle.id };
  }
  if (animationState.noteToggle) {
    pendingNoteToggle = {
      tab: animationState.noteToggle.tab,
      taskId: animationState.noteToggle.taskId,
      noteId: animationState.noteToggle.noteId
    };
  }
  openChildNoteAdds = {};
  var redoData = getData();
  reconcileTransientNoteUiState(redoData);
  render();
  runUndoRedoStateAnimations();
  return true;
}

function saveData(d) {
  pushUndo();
  localStorage.setItem(TM_KEY, JSON.stringify(d));
}
function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function nextCompletionStamp() { return Date.now() + Math.random(); }
function find(arr, id) { return (arr||[]).find(function(t){ return t.id===id; }); }
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayISO() {
  var d = new Date();
  return d.getFullYear() + '-'
    + String(d.getMonth()+1).padStart(2,'0') + '-'
    + String(d.getDate()).padStart(2,'0');
}
function fmtISO(iso) {
  if (!iso) return '';
  var p = iso.split('-');
  return new Date(+p[0], +p[1]-1, +p[2])
    .toLocaleDateString('en-US', { month:'short', day:'numeric' });
}
function isOverdue(t)  { return !t.done && !!t.dueDate && t.dueDate < todayISO(); }
function isDueToday(t) { return !t.done && !!t.dueDate && t.dueDate === todayISO(); }

// ── Sorting ───────────────────────────────────────────────────────────────────

function sortedTasks(tasks) {
  var pri = { high:0, medium:1, low:2 };
  return tasks.slice().sort(function(a, b) {
    if (a.done !== b.done) return a.done ? 1 : -1;
    var da = a.dueDate || 'zzzz', db = b.dueDate || 'zzzz';
    if (da !== db) return da < db ? -1 : 1;
    var pa = pri[a.priority||'medium'], pb = pri[b.priority||'medium'];
    if (pa !== pb) return pa - pb;
    var at = String(a && a.text ? a.text : '').trim();
    var bt = String(b && b.text ? b.text : '').trim();
    return at.localeCompare(bt, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function sortedNotes(noteItems) {
  function noteTextCompare(a, b) {
    var at = String(a && a.text ? a.text : '').trim();
    var bt = String(b && b.text ? b.text : '').trim();
    return at.localeCompare(bt, undefined, { numeric: true, sensitivity: 'base' });
  }
  var open = [];
  var done = [];
  (noteItems || []).forEach(function(note) {
    (note && note.done ? done : open).push(note);
  });
  open.sort(noteTextCompare);
  done.sort(noteTextCompare);
  return open.concat(done);
}

function normalizeNoteItems(noteItems) {
  return (noteItems || []).map(function(note) {
    if (!note || typeof note !== 'object') return note;
    if (!Object.prototype.hasOwnProperty.call(note, 'parentNoteId')) {
      note.parentNoteId = null;
    } else if (note.parentNoteId == null) {
      note.parentNoteId = null;
    }
    return note;
  });
}

function getTopLevelNotes(noteItems) {
  return (noteItems || []).filter(function(note) {
    return note && note.parentNoteId == null;
  });
}

function getChildNotes(noteItems, parentId) {
  return (noteItems || []).filter(function(note) {
    return note && note.parentNoteId === parentId;
  });
}

function addChildNoteItem(tab, taskId, parentNoteId, text, skipFocus) {
  if (!parentNoteId) return;
  addNoteItem(tab, taskId, text, skipFocus, parentNoteId);
}

function applyInitialOrderingOnce() {
  var initKey = TM_KEY + '_order_init_v1';
  if (localStorage.getItem(initKey) === '1') return;
  var data = getData();
  var changed = false;

  function itemKey(item) {
    return item && item.id
      ? String(item.id)
      : ('t:' + String(item && item.text ? item.text : '').trim().toLocaleLowerCase());
  }

  ['life','work','pd'].forEach(function(tab) {
    var tasks = Array.isArray(data[tab]) ? data[tab] : [];

    tasks.forEach(function(task) {
      if (!Array.isArray(task.noteItems)) task.noteItems = [];
      task.noteItems = normalizeNoteItems(task.noteItems);
      var beforeNotes = task.noteItems.map(itemKey).join('|');
      task.noteItems = sortedNotes(task.noteItems);
      var afterNotes = task.noteItems.map(itemKey).join('|');
      if (beforeNotes !== afterNotes) changed = true;
    });

    var beforeTasks = tasks.map(itemKey).join('|');
    tasks = sortedTasks(tasks);
    var afterTasks = tasks.map(itemKey).join('|');
    if (beforeTasks !== afterTasks) changed = true;
    data[tab] = tasks;
  });

  if (changed) {
    localStorage.setItem(TM_KEY, JSON.stringify(data));
  }
  localStorage.setItem(initKey, '1');
}

// ── Migration ─────────────────────────────────────────────────────────────────

function migrateIfNeeded() {
  if (localStorage.getItem(TM_KEY)) return;
  var old = localStorage.getItem('taskmanager_v1');
  if (!old) return;
  try {
    var data = JSON.parse(old);
    ['life','work','pd'].forEach(function(tab) {
      (data[tab]||[]).forEach(function(task) {
        task.priority  = task.priority || 'medium';
        task.dueDate   = task.dueDate  || null;
        if (task.done && typeof task.completedAt !== 'number') task.completedAt = 0;
        task.noteItems = (task.notes && task.notes.trim())
          ? [{ id: genId(), text: task.notes.trim(), done: false, parentNoteId: null }]
          : [];
        task.noteItems = normalizeNoteItems(task.noteItems);
        if (!task.children) task.children = [];
      });
    });
    saveData(data);
  } catch(e) {}
}

// ── Task operations ───────────────────────────────────────────────────────────

function createTaskFromInputs(tab, text, priority, addBtn, dueDate) {
  if (addBtn) {
    clearTimeout(addBtn._confirmTimer);
    addBtn.classList.remove('is-confirmed');
    void addBtn.offsetWidth;
    addBtn.classList.add('is-confirmed');
    addBtn._confirmTimer = setTimeout(function() {
      addBtn.classList.remove('is-confirmed');
    }, 1000);
  }
  var data = getData();
  if (!data[tab]) data[tab] = [];
  var newTask = {
    id: genId(), text: text, done: false,
    priority: priority || 'medium', dueDate: dueDate || null, noteItems: [],
    children: []
  };
  data[tab].push(newTask);
  var addRowRect = addBtn ? addBtn.getBoundingClientRect() : null;
  pendingTaskInsert = addRowRect ? {
    tab: tab,
    id: newTask.id,
    startTop: addRowRect.top
  } : null;
  saveData(data);
  render();
}

function addTask(tab) {
  var inp = document.getElementById('input-'+tab);
  var priInput = document.getElementById('priority-'+tab);
  var text = inp.value.trim();
  if (!text) return;
  var addBtn = document.querySelector('.task-add-btn[onclick="addTask(\''+tab+'\')"]');
  createTaskFromInputs(tab, text, priInput ? (priInput.value || 'medium') : 'medium', addBtn);
  inp.value = '';
  if (priInput) priInput.value = 'medium';
}

function addTaskFromDashboardPreview() {
  if (!document.body.classList.contains('dashboard-topbar-preview') &&
      !document.body.classList.contains('dashboard-topbar-preview-v2')) return;
  var input = document.getElementById('dashboard-add-input');
  var category = document.getElementById('dashboard-add-category');
  var priority = document.getElementById('dashboard-add-priority');
  var addBtn = document.getElementById('dashboard-add-btn');
  if (!input || !category) return;
  var text = input.value.trim();
  if (!text) return;
  createTaskFromInputs(
    category.value || 'life',
    text,
    priority ? (priority.value || 'medium') : 'medium',
    addBtn,
    composerDueDate
  );
  composerDueDate = null;
  syncComposerDateTriggerUI();
  input.value = '';
  if (priority) priority.value = 'medium';
}

function toggleTask(tab, id) {
  _columnScopedToggleTab = tab;
  var data = getData();
  var t = find(data[tab], id);
  if (!t) return;
  t.done = !t.done;
  if (t.done && Array.isArray(t.noteItems) && t.noteItems.length) {
    pendingTaskNoteCompletes = {
      tab: tab,
      taskId: id,
      noteIds: t.noteItems.filter(function(note){ return !note.done; }).map(function(note){ return note.id; })
    };
    t.noteItems.forEach(function(note) { note.done = true; });
  } else if (!t.done && Array.isArray(t.noteItems) && t.noteItems.length) {
    t.noteItems.forEach(function(note) { note.done = false; });
    pendingTaskNoteCompletes = null;
  }
  if (Array.isArray(t.noteItems) && t.noteItems.length) {
    t.noteItems = sortedNotes(t.noteItems);
  }
  data[tab] = sortedTasks(data[tab] || []);
  t.completedAt = t.done ? nextCompletionStamp() : null;
  saveData(data);
  if (t.done) {
    pendingTaskComplete = { tab: tab, id: id };
    render();
    return;
  }
  render();
}

function deleteTask(tab, id, btn) {
  var item = btn && btn.closest ? btn.closest('.task-group') : document.querySelector('.task-group[data-id="'+id+'"]');
  var list = document.getElementById('tasks-'+tab);
  var main = document.querySelector('.main-content');
  function releaseReflowLock(nextList) {
    if (nextList) nextList.classList.remove('is-reflowing');
    if (main) main.classList.remove('task-reflowing');
  }
  function removeFromData() {
    var data = getData();
    data[tab] = (data[tab]||[]).filter(function(t){ return t.id!==id; });
    delete openNotes[id];
    deleteIntentTasks[id] = false;
    saveData(data); render();
    requestAnimationFrame(function() {
      var nextList = document.getElementById('tasks-'+tab);
      var flipMs = nextList && typeof nextList._lastFlipMs === 'number' ? nextList._lastFlipMs : 340;
      setTimeout(function() { releaseReflowLock(nextList); }, Math.max(180, flipMs + 40));
    });
  }
  if (!item) { removeFromData(); return; }
  deleteIntentTasks[id] = true;
  item.querySelectorAll('.note-add-row').forEach(function(row) {
    row.classList.add('removing');
  });
  if (main) main.classList.add('task-reflowing');
  if (list) list.classList.add('is-reflowing');
  item.classList.add('removing');
  setTimeout(removeFromData, 260);
}

function clearDone(tab) {
  if (_clearDoneTimers[tab]) return;
  var data = getData();
  if (!(data[tab]||[]).some(function(t){ return t.done; })) return;
  var container = document.getElementById('tasks-' + tab);
  var exitingEls = [];
  if (container) {
    container.querySelectorAll('.task-group[data-id]').forEach(function(el) {
      var task = find(data[tab], el.dataset.id);
      if (task && task.done) {
        el.classList.add('filter-exit');
        exitingEls.push(el);
      }
    });
  }
  if (!exitingEls.length) {
    (data[tab]||[]).filter(function(t){ return t.done; })
      .forEach(function(t){ delete openNotes[t.id]; });
    data[tab] = (data[tab]||[]).filter(function(t){ return !t.done; });
    saveData(data); render();
    return;
  }
  var prevHeights = captureColumnHeights();
  _clearDoneTimers[tab] = setTimeout(function() {
    delete _clearDoneTimers[tab];
    var d = getData();
    (d[tab]||[]).filter(function(t){ return t.done; })
      .forEach(function(t){ delete openNotes[t.id]; });
    d[tab] = (d[tab]||[]).filter(function(t){ return !t.done; });
    saveData(d);
    render();
    animateColumnHeights(prevHeights);
  }, 260);
}

function clearAllDone() {
  if (_clearAllDoneTimer) return;
  var data = getData();
  var hasDone = ['life','work','pd'].some(function(tab) {
    return (data[tab]||[]).some(function(t){ return t.done; });
  });
  if (!hasDone) { showClearDoneFeedback(); return; }
  var exitingEls = [];
  ['life','work','pd'].forEach(function(tab) {
    var container = document.getElementById('tasks-' + tab);
    if (!container) return;
    container.querySelectorAll('.task-group[data-id]').forEach(function(el) {
      var task = find(data[tab], el.dataset.id);
      if (task && task.done) {
        el.classList.add('filter-exit');
        exitingEls.push(el);
      }
    });
  });
  showClearDoneFeedback();
  if (!exitingEls.length) {
    ['life','work','pd'].forEach(function(tab) {
      (data[tab]||[]).filter(function(t){ return t.done; })
        .forEach(function(t){ delete openNotes[t.id]; });
      data[tab] = (data[tab]||[]).filter(function(t){ return !t.done; });
    });
    saveData(data); render();
    return;
  }
  var prevHeights = captureColumnHeights();
  _clearAllDoneTimer = setTimeout(function() {
    _clearAllDoneTimer = null;
    var d = getData();
    ['life','work','pd'].forEach(function(tab) {
      (d[tab]||[]).filter(function(t){ return t.done; })
        .forEach(function(t){ delete openNotes[t.id]; });
      d[tab] = (d[tab]||[]).filter(function(t){ return !t.done; });
    });
    saveData(d);
    render();
    animateColumnHeights(prevHeights);
  }, 260);
}

function showClearDoneFeedback() {
  var btn = document.getElementById('filter-clear-done');
  if (!btn) return;
  clearTimeout(btn._clearDoneTimer);
  btn.classList.remove('is-undoing');
  btn.classList.add('is-cleared');
  btn._clearDoneTimer = setTimeout(function() {
    btn.classList.remove('is-cleared');
    btn.classList.add('is-undoing');
    btn._clearDoneTimer = null;
  }, 1350);
}

function handleClearDoneClick() {
  var btn = document.getElementById('filter-clear-done');
  if (!btn) return;
  if (btn.classList.contains('is-undoing')) {
    doUndo();
    btn.classList.remove('is-undoing');
  } else {
    clearAllDone();
  }
}

function saveTitle(tab, id, val) {
  var text = val.trim();
  if (!text) return;
  var data = getData();
  var t = find(data[tab], id);
  if (t && t.text !== text) { t.text = text; saveData(data); }
  render();
}

function buildPriDropDOM() {
  if (document.getElementById('pri-drop')) return;
  var el = document.createElement('div');
  el.id = 'pri-drop';
  el.style.cssText = 'display:none;position:fixed;z-index:9998;';
  el.innerHTML = '<div class="pri-drop-popup">'
    + '<div class="pri-drop-item pri-low"    onclick="selectPriority(\'low\')">Low</div>'
    + '<div class="pri-drop-item pri-medium" onclick="selectPriority(\'medium\')">MED</div>'
    + '<div class="pri-drop-item pri-high"   onclick="selectPriority(\'high\')">High</div>'
    + '</div>';
  document.body.appendChild(el);
  document.addEventListener('mousedown', function(e) {
    var d = document.getElementById('pri-drop');
    if (!d || d.style.display === 'none') return;
    if (!d.contains(e.target) && !e.target.closest('.pri-badge')) d.style.display = 'none';
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { var d = document.getElementById('pri-drop'); if (d) d.style.display = 'none'; }
  });
}

function openPriDrop(tab, taskId, badgeEl) {
  buildPriDropDOM();
  var drop = document.getElementById('pri-drop');
  if (drop.style.display !== 'none' && priDropState.taskId === taskId) { drop.style.display = 'none'; return; }
  priDropState.tab = tab;
  priDropState.taskId = taskId;
  drop.style.display = 'block';
  var popup = drop.querySelector('.pri-drop-popup');
  var pw = popup ? popup.offsetWidth : 90, ph = popup ? popup.offsetHeight : 90;
  var rect = badgeEl.getBoundingClientRect();
  var left = rect.left, top = rect.bottom + 4;
  var vw = window.innerWidth, vh = window.innerHeight;
  if (left + pw > vw - 8) left = vw - pw - 8;
  if (top  + ph > vh - 8) top  = rect.top - ph - 4;
  if (left < 8) left = 8;
  drop.style.left = left + 'px';
  drop.style.top  = top  + 'px';
}

function selectPriority(pri) {
  var drop = document.getElementById('pri-drop');
  if (drop) drop.style.display = 'none';
  var data = getData();
  var t = find(data[priDropState.tab], priDropState.taskId);
  if (!t || t.priority === pri) return;
  t.priority = pri;
  saveData(data);
  render();
}

function saveDueDate(tab, id, val) {
  var data = getData();
  var t = find(data[tab], id);
  if (t) t.dueDate = val || null;
  saveData(data);
  _columnScopedToggleTab = tab;
  render();
}

// ── Custom calendar ───────────────────────────────────────────────────────────

var composerDueDate = null;
var calState = { mode: 'task', tab: null, taskId: null, year: 0, month: 0, selectedISO: null };
var CAL_MONTHS = ['January','February','March','April','May','June','July',
                  'August','September','October','November','December'];
var CAL_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function syncComposerDateTriggerUI() {
  var trigger = document.getElementById('dashboard-add-date-trigger');
  if (!trigger) return;
  if (!trigger.dataset.iconMarkup) trigger.dataset.iconMarkup = trigger.innerHTML;
  var hasDate = !!composerDueDate;
  trigger.innerHTML = hasDate
    ? '<span class="dashboard-add-date-text">' + fmtISO(composerDueDate) + '</span>'
    : trigger.dataset.iconMarkup;
  trigger.classList.toggle('has-date', hasDate);
  trigger.title = hasDate ? ('Due: ' + fmtISO(composerDueDate) + ' (click to change)') : 'Set due date';
  trigger.setAttribute('aria-label', hasDate ? ('Change due date (currently ' + fmtISO(composerDueDate) + ')') : 'Set due date');
}

function bindComposerCalendarTrigger() {
  var trigger = document.getElementById('dashboard-add-date-trigger');
  if (!trigger || trigger._calendarBound) return;
  trigger._calendarBound = true;
  trigger.addEventListener('click', function() {
    openComposerCustomCal(trigger);
  });
  syncComposerDateTriggerUI();
}

function buildCalendarDOM() {
  if (document.getElementById('custom-cal')) return;
  var el = document.createElement('div');
  el.id = 'custom-cal';
  el.style.cssText = 'display:none;position:fixed;z-index:9999;';
  el.innerHTML = '<div class="cal-popup">'
    + '<div class="cal-header">'
    +   '<button class="cal-nav" onclick="calNav(-1)">&#8249;</button>'
    +   '<span id="cal-month-label" class="cal-month-label"></span>'
    +   '<button class="cal-nav" onclick="calNav(1)">&#8250;</button>'
    + '</div>'
    + '<div class="cal-grid" id="cal-grid"></div>'
    + '<div class="cal-clear-row"><button class="cal-clear-btn" onclick="calClearDate()">Clear date</button></div>'
    + '</div>';
  document.body.appendChild(el);
  document.addEventListener('mousedown', function(e) {
    var cal = document.getElementById('custom-cal');
    if (!cal || cal.style.display === 'none') return;
    if (!cal.contains(e.target)
        && !e.target.closest('.date-chip')
        && !e.target.closest('.cal-icon-btn')
        && !e.target.closest('.dashboard-add-date-trigger')) cal.style.display = 'none';
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { var cal = document.getElementById('custom-cal'); if (cal) cal.style.display = 'none'; }
  });
}

function openCustomCal(tab, taskId, currentISO, chipEl) {
  buildCalendarDOM();
  var cal = document.getElementById('custom-cal');
  if (cal.style.display !== 'none' && calState.mode === 'task' && calState.taskId === taskId) { cal.style.display = 'none'; return; }
  calState.mode = 'task';
  calState.tab = tab;
  calState.taskId = taskId;
  calState.selectedISO = currentISO || null;
  var base = currentISO ? new Date(currentISO + 'T00:00:00') : new Date();
  calState.year  = base.getFullYear();
  calState.month = base.getMonth();
  renderCalGrid();
  cal.style.display = 'block';
  var popup = cal.querySelector('.cal-popup');
  var pw = popup ? popup.offsetWidth : 224, ph = popup ? popup.offsetHeight : 260;
  var rect = chipEl.getBoundingClientRect();
  var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  var vw = window.innerWidth, vh = window.innerHeight;
  var left = cx, top = cy;
  if (left + pw > vw - 8) left = vw - pw - 8;
  if (top  + ph > vh - 8) top  = cy - ph;
  if (left < 8) left = 8;
  if (top  < 8) top  = 8;
  cal.style.left = left + 'px';
  cal.style.top  = top  + 'px';
}

function openComposerCustomCal(triggerEl) {
  buildCalendarDOM();
  var cal = document.getElementById('custom-cal');
  if (!triggerEl) triggerEl = document.getElementById('dashboard-add-date-trigger');
  if (!triggerEl) return;
  if (cal.style.display !== 'none' && calState.mode === 'composer') { cal.style.display = 'none'; return; }
  calState.mode = 'composer';
  calState.tab = null;
  calState.taskId = null;
  calState.selectedISO = composerDueDate || null;
  var base = composerDueDate ? new Date(composerDueDate + 'T00:00:00') : new Date();
  calState.year  = base.getFullYear();
  calState.month = base.getMonth();
  renderCalGrid();
  cal.style.display = 'block';
  var popup = cal.querySelector('.cal-popup');
  var pw = popup ? popup.offsetWidth : 224, ph = popup ? popup.offsetHeight : 260;
  var rect = triggerEl.getBoundingClientRect();
  var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  var vw = window.innerWidth, vh = window.innerHeight;
  var left = cx, top = cy;
  if (left + pw > vw - 8) left = vw - pw - 8;
  if (top  + ph > vh - 8) top  = cy - ph;
  if (left < 8) left = 8;
  if (top  < 8) top  = 8;
  cal.style.left = left + 'px';
  cal.style.top  = top  + 'px';
}

function calNav(dir) {
  calState.month += dir;
  if (calState.month < 0)  { calState.month = 11; calState.year--; }
  if (calState.month > 11) { calState.month = 0;  calState.year++; }
  renderCalGrid();
}

function renderCalGrid() {
  var lbl = document.getElementById('cal-month-label');
  if (lbl) lbl.textContent = CAL_MONTHS[calState.month] + ' ' + calState.year;
  var grid = document.getElementById('cal-grid');
  if (!grid) return;
  var today      = todayISO();
  var firstDow   = new Date(calState.year, calState.month, 1).getDay();
  var daysInMon  = new Date(calState.year, calState.month + 1, 0).getDate();
  var daysInPrev = new Date(calState.year, calState.month, 0).getDate();
  var html = CAL_DAYS.map(function(d){ return '<div class="cal-dow">'+d+'</div>'; }).join('');
  for (var i = 0; i < firstDow; i++) {
    var pd = daysInPrev - firstDow + 1 + i;
    html += calCell(pd, calState.year, calState.month - 1, pd, today, true);
  }
  for (var d = 1; d <= daysInMon; d++) {
    html += calCell(d, calState.year, calState.month, d, today, false);
  }
  var total = firstDow + daysInMon, fill = total % 7 ? 7 - (total % 7) : 0;
  for (var n = 1; n <= fill; n++) {
    html += calCell(n, calState.year, calState.month + 1, n, today, true);
  }
  grid.innerHTML = html;
}

function calISODate(year, month, day) {
  var d = new Date(year, month, day);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function calCell(displayDay, year, month, day, today, otherMonth) {
  var iso = calISODate(year, month, day);
  var cls = 'cal-day';
  if (otherMonth) cls += ' other-month';
  if (iso === today) cls += ' today';
  if (iso === calState.selectedISO) cls += ' selected';
  return '<div class="'+cls+'" onclick="calPick(\''+iso+'\')">'+displayDay+'</div>';
}

function calPick(iso) {
  calState.selectedISO = iso;
  if (calState.mode === 'composer') {
    composerDueDate = iso;
    syncComposerDateTriggerUI();
  } else {
    saveDueDate(calState.tab, calState.taskId, iso);
  }
  document.getElementById('custom-cal').style.display = 'none';
}

function calClearDate() {
  calState.selectedISO = null;
  if (calState.mode === 'composer') {
    composerDueDate = null;
    syncComposerDateTriggerUI();
  } else {
    saveDueDate(calState.tab, calState.taskId, '');
  }
  document.getElementById('custom-cal').style.display = 'none';
}

function toggleNotes(taskId) {
  openNotes[taskId] = !openNotes[taskId];
  if (!openNotes[taskId]) {
    Object.keys(openChildNoteAdds).forEach(function(key) {
      if (key.indexOf(taskId + ':') === 0) delete openChildNoteAdds[key];
    });
  }
  render();
  if (openNotes[taskId]) {
    setTimeout(function(){
      var inp = document.getElementById('note-add-'+taskId);
      if (inp) inp.focus();
    }, 30);
  }
}

function addNoteItem(tab, taskId, text, skipFocus, parentNoteId) {
  text = (text || '').trim();
  if (!text) return;
  var data = getData();
  var t = find(data[tab], taskId);
  if (!t) return;
  if (!Array.isArray(t.noteItems)) t.noteItems = [];
  t.noteItems.push({ id: genId(), text: text, done: false, parentNoteId: parentNoteId || null });
  t.noteItems = normalizeNoteItems(t.noteItems);
  t.noteItems = sortedNotes(t.noteItems);
  saveData(data);
  render();
  if (!skipFocus) {
    requestAnimationFrame(function() {
      var inp = document.getElementById('note-add-'+taskId);
      if (!inp) return;
      inp.value = '';
      inp.focus();
      if (typeof inp.setSelectionRange === 'function') {
        var end = inp.value.length;
        inp.setSelectionRange(end, end);
      }
    });
  }
}

function handleNoteAddKeydown(e, tab, taskId) {
  if (e.key === 'Enter') {
    e.preventDefault();
    var inp = document.getElementById('note-add-' + taskId);
    if (inp) {
      inp._enterSubmitted = true;
      addNoteItem(tab, taskId, inp.value);
    }
  } else if (e.key === 'Escape') {
    openNotes[taskId] = false;
    render();
  }
}

function handleNoteAddBlur(tab, taskId, input) {
  if (!document.body.contains(input)) return;
  if (deleteIntentTasks[taskId]) return;
  if (input._enterSubmitted) {
    input._enterSubmitted = false;
    return;
  }
  var text = (input.value || '').trim();
  if (text) {
    addNoteItem(tab, taskId, text, true);
    return;
  }
  var row = input.closest ? input.closest('.note-add-row') : null;
  openNotes[taskId] = false;
  if (row && document.body.contains(row)) {
    row.classList.add('note-add-row-exit');
    setTimeout(function() { render(); }, 220);
  } else {
    render();
  }
}

function toggleNoteItem(tab, taskId, noteId) {
  _columnScopedToggleTab = tab;
  var data = getData();
  var t = find(data[tab], taskId);
  if (!t) return;
  var note = (t.noteItems||[]).find(function(n){ return n.id===noteId; });
  if (!note) return;
  _noteToggleRenderTab = tab;
  note.done = !note.done;
  var allNotesDone = (t.noteItems||[]).length > 0 && (t.noteItems||[]).every(function(n){ return n.done; });
  var shouldAutoCompleteTask = note.done && allNotesDone && !t.done;
  var shouldReopenTask = !note.done && t.done && (t.noteItems||[]).length > 0;
  if (shouldAutoCompleteTask) {
    t.done = true;
    t.completedAt = nextCompletionStamp();
  }
  if (shouldReopenTask) {
    t.done = false;
    t.completedAt = null;
  }
  t.noteItems = sortedNotes(t.noteItems || []);
  if (shouldAutoCompleteTask || shouldReopenTask) {
    data[tab] = sortedTasks(data[tab] || []);
  }
  pendingNoteToggle = { tab: tab, taskId: taskId, noteId: noteId };
  saveData(data);
  if (shouldAutoCompleteTask) pendingTaskComplete = { tab: tab, id: taskId };
  render();
  var cb = document.querySelector('.cb-wrap[data-note-id="'+noteId+'"]');
  if (!cb) return;
  var noteInput = cb.parentElement && cb.parentElement.querySelector('.note-text-input');
  runCheckboxTextAnimation(cb, noteInput, note.done, null, { pop: false });
}

function saveNoteText(tab, taskId, noteId, val) {
  val = (val || '').trim();
  var data = getData();
  var t = find(data[tab], taskId);
  if (!t) return;
  var note = (t.noteItems||[]).find(function(n){ return n.id===noteId; });
  if (note && val && note.text !== val) {
    note.text = val;
    t.noteItems = sortedNotes(t.noteItems || []);
    saveData(data);
  }
  _columnScopedToggleTab = tab;
  render();
}

function deleteNoteItem(tab, taskId, noteId, btn) {
  var noteEl = btn && btn.closest
    ? btn.closest('.note-pill[data-note-id]')
    : document.querySelector('.note-pill[data-note-id="'+noteId+'"]');
  var data = getData();
  var task = find(data[tab], taskId);
  var noteItems = task && Array.isArray(task.noteItems) ? task.noteItems : [];
  var noteIdsToRemove = [noteId];
  var isParentDelete = false;
  noteItems.forEach(function(note) {
    if (note && note.parentNoteId === noteId) {
      noteIdsToRemove.push(note.id);
      isParentDelete = true;
    }
  });
  var parentGroup = noteEl && noteEl.closest ? noteEl.closest('.task-group[data-id]') : null;
  var noteElsToAnimate = parentGroup
    ? noteIdsToRemove.map(function(id) {
        return parentGroup.querySelector('.note-pill[data-note-id="'+id+'"]');
      }).filter(Boolean)
    : (noteEl ? [noteEl] : []);
  if (isParentDelete && parentGroup) {
    var parentKey = getChildNoteAddKey(taskId, noteId);
    clearOpenChildNoteInputsForParent(taskId, noteId);
    var childAddInput = parentGroup.querySelector('#note-add-child-'+taskId+'-'+noteId);
    var childAddRow = childAddInput && childAddInput.closest ? childAddInput.closest('.note-add-row') : null;
    if (childAddRow) noteElsToAnimate.push(childAddRow);
    deleteIntentParentNotes[parentKey] = true;
  }
  function removeFromData() {
    var nextData = getData();
    var t = find(nextData[tab], taskId);
    if (!t) return;
    t.noteItems = (t.noteItems||[]).filter(function(n){ return noteIdsToRemove.indexOf(n.id) === -1; });
    if (isParentDelete) {
      var parentKey = getChildNoteAddKey(taskId, noteId);
      deleteIntentParentNotes[parentKey] = false;
      clearOpenChildNoteInputsForParent(taskId, noteId);
    }
    saveData(nextData);
    _columnScopedToggleTab = tab;
    render();
  }
  if (!noteElsToAnimate.length) { removeFromData(); return; }
  if (noteElsToAnimate.some(function(el) { return el.classList.contains('removing'); })) return;
  noteElsToAnimate.forEach(function(el) { el.classList.add('removing'); });
  setTimeout(removeFromData, 260);
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function autoResizeIfNeeded(el) {
  if (!el) return;
  var nextHeight = el.scrollHeight;
  var currentHeight = el.offsetHeight;
  if (Math.abs(nextHeight - currentHeight) < 1) return;
  el.style.height = 'auto';
  el.style.height = nextHeight + 'px';
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function getCompletionTimings(text) {
  var len = ((text || '').trim() || 'x').length;
  var drawMs = clamp(Math.round(120 + Math.sqrt(len) * 16), 150, 280);
  return {
    delayMs: 52,
    drawMs: drawMs
  };
}

function resetCheckboxTextAnimation(cb, textEl) {
  if (cb) {
    cb.classList.remove('cb-anim', 'cb-unanim', 'cb-draw-only', 'cb-undraw-only');
    cb.style.removeProperty('--cb-draw-delay');
    cb.style.removeProperty('--cb-draw-ms');
  }
  if (textEl) {
    textEl.classList.remove('anim-strike', 'anim-unstrike');
    textEl.style.removeProperty('--strike-delay');
    textEl.style.removeProperty('--strike-ms');
  }
}

function measureStrikeWidth(textEl) {
  if (!textEl) return '100%';
  var text = String(textEl.value || textEl.textContent || '').replace(/\r/g, '');
  var lines = text.split('\n');
  var style = window.getComputedStyle(textEl);
  var measurer = measureStrikeWidth._el;
  if (!measurer) {
    measurer = document.createElement('div');
    measurer.style.position = 'absolute';
    measurer.style.visibility = 'hidden';
    measurer.style.pointerEvents = 'none';
    measurer.style.whiteSpace = 'pre';
    measurer.style.left = '-9999px';
    measurer.style.top = '-9999px';
    document.body.appendChild(measurer);
    measureStrikeWidth._el = measurer;
  }
  measurer.style.font = style.font;
  measurer.style.fontFamily = style.fontFamily;
  measurer.style.fontSize = style.fontSize;
  measurer.style.fontWeight = style.fontWeight;
  measurer.style.fontStyle = style.fontStyle;
  measurer.style.letterSpacing = style.letterSpacing;
  var maxWidth = 0;
  lines.forEach(function(line) {
    measurer.textContent = line || ' ';
    maxWidth = Math.max(maxWidth, measurer.getBoundingClientRect().width);
  });
  var available = Math.max(0, textEl.clientWidth || 0);
  var width = Math.max(0, Math.min(Math.ceil(maxWidth) + 4, available + 4));
  return width ? width + 'px' : '0px';
}

function syncStrikeSizes() {
  var scopeTabs = arguments.length > 0 ? arguments[0] : null;
  var roots = [];
  if (Array.isArray(scopeTabs) && scopeTabs.length) {
    scopeTabs.forEach(function(tab) {
      var container = document.getElementById('tasks-' + tab);
      if (container) roots.push(container);
    });
  }
  if (!roots.length) roots = [document];
  roots.forEach(function(root) {
    root.querySelectorAll('.note-text.done, .task-item.done-item .due-text').forEach(function(el) {
      el.style.setProperty('--strike-size', measureStrikeWidth(el));
      el.style.setProperty('--strike-start', '-2px');
    });
  });
}

function runCheckboxTextAnimation(cb, textEl, isDone, onFinish, options) {
  options = options || {};
  var isNoteTextInput = !!(textEl && textEl.classList && textEl.classList.contains('note-text-input'));
  var timings = getCompletionTimings(textEl ? (textEl.value || textEl.textContent || '') : '');
  resetCheckboxTextAnimation(cb, textEl);
  if (cb) {
    cb.style.setProperty('--cb-draw-delay', timings.delayMs + 'ms');
    cb.style.setProperty('--cb-draw-ms', timings.drawMs + 'ms');
  }
  if (textEl && !isNoteTextInput) {
    textEl.style.setProperty('--strike-delay', timings.delayMs + 'ms');
    textEl.style.setProperty('--strike-ms', timings.drawMs + 'ms');
    textEl.style.setProperty('--strike-start', '-2px');
    textEl.style.setProperty('--strike-size', measureStrikeWidth(textEl));
  }
  var usePop = options.pop !== false;
  if (isDone) {
    if (textEl) {
      textEl.classList.add('done');
      textEl.classList.add('anim-strike');
    }
    if (cb) cb.classList.add('checked', usePop ? 'cb-anim' : 'cb-draw-only');
  } else {
    if (textEl) textEl.classList.add('anim-unstrike');
    if (cb) cb.classList.add('checked', usePop ? 'cb-unanim' : 'cb-undraw-only');
  }
  if (!cb) {
    setTimeout(function() {
      if (!isDone && textEl) {
        textEl.classList.remove('done');
        textEl.style.removeProperty('--strike-size');
        textEl.style.removeProperty('--strike-start');
      }
      resetCheckboxTextAnimation(cb, textEl);
      if (typeof onFinish === 'function') onFinish();
    }, timings.delayMs + timings.drawMs);
    return;
  }
  var targetAnimation = isDone ? 'cb-draw' : 'cb-undraw';
  cb.addEventListener('animationend', function handler(e) {
    if (e.animationName !== targetAnimation) return;
    cb.removeEventListener('animationend', handler);
    if (!isDone) {
      cb.classList.remove('checked');
      if (textEl) {
        textEl.classList.remove('done');
        textEl.style.removeProperty('--strike-size');
        textEl.style.removeProperty('--strike-start');
      }
    }
    resetCheckboxTextAnimation(cb, textEl);
    if (typeof onFinish === 'function') onFinish();
  });
}

function getReorderDuration(delta) {
  var distance = Math.abs(delta);
  return clamp(Math.round(360 + distance * 0.62), 420, 760);
}

function getReorderTransition(delta) {
  var duration = getReorderDuration(delta);
  return 'transform ' + duration.toFixed(0) + 'ms cubic-bezier(0.2, 0.9, 0.24, 1)';
}

var TASK_FILTER_FLIP_THRESHOLD_PX = 2.5;

function getDisplayTasksForFilter(tasks, filter) {
  var displayTasks = sortedTasks(tasks || []);
  if (filter === 'active') {
    displayTasks = displayTasks.filter(function(t){ return !t.done; });
  } else if (filter === 'done') {
    displayTasks = displayTasks.filter(function(t){ return t.done; });
  }
  return displayTasks;
}

function captureColumnHeights() {
  return ['life','work','pd'].map(function(tab) {
    var container = document.getElementById('tasks-' + tab);
    var col = container && container.closest ? container.closest('.col') : null;
    return {
      tab: tab,
      el: col,
      height: col ? col.offsetHeight : 0
    };
  });
}

function animateColumnHeights(prevHeights, resizeMs) {
  if (!prevHeights || !prevHeights.length) return;
  if (_columnResizeTimer) {
    clearTimeout(_columnResizeTimer);
    _columnResizeTimer = null;
  }
  var duration = Math.max(360, resizeMs || 0);
  var measurements = prevHeights.map(function(item) {
    if (!item.el) return item.height;
    return item.el.offsetHeight;
  });
  prevHeights.forEach(function(item, idx) {
    if (!item.el) return;
    var nextHeight = measurements[idx];
    if (Math.abs(nextHeight - item.height) < 1) {
      item.el.style.height = '';
      item.el.classList.remove('is-resizing');
      return;
    }
    item.el.classList.add('is-resizing');
    item.el.style.transition = 'none';
    item.el.style.height = item.height + 'px';
  });
  prevHeights.forEach(function(item, idx) {
    if (!item.el) return;
    var nextHeight = measurements[idx];
    if (Math.abs(nextHeight - item.height) < 1) return;
    item.el.offsetHeight;
    item.el.style.transition = 'height ' + duration + 'ms cubic-bezier(0.22, 1, 0.36, 1)';
    item.el.style.height = nextHeight + 'px';
  });
  _columnResizeTimer = setTimeout(function() {
    prevHeights.forEach(function(item) {
      if (!item.el) return;
      item.el.style.transition = '';
      item.el.style.height = '';
      item.el.classList.remove('is-resizing');
    });
    _columnResizeTimer = null;
  }, duration);
}

function getTransitionResizeDuration() {
  var maxFlipMs = 0;
  ['life','work','pd'].forEach(function(tab) {
    var container = document.getElementById('tasks-' + tab);
    var flipMs = container && typeof container._lastFlipMs === 'number'
      ? container._lastFlipMs
      : 0;
    maxFlipMs = Math.max(maxFlipMs, flipMs);
  });
  return Math.max(360, maxFlipMs);
}

function syncTaskCardAvailableHeight() {
  var panel = document.getElementById('panel-task-manager');
  if (!panel) return;
  var grid = panel.querySelector('.columns-grid');
  if (!grid) return;
  var mainContent = document.querySelector('.main-content');
  var columnsTop = grid.getBoundingClientRect().top;
  var mainTop = mainContent ? mainContent.getBoundingClientRect().top : 0;
  var relativeTop = columnsTop - mainTop;
  var panelBottomPadding = Math.max(0, parseFloat(window.getComputedStyle(panel).paddingBottom) || 0);
  var bottomPadding = 16;
  var containerHeight = mainContent ? mainContent.clientHeight : window.innerHeight;
  var available = Math.max(0, Math.floor(containerHeight - relativeTop - panelBottomPadding - bottomPadding));
  panel.style.setProperty('--tasks-available-h', available + 'px');
}

function setFilter(f) {
  if (activeFilter === f && !_filterTransitionTimer) return;
  _filterNoMotionCols = null;
  document.querySelectorAll('.filter-tab').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.filter === f);
  });
  if (_filterTransitionTimer) {
    clearTimeout(_filterTransitionTimer);
    _filterTransitionTimer = null;
    document.querySelectorAll('.task-group.filter-exit').forEach(function(el) {
      el.classList.remove('filter-exit');
    });
  }
  if (_filterEnterTimer) {
    clearTimeout(_filterEnterTimer);
    _filterEnterTimer = null;
    document.querySelectorAll('.task-group.filter-enter').forEach(function(el) {
      el.classList.remove('filter-enter');
    });
  }
  var data = getData();
  var exiting = [];
  pendingFilterEnterIds = { life: {}, work: {}, pd: {} };
  var noMotionCols = { life: false, work: false, pd: false };
  ['life','work','pd'].forEach(function(tab) {
    var container = document.getElementById('tasks-' + tab);
    if (!container) return;
    var currentIds = {};
    container.querySelectorAll('.task-group[data-id]').forEach(function(el) {
      currentIds[el.dataset.id] = true;
    });
    var nextIds = {};
    getDisplayTasksForFilter(data[tab] || [], f).forEach(function(task) {
      nextIds[task.id] = true;
      if (!currentIds[task.id]) {
        pendingFilterEnterIds[tab][task.id] = true;
      }
    });
    var exitingThisTab = [];
    container.querySelectorAll('.task-group[data-id]').forEach(function(el) {
      if (!nextIds[el.dataset.id]) exitingThisTab.push(el);
    });
    exitingThisTab.forEach(function(el) { exiting.push(el); });
  });
  _filterNoMotionCols = noMotionCols;
  if (!exiting.length) {
    var prevHeightsNoExit = captureColumnHeights();
    activeFilter = f;
    render();
    animateColumnHeights(prevHeightsNoExit, getTransitionResizeDuration());
    return;
  }
  exiting.forEach(function(el) {
    el.classList.add('filter-exit');
  });
  var prevHeights = captureColumnHeights();
  _filterTransitionTimer = setTimeout(function() {
    _filterTransitionTimer = null;
    activeFilter = f;
    render();
    animateColumnHeights(prevHeights, getTransitionResizeDuration());
  }, 260);
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  _pendingFlipReleases = [];
  _filterEnterCleanupMs = 380;
  var allTabs = ['life','work','pd'];
  var renderTabs = _noteToggleRenderTab
    ? [_noteToggleRenderTab]
    : (_undoRedoScopedTabs && _undoRedoScopedTabs.length ? _undoRedoScopedTabs.slice() : allTabs);
  var scopedTabsForPostRender = null;
  if (_columnScopedToggleTab) {
    scopedTabsForPostRender = [_columnScopedToggleTab];
  } else if (_undoRedoScopedTabs && _undoRedoScopedTabs.length) {
    scopedTabsForPostRender = _undoRedoScopedTabs.slice();
  }
  var scrollTops = {};
  renderTabs.forEach(function(tab) {
    var containerBefore = document.getElementById('tasks-' + tab);
    if (containerBefore) scrollTops[tab] = containerBefore.scrollTop;
  });
  if (!_freezeTaskAvailableHeightSync && !_noteToggleRenderTab && !_undoRedoScopedTabs) syncTaskCardAvailableHeight();
  var data = getData();
  renderDashboard(data);
  renderTabs.forEach(function(tab){ renderColumn(data, tab); });
  if (_noteToggleRenderTab) {
    renderTabs.forEach(function(tab) {
      var container = document.getElementById('tasks-' + tab);
      if (!container) return;
      container.querySelectorAll('.title-input, .note-text-input').forEach(autoResizeIfNeeded);
    });
  }
  renderTabs.forEach(function(tab) {
    var containerAfter = document.getElementById('tasks-' + tab);
    if (!containerAfter || scrollTops[tab] === undefined) return;
    if (containerAfter.scrollTop !== scrollTops[tab]) {
      containerAfter.scrollTop = scrollTops[tab];
    }
  });
  if (!scopedTabsForPostRender || !scopedTabsForPostRender.length) {
    var motionTabs = ['life','work','pd'].filter(function(tab) {
      var container = document.getElementById('tasks-' + tab);
      if (!container) return false;
      if ((container._lastFlipMs || 0) > 0) return true;
      return !!container.querySelector('.task-group.filter-enter');
    });
    scopedTabsForPostRender = motionTabs.length ? motionTabs : ['life','work','pd'];
  }
  if (pendingFilterEnterIds) {
    if (_filterEnterTimer) clearTimeout(_filterEnterTimer);
    _filterEnterTimer = setTimeout(function() {
      document.querySelectorAll('.task-group.filter-enter').forEach(function(el) {
        el.style.animationDelay = '';
        el.classList.remove('filter-enter');
      });
      pendingFilterEnterIds = null;
      _filterEnterTimer = null;
      _filterEnterCleanupMs = 380;
    }, _filterEnterCleanupMs);
  }
  var undoBtn = document.getElementById('filter-undo-btn');
  if (undoBtn) undoBtn.classList.toggle('is-visible', undoStack.length > 0);
  var clearBtn = document.getElementById('filter-clear-done');
  if (clearBtn) {
    var hasDone = activeFilter === 'done' && data && ['life','work','pd'].some(function(tab) {
      return (data[tab]||[]).some(function(t){ return t.done; });
    });
    var keepClearStateVisible = clearBtn.classList.contains('is-cleared') || clearBtn.classList.contains('is-undoing');
    clearBtn.classList.toggle('is-visible', hasDone || keepClearStateVisible);
    if (!clearBtn.classList.contains('is-cleared')) {
      if (!hasDone) {
        clearBtn.classList.remove('is-undoing', 'is-cleared');
      } else {
        clearBtn.classList.remove('is-undoing');
      }
    }
  }
  renderTabs.forEach(function(tab) {
    var container = document.getElementById('tasks-' + tab);
    if (!container) return;
    container.querySelectorAll('.title-input, .note-text-input').forEach(autoResizeIfNeeded);
  });
  syncStrikeSizes(scopedTabsForPostRender);
  if (_pendingFlipReleases && _pendingFlipReleases.length) {
    var releases = _pendingFlipReleases.slice();
    requestAnimationFrame(function() {
      releases.forEach(function(runRelease) { runRelease(); });
    });
  }
  _pendingFlipReleases = null;
  _filterNoMotionCols = null;
  _freezeTaskAvailableHeightSync = false;
  _undoRedoScopedTabs = null;
  _columnScopedToggleTab = null;
  _noteToggleRenderTab = null;
}

// Syncs version-state-dependent UI without rebuilding task column DOM.
// Called by the version system after revert/restore so unsaved task text is never wiped.
function syncTaskManagerChrome() {
  var undoBtn = document.getElementById('filter-undo-btn');
  if (undoBtn) undoBtn.classList.toggle('is-visible', undoStack.length > 0);
  var clearBtn = document.getElementById('filter-clear-done');
  if (clearBtn) {
    var data = getData();
    var hasDone = activeFilter === 'done' && data && ['life','work','pd'].some(function(tab) {
      return (data[tab]||[]).some(function(t){ return t.done; });
    });
    var keepClearStateVisible = clearBtn.classList.contains('is-cleared') || clearBtn.classList.contains('is-undoing');
    clearBtn.classList.toggle('is-visible', hasDone || keepClearStateVisible);
    if (!hasDone && !clearBtn.classList.contains('is-cleared')) {
      clearBtn.classList.remove('is-undoing', 'is-cleared');
    }
  }
}
window.syncTaskManagerChrome = syncTaskManagerChrome;

function renderColumn(data, tab) {
  var tasks   = data[tab] || [];
  var pending = tasks.filter(function(t){ return !t.done; }).length;
  var done    = tasks.filter(function(t){ return  t.done; }).length;

  var pEl = document.getElementById('pend-'+tab), dEl = document.getElementById('done-'+tab);
  if (pEl) pEl.textContent = pending;
  if (dEl) dEl.textContent = done;

  var container = document.getElementById('tasks-'+tab);
  if (!container) return;
  bindTaskColumnDropZone(container);
  var suppressFilterMotion = !!(_filterNoMotionCols && _filterNoMotionCols[tab]);
  var addInput = document.getElementById('input-'+tab);
  var addRow = addInput ? addInput.closest('.col-add') : null;
  var displayTasks = getDisplayTasksForFilter(tasks, activeFilter);
  if (displayTasks.length === 0) {
    container._lastFlipMs = 0;
    if (pendingNoteToggle && pendingNoteToggle.tab === tab) pendingNoteToggle = null;
    var emptyMsg = activeFilter === 'done'   ? 'No completed tasks.'
                 : activeFilter === 'active' ? 'No active tasks.'
                 : 'No tasks yet.';
    container.innerHTML = '<p class="empty-state">' + emptyMsg + '</p>';
    return;
  }

  var prevRects = {};
  var prevNoteRects = {};
  var noteToggleForTab = pendingNoteToggle && pendingNoteToggle.tab === tab ? pendingNoteToggle : null;
  container.querySelectorAll('.task-group[data-id]').forEach(function(el) {
    prevRects[el.dataset.id] = el.getBoundingClientRect();
    if (!noteToggleForTab || el.dataset.id !== noteToggleForTab.taskId) return;
    var taskId = el.dataset.id;
    el.querySelectorAll('.note-pill[data-note-id]').forEach(function(noteEl) {
      prevNoteRects[taskId + ':' + noteEl.dataset.noteId] = noteEl.getBoundingClientRect();
    });
  });

  container.innerHTML = displayTasks.map(function(task) {
    var ovr = isOverdue(task), tdy = isDueToday(task) && !ovr;
    var pri = task.priority || 'medium';
    var ic = 'task-item'
      + (task.done ? ' done-item' : '')
      + (!task.dueDate ? ' no-due-date' : '')
      + (ovr       ? ' overdue'   : '')
      + (tdy       ? ' due-today' : '');
    var priLabel = pri === 'medium' ? 'MED' : pri.charAt(0).toUpperCase() + pri.slice(1);

    var dueSubtitle = '';
    if (task.dueDate) {
      var dateClass = ovr ? ' overdue' : (tdy ? ' today' : ' future');
      dueSubtitle = '<div class="due-subtitle">'
        + '<span class="date-chip" onclick="openCustomCal(\''+tab+'\',\''+task.id+'\',\''+escHtml(task.dueDate)+'\',this)" title="Change due date">'
        + '<span class="due-text'+dateClass+'">'+fmtISO(task.dueDate)+'</span>'
        + '</span></div>';
    }
    var calIconBtn = '<button class="cal-icon-btn" onclick="openCustomCal(\''+tab+'\',\''+task.id+'\',\''+escHtml(task.dueDate||'')+'\',this)" title="'+(task.dueDate?'Change due date':'Set due date')+'">'
      + ICON_CAL + '</button>';

    var noteItems = task.noteItems || [];
    var notesIconBtn = '<button class="notes-icon-btn" onclick="toggleNotes(\''+task.id+'\')" title="Add a note">'
      + ICON_NOTE + '</button>';

    function renderNotePill(n, isChild) {
      var childAddBtn = !isChild
        ? '<button class="notes-icon-btn note-child-icon-btn" onmousedown="event.preventDefault()" onclick="openChildNoteAdd(event,\''+tab+'\',\''+task.id+'\',\''+n.id+'\')" title="Add child note">' + ICON_NOTE + '</button>'
        : '';
      return '<div class="note-pill'+(n.done?' done-note':'')+'" data-note-id="'+n.id+'">'
        + '<span class="cb-wrap cb-sm'+(n.done?' checked':'')+'" data-note-id="'+n.id+'" onclick="toggleNoteItem(\''+tab+'\',\''+task.id+'\',\''+n.id+'\')">'+CB_SVG+'</span>'
        + '<textarea class="note-text-input'+(n.done?' done':'')+'" rows="1"'
        +   ' onblur="saveNoteText(\''+tab+'\',\''+task.id+'\',\''+n.id+'\',this.value)"'
        +   ' onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.blur();}"'
        +   ' oninput="autoResize(this)">'+escHtml(n.text)+'</textarea>'
        + childAddBtn
        + '<button class="note-del" onmousedown="markParentNoteDeleteIntent(\''+task.id+'\',\''+n.id+'\')" onclick="deleteNoteItem(\''+tab+'\',\''+task.id+'\',\''+n.id+'\',this)" title="Remove note">&#215;</button>'
        + '</div>';
    }

    var topLevelNotes = getTopLevelNotes(noteItems);
    var notePillsList = topLevelNotes.map(function(n){
      var childNotes = getChildNotes(noteItems, n.id);
      var childAddKey = getChildNoteAddKey(task.id, n.id);
      var childAddRow = openChildNoteAdds[childAddKey]
        ? '<div class="note-add-row note-add-row-child">'
          + '<input type="text" class="note-add-input" id="note-add-child-'+task.id+'-'+n.id+'" placeholder="Add a child note..."'
          + ' onkeydown="handleChildNoteAddKeydown(event,\''+tab+'\',\''+task.id+'\',\''+n.id+'\')"'
          + ' onblur="handleChildNoteAddBlur(\''+tab+'\',\''+task.id+'\',\''+n.id+'\',this)">'
          + '<button class="note-add-btn" onmousedown="event.preventDefault()" onclick="submitChildNoteAdd(\''+tab+'\',\''+task.id+'\',\''+n.id+'\',document.getElementById(\'note-add-child-'+task.id+'-'+n.id+'\'))">+</button>'
          + '</div>'
        : '';
      var childrenHtml = childNotes.length
        ? '<div class="note-children">' + childNotes.map(function(cn){ return renderNotePill(cn, true); }).join('') + childAddRow + '</div>'
        : (childAddRow ? '<div class="note-children">' + childAddRow + '</div>' : '');
      return renderNotePill(n, false) + childrenHtml;
    }).join('');

    var addNoteRow = openNotes[task.id]
      ? '<div class="note-add-row">'
        + '<input type="text" class="note-add-input" id="note-add-'+task.id+'" placeholder="Add a note..."'
        + ' onkeydown="handleNoteAddKeydown(event,\''+tab+'\',\''+task.id+'\')"'
        + ' onblur="handleNoteAddBlur(\''+tab+'\',\''+task.id+'\',this)">'
        + '<button class="note-add-btn" onmousedown="event.preventDefault()" onclick="addNoteItem(\''+tab+'\',\''+task.id+'\',document.getElementById(\'note-add-'+task.id+'\').value)">+</button>'
        + '</div>'
      : '';

    var notePillsHTML = (noteItems.length > 0 || openNotes[task.id])
      ? '<div class="note-pills">' + notePillsList + addNoteRow + '</div>'
      : '';

    var enterClass = pendingFilterEnterIds && pendingFilterEnterIds[tab] && pendingFilterEnterIds[tab][task.id]
      ? ' filter-enter'
      : '';

    var dragHandle = '<span class="task-drag-handle" draggable="true" title="Drag task to another category" aria-label="Drag task" role="button"'
      + ' ondragstart="handleTaskDragStart(event,\''+tab+'\',\''+task.id+'\')" ondragend="handleTaskDragEnd()">&#8942;&#8942;</span>';
    return '<div class="task-group'+enterClass+'" data-id="'+task.id+'" draggable="false">'
      + '<div class="'+ic+'">'
      + '<button class="del-x" onmousedown="markTaskDeleteIntent(\''+task.id+'\')" onclick="deleteTask(\''+tab+'\',\''+task.id+'\',this)" title="Remove task">'+ICON_CLOSE+'</button>'
      + '<div class="task-main">'
      +   dragHandle
      +   '<span class="cb-wrap'+(task.done?' checked':'')+'" onclick="toggleTask(\''+tab+'\',\''+task.id+'\')">'+CB_SVG+'</span>'
      +   '<div class="task-body">'
      +     '<div class="title-row">'
      +         '<textarea class="title-input'+(task.done?' done':'')+'" rows="1"'
      +          ' onblur="saveTitle(\''+tab+'\',\''+task.id+'\',this.value)"'
      +          ' onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.blur();}"'
      +          ' oninput="autoResize(this)">'+escHtml(task.text)+'</textarea>'
      +     '</div>'
      +     dueSubtitle
      +     '<div class="task-controls">'
      +       '<div class="task-actions">'
      +         notesIconBtn
      +         calIconBtn
      +       '</div>'
      +       '<button class="pri-badge pri-'+pri+'" onclick="openPriDrop(\''+tab+'\',\''+task.id+'\',this)" title="Click to change priority">'+priLabel+'</button>'
      +     '</div>'
      +   '</div>'
      + '</div>'
      + '</div>'
      + notePillsHTML
      + '</div>';
  }).join('');

  // Settle textarea-driven card heights before measuring the rebuilt layout for FLIP.
  container.querySelectorAll('.title-input, .note-text-input').forEach(autoResizeIfNeeded);

  if (suppressFilterMotion) {
    container._lastFlipMs = 0;
    if (pendingTaskInsert && pendingTaskInsert.tab === tab) pendingTaskInsert = null;
    if (pendingTaskComplete && pendingTaskComplete.tab === tab) pendingTaskComplete = null;
    if (pendingNoteToggle && pendingNoteToggle.tab === tab) pendingNoteToggle = null;
    return;
  }

  // FLIP reorder — calculate deltas from pre-render snapshot
  var newItems = container.querySelectorAll('.task-group[data-id]');
  var enterItems = Array.prototype.slice.call(container.querySelectorAll('.task-group.filter-enter'));
  var animated = {};
  var maxFlipMs = 0;
  var completeAnimation = null;
  var suppressTaskFlipForNoteToggle = !!noteToggleForTab;
  if (
    suppressTaskFlipForNoteToggle ||
    (_columnScopedToggleTab && _columnScopedToggleTab !== tab) ||
    (_undoRedoScopedTabs && _undoRedoScopedTabs.indexOf(tab) === -1)
  ) {
    container._lastFlipMs = 0;
  } else {
    newItems.forEach(function(el) {
      if (el.classList.contains('filter-enter')) return;
      var prev = prevRects[el.dataset.id];
      var currentTop = el.getBoundingClientRect().top;
      var delta = null;
      if (prev) {
        delta = prev.top - currentTop;
      } else if (pendingTaskInsert && pendingTaskInsert.tab === tab && pendingTaskInsert.id === el.dataset.id) {
        delta = pendingTaskInsert.startTop - currentTop;
      }
      if (delta === null || Math.abs(delta) < TASK_FILTER_FLIP_THRESHOLD_PX) return;
      animated[el.dataset.id] = delta;
      maxFlipMs = Math.max(maxFlipMs, getReorderDuration(delta));
    });
    if (pendingTaskComplete && pendingTaskComplete.tab === tab) {
      var completeEl = container.querySelector('.task-group[data-id="'+pendingTaskComplete.id+'"]');
      var completeDelta = completeEl ? animated[pendingTaskComplete.id] : null;
      if (completeEl) {
        completeAnimation = {
          el: completeEl,
          durationMs: completeDelta !== undefined && completeDelta !== null ? getReorderDuration(completeDelta) : 420
        };
        maxFlipMs = Math.max(maxFlipMs, completeAnimation.durationMs);
      }
    }
    container._lastFlipMs = maxFlipMs;

    // Phase 1 — pin every pill at its old position (no transition)
    newItems.forEach(function(el) {
      el.style.transition = 'none';
      if (animated[el.dataset.id] !== undefined)
        el.style.transform = 'translateY(' + animated[el.dataset.id] + 'px)';
    });
    container.offsetHeight; // commit Phase 1
    if (completeAnimation) {
      var completeItem = completeAnimation.el.querySelector('.task-item');
      var completeCb = completeItem && completeItem.querySelector('.cb-wrap');
      var completeTitle = completeItem && completeItem.querySelector('.title-input');
      if (completeCb && completeTitle) {
        resetCheckboxTextAnimation(completeCb, completeTitle);
        completeCb.style.setProperty('--cb-draw-delay', '0ms');
        completeCb.style.setProperty('--cb-draw-ms', completeAnimation.durationMs + 'ms');
        completeTitle.classList.add('done');
        completeCb.classList.add('checked', 'cb-draw-only');
      }
    }

    // Phase 2 — release: moving pills slide, static pills snap (hover-fix)
    if (enterItems.length && maxFlipMs > 0) {
      var enterDelayMs = Math.min(
        FILTER_ENTER_DELAY_MAX_MS,
        Math.round(maxFlipMs * FILTER_ENTER_DELAY_RATIO)
      );
      enterItems.forEach(function(el) {
        el.style.animationDelay = enterDelayMs + 'ms';
      });
      _filterEnterCleanupMs = Math.max(
        _filterEnterCleanupMs,
        enterDelayMs + FILTER_ENTER_ANIMATION_MS + FILTER_ENTER_CLEANUP_BUFFER_MS
      );
    } else if (enterItems.length) {
      enterItems.forEach(function(el) {
        el.style.animationDelay = '';
      });
    }

    var releaseTaskFlip = function() {
      newItems.forEach(function(el) {
        var delta = animated[el.dataset.id];
        if (delta !== undefined) {
          // Scale timing by travel distance so long drops don't rush to the bottom.
          el.style.transition = getReorderTransition(delta) + (completeAnimation ? ' 48ms' : '');
          el.style.willChange = 'transform';
          el.style.transform  = '';
          el.addEventListener('transitionend', function handler(e) {
            if (e.propertyName !== 'transform') return;
            el.style.transition = el.style.transform = el.style.willChange = '';
            el.removeEventListener('transitionend', handler);
          });
        } else {
          requestAnimationFrame(function() {
            el.style.transition = '';
            el.style.willChange = '';
          });
        }
      });
    };
    if (_pendingFlipReleases) _pendingFlipReleases.push(releaseTaskFlip);
    else releaseTaskFlip();
  }
  var noteAnimated = [];
  if (noteToggleForTab) {
    var noteTaskEl = container.querySelector('.task-group[data-id="'+noteToggleForTab.taskId+'"]');
    if (noteTaskEl) {
      noteTaskEl.querySelectorAll('.note-pill[data-note-id]').forEach(function(noteEl) {
        var key = noteToggleForTab.taskId + ':' + noteEl.dataset.noteId;
        var prevNoteRect = prevNoteRects[key];
        if (!prevNoteRect) return;
        var deltaY = prevNoteRect.top - noteEl.getBoundingClientRect().top;
        if (Math.abs(deltaY) < 0.5) return;
        noteEl.style.transition = 'none';
        noteEl.style.transform = 'translateY(' + deltaY + 'px)';
        noteAnimated.push(noteEl);
      });
    }
  }
  if (noteAnimated.length) {
    container.offsetHeight;
    var releaseNoteFlip = function() {
      noteAnimated.forEach(function(noteEl) {
        noteEl.style.transition = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';
        noteEl.style.transform = '';
        noteEl.addEventListener('transitionend', function handler(e) {
          if (e.propertyName !== 'transform') return;
          noteEl.style.transition = '';
          noteEl.style.transform = '';
          noteEl.removeEventListener('transitionend', handler);
        });
      });
    };
    if (_pendingFlipReleases) _pendingFlipReleases.push(releaseNoteFlip);
    else releaseNoteFlip();
  }
  if (pendingTaskNoteCompletes && pendingTaskNoteCompletes.tab === tab) {
    pendingTaskNoteCompletes.noteIds.forEach(function(noteId) {
      var noteCb = container.querySelector('.cb-wrap[data-note-id="'+noteId+'"]');
      var noteInput = noteCb && noteCb.parentElement && noteCb.parentElement.querySelector('.note-text-input');
      if (noteCb && noteInput) runCheckboxTextAnimation(noteCb, noteInput, true, null, { pop: false });
    });
    pendingTaskNoteCompletes = null;
  }
  if (pendingTaskInsert && pendingTaskInsert.tab === tab) pendingTaskInsert = null;
  if (pendingTaskComplete && pendingTaskComplete.tab === tab) pendingTaskComplete = null;
  if (pendingNoteToggle && pendingNoteToggle.tab === tab) pendingNoteToggle = null;
}

function renderDashboard(data) {
  // Internal progress-card view state (default stays Today).
  // Kept local to dashboard progress logic; UI wiring comes in later steps.
  if (!renderDashboard._progressViewState) {
    renderDashboard._progressViewState = {
      current: 'today',
      order: ['today', 'week', 'total'],
      pendingSwitch: false,
      titleSwapTimer: null
    };
  }
  bindComposerCalendarTrigger();
  syncComposerDateTriggerUI();
  var state = renderDashboard._progressViewState;
  var dashboardEl = document.querySelector('#panel-task-manager .dashboard');
  var donutWrapEl = dashboardEl && dashboardEl.querySelector('.dashboard-left');
  var progressTextEl = dashboardEl && dashboardEl.querySelector('.dashboard-middle');
  var prevDonutRect = state.pendingSwitch && donutWrapEl ? donutWrapEl.getBoundingClientRect() : null;
  var prevTextRect = state.pendingSwitch && progressTextEl ? progressTextEl.getBoundingClientRect() : null;
  var titleEl = document.querySelector('#panel-task-manager .chart-heading');
  if (titleEl && !titleEl._progressViewBound) {
    titleEl._progressViewBound = true;
    titleEl.addEventListener('click', function() {
      var state = renderDashboard._progressViewState;
      if (!state || !Array.isArray(state.order) || !state.order.length) return;
      if (state.titleSwapTimer) return;
      titleEl.classList.remove('progress-title-enter');
      titleEl.classList.add('progress-title-exit');
      var idx = state.order.indexOf(state.current);
      var nextView = state.order[(idx + 1) % state.order.length];
      state.titleSwapTimer = setTimeout(function() {
        state.current = nextView;
        state.pendingSwitch = true;
        renderDashboard(getData());
        titleEl.classList.remove('progress-title-exit');
        titleEl.classList.add('progress-title-enter');
        setTimeout(function() {
          titleEl.classList.remove('progress-title-enter');
        }, 320);
        state.titleSwapTimer = null;
      }, 240);
    });
  }
  var today = todayISO();
  var allTasks = ['life','work','pd'].reduce(function(acc, tab){
    return acc.concat(data[tab] || []);
  }, []);
  var allOpen = allTasks.filter(function(t){ return !t.done; });

  function toISODate(dateObj) {
    return dateObj.getFullYear() + '-'
      + String(dateObj.getMonth() + 1).padStart(2, '0') + '-'
      + String(dateObj.getDate()).padStart(2, '0');
  }

  // Normalize task dates to YYYY-MM-DD; invalid/missing => null (undated).
  function normalizeDueDate(raw) {
    if (!raw) return null;
    var s = String(raw).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return toISODate(dt);
  }

  var normalizedToday = normalizeDueDate(today) || today;
  var todayDate = new Date(normalizedToday + 'T00:00:00');
  var startOfTodayMs = todayDate.getTime();
  var startOfWeekDate = new Date(todayDate);
  startOfWeekDate.setDate(todayDate.getDate() - todayDate.getDay());
  var endOfWeekDate = new Date(startOfWeekDate);
  endOfWeekDate.setDate(startOfWeekDate.getDate() + 6);
  var startOfWeek = toISODate(startOfWeekDate);
  var endOfWeek = toISODate(endOfWeekDate);

  function isInCurrentWeek(iso) {
    return iso >= startOfWeek && iso <= endOfWeek;
  }

  function wasCompletedToday(task) {
    return !!(task && task.done && typeof task.completedAt === 'number' && task.completedAt >= startOfTodayMs);
  }

  function ensureTodayProgressSnapshot() {
    var snapshot = getTodayProgressSnapshot();
    if (snapshot && snapshot.date === normalizedToday) return snapshot;

    // Rebuild the day baseline from tasks that are overdue now plus any overdue tasks
    // already completed today, so mid-day initialization still preserves today's workload.
    var overdueIds = allTasks.filter(function(t) {
      var due = normalizeDueDate(t.dueDate);
      if (!due || due >= normalizedToday) return false;
      return !t.done || wasCompletedToday(t);
    }).map(function(t) {
      return String(t.id);
    });

    snapshot = {
      date: normalizedToday,
      overdueIds: overdueIds
    };
    saveTodayProgressSnapshot(snapshot);
    return snapshot;
  }

  var todayProgressSnapshot = ensureTodayProgressSnapshot();
  var todayOverdueIdSet = {};
  (todayProgressSnapshot.overdueIds || []).forEach(function(id) {
    todayOverdueIdSet[id] = true;
  });

  function getIncludedTasksForView(view) {
    if (view === 'total') return allTasks.slice();
    if (view === 'week') {
      return allTasks.filter(function(t) {
        var due = normalizeDueDate(t.dueDate);
        return !!due && isInCurrentWeek(due);
      });
    }
    // Default: today view
    return allTasks.filter(function(t) {
      var due = normalizeDueDate(t.dueDate);
      return (!!due && due === normalizedToday) || !!todayOverdueIdSet[String(t.id)];
    });
  }

  var currentView = (renderDashboard._progressViewState && renderDashboard._progressViewState.current) || 'today';
  if (titleEl) {
    titleEl.textContent = currentView === 'week'
      ? "This Week's Progress"
      : currentView === 'total'
        ? 'Total Progress'
        : "Today's Progress";
  }
  var included = getIncludedTasksForView(currentView);
  var completedIncluded = included.filter(function(t){ return t.done; }).length;
  var totalIncluded = included.length;
  var pct = totalIncluded > 0 ? Math.round((completedIncluded / totalIncluded) * 100) : 0;
  var overdue = allOpen.filter(function(t){
    var due = normalizeDueDate(t.dueDate);
    return !!due && due < normalizedToday;
  }).length;
  var dueToday = allOpen.filter(function(t){
    var due = normalizeDueDate(t.dueDate);
    return !!due && due === normalizedToday;
  }).length;
  var pctEl  = document.getElementById('donut-pct');
  var fillEl = document.getElementById('donut-fill');
  var subEl  = document.getElementById('chart-sub');
  if (pctEl) pctEl.textContent = pct + '%';
  if (subEl) subEl.textContent = completedIncluded + ' of ' + totalIncluded + ' tasks completed';
  if (fillEl) {
    var R = (120 / 2) - 6;
    var C = 2 * Math.PI * R;
    var targetDash = (pct / 100 * C).toFixed(2) + ' ' + C.toFixed(2);
    if (!_donutAnimated) {
      fillEl.style.transition = 'none';
      fillEl.setAttribute('stroke-dasharray', '0 ' + C.toFixed(2));
      _pendingDonutAnimation = {
        fillEl: fillEl,
        pct: pct,
        circumference: C,
        targetDash: targetDash
      };
    } else {
      fillEl.style.transition = 'stroke-dasharray 0.4s ease';
      fillEl.setAttribute('stroke-dasharray', targetDash);
    }
  }
  var el;
  el = document.getElementById('cnt-all');     if(el) el.textContent = allTasks.length;
  el = document.getElementById('cnt-active');  if(el) el.textContent = allOpen.length;
  el = document.getElementById('cnt-done');    if(el) el.textContent = allTasks.length - allOpen.length;
  el = document.getElementById('cnt-overdue'); if(el) el.textContent = overdue;
  el = document.getElementById('cnt-today');   if(el) el.textContent = dueToday;
  el = document.getElementById('pill-overdue'); if(el) el.classList.toggle('dim', overdue === 0);
  el = document.getElementById('pill-today');   if(el) el.classList.toggle('dim', dueToday === 0);

  if (state.pendingSwitch && dashboardEl) {
    function animateProgressTravel(elm, prevRect) {
      if (!elm || !prevRect) return;
      var nextRect = elm.getBoundingClientRect();
      var deltaX = prevRect.left - nextRect.left;
      if (Math.abs(deltaX) < 0.5) return;
      elm.style.transition = 'none';
      elm.style.transform = 'translateX(' + deltaX + 'px)';
      elm.offsetWidth;
      elm.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
      elm.style.transform = '';
      elm.addEventListener('transitionend', function handler(e) {
        if (e.propertyName !== 'transform') return;
        elm.style.transition = '';
        elm.style.transform = '';
        elm.removeEventListener('transitionend', handler);
      });
    }
    animateProgressTravel(donutWrapEl, prevDonutRect);
    animateProgressTravel(progressTextEl, prevTextRect);
    state.pendingSwitch = false;
  }
}

function handleChildNoteAddKeydown(e, tab, taskId, parentNoteId) {
  if (e.key === 'Enter') {
    e.preventDefault();
    var inputId = 'note-add-child-' + taskId + '-' + parentNoteId;
    var inp = document.getElementById(inputId);
    if (!inp) return;
    inp._enterSubmitted = true;
    submitChildNoteAdd(tab, taskId, parentNoteId, inp);
  } else if (e.key === 'Escape') {
    delete openChildNoteAdds[getChildNoteAddKey(taskId, parentNoteId)];
    _columnScopedToggleTab = tab;
    render();
  }
}

function handleChildNoteAddBlur(tab, taskId, parentNoteId, input) {
  if (!document.body.contains(input)) return;
  if (deleteIntentTasks[taskId]) return;
  var key = getChildNoteAddKey(taskId, parentNoteId);
  if (deleteIntentParentNotes[key]) return;
  if (input._submitHandled) return;
  if (input._enterSubmitted) {
    input._enterSubmitted = false;
    return;
  }
  var text = (input.value || '').trim();
  if (text) {
    addChildNoteItem(tab, taskId, parentNoteId, text, true);
    delete openChildNoteAdds[key];
    _columnScopedToggleTab = tab;
    render();
    return;
  }
  var row = input.closest ? input.closest('.note-add-row') : null;
  delete openChildNoteAdds[key];
  _columnScopedToggleTab = tab;
  if (row && document.body.contains(row)) {
    row.classList.add('note-add-row-exit');
    setTimeout(function() { render(); }, 220);
  } else {
    render();
  }
}

function getChildNoteAddKey(taskId, parentNoteId) {
  return String(taskId || '') + ':' + String(parentNoteId || '');
}

function openChildNoteAdd(evt, tab, taskId, parentNoteId) {
  if (evt) {
    evt.preventDefault();
    evt.stopPropagation();
  }
  if (!tab || !taskId || !parentNoteId) return;
  openChildNoteAdds[getChildNoteAddKey(taskId, parentNoteId)] = true;
  _columnScopedToggleTab = tab;
  render();
  requestAnimationFrame(function() {
    var input = document.getElementById('note-add-child-' + taskId + '-' + parentNoteId);
    if (input) input.focus();
  });
}

function submitChildNoteAdd(tab, taskId, parentNoteId, inputEl) {
  if (!inputEl || inputEl._submitHandled) return;
  var text = (inputEl.value || '').trim();
  if (!text) return;
  inputEl._submitHandled = true;
  addChildNoteItem(tab, taskId, parentNoteId, text, true);
  openChildNoteAdds[getChildNoteAddKey(taskId, parentNoteId)] = true;
  _columnScopedToggleTab = tab;
  render();
  requestAnimationFrame(function() {
    var nextInput = document.getElementById('note-add-child-' + taskId + '-' + parentNoteId);
    if (!nextInput) return;
    nextInput.value = '';
    nextInput.focus();
    if (typeof nextInput.setSelectionRange === 'function') nextInput.setSelectionRange(0, 0);
  });
}

function markTaskDeleteIntent(taskId) {
  if (!taskId) return;
  deleteIntentTasks[taskId] = true;
  setTimeout(function() {
    if (deleteIntentTasks[taskId] === true) deleteIntentTasks[taskId] = false;
  }, 360);
}

function markParentNoteDeleteIntent(taskId, noteId) {
  if (!taskId || !noteId) return;
  var key = getChildNoteAddKey(taskId, noteId);
  deleteIntentParentNotes[key] = true;
  setTimeout(function() {
    if (deleteIntentParentNotes[key] === true) deleteIntentParentNotes[key] = false;
  }, 360);
}

function triggerTaskDashboardEntrance() {
  var dashboard = document.querySelector('#panel-task-manager .dashboard');
  if (!dashboard) return;
  var panel = document.getElementById('panel-task-manager');
  var isPreviewTopbar = document.body.classList.contains('dashboard-topbar-preview-v2');
  dashboard.classList.remove('dashboard-enter');
  dashboard.classList.add('dashboard-pre-enter');
  if (panel) {
    panel.classList.remove('category-headers-enter');
    panel.classList.add('category-headers-pre-enter');
    void panel.offsetWidth;
  }
  void dashboard.offsetWidth;
  if (_dashboardEntranceTimer) clearTimeout(_dashboardEntranceTimer);
  if (_categoryHeaderEntranceTimer) clearTimeout(_categoryHeaderEntranceTimer);
  _dashboardEntranceTimer = setTimeout(function() {
    dashboard.classList.remove('dashboard-version-switching');
    dashboard.classList.remove('dashboard-pre-enter');
    dashboard.classList.add('dashboard-enter');
    if (panel) {
      _categoryHeaderEntranceTimer = setTimeout(function() {
        panel.classList.remove('category-headers-pre-enter');
        panel.classList.add('category-headers-enter');
        _categoryHeaderEntranceTimer = setTimeout(function() {
        panel.classList.remove('category-headers-enter');
        _categoryHeaderEntranceTimer = null;
        syncTaskCardAvailableHeight();
      }, 1020);
    }, 0);
  }
    if (_pendingDonutAnimation && _pendingDonutAnimation.fillEl) {
      var fillEl = _pendingDonutAnimation.fillEl;
      var pct = _pendingDonutAnimation.pct;
      var C = _pendingDonutAnimation.circumference;
      var targetDash = _pendingDonutAnimation.targetDash;
      _donutAnimated = true;
      setTimeout(function() {
        if (!document.contains(fillEl)) return;
        if (pct > 0) {
          var overshootPct = Math.min(pct * 1.3, 100);
          var overshootDash = (overshootPct / 100 * C).toFixed(2) + ' ' + C.toFixed(2);
          fillEl.style.transition = 'stroke-dasharray 0.6s ease';
          fillEl.setAttribute('stroke-dasharray', overshootDash);
          setTimeout(function() {
            if (!document.contains(fillEl)) return;
            fillEl.style.transition = 'stroke-dasharray 0.35s ease-out';
            fillEl.setAttribute('stroke-dasharray', targetDash);
          }, 620);
        } else {
          fillEl.style.transition = 'none';
          fillEl.setAttribute('stroke-dasharray', targetDash);
        }
      }, isPreviewTopbar ? 340 : 200);
      _pendingDonutAnimation = null;
    }
  }, 40);
}

window.triggerTaskDashboardEntrance = triggerTaskDashboardEntrance;
window.addEventListener('resize', syncTaskCardAvailableHeight);
var _taskMainContentEl = document.querySelector('.main-content');
if (_taskMainContentEl) _taskMainContentEl.addEventListener('scroll', syncTaskCardAvailableHeight, { passive: true });

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('keydown', function(e) {
  var key = (e.key || '').toLowerCase();
  if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
    var activePanel = document.querySelector('.panel.active');
    var handled = false;
    if (activePanel && activePanel.id === 'panel-cogs-calc' && window.doCogsUndo) {
      handled = window.doCogsUndo();
    } else {
      handled = doUndo();
    }
    if (handled) e.preventDefault();
  }
  if ((e.ctrlKey || e.metaKey) && key === 'y' && !e.shiftKey) {
    var activePanelRedo = document.querySelector('.panel.active');
    var redoHandled = false;
    if (activePanelRedo && activePanelRedo.id === 'panel-cogs-calc' && window.doCogsRedo) {
      redoHandled = window.doCogsRedo();
    } else {
      redoHandled = doRedo();
    }
    if (redoHandled) e.preventDefault();
  }
});

migrateIfNeeded();
applyInitialOrderingOnce();
render();
