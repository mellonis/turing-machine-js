# library-binary-numbers — state graphs

## goToNumber

*2 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s1(("goToNumber"))
  s1 -- "$ → ·/S" --> s0
  s1 -- "* → ·/R" --> s1
```

## goToNextNumber

*3 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s1["goToNumber"]
  s2(("goToNextNumber"))
  s1 -- "$ → ·/S" --> s0
  s1 -- "* → ·/R" --> s1
  s2 -- "* → ·/R" --> s1
```

## goToPreviousNumber

*3 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s3["goToPreviousNumberInternal"]
  s4(("goToPreviousNumber"))
  s3 -- "$ → ·/S" --> s0
  s3 -- "* → ·/L" --> s3
  s4 -- "* → ·/L" --> s3
```

## deleteNumber

*5 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s5["goToNumberStart"]
  s6["deleteNumberInternal"]
  s7["goToNumberStart(deleteNumberInternal)"]
  s8(("deleteNumber"))
  s5 -- "^ → ·/S" --> s0
  s5 -- "* → ·/L" --> s5
  s6 -- "$ → ⌫/S" --> s0
  s6 -- "* → ⌫/R" --> s6
  s7 -- "^ → ·/S" --> s0
  s7 -- "* → ·/L" --> s5
  s7 -. onHalt .-> s6
  s8 -- "^|1|0|$ → ·/S" --> s7
  s8 -- "* → ·/S" --> s0
```

## goToNumbersStart

*2 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s5(("goToNumberStart"))
  s5 -- "^ → ·/S" --> s0
  s5 -- "* → ·/L" --> s5
```

## invertNumber

*5 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s5["goToNumberStart"]
  s9["invertNumberGoToNumberWithInversion"]
  s10["goToNumberStart(invertNumberGoToNumberWithInversion)"]
  s11(("invertNumber"))
  s5 -- "^ → ·/S" --> s0
  s5 -- "* → ·/L" --> s5
  s9 -- "^ → ·/R" --> s9
  s9 -- "1 → 0/R" --> s9
  s9 -- "0 → 1/R" --> s9
  s9 -- "$ → ·/S" --> s0
  s10 -- "^ → ·/S" --> s0
  s10 -- "* → ·/L" --> s5
  s10 -. onHalt .-> s9
  s11 -- "^|1|0|$ → ·/S" --> s10
  s11 -- "* → ·/S" --> s0
```

## normalizeNumber

*7 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s1["goToNumber"]
  s5["goToNumberStart"]
  s12["normalizeNumberPutNewStartSymbol"]
  s13["normalizeNumberMoveNumberStart"]
  s14["goToNumberStart(normalizeNumberMoveNumberStart)"]
  s15(("normalizeNumber"))
  s1 -- "$ → ·/S" --> s0
  s1 -- "* → ·/R" --> s1
  s5 -- "^ → ·/S" --> s0
  s5 -- "* → ·/L" --> s5
  s12 -- "- → ^/S" --> s1
  s13 -- "^|0 → ⌫/R" --> s13
  s13 -- "1|$ → ·/L" --> s12
  s14 -- "^ → ·/S" --> s0
  s14 -- "* → ·/L" --> s5
  s14 -. onHalt .-> s13
  s15 -- "^|1|0|$ → ·/S" --> s14
  s15 -- "* → ·/S" --> s0
```

## plusOne

*5 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s16["plusOneFillZeros"]
  s17["plusOneAddNumberStart"]
  s18["plusOneCaryOne"]
  s19(("plusOne"))
  s16 -- "1 → 0/R" --> s16
  s16 -- "$ → ·/S" --> s0
  s17 -- "- → ^/R" --> s17
  s17 -- "1 → ·/R" --> s16
  s18 -- "0 → 1/R" --> s16
  s18 -- "1 → ·/L" --> s18
  s18 -- "^ → 1/L" --> s17
  s19 -- "^|1|0 → ·/R" --> s19
  s19 -- "$ → ·/L" --> s18
  s19 -- "* → ·/S" --> s0
```

## minusOne

