import { Router, type IRouter, type Request } from "express";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, categoriesTable, listingsTable, notificationsTable, requestsTable, reuseTransactionsTable, usersTable } from "@workspace/db";
import {
  AcceptRequestParams,
  AcceptRequestResponse,
  CancelRequestParams,
  CancelRequestResponse,
  CreateListingBody,
  CreateListingResponse,
  CreateRequestBody,
  CreateRequestResponse,
  CompleteRequestParams,
  CompleteRequestResponse,
  DeleteListingParams,
  GetAdminStatisticsResponse,
  GetDashboardResponse,
  GetImpactResponse,
  GetListingParams,
  GetListingResponse,
  GetMeResponse,
  ListAdminListingsResponse,
  ListAdminUsersResponse,
  ListCategoriesResponse,
  ListListingsQueryParams,
  ListListingsResponse,
  ListNotificationsResponse,
  ListRequestsQueryParams,
  ListRequestsResponse,
  LoginBody,
  LoginResponse,
  MarkAllNotificationsReadResponse,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
  RegisterBody,
  RegisterResponse,
  RejectRequestParams,
  RejectRequestResponse,
  RemoveAdminListingParams,
  UpdateListingBody,
  UpdateListingParams,
  UpdateListingResponse,
} from "@workspace/api-zod";
import { createToken, getUserFromRequest, hashPassword, requireAuth, userId, verifyPassword } from "../lib/auth";

const router: IRouter = Router();

function publicUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    department: user.department,
    college: user.college,
    profileImageUrl: user.profileImageUrl,
    status: user.status,
    createdAt: user.createdAt,
  };
}

function owner(user: typeof usersTable.$inferSelect) {
  return { id: user.id, fullName: user.fullName, role: user.role, department: user.department };
}

async function listingView(id: number) {
  const [row] = await db
    .select()
    .from(listingsTable)
    .innerJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id))
    .innerJoin(usersTable, eq(listingsTable.ownerId, usersTable.id))
    .where(eq(listingsTable.id, id))
    .limit(1);
  if (!row) return null;
  return {
    id: row.listings.id,
    title: row.listings.title,
    description: row.listings.description,
    category: { id: row.categories.id, name: row.categories.name, slug: row.categories.slug },
    condition: row.listings.condition,
    quantity: row.listings.quantity,
    availableQuantity: row.listings.availableQuantity,
    location: row.listings.location,
    owner: owner(row.users),
    imageUrl: row.listings.imageUrl,
    tags: row.listings.tags,
    department: row.listings.department,
    listingType: row.listings.listingType,
    status: row.listings.status,
    expiryDate: row.listings.expiryDate,
    createdAt: row.listings.createdAt,
    updatedAt: row.listings.updatedAt,
  };
}

async function requestView(id: number) {
  const [row] = await db
    .select()
    .from(requestsTable)
    .innerJoin(listingsTable, eq(requestsTable.listingId, listingsTable.id))
    .innerJoin(usersTable, eq(requestsTable.requesterId, usersTable.id))
    .where(eq(requestsTable.id, id))
    .limit(1);
  if (!row) return null;
  const [ownerUser] = await db.select().from(usersTable).where(eq(usersTable.id, row.requests.ownerId)).limit(1);
  if (!ownerUser) return null;
  return {
    id: row.requests.id,
    listing: { id: row.listings.id, title: row.listings.title, imageUrl: row.listings.imageUrl, listingType: row.listings.listingType },
    requester: owner(row.users),
    owner: owner(ownerUser),
    message: row.requests.message,
    status: row.requests.status,
    createdAt: row.requests.createdAt,
    updatedAt: row.requests.updatedAt,
  };
}

function error(res: any, status: number, message: string) {
  res.status(status).json({ error: message });
}

