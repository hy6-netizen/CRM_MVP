import { ReservationBoard } from "../../src/components/reservations/ReservationBoard";
import { CreateReservationButton } from "../../src/components/reservations/CreateReservationButton";
import { CsvImportButton } from "../../src/components/reservations/CsvImportButton";
import { prisma } from "../../src/lib/db";
import { toReservationRow } from "../../src/lib/viewAdapters";

export const dynamic = "force-dynamic";

// 네이버 예약 관리자 페이지 URL. 병원마다 bookingBusinessId 가 다르므로 .env 로 설정.
const NAVER_BOOKING_URL =
  process.env.NAVER_BOOKING_URL ??
  "https://partner.booking.naver.com/bizes/154371/booking-list-view?bookingBusinessId=154371";

export default async function ReservationsPage() {
  const rows = await prisma.reservation.findMany({ orderBy: { reservationAt: "asc" }, take: 300 });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">예약 보드</h1>
          <p className="text-sm text-slate-500 mt-1">
            네이버 예약 이메일은 자동으로 <strong>신규</strong> 컬럼에 들어옵니다.
            확인 후 네이버 예약 관리 페이지에서 <strong>확정 처리</strong>하고,
            이 보드의 카드 상태를 <strong>확정 완료</strong>로 바꿔주세요.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={NAVER_BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
            title="새 탭에서 네이버 예약 관리자 페이지 열기"
          >
            🔗 네이버 예약 관리
          </a>
          <CsvImportButton />
          <CreateReservationButton />
        </div>
      </div>
      <ReservationBoard initial={rows.map(toReservationRow)} />
    </div>
  );
}
