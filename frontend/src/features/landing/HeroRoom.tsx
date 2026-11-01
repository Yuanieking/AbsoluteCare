export function HeroRoom() {
  return (
    <div
      className="relative min-h-[440px] overflow-hidden bg-room-wall lg:min-h-[590px]"
      role="img"
      aria-label="A calm therapy room"
    >
      <div className="absolute inset-y-0 right-0 w-[55%] bg-room-wall-soft" />
      <div className="absolute top-[10%] right-[18%] size-[180px] rounded-full bg-room-sun" />
      <div className="absolute top-[36%] -left-[20%] h-px w-[130%] -rotate-[22deg] bg-ink/15" />
      <div className="absolute top-[62%] -left-[10%] h-px w-[130%] rotate-[14deg] bg-ink/15" />

      <div className="absolute right-[18%] bottom-[12%] h-[150px] w-[160px] -rotate-[8deg] bg-room-chair">
        <div className="absolute top-[19px] -left-4 h-[14px] w-[176px] -rotate-[12deg] bg-room-chair-rail" />
        <span className="absolute bottom-[-90px] left-[18px] h-[115px] w-[9px] rotate-[11deg] bg-room-leg" />
        <i className="absolute right-[18px] bottom-[-90px] h-[115px] w-[9px] -rotate-[11deg] bg-room-leg" />
      </div>

      <div className="absolute bottom-[18%] left-[14%] -rotate-[8deg]">
        <span className="absolute -top-[48px] left-[4px] block h-[57px] w-[26px] -rotate-[34deg] rounded-[100%_0_100%_0] bg-room-leaf" />
        <span className="absolute -top-[63px] left-[30px] block h-[57px] w-[26px] rotate-[22deg] rounded-[100%_0_100%_0] bg-room-leaf" />
        <span className="absolute -top-[30px] left-[43px] block h-[57px] w-[26px] rotate-[60deg] rounded-[100%_0_100%_0] bg-room-leaf" />
        <b className="absolute -bottom-[43px] left-[22px] h-[46px] w-[42px] bg-room-pot" />
      </div>

      <div className="absolute bottom-[9%] left-[9%] flex w-[190px] flex-col bg-panel px-6 pt-5 pb-4 shadow-[0_17px_30px_rgba(35,83,67,0.12)]">
        <span className="text-[10.5px] font-medium text-eyebrow">Your next step</span>
        <strong className="mt-2 font-display text-[19px] leading-[1.1] font-medium tracking-[-0.03em]">
          One easy request
          <br />
          gets care moving.
        </strong>
      </div>

      <div className="absolute right-[9%] bottom-[7%] font-display text-[14px] leading-tight text-primary lg:left-[61%] lg:right-auto">
        A calmer way to begin
        <br />
        <span className="font-sans text-[10px] font-semibold text-ink-soft">
          AbsoluteCare · Malaybalay
        </span>
      </div>
    </div>
  )
}
