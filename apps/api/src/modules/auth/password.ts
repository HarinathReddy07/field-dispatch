import * as argon2 from 'argon2';

export const hashPassword = (plain: string): Promise<string> => argon2.hash(plain, { type: argon2.argon2id });

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | undefined;
/** Hash verified when the user doesn't exist, so unknown emails cost the same time as wrong passwords. */
export const dummyHash = (): Promise<string> => (dummy ??= hashPassword('not-a-real-password'));
