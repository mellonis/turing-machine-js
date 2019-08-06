import TuringMachine from './classes/TuringMachine';
import Alphabet from './classes/Alphabet';
import Tape from './classes/Tape';
import TapeCommand, { movements, symbolCommands } from './classes/TapeCommand';
import State, { haltState, ifOtherSymbol } from './classes/State';
import Reference from './classes/Reference';
import TapeBlock from './classes/TapeBlock';
import Command from './classes/Command';

export {
  TuringMachine as default,
  Alphabet,
  Command,
  Reference,
  State,
  Tape,
  TapeBlock,
  TapeCommand,
  haltState,
  ifOtherSymbol,
  movements,
  symbolCommands,
};
