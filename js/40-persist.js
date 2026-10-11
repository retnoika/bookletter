/**
 * Bookletter — autosave (IndexedDB → localStorage fallback), project save/open
 */
(function() {
  'use strict';
  var BL = window.BL;

  var DB_NAME = 'bookletter';
  var DB_VERSION = 1;
  var STORE_NAME = 'kv';
  var KEY = 'state';
  var DEBOUNCE_MS = 400;

  var saveTimer = null;
  var idbAvailable = null;
  var db = null;

  // ============ IndexedDB ============
  function openIDB() {
    return new Promise(function(resolve, reject) {
      try {
        var request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = function() {
          request.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = function() {
          resolve(request.result);
        };
        request.onerror = function() {
          reject(request.error);
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  function idbGet() {
    return new Promise(function(resolve, reject) {
      openIDB().then(function(database) {
        db = database;
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var req = store.get(KEY);
        req.onsuccess = function() {
          resolve(req.result);
        };
        req.onerror = function() {
          reject(req.error);
        };
      }).catch(reject);
    });
  }

  function idbSet(value) {
    return new Promise(function(resolve, reject) {
      openIDB().then(function(database) {
        db = database;
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        store.put(value, KEY);
        tx.oncomplete = function() {
          resolve(true);
        };
        tx.onerror = function() {
          reject(tx.error);
        };
      }).catch(reject);
    });
  }

  // ============ localStorage fallback ============
  var LS_KEY = 'bookletter_state';

  function lsGet() {
    try {
      var data = localStorage.getItem(LS_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  function lsSet(value) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ============ Autosave ============
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, DEBOUNCE_MS);
  }

  function doSave() {
    var data = BL.clone(BL.S);
    
    if (idbAvailable === true) {
      idbSet(data).then(function() {
        updateSavedStatus('Autosaved in this browser');
      }).catch(function() {
        // Try localStorage
        if (lsSet(data)) {
          updateSavedStatus('Autosaved (local storage)');
        } else {
          updateSavedStatus('Autosave unavailable — use Save');
        }
      });
    } else if (idbAvailable === false) {
      if (lsSet(data)) {
        updateSavedStatus('Autosaved (local storage)');
      } else {
        updateSavedStatus('Autosave unavailable — use Save');
      }
    } else {
      // Not yet determined
      checkIDBAvailability().then(function(avail) {
        idbAvailable = avail;
        doSave();
      });
    }
  }

  function checkIDBAvailability() {
    return new Promise(function(resolve) {
      try {
        var req = indexedDB.open('__test__', 1);
        req.onsuccess = function() {
          req.result.close();
          indexedDB.deleteDatabase('__test__');
          resolve(true);
        };
        req.onerror = function() {
          resolve(false);
        };
      } catch (e) {
        resolve(false);
      }
    });
  }

  function updateSavedStatus(msg) {
    var el = document.getElementById('saved');
    if (el) {
      el.textContent = msg;
    }
  }

  BL.save = save;
  BL.updateSavedStatus = updateSavedStatus;

  // ============ Load saved state ============
  // Helper: check if page count is valid
  function isValidPageCount(len) {
    return BL.VALID_PAGE_COUNTS.indexOf(len) !== -1;
  }

  // Helper: migrate old projects (add pageCount field if missing)
  function migrateProject(data) {
    if (data && data.pages && !data.pageCount) {
      data.pageCount = data.pages.length;
    }
    return data;
  }

  function loadSaved() {
    return new Promise(function(resolve) {
      checkIDBAvailability().then(function(avail) {
        idbAvailable = avail;
        
        if (avail) {
          idbGet().then(function(data) {
            if (data && data.pages && isValidPageCount(data.pages.length)) {
              resolve(migrateProject(data));
            } else {
              // Try localStorage
              var lsData = lsGet();
              if (lsData && lsData.pages && isValidPageCount(lsData.pages.length)) {
                resolve(migrateProject(lsData));
              } else {
                resolve(null);
              }
            }
          }).catch(function() {
            var lsData = lsGet();
            if (lsData && lsData.pages && isValidPageCount(lsData.pages.length)) {
              resolve(migrateProject(lsData));
            } else {
              resolve(null);
            }
          });
        } else {
          var lsData = lsGet();
          if (lsData && lsData.pages && isValidPageCount(lsData.pages.length)) {
            resolve(migrateProject(lsData));
          } else {
            resolve(null);
          }
        }
      });
    });
  }

  BL.loadSaved = loadSaved;

  // ============ Project save (download JSON) ============
  function saveProject() {
    var data = BL.clone(BL.S);
    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    
    var filename = (BL.S.title || 'untitled booklet').replace(/[^a-zA-Z0-9_\- ]/g, '') + '.bookletter.json';
    
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setTimeout(function() {
      URL.revokeObjectURL(url);
    }, 1500);
    
    BL.toast('Project saved: ' + filename);
  }

  BL.saveProject = saveProject;

  // ============ Project open ============
  function validateProject(data) {
    if (!data || typeof data !== 'object') {
      return 'Invalid file format';
    }
    if (!Array.isArray(data.pages) || !isValidPageCount(data.pages.length)) {
      return 'Not a Bookletter project: must have 8, 16, or 24 pages';
    }
    // Migrate: add pageCount if missing
    if (!data.pageCount) {
      data.pageCount = data.pages.length;
    }
    // Check each page has layers array
    for (var i = 0; i < data.pages.length; i++) {
      var page = data.pages[i];
      if (!page || typeof page !== 'object') {
        return 'Invalid page data';
      }
      if (!Array.isArray(page.layers)) {
        page.layers = [];
      }
    }
    return null;
  }

  function openProject(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() {
        try {
          var data = JSON.parse(reader.result);
          var error = validateProject(data);
          if (error) {
            reject(new Error(error));
            return;
          }
          
          // Merge with defaults for any missing fields
          var defaults = BL.defaultState();
          BL.S = {
            v: data.v || defaults.v,
            title: data.title || defaults.title,
            orient: data.orient || defaults.orient,
            sheet: data.sheet || defaults.sheet,
            guide: data.guide !== undefined ? data.guide : defaults.guide,
            safe: data.safe !== undefined ? data.safe : defaults.safe,
            nums: data.nums !== undefined ? data.nums : defaults.nums,
            pages: data.pages
          };
          
          BL.cur = 0;
          BL.sel = null;
          BL.clearHistory();
          
          resolve();
        } catch (e) {
          reject(new Error('Could not parse file: ' + e.message));
        }
      };
      reader.onerror = function() {
        reject(new Error('Could not read file'));
      };
      reader.readAsText(file);
    });
  }

  function handleOpenProject(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    
    openProject(file).then(function() {
      BL.renderAll();
      BL.save();
      BL.toast('Project opened.');
    }).catch(function(err) {
      BL.toast(err.message || 'That file is not a Bookletter project.');
    });
  }

  BL.openProject = openProject;
  BL.handleOpenProject = handleOpenProject;

  // ============ New booklet ============
  function newBooklet() {
    if (!confirm('Create a new booklet? Unsaved changes will be lost.')) {
      return;
    }
    
    BL.S = BL.defaultState();
    BL.cur = 0;
    BL.sel = null;
    BL.clearHistory();
    BL.renderAll();
    BL.save();
    BL.toast('New booklet created.');
  }

  BL.newBooklet = newBooklet;

  // ============ Export/Import for test API ============
  function exportState() {
    return BL.clone(BL.S);
  }

  function importState(data) {
    var error = validateProject(data);
    if (error) {
      throw new Error(error);
    }
    
    var defaults = BL.defaultState();
    BL.S = {
      v: data.v || defaults.v,
      title: data.title || defaults.title,
      orient: data.orient || defaults.orient,
      sheet: data.sheet || defaults.sheet,
      guide: data.guide !== undefined ? data.guide : defaults.guide,
      safe: data.safe !== undefined ? data.safe : defaults.safe,
      nums: data.nums !== undefined ? data.nums : defaults.nums,
      pages: data.pages
    };
    
    BL.cur = 0;
    BL.sel = null;
  }

  BL.exportState = exportState;
  BL.importState = importState;

  // ============ Setup ============
  function setupPersist() {
    var fileJson = document.getElementById('fileJson');
    if (fileJson) {
      fileJson.addEventListener('change', handleOpenProject);
    }
    
    var bOpen = document.getElementById('bOpen');
    if (bOpen) {
      bOpen.addEventListener('click', function() {
        fileJson.value = '';
        fileJson.click();
      });
    }
    
    var bSave = document.getElementById('bSave');
    if (bSave) {
      bSave.addEventListener('click', saveProject);
    }
    
    var bNew = document.getElementById('bNew');
    if (bNew) {
      bNew.addEventListener('click', newBooklet);
    }
    
    var bFill = document.getElementById('bFill');
    if (bFill) {
      bFill.addEventListener('click', function() {
        var fileMany = document.getElementById('fileMany');
        if (fileMany) {
          fileMany.value = '';
          fileMany.click();
        }
      });
    }
  }

  BL.setupPersist = setupPersist;

})();
