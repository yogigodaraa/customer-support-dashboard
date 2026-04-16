import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seedDemoData() {
  console.log("🌱 Seeding demo data...");

  const adminPasswordHash = await bcrypt.hash("admin123", 12);

  // Create admin user
  const demoUser = await prisma.user.upsert({
    where: { email: "admin@wemoney.com" },
    update: { passwordHash: adminPasswordHash, role: "admin" },
    create: {
      email: "admin@wemoney.com",
      name: "Admin",
      passwordHash: adminPasswordHash,
      role: "admin",
    },
  });

  console.log("✓ Created admin user (admin@wemoney.com / admin123)");

  console.log("✓ Created demo user");

  // Add mock sync logs
  const syncLogs = [
    {
      source: "gmail",
      status: "success" as const,
      message: "Synced 42 contacts",
      lastSync: new Date(Date.now() - 5 * 60 * 1000),
      nextSync: new Date(Date.now() + 5 * 60 * 1000),
    },
    {
      source: "intercom",
      status: "success" as const,
      message: "Synced 156 contacts",
      lastSync: new Date(Date.now() - 5 * 60 * 1000),
      nextSync: new Date(Date.now() + 5 * 60 * 1000),
    },
    {
      source: "luciq",
      status: "success" as const,
      message: "Synced 23 bugs",
      lastSync: new Date(Date.now() - 5 * 60 * 1000),
      nextSync: new Date(Date.now() + 5 * 60 * 1000),
    },
  ];

  for (const log of syncLogs) {
    await prisma.syncLog.create({ data: log });
  }

  console.log("✓ Created sync logs");

  // Add mock cached data
  const mockData = [
    {
      source: "gmail",
      identifier: "john@example.com",
      data: {
        id: "contact_123",
        email: "john@example.com",
        name: "John Doe",
        status: "active",
      },
    },
    {
      source: "intercom",
      identifier: "john@example.com",
      data: {
        id: "user_456",
        email: "john@example.com",
        name: "John Doe",
        custom_attributes: { plan: "pro" },
      },
    },
    {
      source: "luciq",
      identifier: "john@example.com",
      data: {
        id: "bug_789",
        title: "Login page crashes on mobile",
        status: "open",
        email: "john@example.com",
        createdAt: new Date().toISOString(),
      },
    },
    {
      source: "gmail",
      identifier: "user_456",
      data: {
        id: "contact_234",
        email: "sarah@example.com",
        name: "Sarah Smith",
        status: "active",
      },
    },
    {
      source: "intercom",
      identifier: "user_456",
      data: {
        id: "user_567",
        email: "sarah@example.com",
        name: "Sarah Smith",
        custom_attributes: { plan: "starter" },
      },
    },
  ];

  for (const data of mockData) {
    await prisma.cachedData.upsert({
      where: { source_identifier: { source: data.source, identifier: data.identifier } },
      update: { data: data.data },
      create: data,
    });
  }

  console.log("✓ Created mock data for demo searches");

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: demoUser.id,
      action: "search",
      resource: "john@example.com",
      details: { searchType: "email", resultsCount: 3 },
    },
  });

  console.log("✓ Created audit log");
  console.log("\n✅ Demo data seeded successfully!");
  console.log("\n📝 Try searching for:");
  console.log("  - Email: john@example.com");
  console.log("  - Email: sarah@example.com");
}

seedDemoData()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
