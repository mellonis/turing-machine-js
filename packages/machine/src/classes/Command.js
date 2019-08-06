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

    try {
      this.#tapeCommandList = this.#tapeCommandList.map((tapeCommand) => {
        let finalTapeCommand;

        if (!(tapeCommand instanceof TapeCommand)) {
          if (
            !Object.prototype.hasOwnProperty.call(tapeCommand, 'movement')
            && !Object.prototype.hasOwnProperty.call(tapeCommand, 'symbol')
          ) {
            throw new Error('invalid tapeCommand');
          }

          finalTapeCommand = new TapeCommand(tapeCommand);
        } else {
          finalTapeCommand = tapeCommand;
        }

        return finalTapeCommand;
      });
    } catch (e) {
      throw new Error('invalid tapeCommand');
    }
  }

  get tapeCommandList() {
    return [...this.#tapeCommandList];
  }
}
