export type LoginState = { status: "idle" } | { status: "error"; code: string };

export type ResetState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; code: string };
