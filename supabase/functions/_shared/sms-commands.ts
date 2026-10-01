// Pure SMS command grammar for the owner approval channel. No I/O.
//
//   APPROVE A7K2            YES A7K2 / OK A7K2 / APPROVED A7K2
//   REJECT A7K2 too salesy  NO A7K2 / DENY A7K2 / DECLINE A7K2
//   EDIT A7K2 make it shorter   CHANGE / REVISE / FIX
//   LIST / STATUS / PENDING     what is waiting
//   HELP / ?                    command card
//   STOP / UNSUBSCRIBE / QUIT   pause the channel (carrier keyword)
//   START / UNSTOP              resume
//   anything else               assistant question
//
// A decision without a code is allowed; the caller resolves it only when
// exactly one item is open, otherwise it asks for the code.

export type SmsDecision = "approve" | "reject" | "edit";

export type SmsCommand =
  | { kind: "decision"; decision: SmsDecision; code: string | null; note: string }
  | { kind: "list" }
  | { kind: "help" }
  | { kind: "stop" }
  | { kind: "start" }
  | { kind: "chat"; text: string }
  | { kind: "empty" };

const DECISION_WORDS: Record<string, SmsDecision> = {
  approve: "approve", approved: "approve", yes: "approve", ok: "approve", okay: "approve",
  accept: "approve", go: "approve", ship: "approve",
  reject: "reject", rejected: "reject", no: "reject", deny: "reject", decline: "reject",
  nope: "reject", cancel: "reject",
  edit: "edit", change: "edit", revise: "edit", fix: "edit", tweak: "edit", rewrite: "edit",
};

// Codes always carry at least one digit (see sms_new_decision_code).
const CODE = /^(?=.*[2-9])[A-HJ-NP-Z2-9]{4}$/;

// The code alphabet excludes 0/O and 1/I and always includes a digit, so a
// four-letter word is never mistaken for a code and keyboard confusion cannot
// produce a different valid code.
export function normalizeCode(raw: string): string | null {
  const strict = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return CODE.test(strict) ? strict : null;
}

export function parseSmsCommand(body: string): SmsCommand {
  const text = String(body || "").replace(/\s+/g, " ").trim();
  if (!text) return { kind: "empty" };
  const words = text.split(" ");
  const first = words[0].toLowerCase().replace(/[^a-z?]/g, "");

  if (["stop", "unsubscribe", "quit", "end", "stopall"].includes(first) && words.length === 1) {
    return { kind: "stop" };
  }
  if (["start", "unstop", "resume"].includes(first) && words.length === 1) return { kind: "start" };
  if (["list", "status", "pending", "queue", "what's", "whats"].includes(first) && words.length <= 2) {
    return { kind: "list" };
  }
  if (["help", "?", "commands"].includes(first) && words.length === 1) return { kind: "help" };

  const decision = DECISION_WORDS[first];
  if (decision) {
    const second = words[1] ? normalizeCode(words[1]) : null;
    const rest = words.slice(second ? 2 : 1).join(" ").trim();
    // "yes that looks great" is a chat sentence, not a decision, unless a code
    // is present or the message is a bare word.
    if (!second && rest && !/^(it|this|that|them|all)$/i.test(rest) && decision !== "edit") {
      return { kind: "chat", text };
    }
    return { kind: "decision", decision, code: second, note: rest.slice(0, 1000) };
  }
  // "A7K2 approve" / "A7K2 no" ordering.
  const leading = normalizeCode(words[0]);
  const secondWord = (words[1] || "").toLowerCase().replace(/[^a-z]/g, "");
  if (leading && DECISION_WORDS[secondWord]) {
    return {
      kind: "decision",
      decision: DECISION_WORDS[secondWord],
      code: leading,
      note: words.slice(2).join(" ").slice(0, 1000),
    };
  }
  return { kind: "chat", text: text.slice(0, 1600) };
}

export const HELP_TEXT =
  "Reply APPROVE <code>, REJECT <code> <reason>, or EDIT <code> <what to change>. " +
  "LIST shows what is waiting. Ask a question in plain words to reach your assistant. STOP pauses texts.";

// Twilio splits >160 GSM-7 chars into segments; keep assistant replies tight.
export function clampSms(text: string, max = 900): string {
  const clean = String(text || "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"));
  return (stop > max * 0.6 ? cut.slice(0, stop + 1) : cut).trim() + "…";
}
