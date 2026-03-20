import {
  ContactRequestSourceType,
  EventParticipantRole,
  EventStatus,
  NotificationType,
  PersonaAccessMode,
  PersonaType,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();
const SEEDED_PASSWORD_HASH =
  "$2b$10$CwTycUXWue0Thq9StjUM0uJ8sJ8fvkgP3Gzdh0dX8GZFODdgNpTi.";

async function main() {
  const now = new Date();
  const liveEventStart = new Date(now.getTime() - 30 * 60 * 1000);
  const liveEventEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const [alice, bob] = await Promise.all([
    prisma.user.upsert({
      where: { email: "alice@dotly.local" },
      update: { passwordHash: SEEDED_PASSWORD_HASH, isVerified: true },
      create: {
        email: "alice@dotly.local",
        passwordHash: SEEDED_PASSWORD_HASH,
        isVerified: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "bob@dotly.local" },
      update: { passwordHash: SEEDED_PASSWORD_HASH, isVerified: false },
      create: {
        email: "bob@dotly.local",
        passwordHash: SEEDED_PASSWORD_HASH,
        isVerified: false,
      },
    }),
  ]);

  const [alicePersona, bobPersona] = await Promise.all([
    prisma.persona.upsert({
      where: { username: "alice-demo" },
      update: {
        userId: alice.id,
        type: PersonaType.PROFESSIONAL,
        publicUrl: "dotly.id/alice-demo",
        fullName: "Alice Demo",
        jobTitle: "Founder",
        companyName: "Dotly",
        tagline: "Building better event networking",
        accessMode: PersonaAccessMode.OPEN,
        verifiedOnly: false,
      },
      create: {
        userId: alice.id,
        type: PersonaType.PROFESSIONAL,
        username: "alice-demo",
        publicUrl: "dotly.id/alice-demo",
        fullName: "Alice Demo",
        jobTitle: "Founder",
        companyName: "Dotly",
        tagline: "Building better event networking",
        accessMode: PersonaAccessMode.OPEN,
        verifiedOnly: false,
      },
    }),
    prisma.persona.upsert({
      where: { username: "bob-demo" },
      update: {
        userId: bob.id,
        type: PersonaType.PROFESSIONAL,
        publicUrl: "dotly.id/bob-demo",
        fullName: "Bob Demo",
        jobTitle: "Designer",
        companyName: "Dotly",
        tagline: "Here to connect with product teams",
        accessMode: PersonaAccessMode.REQUEST,
        verifiedOnly: false,
      },
      create: {
        userId: bob.id,
        type: PersonaType.PROFESSIONAL,
        username: "bob-demo",
        publicUrl: "dotly.id/bob-demo",
        fullName: "Bob Demo",
        jobTitle: "Designer",
        companyName: "Dotly",
        tagline: "Here to connect with product teams",
        accessMode: PersonaAccessMode.REQUEST,
        verifiedOnly: false,
      },
    }),
  ]);

  const event = await prisma.event.upsert({
    where: { slug: "dotly-demo-day" },
    update: {
      name: "Dotly Demo Day",
      description: "Seeded live event for notification testing",
      startsAt: liveEventStart,
      endsAt: liveEventEnd,
      location: "Chennai",
      status: EventStatus.LIVE,
      createdByUserId: alice.id,
    },
    create: {
      name: "Dotly Demo Day",
      slug: "dotly-demo-day",
      description: "Seeded live event for notification testing",
      startsAt: liveEventStart,
      endsAt: liveEventEnd,
      location: "Chennai",
      status: EventStatus.LIVE,
      createdByUserId: alice.id,
    },
  });

  await prisma.eventParticipant.deleteMany({
    where: {
      eventId: event.id,
      userId: { in: [alice.id, bob.id] },
    },
  });

  await prisma.eventParticipant.createMany({
    data: [
      {
        eventId: event.id,
        userId: alice.id,
        personaId: alicePersona.id,
        role: EventParticipantRole.ORGANIZER,
        discoveryEnabled: true,
      },
      {
        eventId: event.id,
        userId: bob.id,
        personaId: bobPersona.id,
        role: EventParticipantRole.ATTENDEE,
        discoveryEnabled: true,
      },
    ],
  });

  await prisma.contactRequest.deleteMany({
    where: {
      OR: [
        { fromUserId: alice.id, toUserId: bob.id },
        { fromUserId: bob.id, toUserId: alice.id },
      ],
    },
  });

  const request = await prisma.contactRequest.create({
    data: {
      fromUserId: alice.id,
      toUserId: bob.id,
      fromPersonaId: alicePersona.id,
      toPersonaId: bobPersona.id,
      sourceType: ContactRequestSourceType.PROFILE,
      status: "PENDING",
      reason: "Would love to connect after the demo.",
    },
  });

  await prisma.notification.deleteMany({
    where: {
      userId: { in: [alice.id, bob.id] },
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: bob.id,
        type: NotificationType.REQUEST_RECEIVED,
        title: "New request",
        body: "Alice Demo requested to connect",
        data: {
          requestId: request.id,
          fromPersonaId: alicePersona.id,
          seedTag: "phase8",
        },
      },
      {
        userId: bob.id,
        type: NotificationType.EVENT_JOINED,
        title: "Event joined",
        body: "You joined Dotly Demo Day",
        data: {
          eventId: event.id,
          personaId: bobPersona.id,
          seedTag: "phase8",
        },
      },
      {
        userId: alice.id,
        type: NotificationType.INSTANT_CONNECT,
        title: "Instant connect",
        body: "You connected instantly with Bob Demo",
        data: {
          targetPersonaId: bobPersona.id,
          seedTag: "phase8",
        },
      },
      {
        userId: alice.id,
        type: NotificationType.SYSTEM,
        title: "Welcome back",
        body: "Phase 8 notification seed is ready.",
        data: {
          seedTag: "phase8",
        },
      },
    ],
  });

  console.log("Seed complete");
  console.log("Users:");
  console.log("- alice@dotly.local / password");
  console.log("- bob@dotly.local / password");
  console.log(`Live event: ${event.name} (${event.slug})`);
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
