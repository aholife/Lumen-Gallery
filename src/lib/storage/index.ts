import { R2Storage } from "./r2";

// Ensure environment variables are loaded (for scripts running outside Astro)
// In Astro, import.meta.env is available. In Node scripts, we might need process.env
const getEnv = (key: string) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return "";
};

export const storage = new R2Storage({
  accountId: getEnv("R2_ACCOUNT_ID"),
  accessKeyId: getEnv("R2_ACCESS_KEY_ID"),
  secretAccessKey: getEnv("R2_SECRET_ACCESS_KEY"),
  bucket: getEnv("R2_BUCKET_NAME"),
  publicUrl: getEnv("R2_PUBLIC_URL"),
});
