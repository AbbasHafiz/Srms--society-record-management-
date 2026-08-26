import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/** Additive tanker desk users — safe to run without wiping the database. */
export async function upsertTankerUsers(client: PrismaClient = prisma) {
  const passwordHash = await bcrypt.hash("password123", 10);

  const driverEmployee = await client.employee.findFirst({
    where: { employeeCode: "EMP-011" },
  });

  await client.user.upsert({
    where: { email: "tanker@society.local" },
    update: {
      passwordHash,
      name: "Tanker Desk Operator",
      role: "TANKER_OPERATOR",
      isActive: true,
    },
    create: {
      email: "tanker@society.local",
      passwordHash,
      name: "Tanker Desk Operator",
      role: "TANKER_OPERATOR",
    },
  });

  await client.user.upsert({
    where: { email: "driver@society.local" },
    update: {
      passwordHash,
      name: driverEmployee?.name ?? "Tanker Driver",
      role: "TANKER_OPERATOR",
      employeeId: driverEmployee?.id ?? null,
      isActive: true,
    },
    create: {
      email: "driver@society.local",
      passwordHash,
      name: driverEmployee?.name ?? "Tanker Driver",
      role: "TANKER_OPERATOR",
      employeeId: driverEmployee?.id ?? null,
    },
  });

  console.log("Tanker users ready: tanker@society.local, driver@society.local / password123");
}

async function main() {
  await upsertTankerUsers();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
