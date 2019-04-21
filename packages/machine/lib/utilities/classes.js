"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Reference = void 0;
const referenceBindingKey = Symbol('referenceBindingKey');

class Reference {
  get ref() {
    return this[referenceBindingKey];
  }

  bind(binding) {
    if (!this.ref) {
      this[referenceBindingKey] = binding;
    }
  }

}

exports.Reference = Reference;