async function adminOnly(req: Request, res: any): Promise<boolean> {
  const current = await getUserFromRequest(req);
  if (!current || current.role !== "ADMIN") {
    res.status(current ? 403 : 401).json({ error: current ? "Admin access is required." : "Please sign in to continue." });
    return false;
  }
  return true;
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    error(res, 400, "Please check your registration details.");
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email.toLowerCase())).limit(1);
  if (existing[0]) {
    error(res, 409, "An account with that email already exists.");
    return;
  }
  const [created] = await db.insert(usersTable).values({
    fullName: parsed.data.fullName,
    email: parsed.data.email.toLowerCase(),
    passwordHash: hashPassword(parsed.data.password),
    role: parsed.data.role,
    department: parsed.data.department,
    college: parsed.data.college,
  }).returning();
  const response = RegisterResponse.parse({ token: createToken(created), user: publicUser(created) });
  res.status(201).json(response);
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    error(res, 401, "Enter a valid email and password.");
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email.toLowerCase())).limit(1);
  if (!user || user.status !== "ACTIVE" || !verifyPassword(parsed.data.password, user.passwordHash)) {
    error(res, 401, "Those credentials do not match an active account.");
    return;
  }
  res.json(LoginResponse.parse({ token: createToken(user), user: publicUser(user) }));
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    error(res, 401, "Please sign in to continue.");
    return;
  }
  res.json(GetMeResponse.parse(publicUser(user)));
});

router.get("/categories", async (_req, res): Promise<void> => {
  const categories = await db.select().from(categoriesTable).where(eq(categoriesTable.active, "true")).orderBy(asc(categoriesTable.name));
  res.json(ListCategoriesResponse.parse(categories.map(({ id, name, slug }) => ({ id, name, slug }))));
});

router.get("/listings", async (req, res): Promise<void> => {
  const parsed = ListListingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    error(res, 400, "Invalid marketplace filters.");
    return;
  }
  const query = parsed.data;
  const filters = [];
  if (query.search) {
    const pattern = `%${query.search}%`;
    filters.push(or(ilike(listingsTable.title, pattern), ilike(listingsTable.description, pattern), sql`${listingsTable.tags}::text ILIKE ${pattern}`));
  }
  if (query.category) filters.push(or(eq(categoriesTable.slug, query.category), eq(categoriesTable.name, query.category)));
  if (query.condition) filters.push(eq(listingsTable.condition, query.condition));
  if (query.listingType) filters.push(eq(listingsTable.listingType, query.listingType));
  if (query.available !== undefined) filters.push(query.available ? gtAvailable() : sql`${listingsTable.availableQuantity} = 0`);
  if (query.department) filters.push(ilike(listingsTable.department, `%${query.department}%`));
  filters.push(sql`${listingsTable.status} NOT IN ('REMOVED', 'EXPIRED')`);
  const where = and(...filters);
  const order = query.sort === "oldest" ? asc(listingsTable.createdAt) : query.sort === "updated" ? desc(listingsTable.updatedAt) : desc(listingsTable.createdAt);
  const [rows, [{ value: total }]] = await Promise.all([
    db.select().from(listingsTable).innerJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id)).innerJoin(usersTable, eq(listingsTable.ownerId, usersTable.id)).where(where).orderBy(order).limit(query.size).offset(query.page * query.size),
    db.select({ value: count() }).from(listingsTable).innerJoin(categoriesTable, eq(listingsTable.categoryId, categoriesTable.id)).where(where),
  ]);
  const content = rows.map((row) => ({
    id: row.listings.id,
    title: row.listings.title,
    description: row.listings.description,
    category: { id: row.categories.id, name: row.categories.name, slug: row.categories.slug },
    condition: row.listings.condition,
    quantity: row.listings.quantity,
    availableQuantity: row.listings.availableQuantity,
    location: row.listings.location,
    owner: owner(row.users),
    imageUrl: row.listings.imageUrl,
    tags: row.listings.tags,
    department: row.listings.department,
    listingType: row.listings.listingType,
    status: row.listings.status,
    expiryDate: row.listings.expiryDate,
    createdAt: row.listings.createdAt,
    updatedAt: row.listings.updatedAt,
  }));
  res.json(ListListingsResponse.parse({ content, page: query.page, size: query.size, totalElements: Number(total), totalPages: Math.ceil(Number(total) / query.size) }));
});

function gtAvailable() {
  return sql`${listingsTable.availableQuantity} > 0`;
}

router.get("/listings/:id", async (req, res): Promise<void> => {
  const parsed = GetListingParams.safeParse(req.params);
  if (!parsed.success) {
    error(res, 400, "Invalid listing.");
    return;
  }
  const listing = await listingView(parsed.data.id);
  if (!listing) {
    error(res, 404, "Listing not found.");
    return;
  }
  res.json(GetListingResponse.parse(listing));
});

