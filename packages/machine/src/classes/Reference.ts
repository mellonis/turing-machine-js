import State from './State';

export default class Reference {
  #referenceBinding: State | null = null;

  get ref() {
    if (!this.#referenceBinding) {
      throw new Error('unbounded reference');
    }

    return this.#referenceBinding;
  }

  bind(state: State) {
    if (this.#referenceBinding == null) {
      this.#referenceBinding = state;
    }

    return this.#referenceBinding;
  }
}
