import { ReservationBoard } from "../../src/components/reservations/ReservationBoard";
import { CreateReservationButton } from "../../src/components/reservations/CreateReservationButton";
import { CsvImportButton } from "../../src/components/reservations/CsvImportButton";
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
            네이버 스마트플레이스에서 예약 목록을 CSV 로 export 한 뒤 <strong>CSV 임포트</strong> 로 일괄 등록하거나,
            <strong> 수동 예약 추가</strong> 로 단건 입력하세요.
            20분 이상 경과한 확정 예약은 자동으로 <strong>노쇼 위험</strong> 으로 전환됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CsvImportButton />
          <CreateReservationButton />
        </div>
      </div>
      <ReservationBoard initial={rows.map(toReservationRow)} />
    </div>
  );
}
