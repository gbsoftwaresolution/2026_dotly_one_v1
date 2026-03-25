export const EyeOffIcon = ({ size = 40 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 20C8 20 12 12 20 12C28 12 32 20 32 20C32 20 28 28 20 28C12 28 8 20 8 20Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="20" cy="20" r="4" stroke="currentColor" strokeWidth="2" />
    <path
      d="M6 6L34 34"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);
