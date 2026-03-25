export const GlobeIcon = ({ size = 40 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="2" />
    <path
      d="M6 20H34"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M20 6C23.5 10 24.5 15 24.5 20C24.5 25 23.5 30 20 34"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M20 6C16.5 10 15.5 15 15.5 20C15.5 25 16.5 30 20 34"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);
