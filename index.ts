import fs from "node:fs";
// Example file contents (displayed in-game bottom-to-top):
// 1110000007jeqic
// 1100000007addic
// 1010000007jeqia
// 1000000007addia
// 0110000007jeqib
// 0100000007addib
// 0010010107jgteq
// 0010010007jgt
// 0010001107jlteq
// 0010000107jneq
// 0010000107jlt
// 0010000007jeq
// 0000010107xor
// 0000010007not
// 0000001107or
// 0000001007and
// 0000000107sub
// 0000000007add
//
//
// Explained:
//
// opcode bits               name        name      name
// (2 indicates ANY)         start idx   end idx
// 11100000                  0           7         jeqic
// 11000000                  0           7         addic
// 10100000                  0           7         jeqia
// 10000000                  0           7         addia
// 01100000                  0           7         jeqib
// 01000000                  0           7         addib
// 00100101                  0           7         jgteq
// 00100100                  0           7         jgt
// 00100011                  0           7         jlteq
// 00100001                  0           7         jneq
// 00100001                  0           7         jlt
// 00100000                  0           7         jeq
// 00000101                  0           7         xor
// 00000100                  0           7         not
// 00000011                  0           7         or
// 00000010                  0           7         and
// 00000001                  0           7         sub
// 00000000                  0           7         add

const instructions = `
2212222222COND
2122222211I_ARG2
2001222233MEM
1222222200I_ARG1
1110010137jgteqi12
1110010037jgti12
1110001137jlteqi12
1110001037jlti12
1110000137jneqi12
1110000037jeqi12
1100011157shli12
1100011057shri12
1100010157xori12
1100001157ori12
1100001057andi12
1100000157subi12
1100000057addi12
1010010137jgteqi1
1010010037jgti1
1010001137jlteqi1
1010001037jlti1
1010000137jneqi1
1010000037jeqi1
1001000147writei1
1001000047readi1
1000011157shli1
1000011057shri1
1000010157xori1
1000010057noti1
1000001157ori1
1000001057andi1
1000000157subi1
1000000057addi1
0110010137jgteqi2
0110010037jgti2
0110001137jlteqi2
0110001037jlti2
0110000137jneqi2
0110000037jeqi2
0100011157shli2
0100011057shri2
0100010157xori2
0100001157ori2
0100001057andi2
0100000157subi2
0100000057addi2
0010010137jgteq
0010010037jgt
0010001137jlteq
0010001037jlt
0010000137jneq
0010000037jeq
0001001147push
0001001047pop
0001000147write
0001000047read
0000011157shl
0000011057shr
0000010157xor
0000010057not
0000001157or
0000001057and
0000000157sub
0000000057add
`;

interface Instruction {
  opcodeBits: string;
  nameStartIndex: number;
  nameEndIndex: number;
  name: string;
}

const ImmediateMode = {
  ARG1_IMMEDIATE: "i1",
  ARG2_IMMEDIATE: "i2",
  BOTH_ARGS_IMMEDIATE: "i12",
} as const;

type ImmediateMode = (typeof ImmediateMode)[keyof typeof ImmediateMode];

const modes: ImmediateMode[] = [
  ImmediateMode.ARG1_IMMEDIATE,
  ImmediateMode.ARG2_IMMEDIATE,
  ImmediateMode.BOTH_ARGS_IMMEDIATE,
];

const modeToBits: Record<ImmediateMode, string[]> = {
  [ImmediateMode.ARG1_IMMEDIATE]: ["1", "0"],
  [ImmediateMode.ARG2_IMMEDIATE]: ["0", "1"],
  [ImmediateMode.BOTH_ARGS_IMMEDIATE]: ["1", "1"],
};

const immediateModeClone = (
  i: Instruction,
  mode: ImmediateMode
): Instruction => {
  const bits = i.opcodeBits.split("");

  const modeBits = modeToBits[mode];
  bits[0] = modeBits[0];
  bits[1] = modeBits[1];

  return {
    ...i,
    opcodeBits: bits.join(""),
    name: i.name + mode,
  };
};

const deserializeInstructionFromRules = (line: string): Instruction => {
  const opcodeBits = line.slice(0, 8);
  const nameStartIndex = parseInt(line.slice(8, 9), 10);
  const nameEndIndex = parseInt(line.slice(9, 10), 10);
  const name = line.slice(10);
  return { opcodeBits, nameStartIndex, nameEndIndex, name };
};

const serializeInstructionToRules = ({
  opcodeBits,
  nameStartIndex,
  nameEndIndex,
  name,
}: Instruction): string =>
  [opcodeBits, nameStartIndex, nameEndIndex, name].join("");

const serializeInstructionToAsm = ({
  opcodeBits,
  name,
}: Instruction): string => {
  if (opcodeBits.includes("2")) {
    throw new Error(`cannot turn opcode with wildcard to asm: ${opcodeBits}`);
  }

  const value = Number.parseInt(opcodeBits, 2);
  return `${name} ${value.toString(10)}`;
};

const readFileInstructions = (input: string): Instruction[] => {
  return input
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => !!l)
    .map((instr) => deserializeInstructionFromRules(instr))
    .reverse();
};

const stringifyFileInstructionsForFile = (instr: Instruction[]) => {
  return instr.map(serializeInstructionToRules).join("\n");
};

const getInstructionImmediateModes = ({
  name,
}: Instruction): ImmediateMode[] => {
  switch (name) {
    case "read":
    case "pop":
      return [];
    // these only use first argument, don't add ib/ic modes which
    // allow using second argument as immediate mode arg
    case "not":
    case "write":
    case "push":
      return [ImmediateMode.ARG1_IMMEDIATE];
    default:
      return modes;
  }
};

const addImmediateModeClones = (i: Instruction): Instruction[] => {
  if (i.opcodeBits.includes("2")) {
    // don't add suffixes for wildcard instrs
    return [i];
  }
  const modesToAdd: ImmediateMode[] = getInstructionImmediateModes(i).filter(
    (a) => a.length > 0
  );
  return [i, ...modesToAdd.map((mode) => immediateModeClone(i, mode))];
};

const instr = readFileInstructions(instructions)
  // filter away already immediate mode instructions we've generated
  .filter(({ name }) => !/i(12|1|2)$/.test(name))
  .map((i) => ({
    ...i,
    // lowercase except if opcode bits has 2 (it's a mask for presentational purposes)
    name: i.opcodeBits.includes("2") ? i.name : i.name.toLowerCase(),
  }))
  .flatMap(addImmediateModeClones);

const instructionRulesContent = stringifyFileInstructionsForFile(instr);

fs.writeFileSync("./instruction_rules.data", instructionRulesContent, "utf-8");

let asmContent = instr
  .filter(({ opcodeBits }) => !opcodeBits.includes("2"))
  .map((i) => serializeInstructionToAsm(i))
  .join("\n");
asmContent += `
R0 0
R1 1
R2 2
R3 3
R4 4
R5 5
COUNTER 6
INPUT 7
OUTPUT 7
_ 0
`;

fs.writeFileSync("./assembly.data", asmContent, "utf-8");
