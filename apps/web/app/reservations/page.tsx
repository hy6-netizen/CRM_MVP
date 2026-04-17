import { ReservationBoard } from "../../src/components/reservations/ReservationBoard";
import { reservations } from "../../src/lib/mockStore";

export const dynamic = "force-dynamic";

export default function ReservationsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">예약 보드</h1>
        <p className="text-sm text-slate-500 mt-1">
          상태별 칸반 보드. 카드의 상태 셀렉트로 status 를 바로 변경할 수 있습니다.
          자동 확정은 provider capability 가 명시될 때만 활성화됩니다.
        </p>
      </div>
      <ReservationBoard initial={reservations} />
    </div>
  );
}
