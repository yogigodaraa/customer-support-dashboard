import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!existing) {
    const hash = await bcrypt.hash("admin123", 12);
    await prisma.user.create({
      data: {
        email: "admin@wemoney.com.au",
        name: "Admin",
        passwordHash: hash,
        role: "admin",
      },
    });
    console.log("Seeded admin user: admin@wemoney.com.au / admin123");
  } else {
    console.log("Admin user already exists, skipping seed");
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
