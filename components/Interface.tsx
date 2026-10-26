export type IconName =
  | "arrow"
  | "upload"
  | "download"
  | "file"
  | "lock"
  | "link"
  | "clock"
  | "grid"
  | "logout"
  | "search"
  | "copy"
  | "check"
  | "close"
  | "refresh"
  | "shield"
  | "eye"
  | "trash"
  | "plus";
const paths: Record<IconName, React.ReactNode> = {
  arrow: (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H5v18h14V8zm0 0v5h5M8 13h8m-8 4h5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
    </>
  ),
  link: (
    <>
      <path
        d="m10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 9a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-2 2"
        transform="translate(1 1) scale(.9)"
      />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H4v16h6m5-12 4 4-4 4m-6-4h10" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M15 8V3H3v13h5" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6" />
    </>
  ),
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" />
    </>
  ),
  plus: <path d="M12 4v16M4 12h16" />,
};
export function Icon({
  name,
  className = "",
  size = 20,
}: {
  name: IconName;
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon ${className}`}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function Mark() {
  return (
    <svg
      width="34"
      height="38"
      viewBox="0 0 34 38"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m17 1 15 8.5v18L17 36 2 27.5v-18L17 1Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M17 9v18m-7-7 7 7 7-7" stroke="currentColor" strokeWidth="2" />
      <path d="m2 9.5 6 3.3m18 14.7 6 0" stroke="currentColor" />
    </svg>
  );
}
export function TransferGraphic({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`transfer-graphic ${compact ? "compact" : ""}`}
      aria-hidden="true"
    >
      <svg className="transfer-svg" viewBox="0 0 640 520" fill="none">
        <defs>
          <linearGradient
            id={compact ? "core-c" : "core"}
            x1="200"
            y1="120"
            x2="450"
            y2="420"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#5BE7F2" stopOpacity=".3" />
            <stop offset="1" stopColor="#5BE7F2" stopOpacity=".02" />
          </linearGradient>
          <radialGradient id={compact ? "halo-c" : "halo"}>
            <stop stopColor="#32CCDA" stopOpacity=".15" />
            <stop offset="1" stopColor="#32CCDA" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle
          cx="320"
          cy="260"
          r="245"
          fill={`url(#${compact ? "halo-c" : "halo"})`}
        />
        <g stroke="#23434B" strokeWidth="1">
          <ellipse
            cx="320"
            cy="260"
            rx="256"
            ry="112"
            transform="rotate(-28 320 260)"
          />
          <ellipse
            cx="320"
            cy="260"
            rx="256"
            ry="112"
            transform="rotate(28 320 260)"
          />
          <circle cx="320" cy="260" r="185" strokeDasharray="2 9" />
          <path d="M320 15v52m0 386v52M64 260h52m408 0h52M139 79l35 35m292 292 35 35M139 441l35-35m292-292 35-35" />
        </g>
        <g className="orbit-track">
          <circle cx="504" cy="157" r="4" fill="#78EBF2" />
          <circle cx="135" cy="361" r="3" fill="#B4E87B" />
        </g>
        <path
          d="m320 119 113 65v131l-113 65-113-65V184l113-65Z"
          fill="#0B1C23"
          stroke="#467782"
        />
        <path
          d="m320 129 104 60v120l-104 60-104-60V189l104-60Z"
          fill={`url(#${compact ? "core-c" : "core"})`}
          stroke="#5BE7F2"
          strokeOpacity=".2"
        />
        <path d="m207 184 113 66 113-66M320 250v130" stroke="#375E68" />
        <path
          d="m320 119 113 65v131l-113 65-113-65V184l113-65Z"
          stroke="#63E3F0"
          strokeDasharray="36 370"
          className="hex-flow"
        />
        <path
          d="M296 207v-45h29l20 20v25m-20-45v20h20"
          stroke="#9AEFF6"
          strokeWidth="1.8"
        />
        <path
          d="M320 204v71m-18-18 18 18 18-18"
          stroke="#9AEFF6"
          strokeWidth="2"
        />
        <path d="m243 335-79 46H62m335-213 82-47h106" stroke="#3E6570" />
        <circle cx="243" cy="335" r="3" fill="#5BE7F2" />
        <circle cx="397" cy="168" r="3" fill="#5BE7F2" />
        <path d="M48 382h9m530-261h9" stroke="#90A8AE" />
        <text
          x="63"
          y="406"
          fill="#6F929B"
          fontFamily="monospace"
          fontSize="9"
          letterSpacing="2"
        >
          SOURCE / FILE
        </text>
        <text
          x="480"
          y="108"
          fill="#6F929B"
          fontFamily="monospace"
          fontSize="9"
          letterSpacing="2"
        >
          TARGET / LINK
        </text>
        <text
          x="288"
          y="426"
          fill="#6F929B"
          fontFamily="monospace"
          fontSize="9"
          letterSpacing="3"
        >
          DEEPDROP
        </text>
      </svg>
      <div className="graphic-coordinate coordinate-top">
        01 / TRANSFER LAYER
      </div>
      <div className="graphic-coordinate coordinate-bottom">
        FILE → LINK → DESTINATARIO
      </div>
    </div>
  );
}
