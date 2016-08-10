'use strict';

const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const Github = require('gh.js');
const async = require('neo-async');

const WAIT = 60 * 1000;
const SORT = 'followers'; // ['followers', 'repositories', 'joined']
const ORDER = 'desc'; // ['desc', 'asc']
const PER_PAGE = 100;
const LOWER_STAR = 3;

const filepath = {
  info: path.resolve(__dirname, '..', 'data', 'info.json'),
  user: path.resolve(__dirname, '..', 'data', 'user.json'),
  repository: path.resolve(__dirname, '..', 'data', 'repository.json')
};
const info = require(filepath.info);
const users = require(filepath.user);
const repositories = require(filepath.repository);
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
    this._token = opts.token;
    this._users = users;
    this._repositories = repositories;
    this
      .saveUser(opts.save || false)
      .readUser(opts.cache)
      .saveRepository(opts.save || false)
      .readRepository(opts.cache)
      .location(opts.loc)
      .language(opts.language)
      .callback(opts.callback);

    this._execute();
  }

  /* options */

  token(token) {
    this._token = token;
    return this;
  }

  /**
   * save user data for data/user.json
   * @param {boolean} bool
   */
  saveUser(bool) {
    this._saveUser = bool !== false;
    return this;
  }

  /**
   * read user data from data/user.json
   * @param {boolean} bool
   */
  readUser(bool) {
    this._cacheUser = bool !== false;
    return this;
  }

  /**
   * save user data for data/user.json
   * @param {boolean} bool
   */
  saveRepository(bool) {
    this._saveRepository = bool !== false;
    return this;
  }

  /**
   * read user data from data/user.json
   * @param {boolean} bool
   */
  readRepository(bool) {
    this._cacheRepository = bool !== false;
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
        this._callback = _.noop;
        const tasks = _.map([
          this._saveCacheUsers,
          this._saveCacheRepositories,
          this._saveInfo
        ], func => {
          return cb => {
            const done = err => {
              if (err) {
                console.error(err);
              }
              cb();
            };
            func.call(this, done);
          };
        });

        async.series(tasks, () => {
          if (err) {
            console.trace();
            throw err;
          }
          setTimeout(process.exit, 1000);
        });
      };
      process.on('SIGINT', err => {
        if (this._close) {
          return;
        }
        console.log('closing...');
        this._close = true;
        this._callback(err);
      });
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
      this._gh = new Github(this._token);
      const tasks = [
        this._getUsers,
        this._getRepositories
      ];
      async.series(this._bind(tasks), this._callback);
    });
  }

  req(method, query, opts, callback) {
    if (this._close) {
      return;
    }
    const done = (err, res) => {
      if (!/API rate limit/.test(err)) {
        return callback(err, res);
      }
      console.error(err);
      console.error('waiting...');
      return setTimeout(() => {
        this.req(method, query, opts, callback);
      }, WAIT);
    };
    this._gh[method](query, opts, done);
  }

  get(query, opts, callback) {
    this.req('get', query, opts, callback);
  }

  patch(query, opts, callback) {
    opts.method = 'PATCH';
    this.req('req', query, opts, callback);
  }

  _saveInfo(callback) {
    fs.writeFile(filepath.info, JSON.stringify(info, null, 2), 'utf8', callback);
  }

  /* user functions */

  _getUsers(callback) {
    const tasks = [this._getCacheUsers];
    if (!this._cacheUser) {
      tasks.push(this._getAllusers);
    }
    if (this._saveUser) {
      tasks.push(this._saveCacheUsers);
    }
    async.series(this._bind(tasks), callback);
  }

  _getCacheUsers(callback) {
    this._users = users;
    callback();
  }

  _saveCacheUsers(callback) {
    const users = _.chain(this._users)
      .sortBy()
      .sortedUniq()
      .value();
    fs.writeFile(filepath.user, JSON.stringify(users, null, 2), 'utf8', callback);
  }

  _getAllusers(callback) {
    let page = 1;
    const test = items => {
      if (_.isBoolean(items)) {
        return items;
      }
      console.log(`current user size: ${this._users.length}`);
      return items.length !== PER_PAGE;
    };
    const iterator = cb => {
      const opts = {
        q: `location:${this._location}`,
        sort: SORT,
        order: ORDER,
        page: page++,
        per_page: PER_PAGE
      };
      this.get(query.users, { opts: opts }, (err, data) => {
        if (err) {
          return cb(err);
        }
        const items = data.items;
        this._users = _.chain(items)
          .map('login')
          .concat(this._users)
          .sortBy()
          .sortedUniq()
          .value();
        cb(null, items);
      });
    };
    async.doUntil(iterator, test, callback);
  }

  /* repository functions */

  _getRepositories(callback) {
    const tasks = [this._getCacheRepositories];
    if (!this._cacheRepository) {
      tasks.push(this._getAllRepositories);
    }
    if (this._saveRepository) {
      tasks.push(this._saveCacheRepositories);
    }
    async.series(this._bind(tasks), callback);
  }

  _getCacheRepositories(callback) {
    this._repositories = repositories;
    callback();
  }

  _saveCacheRepositories(callback) {
    const repositories = _.chain(this._repositories)
      .uniqWith((a, b) => {
        return _.isEqual(a.owner.login, b.owner.login) && _.isEqual(a.name, b.name);
      })
      .sortBy(['owner.login', 'name'])
      .value();
    fs.writeFile(filepath.repository, JSON.stringify(repositories, null, 2), 'utf8', callback);
  }

  _getAllRepositories(callback) {
    const index = _.indexOf(this._users, info.current_user);
    const users = index >= 0 ? _.slice(this._users, index) : this._users;
    const iterator = (name, cb) => {
      console.log(`checking ${name}'s repositories...`);
      const opts = {
        q: `user:${name} fork:false stars:>=${LOWER_STAR} ${this._language || ''}`,
        sort: 'stars'
      };
      this.get(query.repositories, { opts: opts }, (err, data) => {
        if (/Validation Failed/.test(err)) {
          console.error(err);
          console.error(`skip ${name}`);
          info.current_user = name;
          return cb();
        }
        if (err) {
          return cb(err);
        }
        info.current_user = name;
        this._repositories = _.chain(data.items)
          .map(repo => {
            return {
              name: repo.name || '',
              owner: repo.owner,
              language: repo.language || 'Documents',
              full_name: repo.full_name,
              desc: repo.description,
              html_url: repo.html_url,
              stars: repo.stargazers_count,
              homepage: repo.homepage
            };
          })
          .concat(this._repositories)
          .uniqWith((a, b) => {
            return _.isEqual(a.owner.login, b.owner.login) && _.isEqual(a.name, b.name);
          })
          .sortBy(['owner.login', 'name'])
          .value();
        cb();
      });
    };
    async.eachSeries(users, iterator, callback);
  }

}

module.exports = MadeIn;

