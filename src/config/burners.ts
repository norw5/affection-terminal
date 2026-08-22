// Known ecosystem contracts that hold or burn AFFECTION (Ⓐ) — the market-rate sinks of the
// Dysnomia token family (see affection_docs/06_burning_and_sinks.md). The tracked set is a
// community-provided lead, not ground truth; what IS verifiable on-chain is how much Ⓐ each
// contract currently holds (balanceOf), which the `useBurnerBalances` hook reads in parallel.
// A contract holding Ⓐ may burn it (ERC20Burnable) or simply hold it (a soft sink) — the live
// balance is "held/locked", not necessarily "permanently burned". Static per-contract burn
// amounts are deliberately NOT kept here; the burn scan (useBurns) computes those from log
// events.
//
// To add/remove an entry, edit this file. Addresses are checksummed on load.
import { type Address, getAddress } from "viem";

export type BurnerEntry = {
  name: string;
  symbol?: string;
  address: Address;
};

const RAW: Array<Omit<BurnerEntry, "address"> & { address: string }> = [
  {
    name: "ICU",
    symbol: "ICU",
    address: "0x5de2624784ff1a95612e376470f5dda6a8d705b7",
  },
  {
    name: "Tetratricopeptides",
    symbol: "ZHENG",
    address: "0x5f16f6c242e038437a7ba3c903dfedb747db4a5c",
  },
  {
    name: "CHATLOG Shio",
    symbol: "SHIO",
    address: "0xe843765114992e18061498aed708537ce9d924fa",
  },
  {
    name: "DYSNOMIA Qi",
    symbol: "QI",
    address: "0x4d9ce396be95dbc5f71808c38107eb7422fd9a03",
  },
  {
    name: "Dysnomia Cheon",
    symbol: "CHEON",
    address: "0x3d23084ca3f40465553797b5138cfc456e61fb5d",
  },
  {
    name: "Dysnomia Chan",
    symbol: "CHAN",
    address: "0xe250bf9729076b14a8399794b61c72d0f4aefcd8",
  },
  {
    name: "CHATLOG Void",
    symbol: "VOID",
    address: "0x965b0d74591bf30327075a247c47dbf487dcff08",
  },
  {
    name: "DYSNOMIA ReactionsLib",
    symbol: "ReactionsLib",
    address: "0x8704d7740735f6dea0103366fe297ba3f9fcacc4",
  },
  {
    name: "Dysnomia Cho Rod",
    symbol: "CHOROD",
    address: "0x6337de87de564dd9a79789afa43afad52702d00a",
  },
  {
    name: "Yang Rod",
    symbol: "MROD",
    address: "0xbb87fc6ba3d62b86f1ad1fae8e9c410792ef1457",
  },
  {
    name: "Shio Rod",
    symbol: "SROD",
    address: "0xe933f32bc3250c18a69f77775652e5c473c77f23",
  },
  {
    name: "Yi Shio Cone",
    symbol: "ZCONE",
    address: "0xa653bf4dbaf08898a394104aa53df9ef4ae7d0f4",
  },
  {
    name: "Dysnomia Hecke",
    symbol: "HECKE",
    address: "0x29a924d9b0233026b9844f2afeb202f1791d7593",
  },
  {
    name: "PP4000 QING",
    symbol: "qA",
    address: "0xd11f6892e2d7df8422fba01680ec8c7cd7d28457",
  },
  {
    name: "CHATLOG Shio (2)",
    symbol: "SHIO",
    address: "0xf6c50ffe7efbdee63a92e52a4d5e9aff7fb4a4d7",
  },
  {
    name: "Dysnomia Chao",
    symbol: "CHOA",
    address: "0x0f5a352fd4ca4850c2099c15b3600ff085b66197",
  },
  {
    name: "CHATLOG Zheng",
    symbol: "ZHENG",
    address: "0x24e62c39e34d7fe2b7df1162e1344eb6eb3b3e15",
  },
  {
    name: "CHATLOG Zhou",
    symbol: "ZHOU",
    address: "0x5cc318d0c01fed5942b5ed2f53db07727d36e261",
  },
  {
    name: "Dysnomia MAI",
    symbol: "MAI",
    address: "0xc48b0a4e79ef302c8eb5be71f562d08fb8e6a3d8",
  },
  {
    name: "Dysnomia Cho",
    symbol: "CHO",
    address: "0xb6be11f0a788014c1f68c92f8d6ccc1abf78f2ab",
  },
  {
    name: "CHATLOG Shio (3)",
    symbol: "SHIO",
    address: "0x7ae73c498a308247be73688c09c96b3fd06ddb84",
  },
  {
    name: "Dysnomia Xie",
    symbol: "XIE",
    address: "0x4df51741f2926525a21bf63e4769ba70633d2792",
  },
  {
    name: "Yang Cone",
    symbol: "MCONE",
    address: "0x24b5e500915aeafa0d2aabd82484cbac41dc976d",
  },
  {
    name: "Dysnomia Sei",
    symbol: "SEI",
    address: "0x3dc54d46e030c42979f33c9992348a990acb6067",
  },
  {
    name: "Dysnomia Pang",
    symbol: "PANG",
    address: "0xee25ccd41671f3b67d660cf6532085586aec8457",
  },
  {
    name: "Zheng Rod",
    symbol: "ZROD",
    address: "0x1e252e64feee09c31e7815f6c5752a3b5cc91c3d",
  },
  {
    name: "Dysnomia Zi",
    symbol: "ZI",
    address: "0xcbadd3c3957bd9d6c036863cb053feccf3d53338",
  },
  {
    name: "CHATLOG LibAttribute",
    symbol: "LibAttribute",
    address: "0x529e3e15da19c7c828f9cce13c53f7031a30ec7c",
  },
  {
    name: "ICU (2)",
    symbol: "ICU",
    address: "0xb84255e86449aafcf93644f39c40903005c3f19b",
  },
  {
    name: "CHATLOG Siu",
    symbol: "SIU",
    address: "0x43136735603d4060f226c279613a4dd97146937c",
  },
  {
    name: "AFFECTION QING",
    symbol: "qAFF",
    address: "0xfb1d79843b4be8c9fc244f54ee965d051261bb4b",
  },
  {
    name: "Dysnomia Xia",
    symbol: "XIA",
    address: "0x7f4a4dd4a6f233d2d82be38b2f9fc0fef46f25fa",
  },
  {
    name: "CHATLOG Shio (4)",
    symbol: "SHIO",
    address: "0x2674633df0f3061f16033e5f2503c7d53cc04be0",
  },
];

export const BURNERS: BurnerEntry[] = RAW.map((e) => ({ ...e, address: getAddress(e.address) }));
