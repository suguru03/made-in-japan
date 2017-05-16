'use strict';

const fs = require('fs');
const path = require('path');

const _  = require('lodash');
const Aigle = require('aigle');
const Github = require('gh.js');

Aigle.promisifyAll(Github);

const { CancellationError } = Aigle;

const SORTS = [undefined, 'followers', 'repositories', 'joined']; // undefined will be used best match
const ORDERS = ['desc', 'asc'];
const DELAY = 30 * 1000;

const filepath = _.transform([
  'info',
  'rank',
  'engineer',
  'repository'
], (result, key) => {
  result[key] = path.resolve(__dirname, '..', 'data', `${key}.json`);
}, {});
const query = {
  users: 'search/users',
  repositories: 'search/repositories'
};

class MadeIn {

  /**
   * @param {string} token
   */
  constructor(opts) {
    opts = opts || {};
    this._token = opts.token;
    this._gh = new Github(this._token);
    this._developers = [];
    this._ranker = false;
    this._closed = false;
    this._events();
  }

  _events() {
    const errorHandler = () => {
      if (this._closed) {
        return;
      }
      console.log('closing...');
      this._closed = true;
    };
    process.on('uncaughtException', errorHandler);
    process.on('SIGINT', errorHandler);
  }

  get(query, opts) {
    if (this._closed) {
      return Aigle.reject(new CancellationError('It is already cancelled'));
    }
    return this._gh.getAsync(query, opts)
      .catch(error => {
        if (!/^API rate limit/.test(error)) {
          return Aigle.reject(error);
        }
        console.error(error);
        console.error('waiting...');
        return Aigle.delay(DELAY)
          .then(() => this.get(query, opts));
      });
  }

  /**
   * @param {string|string[]} locations
   */
  getDevelopers(locations) {
    console.log('getDevelpers', `locations: [${locations}]`);
    locations = _.isString(locations) ? [locations] : locations;
    this.readDevelopers();
    const info = {};
    return Aigle.eachSeries(locations, location => Aigle.eachSeries(SORTS, sort => {
      return Aigle.each(ORDERS, order => {
        const opts = {
          q: `location:${location}`,
          sort,
          order,
          all: true
        };
        info.location = location;
        console.log('getDevelpers', 'searching user...\n', opts);
        return this.get(query.users, { opts })
          .then(({ items }) => {
            const developers = _.map(items, 'login');
            this._developers.push(...developers);
            this._developers = _.chain(this._developers)
              .sortBy()
              .sortedUniq()
              .value();
          })
          .catch(error => {
            if (error instanceof CancellationError) {
              return Aigle.reject(error);
            }
            console.error('getDevelpers', 'error', error);
          });
      });
    }))
    .finally(() => this.saveDevelopers())
    .catch(CancellationError, _.noop)
    .then(() => info);
  }

  /**
   * read all developers for searching repositories
   */
  readDevelopers() {
    this._ranker = false;
    this._developers = require(filepath.engineer);
  }

  saveDevelopers() {
    console.log('saveDevelopers', 'saving...');
    fs.writeFileSync(filepath.engineer, JSON.stringify(this._developers, null, 2), 'utf8');
  }

  /**
   * read all rankers for searching repositories
   */
  readRankers() {
    this._ranker = true;
    this._developers = require(filepath.rank);
  }
}

module.exports = MadeIn;
