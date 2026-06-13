import protobuf from "protobufjs";
import OTPAuth from "otpauth";
import sharp from "sharp";
import jsQR from "jsqr";

export async function imageUrlToOtpUri(url: string) {
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());

  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);

  if (!code) throw new Error("No QR found");

  return code.data;
}

export interface OTPCredentials {
  secret: string;
  name: string;
  issuer: string;
}




const SCHEMA = `
syntax = "proto3";

message MigrationPayload {
  repeated OTPParameters otp_parameters = 1;

  message OTPParameters {
    bytes secret = 1;
    string name = 2;
    string issuer = 3;
    int32 algorithm = 4;
    int32 digits = 5;
    int32 type = 6;
    int32 counter = 7;
  }
}
`;

function base64UrlToBuffer(data: string) {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
  return Buffer.from(padded, "base64");
}

function uint8ToBase32(bytes: Uint8Array) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

async function decode(data: string) {
  const root = protobuf.parse(SCHEMA).root;
  const Payload = root.lookupType("MigrationPayload");

  const buf = base64UrlToBuffer(data);
  const decoded: any = Payload.decode(buf);

  const accounts =
    decoded.otp_parameters ||
    decoded.otpParameters ||
    [];

  return Array.isArray(accounts) ? accounts : [accounts];
}


export async function migrationToCredentials(uri: string) {
  const data = new URL(uri).searchParams.get("data");
  if (!data) throw new Error("missing data");

  let accounts = await decode(data) as {
    secret: Uint8Array;
    name: string;
    issuer: string;
  }[];
  accounts = accounts.filter((acc) => acc.name.includes("@student.bham.ac.uk"));

  if (!accounts.length) {
    throw new Error("No OTP accounts found in payload");
  }

  if (accounts.length > 1) {
    throw new Error("Multiple OTP accounts found in payload, please only export one");
  }

  const account = accounts[0];

  const secretBase32 = uint8ToBase32(account.secret);

  const credentials: OTPCredentials = {
    secret: secretBase32,
    name: account.name,
    issuer: account.issuer,
  };

  return credentials;
}

export function generateOTP(credentials: OTPCredentials): string {

  const totp = new OTPAuth.TOTP({
    issuer: credentials.issuer || "",
    label: credentials.name || "",
    algorithm: "SHA1",
    digits: 6,
    period: 30, // IMPORTANT
    secret: OTPAuth.Secret.fromBase32(credentials.secret),
  });

  return totp.generate();
}

export async function otpImageToCredentials(url: string) {
  const uri = await imageUrlToOtpUri(url);
  return migrationToCredentials(uri);
}