router.post("/listings", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateListingBody.safeParse(req.body);
  if (!parsed.success) {
    error(res, 400, "Please complete all required listing fields.");
    return;
  }
  const current = await getUserFromRequest(req);
  if (!current) {
    error(res, 401, "Please sign in to continue.");
    return;
  }
  const [created] = await db.insert(listingsTable).values({
    title: parsed.data.title,
    description: parsed.data.description,
    categoryId: parsed.data.categoryId,
    condition: parsed.data.condition,
    quantity: parsed.data.quantity,
    location: parsed.data.location,
    listingType: parsed.data.listingType,
    imageUrl: parsed.data.imageUrl ?? null,
    expiryDate: parsed.data.expiryDate ? parsed.data.expiryDate.toISOString().slice(0, 10) : null,
    ownerId: current.id,
    availableQuantity: parsed.data.quantity,
    department: parsed.data.department ?? current.department,
    tags: parsed.data.tags ?? [],
  }).returning();
  const listing = await listingView(created.id);
  res.status(201).json(CreateListingResponse.parse(listing));
});

router.patch("/listings/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateListingParams.safeParse(req.params);
  const parsed = UpdateListingBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    error(res, 400, "Invalid listing update.");
    return;
  }
  const current = await getUserFromRequest(req);
  const [existing] = await db.select().from(listingsTable).where(eq(listingsTable.id, params.data.id)).limit(1);
  if (!existing) {
    error(res, 404, "Listing not found.");
    return;
  }
  if (!current || (existing.ownerId !== current.id && current.role !== "ADMIN")) {
    error(res, 403, "Only the listing owner can edit this item.");
    return;
  }
  const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.quantity !== undefined) {
    updates.availableQuantity = Math.max(0, existing.availableQuantity + parsed.data.quantity - existing.quantity);
  }
  await db.update(listingsTable).set(updates as any).where(eq(listingsTable.id, params.data.id));
  const listing = await listingView(params.data.id);
  res.json(UpdateListingResponse.parse(listing));
});

router.delete("/listings/:id", requireAuth, async (req, res): Promise<void> => {
  const parsed = DeleteListingParams.safeParse(req.params);
  if (!parsed.success) {
    error(res, 400, "Invalid listing.");
    return;
  }
  const current = await getUserFromRequest(req);
  const [existing] = await db.select().from(listingsTable).where(eq(listingsTable.id, parsed.data.id)).limit(1);
  if (!existing) {
    error(res, 404, "Listing not found.");
    return;
  }
  if (!current || (existing.ownerId !== current.id && current.role !== "ADMIN")) {
    error(res, 403, "Only the listing owner can remove this item.");
    return;
  }
  await db.update(listingsTable).set({ status: "REMOVED", updatedAt: new Date() }).where(eq(listingsTable.id, parsed.data.id));
  res.status(204).send();
});

router.get("/requests", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListRequestsQueryParams.safeParse(req.query);
  const current = await getUserFromRequest(req);
  if (!parsed.success || !current) {
    error(res, 401, "Please sign in to view requests.");
    return;
  }
  const filters = parsed.data.view === "incoming" ? eq(requestsTable.ownerId, current.id) : parsed.data.view === "outgoing" ? eq(requestsTable.requesterId, current.id) : or(eq(requestsTable.ownerId, current.id), eq(requestsTable.requesterId, current.id));
  const requestRows = await db.select({ id: requestsTable.id }).from(requestsTable).where(filters).orderBy(desc(requestsTable.createdAt));
  const views = await Promise.all(requestRows.map(({ id }) => requestView(id)));
  res.json(ListRequestsResponse.parse(views.filter(Boolean)));
});

