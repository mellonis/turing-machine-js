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
  s6["deleteNumberInternal"]
  s8(("deleteNumber"))
  subgraph w_7["halt frame"]
    s7[["goToNumberStart"]]
    c7(((halt)))
  end
  s6 -- "$ → ⌫/S" --> s0
  s6 -- "* → ⌫/R" --> s6
  s7 -- "^ → ·/S" --> c7
  s7 -- "* → ·/L" --> s7
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
  s9["invertNumberGoToNumberWithInversion"]
  s11(("invertNumber"))
  subgraph w_10["halt frame"]
    s10[["goToNumberStart"]]
    c10(((halt)))
  end
  s9 -- "^ → ·/R" --> s9
  s9 -- "1 → 0/R" --> s9
  s9 -- "0 → 1/R" --> s9
  s9 -- "$ → ·/S" --> s0
  s10 -- "^ → ·/S" --> c10
  s10 -- "* → ·/L" --> s10
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
  s12["normalizeNumberPutNewStartSymbol"]
  s13["normalizeNumberMoveNumberStart"]
  s15(("normalizeNumber"))
  subgraph w_14["halt frame"]
    s14[["goToNumberStart"]]
    c14(((halt)))
  end
  s1 -- "$ → ·/S" --> s0
  s1 -- "* → ·/R" --> s1
  s12 -- "- → ^/S" --> s1
  s13 -- "^|0 → ⌫/R" --> s13
  s13 -- "1|$ → ·/L" --> s12
  s14 -- "^ → ·/S" --> c14
  s14 -- "* → ·/L" --> s14
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

*20 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s1["goToNumber"]
  s9["invertNumberGoToNumberWithInversion"]
  s12["normalizeNumberPutNewStartSymbol"]
  s13["normalizeNumberMoveNumberStart"]
  s15["normalizeNumber"]
  s16["plusOneFillZeros"]
  s17["plusOneAddNumberStart"]
  s18["plusOneCaryOne"]
  s23(("minusOne"))
  subgraph w_10["halt frame"]
    s10[["goToNumberStart"]]
    c10(((halt)))
  end
  subgraph w_14["halt frame"]
    s14[["goToNumberStart"]]
    c14(((halt)))
  end
  subgraph w_20["halt frame"]
    s20[["invertNumber"]]
    c20(((halt)))
  end
  subgraph w_21["halt frame"]
    s21[["plusOne"]]
    c21(((halt)))
  end
  subgraph w_22["halt frame"]
    s22[["invertNumber"]]
    c22(((halt)))
  end
  s1 -- "$ → ·/S" --> s0
  s1 -- "* → ·/R" --> s1
  s9 -- "^ → ·/R" --> s9
  s9 -- "1 → 0/R" --> s9
  s9 -- "0 → 1/R" --> s9
  s9 -- "$ → ·/S" --> s0
  s10 -- "^ → ·/S" --> c10
  s10 -- "* → ·/L" --> s10
  s10 -. onHalt .-> s9
  s12 -- "- → ^/S" --> s1
  s13 -- "^|0 → ⌫/R" --> s13
  s13 -- "1|$ → ·/L" --> s12
  s14 -- "^ → ·/S" --> c14
  s14 -- "* → ·/L" --> s14
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
  s20 -- "^|1|0|$ → ·/S" --> s10
  s20 -- "* → ·/S" --> c20
  s20 -. onHalt .-> s15
  s21 -- "^|1|0 → ·/R" --> s21
  s21 -- "$ → ·/L" --> s18
  s21 -- "* → ·/S" --> c21
  s21 -. onHalt .-> s20
  s22 -- "^|1|0|$ → ·/S" --> s10
  s22 -- "* → ·/S" --> c22
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
  s12["normalizeNumberPutNewStartSymbol"]
  s13["normalizeNumberMoveNumberStart"]
  s15["normalizeNumber"]
  s26(("minusOneFast"))
  subgraph w_14["halt frame"]
    s14[["goToNumberStart"]]
    c14(((halt)))
  end
  subgraph w_25["halt frame"]
    s25[["minusOneFastBorrow"]]
    c25(((halt)))
  end
  s1 -- "$ → ·/S" --> s0
  s1 -- "* → ·/R" --> s1
  s12 -- "- → ^/S" --> s1
  s13 -- "^|0 → ⌫/R" --> s13
  s13 -- "1|$ → ·/L" --> s12
  s14 -- "^ → ·/S" --> c14
  s14 -- "* → ·/L" --> s14
  s14 -. onHalt .-> s13
  s15 -- "^|1|0|$ → ·/S" --> s14
  s15 -- "* → ·/S" --> s0
  s25 -- "1 → 0/S" --> c25
  s25 -- "0 → 1/L" --> s25
  s25 -- "^ → ·/S" --> c25
  s25 -. onHalt .-> s15
  s26 -- "^|1|0 → ·/R" --> s26
  s26 -- "$ → ·/L" --> s25
  s26 -- "* → ·/S" --> s0
```
