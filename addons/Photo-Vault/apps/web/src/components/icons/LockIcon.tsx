export const LockIcon = ({ size = 40 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="10"
      y="18"
      width="20"
      height="16"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M14 18V12C14 8.68629 16.6863 6 20 6C23.3137 6 26 8.68629 26 12V18"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="20" cy="26" r="2" fill="currentColor" />
    <path
      d="M20 28V30"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);
