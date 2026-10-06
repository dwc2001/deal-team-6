import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: P) => (
  <Icon {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Icon>
);
export const PlusIcon = (p: P) => (
  <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
);
export const CloseIcon = (p: P) => (
  <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>
);
export const BackIcon = (p: P) => (
  <Icon {...p}><path d="M15 5l-7 7 7 7" /></Icon>
);
export const ChevronRight = (p: P) => (
  <Icon {...p}><path d="m9 5 7 7-7 7" /></Icon>
);
export const ChevronDown = (p: P) => (
  <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>
);
export const PhoneIcon = (p: P) => (
  <Icon {...p}><path d="M6.6 3.8 8.8 3.5l1.6 4-1.9 1.4a11 11 0 0 0 6.6 6.6l1.4-1.9 4 1.6-.3 2.2a2 2 0 0 1-2.1 1.7C10.4 18.5 5.5 13.6 4.9 5.9a2 2 0 0 1 1.7-2.1Z" /></Icon>
);
export const MailIcon = (p: P) => (
  <Icon {...p}><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m4.5 7 7.5 6 7.5-6" /></Icon>
);
export const CopyIcon = (p: P) => (
  <Icon {...p}><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" /><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></Icon>
);
export const SaveContactIcon = (p: P) => (
  <Icon {...p}><circle cx="10" cy="8.5" r="3.5" /><path d="M3.5 19.5a6.5 6.5 0 0 1 11.2-4.5" /><path d="M18.5 14v6M15.5 17h6" /></Icon>
);
export const EditIcon = (p: P) => (
  <Icon {...p}><path d="M14.5 5.5l4 4L9 19H5v-4l9.5-9.5Z" /><path d="m12.5 7.5 4 4" /></Icon>
);
export const ArchiveIcon = (p: P) => (
  <Icon {...p}><rect x="3.5" y="4.5" width="17" height="4" rx="1.5" /><path d="M5 8.5V18a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18V8.5M10 12.5h4" /></Icon>
);
export const ExternalIcon = (p: P) => (
  <Icon {...p}><path d="M14 5h5v5M19 5l-8 8" /><path d="M17 14v3.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 17.5v-9A1.5 1.5 0 0 1 6.5 7H10" /></Icon>
);
export const CheckIcon = (p: P) => (
  <Icon {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>
);
export const StarIcon = (p: P) => (
  <Icon {...p}><path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6L12 4Z" /></Icon>
);
export const CameraIcon = (p: P) => (
  <Icon {...p}><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" /><circle cx="12" cy="13" r="3.4" /></Icon>
);
export const ImagesIcon = (p: P) => (
  <Icon {...p}><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="m4.5 17 5-4.5 3.5 3 2.5-2 4 3.5" /></Icon>
);
export const DownloadIcon = (p: P) => (
  <Icon {...p}><path d="M12 4.5v11M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14" /></Icon>
);
export const GlobeIcon = (p: P) => (
  <Icon {...p}><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4c2.2 2.3 3.2 5 3.2 8s-1 5.7-3.2 8c-2.2-2.3-3.2-5-3.2-8s1-5.7 3.2-8Z" /></Icon>
);
export const PinIcon = (p: P) => (
  <Icon {...p}><path d="M12 20.5s-6-5.4-6-10.5a6 6 0 0 1 12 0c0 5.1-6 10.5-6 10.5Z" /><circle cx="12" cy="10" r="2.2" /></Icon>
);
export const SunIcon = (p: P) => (
  <Icon {...p}><circle cx="12" cy="12" r="3.8" /><path d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M5.6 18.4l1.3-1.3M17.1 6.9l1.3-1.3" /></Icon>
);
export const MoonIcon = (p: P) => (
  <Icon {...p}><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" /></Icon>
);
export const RestoreIcon = (p: P) => (
  <Icon {...p}><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" /><path d="M4.5 4.5V9H9" /></Icon>
);
export const PeopleIcon = (p: P) => (
  <Icon {...p}><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17 14.2a5 5 0 0 1 3.5 4.8" /></Icon>
);
export const CompsIcon = (p: P) => (
  <Icon {...p}><path d="M4 20V9.5L9.5 6v14M9.5 20V4l10 4v12M3 20h18" /><path d="M12.5 10.5h4M12.5 13.5h4M12.5 16.5h4" /></Icon>
);
export const CalcIcon = (p: P) => (
  <Icon {...p}><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h.01" /></Icon>
);
export const LinkIcon = (p: P) => (
  <Icon {...p}><path d="M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1-1" /></Icon>
);
export const SendIcon = (p: P) => (
  <Icon {...p}><path d="M20 4 10.5 13.5M20 4l-6 16-3.5-6.5L4 10l16-6Z" /></Icon>
);
export const TextIcon = (p: P) => (
  <Icon {...p}><path d="M5 18.5V7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6a2.5 2.5 0 0 1-2.5 2.5H9l-4 2.5Z" /></Icon>
);
export const ToolsIcon = (p: P) => (
  <Icon {...p}><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></Icon>
);
