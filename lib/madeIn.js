'use strict';

const _ = require('lodash');
const Github = require('gh.js');
const async = require('neo-async');

const WAIT = 60 * 1000;
const LIMIT = 10; // per min
const SORT = 'followers';
const PER_PAGE = 100;

const query = {
  gist: 'gist',
  users: 'search/users',
  repositories: 'search/repositories'
};

/**
 * This function is based on https://github.com/IonicaBizau/made-in
 */
class MadeIn {

  constructor(opts) {
    opts = opts || {};
    this._token = opts.token;
    this._gh = new Github(this._token);
    this._gist = opts.gist;
    this._read = opts.read;
    this._save = opts.save;
    this.loc(opts.loc);
    this.language(opts.language);
    this.callback(opts.callback);

    this._current = 0;
    this._time = 0;
    this._data = {
      gist: undefined,
      users: []
    };
    this._tasks = [];
    this._execute();
  }

  /**
   * set gist id for save and read user data
   *
   * @param {string} id - gist id
   */
  gist(id, opts) {
    this._gist = id;
    this._read = _.get(opts, ['read'], this._read);
    this._save = _.get(opts, ['save'], this._save);
    return this;
  }

  /**
   * save user data for gist
   * @param {boolean} bool
   */
  save(bool) {
    this._save = bool !== false;
    return this;
  }

  /**
   * read user data for gist
   * @param {boolean} bool
   */
  read(bool) {
    this._read = bool !== false;
    return this;
  }

  /**
   * set user location
   * @param {string} loc - location
   */
  loc(loc) {
    this._loc = loc;
    return this;
  }

  language(language) {
    this._language = language;
    return this;
  }

  callback(callback) {
    this._callback = callback || function(err) {
      if (err) {
        console.trace();
        throw err;
      }
    };
    return this;
  }

  search() {

    return this;
  }

  _execute() {

    process.nextTick(() => {
      const tasks = _.map([
        this._getUsers,
        this._saveGist
      ], (func) => {
        return func.bind(this);
      });
      async.series(tasks, this._callback);
    });
  }

  req(method, query, opts, callback) {
    this._time = this._time || Date.now();
    if (++this._current >= LIMIT && this._time - Date.now() < WAIT) {
      return setTimeout(() => {
        this._current = 0;
        this._time = 0;
        this.req(method, query, opts, callback);
      }, WAIT);
    }
    this._gh[method](query, opts, callback);
  }

  get(query, opts, callback) {
    this.req('get', query, opts, callback);
  }

  patch(query, opts, callback) {
    opts.method = 'PATCH';
    this.req('req', query, opts, callback);
  }

  _getUsers(callback) {
    return this._read ? this._getGist().users(callback) : this._getAllusers(callback);
  }

  _getAllusers(callback) {

    let page = 1;
    const users = this._data.users;
    const test = items => {
      console.log(items.length);
      return true;
    };
    const iterator = cb => {
      this.get(query.users, {
        opts: {
          q: `location:${this._loc}`,
          sort: SORT,
          page: page++,
          per_page: PER_PAGE
        }
      }, (err, data) => {
        if (err) {
          return cb(err);
        }
        const items = data.items;
        Array.prototype.push.apply(users, items);
        cb(null, items);
      });
    };
    async.doUntil(iterator, test, callback);
  }

  _getGist(callback) {
    if (this._data.gist) {
      return callback(null, this._data.gist);
    }
    const q = `${query.gist}/${this._gist}`;
    this.get(q, (err, res) => {
      if (err) {
        return this._callback(err);
      }
      this._data.gist = res;
      callback(null, res);
    });
  }

  _saveGist(callback) {
    if (!this._save) {
      return callback();
    }
    this._getGist((err, res) => {
      if (err) {
        return callback(err);
      }
      console.log(res);
    });
  }


}

module.exports = MadeIn;