router.post("/requests", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateRequestBody.safeParse(req.body);
  const current = await getUserFromRequest(req);
  if (!parsed.success || !current) {
    error(res, 400, "Please add a message before requesting this item.");
    return;
  }
  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, parsed.data.listingId)).limit(1);
  if (!listing || listing.status !== "AVAILABLE" || listing.availableQuantity < 1) {
    error(res, 409, "This item is no longer available.");
    return;
  }
  if (listing.ownerId === current.id) {
    error(res, 400, "You cannot request your own listing.");
    return;
  }
  const duplicate = await db.select().from(requestsTable).where(and(eq(requestsTable.listingId, listing.id), eq(requestsTable.requesterId, current.id), sql`${requestsTable.status} IN ('PENDING', 'ACCEPTED')`)).limit(1);
  if (duplicate[0]) {
    error(res, 409, "You already have an active request for this item.");
    return;
  }
  const [created] = await db.insert(requestsTable).values({ listingId: listing.id, requesterId: current.id, ownerId: listing.ownerId, message: parsed.data.message }).returning();
  await db.insert(notificationsTable).values({ userId: listing.ownerId, title: "New request received", message: `${current.fullName} requested ${listing.title}.`, type: "REQUEST_RECEIVED" });
  const view = await requestView(created.id);
  res.status(201).json(CreateRequestResponse.parse(view));
});

async function transitionRequest(req: Request, res: any, action: "accept" | "reject" | "cancel" | "complete"): Promise<void> {
  const paramSchema = action === "accept" ? AcceptRequestParams : action === "reject" ? RejectRequestParams : action === "cancel" ? CancelRequestParams : CompleteRequestParams;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = paramSchema.safeParse({ id: Number(rawId) });
  if (!params.success) {
    error(res, 400, "Invalid request.");
    return;
  }
  const id = params.data.id;
  const current = await getUserFromRequest(req);
  const [request] = await db.select().from(requestsTable).where(eq(requestsTable.id, id)).limit(1);
  if (!request || !current) {
    error(res, 404, "Request not found.");
    return;
  }
  const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, request.listingId)).limit(1);
  if (!listing) {
    error(res, 404, "Listing not found.");
    return;
  }
  if (action === "accept") {
    if (request.ownerId !== current.id) {
      error(res, 403, "Only the listing owner can accept this request.");
      return;
    }
    if (request.status !== "PENDING" || listing.availableQuantity < 1) {
      error(res, 409, "This request can no longer be accepted.");
      return;
    }
    await db.transaction(async (tx) => {
      const updated = await tx.update(listingsTable).set({ availableQuantity: sql`${listingsTable.availableQuantity} - 1`, status: sql`CASE WHEN ${listingsTable.availableQuantity} <= 1 THEN 'UNAVAILABLE' ELSE 'AVAILABLE' END`, updatedAt: new Date() }).where(and(eq(listingsTable.id, listing.id), gtAvailable())).returning();
      if (!updated[0]) throw new Error("Listing is no longer available");
      await tx.update(requestsTable).set({ status: "ACCEPTED", updatedAt: new Date() }).where(eq(requestsTable.id, id));
      await tx.insert(notificationsTable).values({ userId: request.requesterId, title: "Your request was accepted", message: `Your request for ${listing.title} was accepted.`, type: "REQUEST_ACCEPTED" });
    });
  } else if (action === "reject") {
    if (request.ownerId !== current.id) {
      error(res, 403, "Only the listing owner can reject this request.");
      return;
    }
    if (request.status !== "PENDING") {
      error(res, 409, "This request has already been resolved.");
      return;
    }
    await db.update(requestsTable).set({ status: "REJECTED", updatedAt: new Date() }).where(eq(requestsTable.id, id));
    await db.insert(notificationsTable).values({ userId: request.requesterId, title: "Request update", message: `Your request for ${listing.title} was not accepted.`, type: "REQUEST_REJECTED" });
  } else if (action === "cancel") {
    if (request.requesterId !== current.id) {
      error(res, 403, "Only the requester can cancel this request.");
      return;
    }
    if (request.status !== "PENDING") {
      error(res, 409, "Only pending requests can be cancelled.");
      return;
    }
    await db.update(requestsTable).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(requestsTable.id, id));
  } else {
    if (request.ownerId !== current.id && request.requesterId !== current.id) {
      error(res, 403, "Only exchange participants can complete this request.");
      return;
    }
    if (request.status === "ACCEPTED") {
      await db.transaction(async (tx) => {
        await tx.update(requestsTable).set({ status: "COMPLETED", updatedAt: new Date() }).where(eq(requestsTable.id, id));
        await tx.insert(reuseTransactionsTable).values({ listingId: request.listingId, requestId: id, ownerId: request.ownerId, requesterId: request.requesterId, listingType: listing.listingType, quantity: 1 });
        await tx.insert(notificationsTable).values({ userId: request.requesterId === current.id ? request.ownerId : request.requesterId, title: "Exchange completed", message: `${listing.title} has been marked as reused.`, type: "EXCHANGE_COMPLETED" });
      });
    } else if (request.status !== "COMPLETED") {
      error(res, 409, "Only accepted requests can be completed.");
      return;
    }
  }
  const view = await requestView(id);
  const schema = action === "accept" ? AcceptRequestResponse : action === "reject" ? RejectRequestResponse : action === "cancel" ? CancelRequestResponse : CompleteRequestResponse;
  res.json(schema.parse(view));
}

