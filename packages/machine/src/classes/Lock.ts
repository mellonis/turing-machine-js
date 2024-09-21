export default class Lock {
  #lockSymbol: symbol | null = null;

  lock(symbol: symbol) {
    if (this.#lockSymbol === null) {
      this.#lockSymbol = symbol;
    }
  }

  unlock(symbol: symbol) {
    if (this.#lockSymbol === symbol) {
      this.#lockSymbol = null;
    }
  }

  check(symbol: symbol | null) {
    if (this.#lockSymbol && this.#lockSymbol !== symbol) {
      throw new Error('Lock check failed');
    }
  }
}
