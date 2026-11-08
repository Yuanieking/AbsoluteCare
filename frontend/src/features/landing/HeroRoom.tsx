export function HeroRoom() {
  return (
    <figure className="care-room" aria-labelledby="care-room-caption">
      <svg viewBox="0 0 600 570" fill="none" role="img" aria-labelledby="care-room-title">
        <title id="care-room-title">An illustration of a sunlit therapy room with a treatment table, exercise equipment, and a plant</title>
        <defs>
          <clipPath id="care-room-window">
            <path d="M321 97a78 78 0 0 1 156 0v184H321V97Z" />
          </clipPath>
        </defs>
        <path fill="#dce6da" d="M0 0h600v570H0z" />
        <path fill="#cbdacb" d="m0 375 600-55v250H0z" />
        <path fill="#eaf0e5" d="M0 0h262v351L0 375V0Z" />
        <path stroke="#b1c5b3" strokeWidth="2" d="m0 375 262-24 338-31M262 0v351" />
        <path fill="#b4c8b7" d="M309 97a90 90 0 0 1 180 0v196H309V97Z" />
        <g clipPath="url(#care-room-window)">
          <path fill="#f8f5df" d="M321 0h156v281H321z" />
          <circle cx="438" cy="99" r="35" fill="#e7d594" />
          <path fill="#ceddbd" d="M301 222c54-74 103-89 192-42v123H301z" />
          <path fill="#aec7a8" d="M301 259c46-44 107-67 192-25v69H301z" />
          <path stroke="#fffefb" strokeWidth="7" d="M399 15v270m-80-113h160" />
        </g>
        <path fill="#f5f4e9" d="M301 281h196v12H301z" />
        <path fill="#fffefb" fillOpacity=".35" d="m321 293 156-1 123 149-162 17z" />
        <ellipse cx="300" cy="469" rx="198" ry="39" fill="#b3c5b2" />
        {/* Wall-mounted exercise bars belong to the room, rather than decorating the page. */}
        <path fill="#8d9f86" d="m63 133 10-1v173l-10 1zm118-11 10-1v173l-10 1z" />
        {[151, 181, 211, 241, 271].map((y) => (
          <g key={y}>
            <path d={`m69 ${y} 116-11`} stroke="#b09b70" strokeWidth="10" strokeLinecap="round" />
            <path d={`m69 ${y - 2} 116-11`} stroke="#d4c3a0" strokeWidth="3" strokeLinecap="round" />
          </g>
        ))}
        {/* Treatment table: upholstered top, frame, and grounded legs. */}
        <path fill="#526f5a" d="m167 372 12-2v103l-12 3zm225-22 12-1v104l-12 3z" />
        <path fill="#6c876e" d="m236 406 12-2v97l-12 3zm222-27 12-2v99l-12 3z" />
        <path stroke="#6c876e" strokeWidth="7" d="m178 451 217-26m-148 55 213-25" />
        <path fill="#78957c" d="m151 350 246-29 91 52-245 35-92-58z" />
        <path fill="#52705c" d="m151 350 92 58v18l-92-56z" />
        <path fill="#64836a" d="m243 408 245-35v19l-245 34z" />
        <path fill="#fffefb" d="m148 327 245-28c5-1 10 0 14 3l79 45c9 5 7 17-3 19l-238 34c-5 1-10 0-14-3l-84-49c-9-5-8-19 1-21z" />
        <path fill="#dce5d8" d="m147 342 84 49c4 3 9 4 14 3l238-34c4-1 7-3 9-6 1 6-2 11-9 12l-238 34c-5 1-10 0-14-3l-84-49c-4-3-7-7-6-11 1 2 3 4 6 5z" />
        <path fill="#dae3d3" d="m159 323 59-7 83 48-61 9z" />
        <path fill="#edf0e5" d="m170 315 45-5c3 0 5 0 7 2l40 23c5 3 4 9-2 10l-43 6c-3 1-6 0-8-1l-40-24c-5-3-4-10 1-11z" />
        <path fill="#b5c8ae" d="m324 312 49-6 68 39-49 7z" />
        <path stroke="#91ab8d" strokeWidth="2" d="m333 316 48 28m-37-29 48 28m-37-29 48 28m-37-29 48 28" />
        {/* Storage and exercise equipment. */}
        <path fill="#9caf91" d="m45 386 62-7 39 24-63 9z" />
        <path fill="#a9bc9e" d="m45 386 38 26v65l-38-26z" />
        <path fill="#8ba480" d="m83 412 63-9v65l-63 9z" />
        <path stroke="#6e8d68" strokeWidth="2" d="m83 441 63-9" />
        <path stroke="#55734e" strokeWidth="3" strokeLinecap="round" d="m107 423 15-2m-15 31 15-2" />
        <path fill="#e8e8d7" d="m56 378 43-5 31 17-44 6z" />
        <path fill="#f7f6e9" d="m57 369 43-5 31 18-44 6z" />
        <circle cx="520" cy="439" r="38" fill="#9caf71" />
        <path d="M495 412c-14 19-9 46 14 58" stroke="#b8c78d" strokeWidth="5" strokeLinecap="round" />
        {/* A potted plant softens the treatment space. */}
        <ellipse cx="525" cy="354" rx="28" ry="9" fill="#b7c7ad" />
        <path fill="#e5ddc3" d="m502 317 46-3-8 39c-7 8-23 9-30 1z" />
        <ellipse cx="525" cy="316" rx="23" ry="8" fill="#b7b598" />
        <path stroke="#68865c" strokeWidth="4" d="M525 319v-86m0 58-23-31m23 16 24-32" />
        <path fill="#6d8e60" d="M525 264c-25-5-34-21-30-43 23 6 33 21 30 43Z" />
        <path fill="#829e6d" d="M526 251c-4-26 7-46 29-52 3 25-7 43-29 52Z" />
        <path fill="#6d8e60" d="M526 290c10-24 25-32 45-28-8 22-23 31-45 28Z" />
        <path fill="#829e6d" d="M520 303c-25 0-43-12-46-34 24 1 40 12 46 34Z" />
      </svg>
      <figcaption id="care-room-caption" className="care-room-caption">
        <span>Room to move.<br />Space to grow.</span>
        <span className="care-room-note">Physical therapy & pediatric OT<br />Malaybalay City, Bukidnon</span>
      </figcaption>
    </figure>
  )
}
