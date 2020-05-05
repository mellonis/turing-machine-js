import buildMachine from '@turing-machine-js/builder';
import TuringMachine, { Tape } from '@turing-machine-js/machine';

describe('buildMachine', () => {
  test('copyString', () => {
    function parse(stateDeclarations) {
      const states = {};
      const qq = /\((.*?),(.*?)\)->\((.*?),(.*?),(.*?)\);/g;
      let match;

      // eslint-disable-next-line no-cond-assign
      while (match = qq.exec(stateDeclarations)) {
        const [, stateName, currentSymbol, nextStateName, nextSymbol, nextMovement] = match;

        if (!Object.prototype.hasOwnProperty.call(states, stateName)) {
          states[stateName] = {};
        }

        states[stateName][currentSymbol] = {
          symbol: nextSymbol,
          movement: (['L', 'R'].indexOf(nextMovement) >= 0 ? nextMovement : 'S'),
          state: nextStateName,
        };
      }

      return states;
    }

    const [machine, machineInitialState] = buildMachine({
      alphabetString: '_01XY#',
      initialState: 'Q8',
      finalStateList: ['Q5'],
      states: parse(`
        (Q8,#)->(Q6,#,R);
        (Q6,0)->(Q0,X,R);
        (Q0,0)->(Q0,0,R);
        (Q6,1)->(Q1,Y,R);
        (Q1,0)->(Q1,0,R);
        (Q0,1)->(Q0,1,R);
        (Q0,#)->(Q0,#,R);
        (Q0,_)->(Q7,0,L);
        (Q1,1)->(Q1,1,R);
        (Q1,#)->(Q1,#,R);
        (Q1,_)->(Q7,1,L);
        (Q7,0)->(Q7,0,L);
        (Q7,1)->(Q7,1,L);
        (Q7,#)->(Q7,#,L);
        (Q7,X)->(Q6,X,R);
        (Q7,Y)->(Q6,Y,R);
        (Q6,#)->(Q2,#,R);
        (Q2,0)->(Q2,0,R);
        (Q2,1)->(Q2,1,R);
        (Q2,_)->(Q3,#,L);
        (Q3,0)->(Q3,0,L);
        (Q3,1)->(Q3,1,L);
        (Q3,#)->(Q4,#,L);
        (Q4,X)->(Q4,0,L);
        (Q4,Y)->(Q4,1,L);
        (Q4,#)->(Q5,#,R);
      `),
    });

    expect(machine instanceof TuringMachine)
      .toBe(true);

    machine.tapeBlock.replaceTape(new Tape({
      alphabet: machine.tapeBlock.alphabetList[0],
      symbolList: '#011#'.split(''),
    }));

    expect(machine.tapeBlock.tapeList[0].symbolList)
      .toEqual('#011#'.split(''));

    machine.run({
      initialState: machineInitialState,
      stepsLimit: 100,
    });

    expect(machine.tapeBlock.tapeList[0].symbolList)
      .toEqual('#011#011#'.split(''));
  });
});