router.patch("/requests/:id/accept", requireAuth, (req, res) => transitionRequest(req, res, "accept"));
router.patch("/requests/:id/reject", requireAuth, (req, res) => transitionRequest(req, res, "reject"));
router.patch("/requests/:id/cancel", requireAuth, (req, res) => transitionRequest(req, res, "cancel"));
router.patch("/requests/:id/complete", requireAuth, (req, res) => transitionRequest(req, res, "complete"));

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const current = await getUserFromRequest(req);
  if (!current) {
    error(res, 401, "Please sign in to view notifications.");
    return;
  }
  const notifications = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, current.id)).orderBy(desc(notificationsTable.createdAt));
  res.json(ListNotificationsResponse.parse(notifications));
});

router.patch("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const params = MarkNotificationReadParams.safeParse(req.params);
  const current = await getUserFromRequest(req);
  if (!params.success || !current) {
    error(res, 400, "Invalid notification.");
    return;
  }
  const [notification] = await db.update(notificationsTable).set({ read: true }).where(and(eq(notificationsTable.id, params.data.id), eq(notificationsTable.userId, current.id))).returning();
  if (!notification) {
    error(res, 404, "Notification not found.");
    return;
  }
  res.json(MarkNotificationReadResponse.parse(notification));
});

router.patch("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const current = await getUserFromRequest(req);
  if (!current) {
    error(res, 401, "Please sign in to continue.");
    return;
  }
  await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.userId, current.id));
  res.status(204).send(MarkAllNotificationsReadResponse.parse(undefined));
});

router.get("/dashboard", requireAuth, async (req, res): Promise<void> => {
  const current = await getUserFromRequest(req);
  if (!current) {
    error(res, 401, "Please sign in to continue.");
    return;
  }
  const [myListings, myRequests, incoming, [{ listed }], [{ made }], [{ reused }], [{ active }], [{ pending }]] = await Promise.all([
    db.select({ id: listingsTable.id }).from(listingsTable).where(eq(listingsTable.ownerId, current.id)).orderBy(desc(listingsTable.createdAt)).limit(6),
    db.select({ id: requestsTable.id }).from(requestsTable).where(eq(requestsTable.requesterId, current.id)).orderBy(desc(requestsTable.createdAt)).limit(6),
    db.select({ id: requestsTable.id }).from(requestsTable).where(eq(requestsTable.ownerId, current.id)).orderBy(desc(requestsTable.createdAt)).limit(6),
    db.select({ listed: count() }).from(listingsTable).where(eq(listingsTable.ownerId, current.id)),
    db.select({ made: count() }).from(requestsTable).where(eq(requestsTable.requesterId, current.id)),
    db.select({ reused: count() }).from(reuseTransactionsTable).where(eq(reuseTransactionsTable.requesterId, current.id)),
    db.select({ active: count() }).from(listingsTable).where(and(eq(listingsTable.ownerId, current.id), eq(listingsTable.status, "AVAILABLE"))),
    db.select({ pending: count() }).from(requestsTable).where(and(eq(requestsTable.ownerId, current.id), eq(requestsTable.status, "PENDING"))),
  ]);
  const [incomingCount] = await db.select({ value: count() }).from(requestsTable).where(and(eq(requestsTable.ownerId, current.id), eq(requestsTable.status, "PENDING")));
  const [listingViews, requestViews, incomingViews] = await Promise.all([
    Promise.all(myListings.map(({ id }) => listingView(id))),
    Promise.all(myRequests.map(({ id }) => requestView(id))),
    Promise.all(incoming.map(({ id }) => requestView(id))),
  ]);
  const dashboard = { itemsListed: Number(listed), requestsMade: Number(made), itemsReused: Number(reused), activeListings: Number(active), pendingRequests: Number(pending), incomingRequests: Number(incomingCount?.value ?? 0), myListings: listingViews.filter(Boolean), myRequests: requestViews.filter(Boolean), incoming: incomingViews.filter(Boolean) };
  res.json(GetDashboardResponse.parse(dashboard));
});

