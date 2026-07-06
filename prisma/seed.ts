import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { seedCareerDestinations, validateCareerDestination } from "../lib/game/career-data";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding career destinations...");

  const seeds = seedCareerDestinations();
  let created = 0;

  for (const seed of seeds) {
    const errors = validateCareerDestination(seed);
    if (errors.length > 0) {
      console.error(`Skipping "${seed.displayName}": ${errors.join(", ")}`);
      continue;
    }

    const existing = await prisma.careerDestination.findFirst({
      where: { displayName: seed.displayName },
    });

    if (existing) {
      await prisma.careerDestination.update({
        where: { id: existing.id },
        data: seed,
      });
    } else {
      await prisma.careerDestination.create({
        data: seed,
      });
    }
    created++;
  }

  console.log(`Done. ${created} career destinations seeded.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});