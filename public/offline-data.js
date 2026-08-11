(function () {
  'use strict';

  var DATABASE_PREFIX = 'railcommand-offline:';
  var SCOPE_KEY = 'rc-offline-database-scope';
  var RECORDS_STORE = 'records';
  var METADATA_STORE = 'metadata';

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

  async function resolveDatabaseName() {
    var storedScope = null;
    try { storedScope = localStorage.getItem(SCOPE_KEY); } catch (_) {}
    if (storedScope && storedScope.indexOf(DATABASE_PREFIX) === 0) return storedScope;
    return null;
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

  function renderLogList(container, project, logs, cachedAt, isStale) {
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

    var database = await openDatabase(databaseName);
    try {
      var activeProjectMetadata = await readRecord(database, METADATA_STORE, 'active_project_id');
      var pathMatch = location.pathname.match(/^\/projects\/([^/]+)(?:\/daily-logs(?:\/([^/]+))?)?/);
      var requestedProjectId = pathMatch ? decodeURIComponent(pathMatch[1]) : null;
      var requestedLogId = pathMatch && pathMatch[2] ? decodeURIComponent(pathMatch[2]) : null;
      var projectId = requestedProjectId || (activeProjectMetadata && activeProjectMetadata.value);

      if (!projectId) {
        renderStatus('Open a project online once before using its offline copy.');
        return;
      }

      var records = await Promise.all([
        readRecord(database, RECORDS_STORE, 'project:' + projectId),
        readRecord(database, RECORDS_STORE, 'daily_logs:' + projectId),
      ]);
      var projectRecord = records[0];
      var logsRecord = records[1];
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
        renderLogList(container, project, logs, logsRecord.cachedAt, isStale);
      }
    } finally {
      database.close();
    }
  }

  renderOfflineData().catch(function () {
    renderStatus('Saved RailCommand data could not be opened safely. Reconnect and try again.');
  });
})();
