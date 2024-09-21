import Command from './Command';
import TapeCommand from './TapeCommand';

describe('Command constructor', () => {
  test('throws an exception on an empty array parameter', () => {
    expect(() => new Command([]))
      .toThrow('invalid parameter');
  });

  test('valid tapeCommand', () => {
    const tapeCommand = new TapeCommand({});

    expect(() => new Command([
      tapeCommand,
    ]))
      .not
      .toThrow();

    expect(new Command([
      tapeCommand,
    ]).tapesCommands)
      .toEqual([tapeCommand]);
  });
});
