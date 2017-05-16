'use strict';

const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const Github = require('gh.js');
const async = require('neo-async');

const WAIT = 60 * 1000;
const TIMEOUT = 5000;
const SORT = 'followers'; // ['followers', 'repositories', 'joined']
const ORDER = 'desc'; // ['desc', 'asc']
const PER_PAGE = 100;
const LOWER_STAR = 3;

const filepath = {
  info: path.resolve(__dirname, '..', 'data', 'info.json'),
  rank: path.resolve(__dirname, '..', 'data', 'rank.json'),
  engineer: path.resolve(__dirname, '..', 'data', 'engineer.json'),
  repository: path.resolve(__dirname, '..', 'data', 'repository.json')
};
const info = require(filepath.info) || {};
const rankers = require(filepath.rank);
const engineers = require(filepath.engineer);
const repositories = require(filepath.repository);
const query = {
  engineers: 'search/users',
  repositories: 'search/repositories'
};

/**
 * This function is based on https://github.com/IonicaBizau/made-in
 */
class MadeIn {

  constructor(opts) {
    opts = opts || {};
    this._token = opts.token;
    this._ranker = opts.ranker;
    this._engineers = this._ranker ? rankers : engineers;
    this._repositories = repositories;
    this
      .saveEngineer(opts.save || false)
      .readEngineer(opts.cache)
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
   * save engineer data for data/engineer.json
   * @param {boolean} bool
   */
  saveEngineer(bool) {
    this._saveEngineer = bool !== false;
    return this;
  }

  /**
   * read engineer data from data/engineer.json
   * @param {boolean} bool
   */
  readEngineer(bool) {
    this._cacheEngineer = bool !== false;
    return this;
  }

  /**
   * save engineer data for data/repository.json
   * @param {boolean} bool
   */
  saveRepository(bool) {
    this._saveRepository = bool !== false;
    return this;
  }

  /**
   * read engineer data from data/repository.json
   * @param {boolean} bool
   */
  readRepository(bool) {
    this._cacheRepository = bool !== false;
    return this;
  }

  /**
   * set engineer location
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
    // only first time
    const errorHandler = err => {
      console.log('closing...');
      if (this._callback !== _.noop) {
        this._callback(err);
      }
    };
    process.on('uncaughtException', errorHandler);
    process.on('SIGINT', errorHandler);

    this._callback = (err, result) => {
      this._callback = _.noop;
      const tasks = _.map([
        this._saveCacheEngineers,
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

      async.series(tasks, _err => {
        err = err || _err;
        if (err) {
          console.trace(err);
        }
        process.removeListener('uncaughtException', errorHandler);
        process.removeListener('SIGINT', errorHandler);
        if (callback) {
          return callback(err, result);
        }
        setTimeout(process.exit, TIMEOUT);
      });
    };
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
        this._getEngineers,
        this._getRepositories
      ];
      async.series(this._bind(tasks), err => {
        const result = {
          engineers: this._engineers,
          repositories: this._repositories
        };
        this._callback(err, result);
      });
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

  /* engineer functions */

  _getEngineers(callback) {
    const tasks = [this._getCacheEngineers];
    if (!this._cacheEngineer) {
      tasks.push(this._getAllEngineers);
    }
    if (this._saveEngineer) {
      tasks.push(this._saveCacheEngineers);
    }
    async.series(this._bind(tasks), callback);
  }

  _getCacheEngineers(callback) {
    this._engineers = this._ranker ? rankers : engineers;
    callback();
  }

  _saveCacheEngineers(callback) {
    if (this._ranker) {
      return callback();
    }
    const engineers = _.chain(this._engineers)
      .sortBy()
      .sortedUniq()
      .value();
    fs.writeFile(filepath.engineer, JSON.stringify(engineers, null, 2), 'utf8', callback);
  }

  _getAllEngineers(callback) {
    let page = 1;
    const test = items => {
      if (_.isBoolean(items)) {
        return items;
      }
      console.log(`current engineer size: ${this._engineers.length}`);
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
      this.get(query.engineers, { opts }, (err, data) => {
        if (err) {
          return cb(err);
        }
        const items = data.items;
        this._engineers = _.chain(items)
          .map('login')
          .concat(this._engineers)
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
    const index = _.indexOf(this._engineers, info.current_engineer);
    const engineers = index >= 0 ? _.slice(this._engineers, index) : this._engineers;
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
          info.current_engineer = name;
          return cb();
        }
        if (err) {
          return cb(err);
        }
        info.current_engineer = name;
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
    async.eachSeries(engineers, iterator, callback);
  }

}

module.exports = MadeIn;