*17 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s1["goToNumber"]
  s5["goToNumberStart"]
  s9["invertNumberGoToNumberWithInversion"]
  s10["goToNumberStart(invertNumberGoToNumberWithInversion)"]
  s12["normalizeNumberPutNewStartSymbol"]
  s13["normalizeNumberMoveNumberStart"]
  s14["goToNumberStart(normalizeNumberMoveNumberStart)"]
  s15["normalizeNumber"]
  s16["plusOneFillZeros"]
  s17["plusOneAddNumberStart"]
  s18["plusOneCaryOne"]
  s19["plusOne"]
  s20["invertNumber(normalizeNumber)"]
  s21["plusOne(invertNumber(normalizeNumber))"]
  s22["invertNumber(plusOne(invertNumber(normalizeNumber)))"]
  s23(("minusOne"))
  s1 -- "$ → ·/S" --> s0
  s1 -- "* → ·/R" --> s1
  s5 -- "^ → ·/S" --> s0
  s5 -- "* → ·/L" --> s5
  s9 -- "^ → ·/R" --> s9
  s9 -- "1 → 0/R" --> s9
  s9 -- "0 → 1/R" --> s9
  s9 -- "$ → ·/S" --> s0
  s10 -- "^ → ·/S" --> s0
  s10 -- "* → ·/L" --> s5
  s10 -. onHalt .-> s9
  s12 -- "- → ^/S" --> s1
  s13 -- "^|0 → ⌫/R" --> s13
  s13 -- "1|$ → ·/L" --> s12
  s14 -- "^ → ·/S" --> s0
  s14 -- "* → ·/L" --> s5
  s14 -. onHalt .-> s13
  s15 -- "^|1|0|$ → ·/S" --> s14
  s15 -- "* → ·/S" --> s0
  s16 -- "1 → 0/R" --> s16
  s16 -- "$ → ·/S" --> s0
  s17 -- "- → ^/R" --> s17
  s17 -- "1 → ·/R" --> s16
  s18 -- "0 → 1/R" --> s16
  s18 -- "1 → ·/L" --> s18
  s18 -- "^ → 1/L" --> s17
  s19 -- "^|1|0 → ·/R" --> s19
  s19 -- "$ → ·/L" --> s18
  s19 -- "* → ·/S" --> s0
  s20 -- "^|1|0|$ → ·/S" --> s10
  s20 -- "* → ·/S" --> s0
  s20 -. onHalt .-> s15
  s21 -- "^|1|0 → ·/R" --> s19
  s21 -- "$ → ·/L" --> s18
  s21 -- "* → ·/S" --> s0
  s21 -. onHalt .-> s20
  s22 -- "^|1|0|$ → ·/S" --> s10
  s22 -- "* → ·/S" --> s0
  s22 -. onHalt .-> s21
  s23 -- "^|1|0 → ·/R" --> s23
  s23 -- "$ → ·/S" --> s22
  s23 -- "* → ·/S" --> s0
```

## minusOneFast

*10 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s1["goToNumber"]
  s5["goToNumberStart"]
  s12["normalizeNumberPutNewStartSymbol"]
  s13["normalizeNumberMoveNumberStart"]
  s14["goToNumberStart(normalizeNumberMoveNumberStart)"]
  s15["normalizeNumber"]
  s24["minusOneFastBorrow"]
  s25["minusOneFastBorrow(normalizeNumber)"]
  s26(("minusOneFast"))
  s1 -- "$ → ·/S" --> s0
  s1 -- "* → ·/R" --> s1
  s5 -- "^ → ·/S" --> s0
  s5 -- "* → ·/L" --> s5
  s12 -- "- → ^/S" --> s1
  s13 -- "^|0 → ⌫/R" --> s13
  s13 -- "1|$ → ·/L" --> s12
  s14 -- "^ → ·/S" --> s0
  s14 -- "* → ·/L" --> s5
  s14 -. onHalt .-> s13
  s15 -- "^|1|0|$ → ·/S" --> s14
  s15 -- "* → ·/S" --> s0
  s24 -- "1 → 0/S" --> s0
  s24 -- "0 → 1/L" --> s24
  s24 -- "^ → ·/S" --> s0
  s25 -- "1 → 0/S" --> s0
  s25 -- "0 → 1/L" --> s24
  s25 -- "^ → ·/S" --> s0
  s25 -. onHalt .-> s15
  s26 -- "^|1|0 → ·/R" --> s26
  s26 -- "$ → ·/L" --> s25
  s26 -- "* → ·/S" --> s0
```
