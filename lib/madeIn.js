'use strict';

const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const Github = require('gh.js');
const async = require('neo-async');

const FILEPATH = path.resolve(__dirname, '..', 'data', 'user.json');
const WAIT = 60 * 1000;
const LIMIT = 10; // per min
const SORT = 'followers'; // ['followers', 'repositories', 'joined']
const ORDER = 'desc'; // ['desc', 'asc']
const PER_PAGE = 100;

const users = require(FILEPATH);
const query = {
  users: 'search/users',
  repositories: 'search/repositories'
};

/**
 * This function is based on https://github.com/IonicaBizau/made-in
 */
class MadeIn {

  constructor(opts) {
    opts = opts || {};
    this._current = 0;
    this._token = opts.token;
    this._gh = new Github(this._token);
    this._users = users;
    this._tasks = [
      this._getUsers
    ];
    this
      .saveCache(opts.save)
      .readCache(opts.cache)
      .location(opts.loc)
      .language(opts.language)
      .callback(opts.callback);

    this._execute();
  }

  /* options */

  /**
   * save user data for data/user.json
   * @param {boolean} bool
   */
  saveCache(bool) {
    this._save = bool !== false;
    return this;
  }

  /**
   * read user data from data/user.json
   * @param {boolean} bool
   */
  readCache(bool) {
    this._cache = bool !== false;
    return this;
  }

  /**
   * set user location
   * @param {string} loc - location
   */
  location(loc) {
    this._location = loc;
    return this;
  }

  language(language) {
    this._language = language;
    return this;
  }

  callback(callback) {
    if (callback) {
      this._callback = callback;
    } else {
      this._callback = err => {
        this._saveCacheUsers(() => {
          if (err) {
            console.trace();
            throw err;
          }
        });
      };
    }
    return this;
  }

  /* funcitons */

  _bind(tasks) {
    const newTasks = _.map(tasks, func => func.bind(this));
    return newTasks;
  }

  _execute() {
    process.nextTick(() => {
      async.series(this._bind(this._tasks), this._callback);
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
    const tasks = [this._getCacheUsers];
    if (!this._cache) {
      tasks.push(this._getAllusers);
    }
    if (this._save) {
      tasks.push(this._saveCacheUsers);
    }
    async.series(this._bind(tasks), callback);
  }

  _getCacheUsers(callback) {
    this._users = users;
    callback();
  }

  _saveCacheUsers(callback) {
    const str = _.chain(this._users)
      .sortBy()
      .sortedUniq()
      .reduce((result, name) => {
        if (!result) {
          return `\n"${name}"`;
        }
        return `${result},\n"${name}"`;
      }, '')
      .value();
    fs.writeFile(FILEPATH, `[${str}\n]`, 'utf8', callback);
  }

  _getAllusers(callback) {
    let page = 1;
    const users = this._users;
    const test = items => {
      if (_.isBoolean(items)) {
        return items;
      }
      console.log(`current user size: ${_.uniq(users).length}`);
      return items.length !== PER_PAGE;
    };
    const iterator = cb => {
      this.get(query.users, {
        opts: {
          q: `location:${this._location}`,
          sort: SORT,
          order: ORDER,
          page: page++,
          per_page: PER_PAGE
        }
      }, (err, data) => {
        if (/API rate limit/.test(err)) {
          console.error(err);
          console.error('waiting...');
          this._current = LIMIT;
          this._time = Date.now();
          return cb(null, false);
        }
        if (err) {
          return cb(err);
        }
        const items = _.map(data.items, 'login');
        Array.prototype.push.apply(users, items);
        cb(null, items);
      });
    };
    async.doUntil(iterator, test, callback);
  }


}

module.exports = MadeIn;

