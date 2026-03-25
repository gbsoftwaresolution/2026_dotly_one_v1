export const CreditCardIcon = ({ size = 40 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="4"
      y="10"
      width="32"
      height="20"
      rx="3"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path d="M4 16H36" stroke="currentColor" strokeWidth="2" />
    <path
      d="M8 24H14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);
