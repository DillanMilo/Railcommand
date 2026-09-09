(function () {
  'use strict';

  var DATABASE_PREFIX = 'railcommand-offline:';
  var SCOPE_KEY = 'rc-offline-database-scope';
  var RECORDS_STORE = 'records';
  var METADATA_STORE = 'metadata';
  var DRAFTS_STORE = 'drafts';
  var OUTBOX_STORE = 'outbox';
  var DAILY_LOG_DRAFT_KIND = 'daily_log_create';
  var activeDatabaseName = null;
  var scopeLocked = false;

  function currentDatabaseName() {
    try {
      var scope = localStorage.getItem(SCOPE_KEY);
      return scope && scope.indexOf(DATABASE_PREFIX) === 0 ? scope : null;
    } catch { return null; }
  }

  function hasActiveScope(databaseName) {
    return !scopeLocked && currentDatabaseName() === databaseName;
  }

  function lockChangedScope() {
    if (!activeDatabaseName || hasActiveScope(activeDatabaseName)) return;
    scopeLocked = true;
    // Hide, rather than discard, any in-memory input. Pending saves may finish
    // only in the original existing database; no callback may recreate it.
    var container = byId('offline-project-data');
    container.hidden = true;
    container.querySelectorAll('input, textarea, select, button').forEach(function (control) {
      control.disabled = true;
    });
    byId('offline-neutral-message').hidden = false;
    renderStatus('Your session changed. This offline page is locked. Keep it open if a draft was not saved; sign in to the same account to recover saved work.');
  }

  function requireActiveScope(databaseName) {
    if (!hasActiveScope(databaseName)) {
      lockChangedScope();
      throw new Error('Your session changed. Sign in to the same account before queueing this draft.');
    }
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function element(tag, text, className) {
    var node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function formatDate(value, includeTime) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || 'Unknown date';
    return new Intl.DateTimeFormat(undefined, includeTime
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { dateStyle: 'full' }).format(date);
  }

  function openDatabase(name) {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(name);
      // The neutral reader must never recreate a database removed by confirmed
      // sign-out. Schema creation belongs to authenticated app initialization.
      request.onupgradeneeded = function () { request.transaction.abort(); };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('Could not open saved data')); };
    });
  }

  function readRecord(database, storeName, key) {
    return new Promise(function (resolve, reject) {
      if (!database.objectStoreNames.contains(storeName)) {
        resolve(null);
        return;
      }
      var transaction = database.transaction(storeName, 'readonly');
      var request = transaction.objectStore(storeName).get(key);
      request.onsuccess = function () { resolve(request.result || null); };
      request.onerror = function () { reject(request.error || new Error('Could not read saved data')); };
    });
  }

  function assertDraftBaseline(stored, draft, expectedUpdatedAt) {
    if (!stored || stored.clientId !== draft.clientId || stored.updatedAt !== expectedUpdatedAt) {
      throw new Error('This draft changed in another tab. Keep this page open to preserve your input and review the latest saved draft.');
    }
  }

  function writeRecord(database, storeName, value, expectedUpdatedAt) {
    return new Promise(function (resolve, reject) {
      if (!database.objectStoreNames.contains(storeName)) {
        reject(new Error('Saved draft storage is unavailable'));
        return;
      }
      var transaction = database.transaction(storeName, 'readwrite');
      var writeError = null;
      transaction.oncomplete = function () { resolve(); };
      transaction.onerror = function () { reject(writeError || transaction.error || new Error('Could not save draft')); };
      transaction.onabort = function () { reject(writeError || transaction.error || new Error('Draft save was interrupted')); };
      var store = transaction.objectStore(storeName);
      var request = store.get(value.draftId);
      request.onsuccess = function () {
        try {
          assertDraftBaseline(request.result, value, expectedUpdatedAt);
          store.put(value);
        } catch (error) {
          writeError = error;
          transaction.abort();
        }
      };
    });
  }

  function queueDailyLogDraft(databaseName, draft) {
    requireActiveScope(databaseName);
    var timestamp = new Date().toISOString();
    var values = draft.values;
    var operation = {
      operationId: draft.clientId,
      kind: DAILY_LOG_DRAFT_KIND,
      projectId: draft.projectId,
      clientId: draft.clientId,
      idempotencyKey: draft.idempotencyKey,
      payload: {
        log_date: values.date,
        weather_temp: typeof values.temp === 'number' ? values.temp : 0,
        weather_conditions: values.conditions || '',
        weather_wind: values.wind || '',
        work_summary: values.workSummary || '',
        safety_notes: values.safetyNotes || '',
        geo_tag: values.geoTag || null,
        personnel: values.personnel || [],
        equipment: (values.equipment || []).map(function (row) {
          return { equipment_type: row.type, count: row.count, notes: row.notes };
        }),
        work_items: values.workItems || [],
      },
      status: 'pending',
      attemptCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      nextAttemptAt: timestamp,
      lastError: null,
    };

    return openDatabase(databaseName).then(function (database) {
      return new Promise(function (resolve, reject) {
        if (!hasActiveScope(databaseName)) {
          database.close();
          reject(new Error('Your session changed. The saved draft has not been queued.'));
          return;
        }
        if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
          database.close();
          reject(new Error('Synchronization storage is unavailable'));
          return;
        }
        var transaction = database.transaction([OUTBOX_STORE, DRAFTS_STORE], 'readwrite');
        var writeError = null;
        transaction.oncomplete = function () { database.close(); resolve(operation); };
        transaction.onerror = function () {
          database.close();
          reject(writeError || transaction.error || new Error('Could not queue the daily log'));
        };
        transaction.onabort = function () {
          database.close();
          reject(writeError || transaction.error || new Error('Daily-log queue was interrupted'));
        };
        var drafts = transaction.objectStore(DRAFTS_STORE);
        var readDraft = drafts.get(draft.draftId);
        readDraft.onsuccess = function () {
          try {
            requireActiveScope(databaseName);
            assertDraftBaseline(readDraft.result, draft, draft.updatedAt);
            transaction.objectStore(OUTBOX_STORE).add(operation);
            drafts.delete(draft.draftId);
          } catch (error) {
            writeError = error;
            transaction.abort();
          }
        };
      });
    });
  }

  async function resolveDatabaseName() {
    return currentDatabaseName();
  }

  function recordIsUsable(record) {
    return Boolean(
      record &&
      record.value !== undefined &&
      Date.parse(record.discardAfter) > Date.now()
    );
  }

  function renderStatus(message) {
    byId('offline-data-status').textContent = message;
  }

  function renderLogList(container, project, logs, cachedAt, isStale, draft) {
    container.appendChild(element('h2', project.name, 'project-title'));
    var meta = element(
      'p',
      'Saved ' + formatDate(cachedAt, true) + (isStale ? ' · refresh overdue' : ''),
      'cache-meta'
    );
    container.appendChild(meta);

    var note = element(
      'p',
      'Read-only offline copy. Reconnect before creating or editing project records.',
      'read-only-note'
    );
    container.appendChild(note);

    if (draft && draft.kind === DAILY_LOG_DRAFT_KIND && draft.projectId === project.id) {
      var continueDraft = element('a', 'Continue daily-log draft · Saved on this device', 'draft-continue');
      continueDraft.href = '/projects/' + encodeURIComponent(project.id) + '/daily-logs/new';
      container.appendChild(continueDraft);
    }

    if (!logs.length) {
      container.appendChild(element('p', 'No recent daily logs were saved for this project.', 'empty-state'));
      return;
    }

    var list = element('div', undefined, 'log-list');
    logs.forEach(function (log) {
      var link = element('a', undefined, 'log-card');
      link.href = '/projects/' + encodeURIComponent(project.id) + '/daily-logs/' + encodeURIComponent(log.id);
      link.appendChild(element('strong', formatDate(log.log_date, false)));
      link.appendChild(element('span', log.work_summary || 'No work summary recorded.', 'log-summary'));
      var weather = [log.weather_temp !== undefined ? log.weather_temp + '°F' : '', log.weather_conditions || '']
        .filter(Boolean)
        .join(' · ');
      if (weather) link.appendChild(element('span', weather, 'log-meta'));
      list.appendChild(link);
    });
    container.appendChild(list);
  }

  function renderLogDetail(container, project, log, cachedAt, isStale) {
    var back = element('a', '← Recent daily logs', 'back-link');
    back.href = '/projects/' + encodeURIComponent(project.id) + '/daily-logs';
    container.appendChild(back);
    container.appendChild(element('h2', formatDate(log.log_date, false), 'project-title'));
    container.appendChild(element(
      'p',
      project.name + ' · Saved ' + formatDate(cachedAt, true) + (isStale ? ' · refresh overdue' : ''),
      'cache-meta'
    ));
    container.appendChild(element(
      'p',
      'Read-only offline copy. Files and editing require a connection.',
      'read-only-note'
    ));

    var sections = [
      ['Weather', [log.weather_temp !== undefined ? log.weather_temp + '°F' : '', log.weather_conditions, log.weather_wind].filter(Boolean).join(' · ')],
      ['Work summary', log.work_summary || 'No work summary recorded.'],
      ['Safety notes', log.safety_notes || 'No safety notes recorded.'],
    ];
    sections.forEach(function (section) {
      var card = element('section', undefined, 'detail-card');
      card.appendChild(element('h3', section[0]));
      card.appendChild(element('p', section[1]));
      container.appendChild(card);
    });

    var personnel = Array.isArray(log.personnel) ? log.personnel : [];
    if (personnel.length) {
      var personnelCard = element('section', undefined, 'detail-card');
      personnelCard.appendChild(element('h3', 'Personnel'));
      personnel.forEach(function (row) {
        personnelCard.appendChild(element(
          'p',
          [row.role, row.company, row.headcount + ' workers'].filter(Boolean).join(' · ')
        ));
      });
      container.appendChild(personnelCard);
    }

    var workItems = Array.isArray(log.work_items) ? log.work_items : [];
    if (workItems.length) {
      var workCard = element('section', undefined, 'detail-card');
      workCard.appendChild(element('h3', 'Work items'));
      workItems.forEach(function (row) {
        workCard.appendChild(element(
          'p',
          [row.description, row.quantity !== undefined ? row.quantity + ' ' + (row.unit || '') : '', row.location]
            .filter(Boolean)
            .join(' · ')
        ));
      });
      container.appendChild(workCard);
    }
  }

  function renderDraftField(parent, labelText, input) {
    var wrapper = element('label', undefined, 'draft-field');
    wrapper.appendChild(element('span', labelText));
    wrapper.appendChild(input);
    parent.appendChild(wrapper);
    return input;
  }

  function draftInput(type, value, placeholder) {
    var input = element('input');
    input.type = type;
    input.value = value === undefined || value === null ? '' : String(value);
    if (placeholder) input.placeholder = placeholder;
    if (type === 'number') input.min = '0';
    return input;
  }

  function draftSelect(value, options, placeholder) {
    var select = element('select');
    var empty = element('option', placeholder || 'Select…');
    empty.value = '';
    select.appendChild(empty);
    options.forEach(function (optionValue) {
      var option = element('option', optionValue);
      option.value = optionValue;
      select.appendChild(option);
    });
    select.value = value || '';
    return select;
  }

  function renderDraftRows(parent, title, rows, columns, createEmptyRow, scheduleSave) {
    var card = element('section', undefined, 'detail-card draft-card');
    card.appendChild(element('h3', title));
    var rowsContainer = element('div', undefined, 'draft-rows');
    card.appendChild(rowsContainer);

    function drawRows() {
      while (rowsContainer.firstChild) rowsContainer.removeChild(rowsContainer.firstChild);
      rows.forEach(function (row, rowIndex) {
        var rowNode = element('div', undefined, 'draft-row');
        columns.forEach(function (column) {
          var control = column.options
            ? draftSelect(row[column.key], column.options, column.label)
            : draftInput(column.type || 'text', row[column.key], column.label);
          control.setAttribute('aria-label', title + ' ' + column.label + ' ' + (rowIndex + 1));
          control.addEventListener('input', function () {
            row[column.key] = column.type === 'number' ? Number(control.value) : control.value;
            scheduleSave();
          });
          rowNode.appendChild(control);
        });
        var remove = element('button', 'Remove', 'draft-remove');
        remove.type = 'button';
        remove.addEventListener('click', function () {
          rows.splice(rowIndex, 1);
          drawRows();
          scheduleSave();
        });
        rowNode.appendChild(remove);
        rowsContainer.appendChild(rowNode);
      });
    }

    drawRows();
    var add = element('button', 'Add ' + title.replace(/s$/, ''), 'draft-add');
    add.type = 'button';
    add.addEventListener('click', function () {
      rows.push(createEmptyRow());
      drawRows();
      scheduleSave();
    });
    card.appendChild(add);
    parent.appendChild(card);
  }

  function renderDailyLogDraft(container, database, project, draft) {
    var values = draft.values;
    var saveTimer = null;
    var draftQueued = false;
    var saveChain = Promise.resolve();
    container.appendChild(element('h2', 'New Daily Log', 'project-title'));
    container.appendChild(element('p', project ? project.name : 'Saved project draft', 'cache-meta'));
    var savedNote = element('p', 'Saved on this device', 'read-only-note draft-saved-note');
    container.appendChild(savedNote);
    container.appendChild(element(
      'p',
      'This unfinished log remains private on this device. You can queue the log now. Add photos in the main app before queueing; this recovery screen edits text only.',
      'draft-help'
    ));

    function saveNow() {
      if (draftQueued) return saveChain;
      savedNote.textContent = 'Saving on this device…';
      saveChain = saveChain.then(function () { return openDatabase(database.name); }).then(function (writableDatabase) {
        // Snapshot the values and compare the stored baseline in one transaction.
        // A stale tab must not overwrite newer input or resurrect a queued draft.
        var snapshot = JSON.parse(JSON.stringify(draft));
        snapshot.updatedAt = new Date(Math.max(Date.now(), Date.parse(draft.updatedAt) + 1)).toISOString();
        return writeRecord(writableDatabase, DRAFTS_STORE, snapshot, draft.updatedAt).then(function () {
          draft.updatedAt = snapshot.updatedAt;
        }).finally(function () {
          writableDatabase.close();
        });
      }).then(function () {
          savedNote.textContent = 'Saved on this device';
        }).catch(function (error) {
          savedNote.textContent = error && error.message
            ? error.message + ' Keep this page open.'
            : 'Could not save on this device — keep this page open';
        });
      return saveChain;
    }

    function scheduleSave() {
      if (saveTimer) window.clearTimeout(saveTimer);
      savedNote.textContent = 'Saving on this device…';
      saveTimer = window.setTimeout(saveNow, 150);
    }

    window.addEventListener('pagehide', saveNow);
    window.addEventListener('storage', function (event) {
      if ((event.key === SCOPE_KEY || event.key === null) && !hasActiveScope(database.name)) {
        if (saveTimer) window.clearTimeout(saveTimer);
        // Preserve the last keystrokes on involuntary session loss. Opening a
        // deleted database is rejected, so confirmed sign-out cannot be undone.
        saveNow();
      }
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') saveNow();
    });

    var basics = element('section', undefined, 'detail-card draft-card draft-grid');
    renderDraftField(basics, 'Date', draftInput('date', values.date)).addEventListener('input', function (event) {
      values.date = event.target.value;
      scheduleSave();
    });
    renderDraftField(basics, 'Temperature (°F)', draftInput('number', values.temp, '42')).addEventListener('input', function (event) {
      values.temp = event.target.value === '' ? '' : Number(event.target.value);
      scheduleSave();
    });
    renderDraftField(basics, 'Conditions', draftSelect(values.conditions, [
      'Clear', 'Partly Cloudy', 'Overcast', 'Light Snow', 'Snow', 'Rain', 'Foggy'
    ])).addEventListener('input', function (event) {
      values.conditions = event.target.value;
      scheduleSave();
    });
    renderDraftField(basics, 'Wind', draftInput('text', values.wind, 'NW 8 mph')).addEventListener('input', function (event) {
      values.wind = event.target.value;
      scheduleSave();
    });
    container.appendChild(basics);

    renderDraftRows(container, 'Personnel', values.personnel, [
      { key: 'role', label: 'Role' },
      { key: 'headcount', label: 'Count', type: 'number' },
      { key: 'company', label: 'Company' },
    ], function () { return { role: '', headcount: 0, company: '' }; }, scheduleSave);
    renderDraftRows(container, 'Equipment', values.equipment, [
      { key: 'type', label: 'Equipment Type' },
      { key: 'count', label: 'Count', type: 'number' },
      { key: 'notes', label: 'Notes' },
    ], function () { return { type: '', count: 0, notes: '' }; }, scheduleSave);
    renderDraftRows(container, 'Work Items', values.workItems, [
      { key: 'description', label: 'Description' },
      { key: 'quantity', label: 'Qty', type: 'number' },
      { key: 'unit', label: 'Unit', options: ['LF', 'CY', 'each', 'SF', 'tons', 'hours'] },
      { key: 'location', label: 'Location' },
    ], function () { return { description: '', quantity: 0, unit: '', location: '' }; }, scheduleSave);

    var notes = element('section', undefined, 'detail-card draft-card');
    var summary = element('textarea');
    summary.rows = 4;
    summary.value = values.workSummary || '';
    renderDraftField(notes, 'Work Summary', summary).addEventListener('input', function (event) {
      values.workSummary = event.target.value;
      scheduleSave();
    });
    var safety = element('textarea');
    safety.rows = 3;
    safety.value = values.safetyNotes || '';
    renderDraftField(notes, 'Safety Notes', safety).addEventListener('input', function (event) {
      values.safetyNotes = event.target.value;
      scheduleSave();
    });
    container.appendChild(notes);

    var locationCard = element('section', undefined, 'detail-card draft-card');
    locationCard.appendChild(element('h3', 'Location'));
    var locationText = element(
      'p',
      values.geoTag
        ? values.geoTag.lat.toFixed(6) + ', ' + values.geoTag.lng.toFixed(6)
        : 'No GPS location captured.',
      'draft-location'
    );
    locationCard.appendChild(locationText);
    var capture = element('button', values.geoTag ? 'Update GPS location' : 'Capture GPS location', 'draft-add');
    capture.type = 'button';
    capture.addEventListener('click', function () {
      if (!navigator.geolocation) return;
      capture.disabled = true;
      capture.textContent = 'Capturing…';
      navigator.geolocation.getCurrentPosition(function (position) {
        values.geoTag = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude === null ? undefined : position.coords.altitude,
          timestamp: new Date(position.timestamp).toISOString(),
        };
        locationText.textContent = values.geoTag.lat.toFixed(6) + ', ' + values.geoTag.lng.toFixed(6);
        capture.textContent = 'Update GPS location';
        capture.disabled = false;
        scheduleSave();
      }, function () {
        capture.textContent = values.geoTag ? 'Update GPS location' : 'Capture GPS location';
        capture.disabled = false;
      });
    });
    locationCard.appendChild(capture);
    container.appendChild(locationCard);

    var queue = element('button', 'Queue Log for Sync', 'draft-add');
    queue.type = 'button';
    queue.addEventListener('click', function () {
      if (saveTimer) window.clearTimeout(saveTimer);
      if (!values.date) {
        savedNote.textContent = 'Choose a log date before queueing.';
        return;
      }
      // Freeze this draft while delivery is queued, so later autosaves cannot
      // recreate it after the atomic draft-to-outbox move.
      draftQueued = true;
      function disableForm(disabled) {
        container.querySelectorAll('input, textarea, select, button').forEach(function (control) {
          control.disabled = disabled;
        });
      }
      disableForm(true);
      queue.disabled = true;
      queue.textContent = 'Saving to synchronization queue…';
      saveChain.then(function () { return queueDailyLogDraft(database.name, draft); }).then(function () {
        savedNote.textContent = 'Queued for synchronization · Saved on this device';
        queue.textContent = 'Queued for synchronization';
      }).catch(function (error) {
        draftQueued = false;
        disableForm(false);
        queue.disabled = false;
        queue.textContent = 'Queue Log for Sync';
        savedNote.textContent = error && error.message
          ? error.message
          : 'Could not queue this daily log — your draft is still saved';
      });
    });
    container.appendChild(queue);
  }

  async function renderOfflineData() {
    if (!('indexedDB' in window)) {
      renderStatus('This browser cannot open saved RailCommand data.');
      return;
    }

    var databaseName = await resolveDatabaseName();
    if (!databaseName) {
      renderStatus('No unambiguous signed-in offline data is available on this device.');
      return;
    }

    activeDatabaseName = databaseName;
    if (!hasActiveScope(databaseName)) { lockChangedScope(); return; }

    var database = await openDatabase(databaseName);
    try {
      var activeProjectMetadata = await readRecord(database, METADATA_STORE, 'active_project_id');
      if (!hasActiveScope(databaseName)) { lockChangedScope(); return; }
      var pathMatch = location.pathname.match(/^\/projects\/([^/]+)(?:\/daily-logs(?:\/([^/]+))?)?/);
      var requestedProjectId = pathMatch ? decodeURIComponent(pathMatch[1]) : null;
      var requestedLogId = pathMatch && pathMatch[2] ? decodeURIComponent(pathMatch[2]) : null;
      var projectId = requestedProjectId || (activeProjectMetadata && activeProjectMetadata.value);

      if (!projectId) {
        renderStatus('Open a project online once before using its offline copy.');
        return;
      }

      var isNewDailyLogDraft = /^\/projects\/[^/]+\/daily-logs\/new\/?$/.test(location.pathname);
      if (isNewDailyLogDraft) {
        var draftRecords = await Promise.all([
          readRecord(database, RECORDS_STORE, 'project:' + projectId),
          readRecord(database, DRAFTS_STORE, DAILY_LOG_DRAFT_KIND + ':' + projectId),
        ]);
        var savedProject = draftRecords[0];
        var draft = draftRecords[1];
        if (!hasActiveScope(databaseName)) { lockChangedScope(); return; }
        if (!draft || draft.kind !== DAILY_LOG_DRAFT_KIND || draft.projectId !== projectId) {
          renderStatus('No unfinished daily-log draft is saved for this project. Reconnect to start one.');
          return;
        }
        var draftContainer = byId('offline-project-data');
        draftContainer.hidden = false;
        byId('offline-neutral-message').hidden = true;
        renderStatus('');
        renderDailyLogDraft(
          draftContainer,
          database,
          recordIsUsable(savedProject) ? savedProject.value : null,
          draft
        );
        return;
      }

      var records = await Promise.all([
        readRecord(database, RECORDS_STORE, 'project:' + projectId),
        readRecord(database, RECORDS_STORE, 'daily_logs:' + projectId),
        readRecord(database, DRAFTS_STORE, DAILY_LOG_DRAFT_KIND + ':' + projectId),
      ]);
      var projectRecord = records[0];
      var logsRecord = records[1];
      var dailyLogDraft = records[2];
      if (!hasActiveScope(databaseName)) { lockChangedScope(); return; }
      if (!recordIsUsable(projectRecord) || !recordIsUsable(logsRecord)) {
        renderStatus('The saved project copy is missing or has expired. Reconnect to refresh it.');
        return;
      }

      var project = projectRecord.value;
      var logs = Array.isArray(logsRecord.value) ? logsRecord.value : [];
      if (project.id !== projectId || logs.some(function (log) { return log.project_id !== projectId; })) {
        renderStatus('Saved data did not pass its project isolation check. Reconnect to refresh it.');
        return;
      }

      var container = byId('offline-project-data');
      container.hidden = false;
      byId('offline-neutral-message').hidden = true;
      renderStatus('');
      var isStale = Date.parse(logsRecord.refreshAfter) <= Date.now();
      if (requestedLogId) {
        var log = logs.find(function (candidate) { return candidate.id === requestedLogId; });
        if (!log) {
          renderStatus('That daily log is not included in the recent offline copy.');
          container.hidden = true;
          byId('offline-neutral-message').hidden = false;
          return;
        }
        renderLogDetail(container, project, log, logsRecord.cachedAt, isStale);
      } else {
        renderLogList(container, project, logs, logsRecord.cachedAt, isStale, dailyLogDraft);
      }
    } finally {
      database.close();
    }
  }

  window.addEventListener('storage', function (event) {
    if (event.key === SCOPE_KEY || event.key === null) lockChangedScope();
  });
  window.addEventListener('focus', lockChangedScope);
  window.addEventListener('pageshow', lockChangedScope);
  document.addEventListener('visibilitychange', lockChangedScope);

  renderOfflineData().catch(function () {
    renderStatus('Saved RailCommand data could not be opened safely. Reconnect and try again.');
  });
})();
