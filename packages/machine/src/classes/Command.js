import TapeCommand from './TapeCommand';

export default class Command {
  #tapeCommandList;

  constructor(tapeCommandList) {
    this.#tapeCommandList = tapeCommandList;

    if (!Array.isArray(this.#tapeCommandList)) {
      throw new Error('invalid parameter');
    }

    if (this.#tapeCommandList.length === 0) {
      throw new Error('invalid parameter');
    }

    if (this.#tapeCommandList.some(tapeCommand => !(tapeCommand instanceof TapeCommand))) {
      throw new Error('invalid tapeCommand');
    }
  }

  get tapeCommandList() {
    return [...this.#tapeCommandList];
  }
}
