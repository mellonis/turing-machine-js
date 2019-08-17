export default class Reference {
  #referenceBinding;

  get ref() {
    if (!this.#referenceBinding) {
      throw new Error('unbounded reference');
    }

    return this.#referenceBinding;
  }

  bind(binding) {
    if (!this.#referenceBinding) {
      this.#referenceBinding = binding;
    }
  }
}
