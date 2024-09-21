import Reference from './Reference';
import State from './State';

describe('Reference constructor', () => {
  test('Reference', () => {
    const reference = new Reference();

    expect(() => reference.ref)
      .toThrow('unbounded reference');
  });
});

describe('Reference properties', () => {
  test('Reference ref', () => {
    const reference = new Reference();
    const state = new State();

    reference.bind(state);

    expect(reference.ref)
      .toBe(state);
  });

  test('Reference bind return the passed parameter', () => {
    const reference = new Reference();
    const state = new State();

    const returnedValue = reference.bind(state);

    expect(returnedValue)
      .toBe(state);
  });

  test('Reference redefine ref', () => {
    const reference = new Reference();
    const state = new State();
    const antherState = new State();

    reference.bind(state);
    reference.bind(antherState);

    expect(reference.ref)
      .toBe(state);
  });
});
