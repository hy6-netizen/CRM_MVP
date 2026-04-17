import { ReservationBoard } from "../../src/components/reservations/ReservationBoard";
import { CreateReservationButton } from "../../src/components/reservations/CreateReservationButton";
import { prisma } from "../../src/lib/db";
import { toReservationRow } from "../../src/lib/viewAdapters";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const rows = await prisma.reservation.findMany({ orderBy: { reservationAt: "asc" }, take: 300 });
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">예약 보드</h1>
          <p className="text-sm text-slate-500 mt-1">
            현재 네이버 예약 공식 API 연동 전이라 <strong>수동 입력 / CSV 임포트</strong> 기반입니다.
            네이버 스마트플레이스에서 예약 발생 시, 운영자가 "수동 예약 추가"로 보드에 등록하세요.
            20분 이상 경과한 확정 예약은 자동으로 <strong>노쇼 위험</strong>으로 전환됩니다.
          </p>
        </div>
        <CreateReservationButton />
      </div>
      <ReservationBoard initial={rows.map(toReservationRow)} />
    </div>
  );
}
