import { and, count, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  categoriesTable,
  listingsTable,
  notificationsTable,
  requestsTable,
  usersTable,
} from "@workspace/db";
import { hashPassword } from "./auth";
import { logger } from "./logger";

const categories = [
  ["Electronics", "electronics"],
  ["Books", "books"],
  ["Lab Equipment", "lab-equipment"],
  ["Project Materials", "project-materials"],
  ["Stationery", "stationery"],
  ["Tools", "tools"],
  ["Event Materials", "event-materials"],
  ["Furniture", "furniture"],
  ["Cables & Accessories", "cables-accessories"],
  ["Other", "other"],
] as const;

export async function ensureSeedData(): Promise<void> {
  const [{ value: categoryCount }] = await db.select({ value: count() }).from(categoriesTable);
  if (Number(categoryCount) === 0) {
    await db.insert(categoriesTable).values(categories.map(([name, slug]) => ({ name, slug })));
  }

  const [{ value: userCount }] = await db.select({ value: count() }).from(usersTable);
  if (Number(userCount) > 0) return;

  const passwordHash = hashPassword("CampusLoop123!");
  const seededUsers = await db
    .insert(usersTable)
    .values([
      { fullName: "Aarav Mehta", email: "student@example.com", passwordHash, role: "STUDENT", department: "Computer Science", college: "Northbridge University" },
      { fullName: "Maya Iyer", email: "maya@example.com", passwordHash, role: "STUDENT", department: "Electrical Engineering", college: "Northbridge University" },
      { fullName: "Robotics Club", email: "organization@example.com", passwordHash, role: "ORGANIZATION", department: "Student Activities", college: "Northbridge University" },
      { fullName: "Campus Admin", email: "admin@example.com", passwordHash, role: "ADMIN", department: "Administration", college: "Northbridge University" },
    ])
    .returning();

  const seededCategories = await db.select().from(categoriesTable);
  const categoryId = (slug: string) => seededCategories.find((category) => category.slug === slug)!.id;
  const student = seededUsers[0];
  const organization = seededUsers[2];

  const seededListings = await db
    .insert(listingsTable)
    .values([
      { title: "ESP32 Development Board", description: "Two working boards from an IoT studio project. Includes headers and USB cables.", categoryId: categoryId("electronics"), condition: "GOOD", quantity: 2, availableQuantity: 2, location: "CSE Lab 2", ownerId: student.id, tags: ["ESP32", "IoT", "microcontroller"], department: "Computer Science", listingType: "DONATE" },
      { title: "Arduino Uno Starter Kit", description: "A complete starter kit with an Uno, jumper wires, and a small breadboard.", categoryId: categoryId("electronics"), condition: "LIKE_NEW", quantity: 1, availableQuantity: 1, location: "Innovation Hub", ownerId: organization.id, tags: ["Arduino", "starter kit"], department: "Student Activities", listingType: "EXCHANGE" },
      { title: "Ultrasonic Sensor Pack", description: "Five HC-SR04 sensors left over from the robotics club build night.", categoryId: categoryId("electronics"), condition: "GOOD", quantity: 5, availableQuantity: 5, location: "Robotics Club Room", ownerId: organization.id, tags: ["sensor", "robotics"], department: "Student Activities", listingType: "DONATE" },
      { title: "Engineering Mathematics Vol. 2", description: "Lightly used reference book with clean pages and helpful margin notes.", categoryId: categoryId("books"), condition: "USED", quantity: 1, availableQuantity: 1, location: "Library foyer", ownerId: student.id, tags: ["maths", "engineering"], department: "Computer Science", listingType: "DONATE" },
      { title: "Signals & Systems Textbook", description: "Good condition textbook, ideal for second-year EE students.", categoryId: categoryId("books"), condition: "GOOD", quantity: 1, availableQuantity: 1, location: "EE Department Office", ownerId: seededUsers[1].id, tags: ["signals", "EE"], department: "Electrical Engineering", listingType: "EXCHANGE" },
      { title: "Large Breadboard Pack", description: "Ten full-size breadboards and a bundle of jumper wires for project teams.", categoryId: categoryId("project-materials"), condition: "GOOD", quantity: 10, availableQuantity: 10, location: "Makerspace", ownerId: organization.id, tags: ["breadboard", "wires"], department: "Student Activities", listingType: "DONATE" },
      { title: "Clean Cardboard Sheets", description: "Flat, clean sheets from the design showcase installation.", categoryId: categoryId("project-materials"), condition: "GOOD", quantity: 20, availableQuantity: 20, location: "Design Studio", ownerId: student.id, tags: ["cardboard", "model making"], department: "Computer Science", listingType: "DONATE" },
      { title: "Benchtop Power Supply", description: "Adjustable DC supply, tested and ready for a new lab bench.", categoryId: categoryId("lab-equipment"), condition: "GOOD", quantity: 1, availableQuantity: 1, location: "Electronics Lab", ownerId: seededUsers[1].id, tags: ["power supply", "lab"], department: "Electrical Engineering", listingType: "EXCHANGE" },
      { title: "Event Poster Board Set", description: "Reusable foam boards with clips and stands for student events.", categoryId: categoryId("event-materials"), condition: "LIKE_NEW", quantity: 6, availableQuantity: 6, location: "Student Union storage", ownerId: organization.id, tags: ["event", "poster"], department: "Student Activities", listingType: "DONATE" },
      { title: "Precision Screwdriver Set", description: "Compact set for electronics repair and prototyping.", categoryId: categoryId("tools"), condition: "LIKE_NEW", quantity: 1, availableQuantity: 1, location: "Makerspace", ownerId: student.id, tags: ["tools", "repair"], department: "Computer Science", listingType: "EXCHANGE" },
    ])
    .returning();

  const esp32 = seededListings[0];
  const arduino = seededListings[1];
  await db.insert(requestsTable).values([
    { listingId: esp32.id, requesterId: seededUsers[1].id, ownerId: student.id, message: "I need this for my embedded systems lab and can collect it from CSE Lab 2.", status: "PENDING" },
    { listingId: arduino.id, requesterId: student.id, ownerId: organization.id, message: "Happy to exchange a spare motor driver from our project kit.", status: "ACCEPTED" },
  ]);
  await db.insert(notificationsTable).values([
    { userId: student.id, title: "New request on your ESP32 listing", message: "Maya Iyer sent a request for your ESP32 Development Board.", type: "REQUEST_RECEIVED", read: false },
    { userId: student.id, title: "Welcome to CampusLoop", message: "List one useful item this week and keep campus resources moving.", type: "WELCOME", read: false },
  ]);
  logger.info("CampusLoop demo data is ready");
}