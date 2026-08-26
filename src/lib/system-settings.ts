import { prisma } from "@/lib/db";

export async function getSystemSetting(key: string): Promise<string | null> {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  return setting?.value ?? null;
}

export async function getSocietyName(): Promise<string | null> {
  return getSystemSetting("society_name");
}
