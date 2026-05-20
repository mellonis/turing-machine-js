# library-binary-numbers — state graphs

## goToNumber

*2 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s1["goToNumber"]
  idle([idle])
  idle -. enter .-> s1
  s1 -- "'$' → K/S" --> s0
  s1 -- "* → K/R" --> s1
```

## goToNextNumber

*3 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s1["goToNumber"]
  s2["goToNextNumber"]
  idle([idle])
  idle -. enter .-> s2
  s1 -- "'$' → K/S" --> s0
  s1 -- "* → K/R" --> s1
  s2 -- "* → K/R" --> s1
```

## goToPreviousNumber

*3 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s3["goToPreviousNumberInternal"]
  s4["goToPreviousNumber"]
  idle([idle])
  idle -. enter .-> s4
  s3 -- "'$' → K/S" --> s0
  s3 -- "* → K/L" --> s3
  s4 -- "* → K/L" --> s3
```

## deleteNumber

*4 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s6["deleteNumberInternal"]
  s8["deleteNumber"]
  idle([idle])
  subgraph w_7["halt frame"]
    s7[["goToNumberStart"]]
    c7(((halt)))
  end
  idle -. enter .-> s8
  s6 -- "'$' → E/S" --> s0
  s6 -- "* → E/R" --> s6
  s7 -- "'^' → K/S" --> c7
  s7 -- "* → K/L" --> s7
  s7 -. onHalt .-> s6
  s8 -- "'^'|'1'|'0'|'$' → K/S" --> s7
  s8 -- "* → K/S" --> s0
```

## goToNumbersStart

*2 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s5["goToNumberStart"]
  idle([idle])
  idle -. enter .-> s5
  s5 -- "'^' → K/S" --> s0
  s5 -- "* → K/L" --> s5
```

## invertNumber

*4 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s9["invertNumberGoToNumberWithInversion"]
  s11["invertNumber"]
  idle([idle])
  subgraph w_10["halt frame"]
    s10[["goToNumberStart"]]
    c10(((halt)))
  end
  idle -. enter .-> s11
  s9 -- "'^' → K/R" --> s9
  s9 -- "'1' → '0'/R" --> s9
  s9 -- "'0' → '1'/R" --> s9
  s9 -- "'$' → K/S" --> s0
  s10 -- "'^' → K/S" --> c10
  s10 -- "* → K/L" --> s10
  s10 -. onHalt .-> s9
  s11 -- "'^'|'1'|'0'|'$' → K/S" --> s10
  s11 -- "* → K/S" --> s0
```

## normalizeNumber

*6 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s1["goToNumber"]
  s12["normalizeNumberPutNewStartSymbol"]
  s13["normalizeNumberMoveNumberStart"]
  s15["normalizeNumber"]
  idle([idle])
  subgraph w_14["halt frame"]
    s14[["goToNumberStart"]]
    c14(((halt)))
  end
  idle -. enter .-> s15
  s1 -- "'$' → K/S" --> s0
  s1 -- "* → K/R" --> s1
  s12 -- "- → '^'/S" --> s1
  s13 -- "'^'|'0' → E/R" --> s13
  s13 -- "'1'|'$' → K/L" --> s12
  s14 -- "'^' → K/S" --> c14
  s14 -- "* → K/L" --> s14
  s14 -. onHalt .-> s13
  s15 -- "'^'|'1'|'0'|'$' → K/S" --> s14
  s15 -- "* → K/S" --> s0
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
  s19["plusOne"]
  idle([idle])
  idle -. enter .-> s19
  s16 -- "'1' → '0'/R" --> s16
  s16 -- "'$' → K/S" --> s0
  s17 -- "- → '^'/R" --> s17
  s17 -- "'1' → K/R" --> s16
  s18 -- "'0' → '1'/R" --> s16
  s18 -- "'1' → K/L" --> s18
  s18 -- "'^' → '1'/L" --> s17
  s19 -- "'^'|'1'|'0' → K/R" --> s19
  s19 -- "'$' → K/L" --> s18
  s19 -- "* → K/S" --> s0
