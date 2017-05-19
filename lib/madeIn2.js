'use strict';

const fs = require('fs');
const path = require('path');

const _  = require('lodash');
const Aigle = require('aigle');
const Github = require('gh.js');

Aigle.promisifyAll(Github);
Aigle.config({ cancellation: true });

const { CancellationError } = Aigle;

const SORTS = [undefined, 'followers', 'repositories', 'joined']; // undefined will be used best match
const ORDERS = ['desc', 'asc'];
const DELAY = 30 * 1000;
const LOWEST_STAR = 3;

const filepath = _.transform([
  'info',
  'rankers',
  'developers',
  'repositories'
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
    this._repositories = [];
    this._ranker = false;
    this._closed = false;
    this._promises = [];
    this._events();
  }

  _events() {
    const errorHandler = () => {
      if (this._closed) {
        return;
      }
      console.log('closing...');
      this._closed = true;
      _.forEach(this._promises, promise => promise.cancel());
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
        const promise = Aigle.delay(DELAY);
        this._promises.push(promise);
        return promise.then(() => this.get(query, opts))
          .finally(() => _.remove(this._promises, promise));
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
   * get repositories by developers
   * @param {string[]} [developers]
   */
  getRepositories(developers) {
    developers = developers || this.readDevelopers();
    if (_.isEmpty(developers)) {
      return Aigle.reject(new Error('Need to get users, first'));
    }
    this.readRepositories();
    const info = {};
    return Aigle.eachLimit(developers, developer => {
      console.log(`checking ${developer}'s repositories...`);
      const opts = {
        q: `user:${developer} fork:false stars:>=${LOWEST_STAR}`,
        sort: 'stars',
        all: true
      };
      info.developer = developer;
      return this.get(query.repositories, { opts })
        .then(({ items }) => {
          const repositories = _.map(items, repo => {
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
          });
          this._repositories.push(...repositories);
        })
        .catch(error => {
          if (/Validation Failed/.test(error)) {
            return console.error(`skip ${developer}`, error);
          }
          return Aigle.reject(error);
        });
    })
    .finally(() => this.saveRepositories())
    .catch(CancellationError, _.noop)
    .then(() => info);
  }

  /**
   * read all developers for searching repositories
   */
  readDevelopers() {
    this._ranker = false;
    this._developers = require(filepath.developers);
    return this._developers;
  }

  setDevelopers(developers) {
    this._ranker = false;
    this._developers = developers;
  }

  saveDevelopers() {
    console.log('saveDevelopers', 'saving...');
    const developers = _.chain(this._developers)
      .sortBy()
      .sortedUniq()
      .value();
    console.log('saveDevelopers', `developers: ${developers.length}`);
    fs.writeFileSync(filepath.developers, JSON.stringify(developers, null, 2), 'utf8');
  }

  /**
   * read all rankers for searching repositories
   */
  readRankers() {
    this._ranker = true;
    this._developers = require(filepath.rankers);
    return this._developers;
  }

  readRepositories() {
    this._repositories = require(filepath.repositories);
    return this._repositories;
  }

  saveRepositories() {
    console.log('saveRepositories', 'saving...');
    const repositories = _.chain(this._repositories)
      .uniqWith((a, b) => _.isEqual(a.owner.login, b.owner.login) && _.isEqual(a.name, b.name))
      .sortBy(['owner.login', 'name'])
      .value();
    console.log('saveRepositories', `repositories: ${repositories.length}`);
    fs.writeFileSync(filepath.repositories, JSON.stringify(repositories, null, 2), 'utf8');
  }
}

module.exports = MadeIn;
