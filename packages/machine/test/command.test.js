import { Command, TapeCommand, haltState } from '@turing-machine-js/machine';

describe('Command constructor', () => {
  test('throws an exception on empty parameter', () => {
    expect(() => new Command())
      .toThrow('invalid parameter');
  });

  test('throws an exception on non array parameter', () => {
    expect(() => new Command('some value'))
      .toThrow('invalid parameter');
  });

  test('throws an exception on an empty array parameter', () => {
    expect(() => new Command([]))
      .toThrow('invalid parameter');
  });

  test('throws an exception on invalid tapeCommand', () => {
    expect(() => new Command(['some value']))
      .toThrow('invalid tapeCommand');
  });

  test('valid tapeCommand', () => {
    const tapeCommand = new TapeCommand({
      nextState: haltState,
    });

    expect(() => new Command([
      tapeCommand,
    ]))
      .not
      .toThrow();

    expect(new Command([
      tapeCommand,
    ]).tapeCommandList)
      .toEqual([tapeCommand]);
  });
});