router.get("/impact", async (_req, res): Promise<void> => {
  const [[{ itemsReused }], [{ completedExchanges }], [{ donations }], [{ exchanges }]] = await Promise.all([
    db.select({ itemsReused: count() }).from(reuseTransactionsTable),
    db.select({ completedExchanges: count() }).from(requestsTable).where(eq(requestsTable.status, "COMPLETED")),
    db.select({ donations: count() }).from(reuseTransactionsTable).where(eq(reuseTransactionsTable.listingType, "DONATE")),
    db.select({ exchanges: count() }).from(reuseTransactionsTable).where(eq(reuseTransactionsTable.listingType, "EXCHANGE")),
  ]);
  res.json(GetImpactResponse.parse({ itemsReused: Number(itemsReused), completedExchanges: Number(completedExchanges), donations: Number(donations), exchanges: Number(exchanges) }));
});

router.get("/admin/statistics", requireAuth, async (req, res): Promise<void> => {
  if (!(await adminOnly(req, res))) return;
  const [[{ totalUsers }], [{ totalListings }], [{ availableItems }], [{ pendingRequests }], [{ completedExchanges }], [{ totalCategories }]] = await Promise.all([
    db.select({ totalUsers: count() }).from(usersTable),
    db.select({ totalListings: count() }).from(listingsTable).where(sql`${listingsTable.status} <> 'REMOVED'`),
    db.select({ availableItems: count() }).from(listingsTable).where(eq(listingsTable.status, "AVAILABLE")),
    db.select({ pendingRequests: count() }).from(requestsTable).where(eq(requestsTable.status, "PENDING")),
    db.select({ completedExchanges: count() }).from(requestsTable).where(eq(requestsTable.status, "COMPLETED")),
    db.select({ totalCategories: count() }).from(categoriesTable),
  ]);
  res.json(GetAdminStatisticsResponse.parse({ totalUsers: Number(totalUsers), totalListings: Number(totalListings), availableItems: Number(availableItems), pendingRequests: Number(pendingRequests), completedExchanges: Number(completedExchanges), totalCategories: Number(totalCategories) }));
});

router.get("/admin/users", requireAuth, async (req, res): Promise<void> => {
  if (!(await adminOnly(req, res))) return;
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(ListAdminUsersResponse.parse(users.map(publicUser)));
});

router.patch("/admin/users/:id/disable", requireAuth, async (req, res): Promise<void> => {
  if (!(await adminOnly(req, res))) return;
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  await db.update(usersTable).set({ status: "DISABLED", updatedAt: new Date() }).where(eq(usersTable.id, id));
  res.status(204).send();
});

router.get("/admin/listings", requireAuth, async (req, res): Promise<void> => {
  if (!(await adminOnly(req, res))) return;
  const listings = await db.select({ id: listingsTable.id }).from(listingsTable).orderBy(desc(listingsTable.createdAt));
  const views = await Promise.all(listings.map(({ id }) => listingView(id)));
  res.json(ListAdminListingsResponse.parse(views.filter(Boolean)));
});

router.patch("/admin/listings/:id/remove", requireAuth, async (req, res): Promise<void> => {
  if (!(await adminOnly(req, res))) return;
  const params = RemoveAdminListingParams.safeParse(req.params);
  if (!params.success) {
    error(res, 400, "Invalid listing.");
    return;
  }
  await db.update(listingsTable).set({ status: "REMOVED", updatedAt: new Date() }).where(eq(listingsTable.id, params.data.id));
  res.status(204).send();
});

export default router;