import { createPrivateKey, sign } from "node:crypto";
import { connect } from "node:http2";

/**
 * A push to one iPhone through Apple's APNs, with Node's own http2 and crypto (no library).
 * Token auth: a .p8 key from the Apple Developer account (Keys → APNs), in Vercel as
 * `APNS_KEY` (the file's contents) and `APNS_KEY_ID`. Without them nothing is sent and
 * the caller carries on: the app's own poll still finds the result.
 */
const TEAM = "8D6ML34D52";
const TOPIC = "se.sarper.vicolo";

let cached: { jwt: string; at: number } | null = null;

/** Apple wants the same token reused for up to an hour, not a new one per push. */
function authToken(): string | null {
  const keyId = process.env.APNS_KEY_ID;
  const pem = process.env.APNS_KEY?.replace(/\\n/g, "\n");
  if (!keyId || !pem) return null;
  if (cached && Date.now() - cached.at < 40 * 60_000) return cached.jwt;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const iat = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: "ES256", kid: keyId })}.${b64({ iss: TEAM, iat })}`;
  const sig = sign("sha256", Buffer.from(body), { key: createPrivateKey(pem), dsaEncoding: "ieee-p1363" });
  cached = { jwt: `${body}.${sig.toString("base64url")}`, at: Date.now() };
  return cached.jwt;
}

export type Push = { title: string; body: string; data?: Record<string, unknown> };

/** true = Apple took it. `sandbox`: a Debug build (Xcode, Simulator) has a sandbox token. */
export async function sendPush(token: string, push: Push, sandbox = false): Promise<boolean> {
  const jwt = authToken();
  if (!jwt) return false;
  const host = sandbox ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const payload = JSON.stringify({ aps: { alert: { title: push.title, body: push.body }, sound: "default" }, ...push.data });
  return new Promise((resolve) => {
    const session = connect(host);
    const done = (ok: boolean, why?: string) => {
      if (why) console.warn("apns:", why);
      session.close();
      resolve(ok);
    };
    session.on("error", (e) => done(false, e.message));
    const req = session.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": TOPIC,
      "apns-push-type": "alert",
      "content-type": "application/json",
    });
    let status = 0;
    let answer = "";
    req.setTimeout(10_000, () => {
      req.close();
      done(false, "timed out");
    });
    req.on("response", (h) => (status = Number(h[":status"])));
    req.on("data", (c) => (answer += c));
    req.on("end", () => done(status === 200, status === 200 ? undefined : `${status} ${answer}`));
    req.on("error", (e) => done(false, e.message));
    req.end(payload);
  });
}
