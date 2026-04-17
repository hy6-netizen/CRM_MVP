"use client";

// 범용 담당자 배정 드롭다운.
// Review / Conversation / Reservation 모두 동일한 PATCH {assigneeId} 패턴을 지원하므로
// entity prop 으로 endpoint 분기만 시킴.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Entity = "reviews" | "conversations" | "reservations";

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "원장",
  manager: "매니저",
  staff: "직원",
  reviewer: "리뷰어",
};

export function AssigneeSelect({
  entity,
  id,
  currentAssigneeId,
  size = "sm",
  onChanged,
}: {
  entity: Entity;
  id: string;
  currentAssigneeId?: string | null;
  size?: "xs" | "sm";
  onChanged?: (assigneeId: string | null) => void;
}) {
  const [users, setUsers] = useState<UserOption[] | null>(null);
  const [value, setValue] = useState<string>(currentAssigneeId ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (users) return;
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.items ?? []))
      .catch(() => setUsers([]));
  }, [users]);

  useEffect(() => {
    setValue(currentAssigneeId ?? "");
  }, [currentAssigneeId]);

  async function change(next: string) {
    setValue(next);
    start(async () => {
      const res = await fetch(`/api/${entity}/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assigneeId: next || null }),
      });
      if (res.ok) {
        onChanged?.(next || null);
        router.refresh();
      }
    });
  }

  const className =
    size === "xs" ? "input py-0.5 text-[10px]" : "input py-1 text-xs";

  return (
    <select className={className} value={value} disabled={pending || !users} onChange={(e) => change(e.target.value)}>
      <option value="">담당자 미지정</option>
      {users?.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name} ({ROLE_LABEL[u.role] ?? u.role})
        </option>
      ))}
    </select>
  );
}
