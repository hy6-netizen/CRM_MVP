import { prisma } from "./db";

export async function recordAudit(entry: {
  actorId?: string | null;
  actorName?: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}) {
  return prisma.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      actorName: entry.actorName ?? null,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      beforeJson: entry.before === undefined ? undefined : (entry.before as object | null),
      afterJson: entry.after === undefined ? undefined : (entry.after as object | null),
    },
  });
}
