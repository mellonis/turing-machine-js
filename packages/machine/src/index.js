import TuringMachine from './classes/TuringMachine';
import Alphabet from './classes/Alphabet';
import Tape from './classes/Tape';
import Command, { movements, symbolCommands } from './classes/Command';
import State, { haltState, ifOtherSymbol } from './classes/State';
import { Reference } from './utilities/classes';

export {
  TuringMachine as default,
  Alphabet,
  Command,
  Reference,
  State,
  Tape,
  haltState,
  ifOtherSymbol,
  movements,
  symbolCommands,
};
