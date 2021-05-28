import { Reference } from '@turing-machine-js/machine';

describe('Reference constructor', () => {
  test('Reference', () => {
    const reference = new Reference();

    expect(() => reference.ref)
      .toThrowError('unbounded reference');
  });
});

describe('Reference properties', () => {
  test('Reference ref', () => {
    const reference = new Reference();
    const obj = {};

    reference.bind(obj);

    expect(reference.ref)
      .toBe(obj);
  });

  test('Reference bind return the passed parameter', () => {
    const reference = new Reference();
    const obj = {};

    const returnedValue = reference.bind(obj);

    expect(returnedValue)
      .toBe(obj);
  });

  test('Reference redefine ref', () => {
    const reference = new Reference();
    const obj = {};

    reference.bind(obj);
    reference.bind({});

    expect(reference.ref)
      .toBe(obj);
  });
});
