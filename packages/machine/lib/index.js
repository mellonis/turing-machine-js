"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "default", {
  enumerable: true,
  get: function () {
    return _TuringMachine.default;
  }
});
Object.defineProperty(exports, "Alphabet", {
  enumerable: true,
  get: function () {
    return _Alphabet.default;
  }
});
Object.defineProperty(exports, "Tape", {
  enumerable: true,
  get: function () {
    return _Tape.default;
  }
});
Object.defineProperty(exports, "Command", {
  enumerable: true,
  get: function () {
    return _Command.default;
  }
});
Object.defineProperty(exports, "movements", {
  enumerable: true,
  get: function () {
    return _Command.movements;
  }
});
Object.defineProperty(exports, "symbolCommands", {
  enumerable: true,
  get: function () {
    return _Command.symbolCommands;
  }
});
Object.defineProperty(exports, "State", {
  enumerable: true,
  get: function () {
    return _State.default;
  }
});
Object.defineProperty(exports, "haltState", {
  enumerable: true,
  get: function () {
    return _State.haltState;
  }
});
Object.defineProperty(exports, "ifOtherSymbol", {
  enumerable: true,
  get: function () {
    return _State.ifOtherSymbol;
  }
});

var _TuringMachine = _interopRequireDefault(require("./classes/TuringMachine"));

var _Alphabet = _interopRequireDefault(require("./classes/Alphabet"));

var _Tape = _interopRequireDefault(require("./classes/Tape"));

var _Command = _interopRequireWildcard(require("./classes/Command"));

var _State = _interopRequireWildcard(require("./classes/State"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }