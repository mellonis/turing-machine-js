import TuringMachine, {
  Tape,
  Alphabet,
  Command,
  State,
  haltState,
  ifOtherSymbol,
  movements,
  symbolCommands,
} from './TuringMachine';
import binaryNumbers from './std/binaryNumbers';

const std = {
  binaryNumbers,
};

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
  std,
};
