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
  s1 -- "'$' → K/⇹" --> s0
  s1 -- "∗ → K/→" --> s1
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
  s1 -- "'$' → K/⇹" --> s0
  s1 -- "∗ → K/→" --> s1
  s2 -- "∗ → K/→" --> s1
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
  s3 -- "'$' → K/⇹" --> s0
  s3 -- "∗ → K/←" --> s3
  s4 -- "∗ → K/←" --> s3
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
  s6 -- "'$' → E/⇹" --> s0
  s6 -- "∗ → E/→" --> s6
  s7 -- "'^' → K/⇹" --> c7
  s7 -- "∗ → K/←" --> s7
  s7 -. onHalt .-> s6
  s8 -- "'^'|'1'|'0'|'$' → K/⇹" --> s7
  s8 -- "∗ → K/⇹" --> s0
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
  s5 -- "'^' → K/⇹" --> s0
  s5 -- "∗ → K/←" --> s5
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
  s9 -- "'^' → K/→" --> s9
  s9 -- "'1' → '0'/→" --> s9
  s9 -- "'0' → '1'/→" --> s9
  s9 -- "'$' → K/⇹" --> s0
  s10 -- "'^' → K/⇹" --> c10
  s10 -- "∗ → K/←" --> s10
  s10 -. onHalt .-> s9
  s11 -- "'^'|'1'|'0'|'$' → K/⇹" --> s10
  s11 -- "∗ → K/⇹" --> s0
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
  s1 -- "'$' → K/⇹" --> s0
  s1 -- "∗ → K/→" --> s1
  s12 -- "- → '^'/⇹" --> s1
  s13 -- "'^'|'0' → E/→" --> s13
  s13 -- "'1'|'$' → K/←" --> s12
  s14 -- "'^' → K/⇹" --> c14
  s14 -- "∗ → K/←" --> s14
  s14 -. onHalt .-> s13
  s15 -- "'^'|'1'|'0'|'$' → K/⇹" --> s14
  s15 -- "∗ → K/⇹" --> s0
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
  s16 -- "'1' → '0'/→" --> s16
  s16 -- "'$' → K/⇹" --> s0
  s17 -- "- → '^'/→" --> s17
  s17 -- "'1' → K/→" --> s16
  s18 -- "'0' → '1'/→" --> s16
  s18 -- "'1' → K/←" --> s18
  s18 -- "'^' → '1'/←" --> s17
  s19 -- "'^'|'1'|'0' → K/→" --> s19
  s19 -- "'$' → K/←" --> s18
  s19 -- "∗ → K/⇹" --> s0
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
  s1 -- "'$' → K/⇹" --> s0
  s1 -- "∗ → K/→" --> s1
  s9 -- "'^' → K/→" --> s9
  s9 -- "'1' → '0'/→" --> s9
  s9 -- "'0' → '1'/→" --> s9
  s9 -- "'$' → K/⇹" --> s0
  s10 -- "'^' → K/⇹" --> c10
  s10 -- "∗ → K/←" --> s10
  s10 -. onHalt .-> s9
  s12 -- "- → '^'/⇹" --> s1
  s13 -- "'^'|'0' → E/→" --> s13
  s13 -- "'1'|'$' → K/←" --> s12
  s14 -- "'^' → K/⇹" --> c14
  s14 -- "∗ → K/←" --> s14
  s14 -. onHalt .-> s13
  s15 -- "'^'|'1'|'0'|'$' → K/⇹" --> s14
  s15 -- "∗ → K/⇹" --> s0
  s16 -- "'1' → '0'/→" --> s16
  s16 -- "'$' → K/⇹" --> s0
  s17 -- "- → '^'/→" --> s17
  s17 -- "'1' → K/→" --> s16
  s18 -- "'0' → '1'/→" --> s16
  s18 -- "'1' → K/←" --> s18
  s18 -- "'^' → '1'/←" --> s17
  s20 -- "'^'|'1'|'0'|'$' → K/⇹" --> s10
  s20 -- "∗ → K/⇹" --> c20
  s20 -. onHalt .-> s15
  s21 -- "'^'|'1'|'0' → K/→" --> s21
  s21 -- "'$' → K/←" --> s18
  s21 -- "∗ → K/⇹" --> c21
  s21 -. onHalt .-> s20
  s22 -- "'^'|'1'|'0'|'$' → K/⇹" --> s10
  s22 -- "∗ → K/⇹" --> c22
  s22 -. onHalt .-> s21
  s23 -- "'^'|'1'|'0' → K/→" --> s23
  s23 -- "'$' → K/⇹" --> s22
  s23 -- "∗ → K/⇹" --> s0
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
  s1 -- "'$' → K/⇹" --> s0
  s1 -- "∗ → K/→" --> s1
  s12 -- "- → '^'/⇹" --> s1
  s13 -- "'^'|'0' → E/→" --> s13
  s13 -- "'1'|'$' → K/←" --> s12
  s14 -- "'^' → K/⇹" --> c14
  s14 -- "∗ → K/←" --> s14
  s14 -. onHalt .-> s13
  s15 -- "'^'|'1'|'0'|'$' → K/⇹" --> s14
  s15 -- "∗ → K/⇹" --> s0
  s25 -- "'1' → '0'/⇹" --> c25
  s25 -- "'0' → '1'/←" --> s25
  s25 -- "'^' → K/⇹" --> c25
  s25 -. onHalt .-> s15
  s26 -- "'^'|'1'|'0' → K/→" --> s26
  s26 -- "'$' → K/←" --> s25
  s26 -- "∗ → K/⇹" --> s0
```
