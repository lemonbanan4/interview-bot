import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Clean existing data (order respects FKs)
  await prisma.transcriptItem.deleteMany();
  await prisma.performanceScorecard.deleteMany();
  await prisma.interviewSession.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      email: "liam@cogcoretech.com",
      name: "Liam Högberg",
      subscriptionStatus: "active",
      plan: "pro",
      creditsRemaining: 120,
    },
  });

  const session = await prisma.interviewSession.create({
    data: {
      userId: user.id,
      jobTitle: "Senior Full-Stack Engineer",
      company: "TechCorp Global",
      duration: "38 mins",
      overallScore: 91,
      strengths: [
        "Articulated Next.js App Router edge caching and SSR optimization flawlessly.",
        "Demonstrated strong system architecture knowledge regarding database sharding.",
        "Maintained excellent composure during live debugging queries.",
      ],
      improvements: [
        "Could have mentioned Redis connection pooling earlier during the traffic spike question.",
      ],
      transcripts: {
        create: [
          {
            speaker: "Interviewer",
            text: "Can you walk me through how you scale a Next.js app handling sudden 10x traffic spikes?",
            timestamp: "01:15",
          },
          {
            speaker: "AI Copilot",
            text: "Suggested: Mention Vercel Edge caching, Redis rate-limiting, and Prisma connection pooling.",
            timestamp: "01:18",
          },
          {
            speaker: "Candidate",
            text: "At CogCore, we mitigated sudden traffic spikes by pushing static assets to Edge cache and implementing Redis rate-limiting at the gateway...",
            timestamp: "01:30",
          },
          {
            speaker: "Interviewer",
            text: "Very clean approach. How do you handle database connection exhaustion under that load?",
            timestamp: "02:10",
          },
        ],
      },
      scorecard: {
        create: {
          technicalAccuracy: 94,
          communicationClarity: 89,
          pacingAndConfidence: 90,
        },
      },
    },
  });

  console.log(
    `✅ Database seeded successfully! Created user ID: ${user.id} and session ID: ${session.id}`,
  );
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
