import Command from './Command';
import TapeCommand from './TapeCommand';

describe('Command constructor', () => {
  test('throws an exception on an empty array parameter', () => {
    expect(() => new Command([]))
      .toThrow('invalid parameter');
  });

  test('stores the passed TapeCommand list on .tapesCommands', () => {
    // Previously: two separate `new Command([tapeCommand])` calls — first
    // wrapped in `expect(() => ...).not.toThrow()`, second to inspect the
    // result. Single construction is enough; if the constructor throws,
    // the next assertion would fail.
    const tapeCommand = new TapeCommand({});
    const command = new Command([tapeCommand]);

    expect(command.tapesCommands).toEqual([tapeCommand]);
  });

  test('preserves the order of multiple TapeCommands', () => {
    // The original spec didn't pin order — this catches a refactor that
    // would, say, sort or reverse the input.
    const a = new TapeCommand({});
    const b = new TapeCommand({});
    const c = new TapeCommand({});
    const command = new Command([a, b, c]);

    expect(command.tapesCommands).toEqual([a, b, c]);
  });
});
