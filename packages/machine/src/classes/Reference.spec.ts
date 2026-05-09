import Reference from './Reference';
import State from './State';

describe('Reference', () => {
  describe('unbounded behavior', () => {
    test('reading .ref before bind throws "unbounded reference"', () => {
      const reference = new Reference();

      expect(() => reference.ref).toThrow('unbounded reference');
    });
  });

  describe('first bind', () => {
    test('stores the state so .ref returns it', () => {
      const reference = new Reference();
      const state = new State();

      reference.bind(state);

      expect(reference.ref).toBe(state);
    });

    test('returns the bound state', () => {
      const reference = new Reference();
      const state = new State();

      const returned = reference.bind(state);

      expect(returned).toBe(state);
    });
  });

  describe('subsequent binds (sticky — first binding wins)', () => {
    // The previous spec called this "redefine ref" but the source's bind is
    // sticky: the second bind() is a no-op and the original binding is kept.
    // Pin that contract explicitly.

    test('second bind() does not replace the existing binding', () => {
      const reference = new Reference();
      const first = new State();
      const second = new State();

      reference.bind(first);
      reference.bind(second);

      expect(reference.ref).toBe(first);
      expect(reference.ref).not.toBe(second);
    });

    test('second bind() returns the EXISTING binding, not the passed argument', () => {
      // This was the subtle case the previous "Reference bind return the passed
      // parameter" test under-asserted. The first bind happens to satisfy that
      // claim, but it's not the contract — the contract is "return the current
      // binding."
      const reference = new Reference();
      const first = new State();
      const second = new State();

      reference.bind(first);
      const returnedFromSecond = reference.bind(second);

      expect(returnedFromSecond).toBe(first);
      expect(returnedFromSecond).not.toBe(second);
    });
  });

  describe('.ref idempotence', () => {
    test('reading .ref multiple times returns the same instance', () => {
      const reference = new Reference();
      const state = new State();

      reference.bind(state);

      expect(reference.ref).toBe(reference.ref);
    });
  });
});
