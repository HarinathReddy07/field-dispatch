/**
 * API base URL. Android emulator reaches the host machine at 10.0.2.2; iOS simulator can use localhost;
 * a physical device needs the host's LAN address. Set EXPO_PUBLIC_API_URL (see docs/runbook.md).
 * Plain HTTP is a local-development setting; a deployable build must use HTTPS/WSS.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000';
