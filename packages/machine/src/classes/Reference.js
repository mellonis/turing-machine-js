export default class Reference {
  #referenceBinding;

  get ref() {
    return this.#referenceBinding;
  }

  bind(binding) {
    if (!this.ref) {
      this.#referenceBinding = binding;
    }
  }
}
