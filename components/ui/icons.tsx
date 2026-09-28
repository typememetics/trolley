import type { SVGProps } from "react";

/** Line icons drawn in the text color. Decorative: the button's own label names the action. */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ArrowLeftIcon = () => <Icon><path d="M19 12H5M11 18l-6-6 6-6"/></Icon>;
export const SignOutIcon = () => <Icon><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></Icon>;
export const PencilIcon = () => <Icon><path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></Icon>;
export const CheckIcon = () => <Icon><path d="M20 6 9 17l-5-5"/></Icon>;
export const CloseIcon = () => <Icon><path d="M18 6 6 18M6 6l12 12"/></Icon>;

export const GitHubIcon = () => (
  <Icon fill="currentColor" stroke="none">
    <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/>
  </Icon>
);

export const XIcon = () => (
  <Icon fill="currentColor" stroke="none">
    <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12Z"/>
  </Icon>
);

export const LinkedInIcon = () => (
  <Icon fill="currentColor" stroke="none">
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"/>
  </Icon>
);

export const BlueskyIcon = () => (
  <Icon fill="currentColor" stroke="none">
    <path d="M5.2 2.86C7.95 4.93 10.9 9.13 12 11.4c1.1-2.27 4.05-6.47 6.8-8.54 1.98-1.49 5.2-2.64 5.2 1.03 0 .73-.42 6.15-.67 7.03-.85 3.06-3.97 3.84-6.74 3.37 4.84.82 6.07 3.55 3.41 6.28-5.05 5.18-7.26-1.3-7.82-2.96-.1-.3-.15-.45-.18-.33-.03-.12-.08.03-.18.33-.56 1.66-2.77 8.14-7.82 2.96-2.66-2.73-1.43-5.46 3.41-6.28-2.77.47-5.89-.31-6.74-3.37C.42 10.04 0 4.62 0 3.9 0 .22 3.22 1.37 5.2 2.86Z"/>
  </Icon>
);

export const HackerNewsIcon = () => (
  <Icon fill="currentColor" stroke="none">
    <path d="M0 0v24h24V0Zm13.1 13.55v5.2h-2.2v-5.2L6.75 5.25h2.5L12 10.87l2.75-5.62h2.5Z"/>
  </Icon>
);
