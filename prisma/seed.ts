import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Demo event: a lakeside festival in Zürich (Landiwiese).
const CENTER = { lat: 47.3548, lng: 8.5361 };

const POIS = [
  { title: "Main Stage", icon: "🎤", description: "Headliners play here from 18:00. Doors 30 min before each show.", dLat: 0.0012, dLng: 0.0008 },
  { title: "Food Court", icon: "🍔", description: "12 street-food stands: burgers, ramen, falafel, vegan options.", dLat: -0.0006, dLng: 0.0015 },
  { title: "Beer Garden", icon: "🍺", description: "Local craft beer and soft drinks. Returnable cup deposit CHF 2.", dLat: -0.001, dLng: 0.0004 },
  { title: "Info Point", icon: "ℹ️", description: "Lost & found, day programs, accessibility support.", dLat: 0.0002, dLng: -0.0009 },
  { title: "First Aid", icon: "⛑️", description: "Staffed 24/7 during the festival. Emergencies: call 144.", dLat: 0.0007, dLng: -0.0014 },
  { title: "Toilets North", icon: "🚻", description: "Accessible toilets and baby changing table available.", dLat: 0.0016, dLng: -0.0002 },
  { title: "Toilets South", icon: "🚻", description: "Near the food court.", dLat: -0.0014, dLng: 0.0011 },
  { title: "Water Refill Station", icon: "💧", description: "Free tap water — bring your bottle.", dLat: 0.0004, dLng: 0.0018 },
  { title: "Merch Stand", icon: "🛍️", description: "Festival shirts, posters and artist merch. Cards accepted.", dLat: -0.0003, dLng: -0.0016 },
  { title: "Main Entrance", icon: "🚪", description: "Ticket scan and bag check. Re-entry allowed with wristband.", dLat: -0.0018, dLng: -0.0006 },
];

async function main() {
  // orgId is a placeholder here: with AUTH_STORAGE=memory the real Better Auth
  // organization is created on every server boot, and src/instrumentation.ts
  // re-points this row at it. Never overwrite orgId from the seed.
  const team = await prisma.team.upsert({
    where: { slug: "demo-team" },
    update: {},
    create: {
      slug: "demo-team",
      name: "Demo Team",
      orgId: "seed-placeholder-org",
    },
  });

  let map = await prisma.event.findFirst({
    where: { teamId: team.id, name: "Lakeside Festival 2026" },
  });
  map ??= await prisma.event.create({
    data: {
      teamId: team.id,
      name: "Lakeside Festival 2026",
      slug: "lakeside-festival-2026",
      description: "Three days of music on the Zürich lakeshore.",
      centerName: "Landiwiese, Zürich",
      centerLat: CENTER.lat,
      centerLng: CENTER.lng,
      zoom: 16,
      published: true,
    },
  });

  // Recreate POIs so re-running the seed yields a clean, known state.
  await prisma.pointOfInterest.deleteMany({ where: { mapId: map.id } });
  await prisma.pointOfInterest.createMany({
    data: POIS.map(({ title, icon, description, dLat, dLng }) => ({
      mapId: map.id,
      title,
      icon,
      description,
      lat: CENTER.lat + dLat,
      lng: CENTER.lng + dLng,
    })),
  });

  console.log(
    `Seeded team "demo-team" with map "${map.name}" and ${POIS.length} POIs.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
