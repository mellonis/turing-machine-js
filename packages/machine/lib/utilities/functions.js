"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.uniquePredicate = void 0;

const uniquePredicate = (v, i, a) => a.indexOf(v) === i;

exports.uniquePredicate = uniquePredicate;