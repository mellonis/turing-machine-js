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

export {
  // eslint-disable-next-line import/prefer-default-export
  Reference,
};
