import TapeCommand from './TapeCommand';

export default class Command {
  readonly #tapesCommands: TapeCommand[];

  constructor(tapesCommands: TapeCommand[] | ConstructorParameters<typeof TapeCommand>[0][]) {
    if (tapesCommands.length === 0) {
      throw new Error('invalid parameter');
    }

    try {
      this.#tapesCommands = tapesCommands.map((tapeCommand) => {
        if (tapeCommand instanceof TapeCommand) {
          return tapeCommand;
        }

        return new TapeCommand(tapeCommand);
      });
    } catch (error) {
      void error;
      throw new Error('invalid tapeCommand');
    }
  }

  get tapesCommands() {
    return [...this.#tapesCommands];
  }
}
