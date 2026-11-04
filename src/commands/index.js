import account from "./account.js";
import { addtime, ban, forcereset, removetime, unban } from "./accountActions.js";
import download from "./download.js";
import genkey from "./genkey.js";
import help from "./help.js";
import hwidreset from "./hwidreset.js";
import { keyinfo, revokekey } from "./keys.js";
import link from "./link.js";
import lookup from "./lookup.js";
import panel from "./panel.js";
import pricing from "./pricing.js";
import redeem from "./redeem.js";
import resetpassword from "./resetpassword.js";
import setup from "./setup.js";
import stats from "./stats.js";
import status from "./status.js";
import unlink from "./unlink.js";

/** Every command, in the order /help lists them. */
export const commands = [
  help,
  redeem,
  account,
  hwidreset,
  resetpassword,
  link,
  unlink,
  pricing,
  download,
  status,
  genkey,
  lookup,
  addtime,
  removetime,
  forcereset,
  ban,
  unban,
  keyinfo,
  revokekey,
  stats,
  panel,
  setup,
];

export const byName = new Map(commands.map((c) => [c.data.name, c]));