```

## minusOne

*15 states (including `haltState`)*

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
  s23["minusOne"]
  idle([idle])
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
  idle -. enter .-> s23
  s1 -- "'$' → K/S" --> s0
  s1 -- "* → K/R" --> s1
  s9 -- "'^' → K/R" --> s9
  s9 -- "'1' → '0'/R" --> s9
  s9 -- "'0' → '1'/R" --> s9
  s9 -- "'$' → K/S" --> s0
  s10 -- "'^' → K/S" --> c10
  s10 -- "* → K/L" --> s10
  s10 -. onHalt .-> s9
  s12 -- "- → '^'/S" --> s1
  s13 -- "'^'|'0' → E/R" --> s13
  s13 -- "'1'|'$' → K/L" --> s12
  s14 -- "'^' → K/S" --> c14
  s14 -- "* → K/L" --> s14
  s14 -. onHalt .-> s13
  s15 -- "'^'|'1'|'0'|'$' → K/S" --> s14
  s15 -- "* → K/S" --> s0
  s16 -- "'1' → '0'/R" --> s16
  s16 -- "'$' → K/S" --> s0
  s17 -- "- → '^'/R" --> s17
  s17 -- "'1' → K/R" --> s16
  s18 -- "'0' → '1'/R" --> s16
  s18 -- "'1' → K/L" --> s18
  s18 -- "'^' → '1'/L" --> s17
  s20 -- "'^'|'1'|'0'|'$' → K/S" --> s10
  s20 -- "* → K/S" --> c20
  s20 -. onHalt .-> s15
  s21 -- "'^'|'1'|'0' → K/R" --> s21
  s21 -- "'$' → K/L" --> s18
  s21 -- "* → K/S" --> c21
  s21 -. onHalt .-> s20
  s22 -- "'^'|'1'|'0'|'$' → K/S" --> s10
  s22 -- "* → K/S" --> c22
  s22 -. onHalt .-> s21
  s23 -- "'^'|'1'|'0' → K/R" --> s23
  s23 -- "'$' → K/S" --> s22
  s23 -- "* → K/S" --> s0
```

## minusOneFast

*8 states (including `haltState`)*

```mermaid
flowchart TD
%% alphabets: [[" ","^","$","0","1"]]
  s0(((halt)))
  s1["goToNumber"]
  s12["normalizeNumberPutNewStartSymbol"]
  s13["normalizeNumberMoveNumberStart"]
  s15["normalizeNumber"]
  s26["minusOneFast"]
  idle([idle])
  subgraph w_14["halt frame"]
    s14[["goToNumberStart"]]
    c14(((halt)))
  end
  subgraph w_25["halt frame"]
    s25[["minusOneFastBorrow"]]
    c25(((halt)))
  end
  idle -. enter .-> s26
  s1 -- "'$' → K/S" --> s0
  s1 -- "* → K/R" --> s1
  s12 -- "- → '^'/S" --> s1
  s13 -- "'^'|'0' → E/R" --> s13
  s13 -- "'1'|'$' → K/L" --> s12
  s14 -- "'^' → K/S" --> c14
  s14 -- "* → K/L" --> s14
  s14 -. onHalt .-> s13
  s15 -- "'^'|'1'|'0'|'$' → K/S" --> s14
  s15 -- "* → K/S" --> s0
  s25 -- "'1' → '0'/S" --> c25
  s25 -- "'0' → '1'/L" --> s25
  s25 -- "'^' → K/S" --> c25
  s25 -. onHalt .-> s15
  s26 -- "'^'|'1'|'0' → K/R" --> s26
  s26 -- "'$' → K/L" --> s25
  s26 -- "* → K/S" --> s0
```
