/* Shelf: shared IndexedDB helpers (used by the page and the service worker) */
var ShelfDB = (function () {
  var NAME = 'shelf', STORE = 'files', dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open(NAME, 1);
      r.onupgradeneeded = function () {
        var s = r.result.createObjectStore(STORE, { keyPath: 'id' });
        s.createIndex('name', 'name', { unique: false });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, mode), s = t.objectStore(STORE), out;
        Promise.resolve(fn(s)).then(function (v) { out = v; });
        t.oncomplete = function () { res(out); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function req(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function all() { return tx('readonly', function (s) { return req(s.getAll()); }); }
  function get(id) { return tx('readonly', function (s) { return req(s.get(id)); }); }
  function put(rec) { return tx('readwrite', function (s) { return req(s.put(rec)); }); }
  function del(id) { return tx('readwrite', function (s) { return req(s.delete(id)); }); }
  function kindOf(name, text) {
    var n = (name || '').toLowerCase();
    if (/\.(html?|xhtml)$/.test(n)) return 'html';
    if (/\.(md|markdown|mdown|mkd)$/.test(n)) return 'md';
    var head = (text || '').slice(0, 2000).trim().toLowerCase();
    if (/^(<!doctype html|<html|<head|<title|<style|<div|<body|<section|<main|<svg)/.test(head)) return 'html';
    return 'md';
  }
  /* Add or replace by file name (same name = update, keeps saved page data) */
  function addText(name, text) {
    name = (name || '').trim() || '無題.md';
    var kind = kindOf(name, text);
    if (!/\.[a-z0-9]+$/i.test(name)) name += kind === 'html' ? '.html' : '.md';
    return all().then(function (list) {
      var ex = list.filter(function (f) { return f.name === name; })[0];
      var now = Date.now();
      var rec = ex ? Object.assign({}, ex, { text: text, kind: kind, size: text.length, updatedAt: now })
                   : { id: now.toString(36) + Math.random().toString(36).slice(2, 8), name: name, text: text, kind: kind,
                       size: text.length, addedAt: now, updatedAt: now, openedAt: 0, storage: {} };
      return put(rec).then(function () { return { rec: rec, replaced: !!ex }; });
    });
  }
  return { all: all, get: get, put: put, del: del, addText: addText, kindOf: kindOf };
})();
