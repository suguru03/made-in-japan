'use strict';

const _ = require('lodash');
const _madeIn = require('made-in');
const makeFunc = require('make-function');

class MadeIn {

  constructor(loc) {
    this._loc = loc;
    this._token = undefined;
    this._language = undefined;
    this._callback = _.noop;
  }

  token(token) {
    this._token = token;
    return this;
  }

  language(language) {
    this._language = language;
    return this;
  }

  loc(loc) {
    this._loc = loc;
    return this;
  }

  search(callback) {
    _madeIn(this._loc, {
      token: this._token,
      language: this._language
    }, callback);
    return this;
  }
}

function madeIn(loc) {
  return function madeIn(token, language, callback) {
    new MadeIn()
      .loc(loc)
      .token(token)
      .language(language)
      .search(callback);
  };
}

let madeInJapan = madeIn('Japan');
madeInJapan.madeIn = madeIn;
madeInJapan.MadeIn = MadeIn;
module.exports = madeInJapan;
