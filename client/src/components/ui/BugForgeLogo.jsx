export default function BugForgeLogo({ className = 'w-8 h-8' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="BugForge"
    >
      <path d="M16 2L28 9V23L16 30L4 23V9L16 2Z" fill="#4F46E5" />
      <path d="M19 8L13 17H17L13 24L21 14H17L19 8Z" fill="white" />
    </svg>
  );
}
