export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#fbfaf6] px-4 py-12 text-[#2a241e]">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-black">개인정보 처리방침</h1>
        <p className="mt-2 text-sm text-[#706b62]">최종 수정일: 2026년 7월 9일</p>

        <section className="mt-8 space-y-6 text-sm leading-relaxed">
          <div>
            <h2 className="text-lg font-bold">1. 수집하는 개인정보</h2>
            <p className="mt-2 text-[#4a3f35]">
              회원가입 시 이메일 주소와 비밀번호를 수집합니다. 비밀번호는 암호화되어 저장되며, 원문을 저장하지 않습니다.
              게임 플레이를 위해 캐릭터 이름, 나이, 전공 등 사용자가 직접 입력한 정보를 저장합니다.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold">2. 개인정보의 이용 목적</h2>
            <p className="mt-2 text-[#4a3f35]">
              수집된 정보는 게임 계정 관리, 게임 진행 상태 저장, 기록 열람 서비스 제공을 위해서만 사용됩니다.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold">3. 개인정보의 보관 및 파기</h2>
            <p className="mt-2 text-[#4a3f35]">
              회원 탈퇴 시 모든 개인정보는 즉시 삭제됩니다. 게임 기록은 익명화된 형태로 통계 목적으로 보관될 수 있습니다.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold">4. 제3자 제공</h2>
            <p className="mt-2 text-[#4a3f35]">
              개인정보를 제3자에게 제공하지 않습니다. 단, 법령에 의한 요구가 있는 경우 예외로 합니다.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold">5. 문의</h2>
            <p className="mt-2 text-[#4a3f35]">
              개인정보 처리에 관한 문의는 앱 내 설정 메뉴의 문의하기를 통해 연락해 주시기 바랍니다.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
