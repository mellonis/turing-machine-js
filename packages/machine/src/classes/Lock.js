export default class Lock {
  #lockSymbol = null;

  lock(symbol) {
    if (this.#lockSymbol === null && typeof symbol === 'symbol') {
      this.#lockSymbol = symbol;
    }
  }

  unlock(symbol) {
    if (this.#lockSymbol === symbol) {
      this.#lockSymbol = null;
    }
  }

  check(symbol) {
    if (this.#lockSymbol && this.#lockSymbol !== symbol) {
      throw new Error('Lock check failed');
    }
  }
}
