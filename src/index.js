import TuringMachine from './classes/TuringMachine';
import Alphabet from './classes/Alphabet';
import Tape from './classes/Tape';
import Command, { movements, symbolCommands } from './classes/Command';
import State, { haltState, ifOtherSymbol } from './classes/State';

export {
  TuringMachine as default,
  Tape,
  Alphabet,
  Command,
  State,
  haltState,
  ifOtherSymbol,
  movements,
  symbolCommands,
};
